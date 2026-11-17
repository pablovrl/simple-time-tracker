import { Component, computed, DestroyRef, ElementRef, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucidePlay, LucideSquare } from '@lucide/angular';
import { interval } from 'rxjs';
import { Task, TasksService } from '../../services/tasks.service';
import { TimeEntry, TimeEntriesService } from '../../services/time-entries.service';
import { MoneyPipe } from '../../pipes/money.pipe';

@Component({
  selector: 'app-time-tracker',
  imports: [LucidePlay, LucideSquare, MoneyPipe],
  templateUrl: './time-tracker.html',
  host: {
    class: 'relative block',
    '(document:click)': 'onOutsideClick($event)',
    '(keydown.escape)': 'expanded.set(false)',
    '(focusout)': 'onFocusOut($event)',
  },
})
export class TimeTracker implements OnInit {
  private readonly service = inject(TasksService);
  private readonly entries = inject(TimeEntriesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly expanded = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly description = signal('');
  protected readonly activeEntry = signal<TimeEntry | null>(null);
  protected readonly restoring = signal(true);
  protected readonly pending = signal(false);
  protected readonly actionError = signal<string | null>(null);
  private readonly now = signal(Date.now());
  private readonly elapsedMs = computed(() => this.calculateElapsedMs());
  protected readonly elapsed = computed(() => this.formatElapsed());
  protected readonly amount = computed(() => this.calculateAmount());
  private readonly tasks = signal<Task[]>([]);
  protected readonly filteredTasks = computed(() => this.filterTasks());

  ngOnInit() {
    this.restore();
    interval(250)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.now.set(Date.now());
      });
  }

  protected restore() {
    if (this.pending()) return;
    this.restoring.set(true);
    this.expanded.set(false);
    this.actionError.set(null);
    this.entries
      .active()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ timeEntry }) => {
          this.activeEntry.set(timeEntry);
          this.description.set(timeEntry?.description ?? timeEntry?.taskTitle ?? '');
          this.now.set(Date.now());
          this.restoring.set(false);
        },
        error: () => {
          this.restoring.set(false);
          this.actionError.set('unable to check the active timer. please try again.');
        },
      });
  }

  protected open() {
    if (
      this.expanded() ||
      this.restoring() ||
      this.pending() ||
      this.activeEntry() ||
      this.actionError()
    )
      return;
    this.expanded.set(true);
    this.loadTasks();
  }

  protected loadTasks() {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(false);
    this.service
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ tasks }) => {
          this.tasks.set(tasks);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  protected select(task: Task) {
    if (this.restoring() || this.pending() || this.activeEntry() || this.actionError()) return;
    this.pending.set(true);
    this.expanded.set(false);
    this.element.nativeElement.querySelector('input')?.focus();
    this.entries
      .start({ taskId: task.id, description: task.title })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ timeEntry }) => {
          this.activeEntry.set(timeEntry);
          this.description.set(task.title);
          this.now.set(Date.now());
          this.pending.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.pending.set(false);
          if (error.status === 409) {
            this.restore();
          } else {
            this.actionError.set(
              'unable to start the timer. check its status before trying again.',
            );
          }
        },
      });
  }

  protected stop() {
    if (!this.activeEntry() || this.pending() || this.restoring()) return;
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
          if (error.status === 404) {
            this.restore();
          } else {
            this.actionError.set('unable to stop the timer. please try again.');
          }
        },
      });
  }

  protected onOutsideClick(event: MouseEvent) {
    if (!this.element.nativeElement.contains(event.target as Node)) this.expanded.set(false);
  }

  protected onFocusOut(event: FocusEvent) {
    if (!this.element.nativeElement.contains(event.relatedTarget as Node | null)) {
      this.expanded.set(false);
    }
  }

  private calculateElapsedMs() {
    const entry = this.activeEntry();
    return entry ? Math.max(0, this.now() - Date.parse(entry.startedAt)) : 0;
  }

  private formatElapsed() {
    const seconds = Math.floor(this.elapsedMs() / 1000);
    return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
      .map((value) => String(value).padStart(2, '0'))
      .join(':');
  }

  private calculateAmount() {
    const entry = this.activeEntry();
    if (!entry) return '0';
    const digits =
      new Intl.NumberFormat('en', {
        style: 'currency',
        currency: entry.currency,
      }).resolvedOptions().maximumFractionDigits ?? 2;
    const [whole, fraction = ''] = entry.hourlyRate.split('.');
    const rate = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'));
    const denominator = 3600000n * 10n ** BigInt(6 - digits);
    const minorUnits = (BigInt(this.elapsedMs()) * rate + denominator / 2n) / denominator;
    const scale = 10n ** BigInt(digits);
    return digits === 0
      ? minorUnits.toString()
      : `${minorUnits / scale}.${(minorUnits % scale).toString().padStart(digits, '0')}`;
  }

  private filterTasks() {
    const search = this.description().trim().toLocaleLowerCase();
    return this.tasks().filter((task) => task.title.toLocaleLowerCase().includes(search));
  }
}
