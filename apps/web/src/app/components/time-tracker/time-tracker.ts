import { Component, computed, DestroyRef, ElementRef, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucidePlay, LucidePlus, LucideSquare } from '@lucide/angular';
import { interval } from 'rxjs';
import { TimeEntry, TimeEntriesService } from '../../services/time-entries.service';
import { Button } from '../button/button';
import { Card } from '../card/card';
import { Task, TasksService } from '../../services/tasks.service';
import { CreateTask } from '../create-task/create-task';

@Component({
  selector: 'app-time-tracker',
  imports: [Button, LucidePlay, LucidePlus, LucideSquare, Card, CreateTask],
  templateUrl: './time-tracker.html',
  host: {
    class: 'relative',
    '(document:click)': 'onOutsideClick($event)',
    '(keydown.escape)': 'expanded.set(false)',
    '(focusout)': 'onFocusOut($event)',
  },
})
export class TimeTracker implements OnInit {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly tasksService = inject(TasksService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly entries = inject(TimeEntriesService);
  private readonly now = signal(Date.now());
  protected readonly activeEntry = signal<TimeEntry | null>(null);
  protected readonly pending = signal(false);
  protected readonly restoring = signal(true);
  protected readonly actionError = signal<string | null>(null);
  private readonly elapsedMs = computed(() => {
    const active = this.activeEntry();
    return active ? Math.max(0, this.now() - Date.parse(active.startedAt)) : 0;
  });
  protected readonly elapsed = computed(() => {
    const seconds = Math.floor(this.elapsedMs() / 1000);
    return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
      .map((value) => String(value).padStart(2, '0'))
      .join(':');
  });
  protected readonly earnings = computed(() => {
    const active = this.activeEntry();
    if (!active) return '$0';
    const formatter = new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: active.currency,
      currencyDisplay: 'narrowSymbol',
    });
    const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    const [whole, fraction = ''] = active.hourlyRate.split('.');
    const rate = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'));
    const denominator = 3600000n * 10n ** BigInt(6 - digits);
    const minorUnits = (BigInt(this.elapsedMs()) * rate + denominator / 2n) / denominator;
    const scale = 10n ** BigInt(digits);
    const amount =
      digits === 0
        ? minorUnits.toString()
        : `${minorUnits / scale}.${(minorUnits % scale).toString().padStart(digits, '0')}`;
    // Intl supports exact decimal strings; TypeScript still declares a numeric input.
    return formatter.format(amount as unknown as number);
  });
  protected readonly tasks = signal<Task[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly expanded = signal(false);
  protected readonly description = signal('');
  protected readonly showCreateTask = signal(false);
  protected readonly filteredTasks = computed(() => {
    const search = this.description().trim().toLocaleLowerCase();
    return this.tasks().filter((task) => task.title.toLocaleLowerCase().includes(search));
  });

  ngOnInit() {
    this.restore();
    interval(100)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.now.set(Date.now()));
  }

  private restore() {
    this.restoring.set(true);
    this.entries
      .active()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ timeEntry: active }) => {
          this.activeEntry.set(active);
          if (active) this.description.set(active.description ?? active.taskTitle ?? '');
          this.now.set(Date.now());
          this.restoring.set(false);
        },
        error: () => {
          this.restoring.set(false);
          this.actionError.set('Unable to check the active timer. Please reload before starting.');
        },
      });
  }

  protected startTask(task: Task) {
    if (this.pending() || this.restoring() || this.activeEntry() || this.actionError()) return;
    this.pending.set(true);
    this.entries
      .start({
        projectId: task.projectId,
        taskId: task.id,
        description: task.title,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ timeEntry }) => {
          this.activeEntry.set(timeEntry);
          this.description.set(task.title);
          this.now.set(Date.now());
          this.expanded.set(false);
          this.pending.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.pending.set(false);
          this.expanded.set(false);
          this.actionError.set(
            error.status === 409
              ? 'A timer may already be running. Reload to synchronize.'
              : 'Unable to start the timer. Please try again.',
          );
        },
      });
  }

  protected stop() {
    if (!this.activeEntry() || this.pending()) return;
    this.pending.set(true);
    this.actionError.set(null);
    this.entries
      .stop()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.activeEntry.set(null);
          this.description.set('');
          this.pending.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.pending.set(false);
          this.actionError.set('Unable to stop the timer. Please try again.');
          if (error.status === 404) this.restore();
        },
      });
  }

  protected retryTimer() {
    this.actionError.set(null);
    this.restore();
  }

  protected open() {
    if (
      this.expanded() ||
      this.showCreateTask() ||
      this.activeEntry() ||
      this.pending() ||
      this.restoring() ||
      this.actionError()
    )
      return;
    this.expanded.set(true);
    if (!this.loading()) this.loadTasks();
  }

  protected loadTasks() {
    this.loading.set(true);
    this.error.set(null);
    this.tasksService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ tasks }) => {
          this.tasks.set(tasks);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Unable to load tasks. Please try again.');
          this.loading.set(false);
        },
      });
  }

  protected onOutsideClick(event: MouseEvent) {
    if (!this.element.nativeElement.contains(event.target as Node)) {
      this.expanded.set(false);
    }
  }

  protected openCreateTask() {
    this.expanded.set(false);
    this.showCreateTask.set(true);
  }

  protected onTaskCreated(task: Task) {
    this.tasks.update((tasks) => [task, ...tasks.filter((item) => item.id !== task.id)]);
    this.showCreateTask.set(false);
  }

  protected onFocusOut(event: FocusEvent) {
    if (!this.element.nativeElement.contains(event.relatedTarget as Node | null)) {
      this.expanded.set(false);
    }
  }
}
