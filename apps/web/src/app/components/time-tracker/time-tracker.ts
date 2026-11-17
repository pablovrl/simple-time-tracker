import { Component, computed, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucidePlay } from '@lucide/angular';
import { Task, TasksService } from '../../services/tasks.service';

@Component({
  selector: 'app-time-tracker',
  imports: [LucidePlay],
  templateUrl: './time-tracker.html',
  host: {
    class: 'relative block',
    '(document:click)': 'onOutsideClick($event)',
    '(keydown.escape)': 'expanded.set(false)',
    '(focusout)': 'onFocusOut($event)',
  },
})
export class TimeTracker {
  private readonly service = inject(TasksService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly expanded = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly description = signal('');
  private readonly tasks = signal<Task[]>([]);
  protected readonly filteredTasks = computed(() => {
    const search = this.description().trim().toLocaleLowerCase();
    return this.tasks().filter((task) => task.title.toLocaleLowerCase().includes(search));
  });

  protected open() {
    if (this.expanded()) return;
    this.expanded.set(true);
    this.loadTasks();
  }

  protected loadTasks() {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(false);
    this.service.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
    this.description.set(task.title);
    this.expanded.set(false);
    this.element.nativeElement.querySelector('input')?.focus();
  }

  protected onOutsideClick(event: MouseEvent) {
    if (!this.element.nativeElement.contains(event.target as Node)) this.expanded.set(false);
  }

  protected onFocusOut(event: FocusEvent) {
    if (!this.element.nativeElement.contains(event.relatedTarget as Node | null)) {
      this.expanded.set(false);
    }
  }
}
