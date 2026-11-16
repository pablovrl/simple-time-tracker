import { Component, computed, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucidePlay, LucidePlus } from '@lucide/angular';
import { Button } from '../button/button';
import { Card } from '../card/card';
import { Task, TasksService } from '../../services/tasks.service';
import { CreateTask } from '../create-task/create-task';

@Component({
  selector: 'app-time-tracker',
  imports: [Button, LucidePlay, LucidePlus, Card, CreateTask],
  templateUrl: './time-tracker.html',
  host: {
    class: 'relative',
    '(document:click)': 'onOutsideClick($event)',
    '(keydown.escape)': 'expanded.set(false)',
    '(focusout)': 'onFocusOut($event)',
  },
})
export class TimeTracker {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly tasksService = inject(TasksService);
  private readonly destroyRef = inject(DestroyRef);
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

  protected open() {
    if (this.expanded() || this.showCreateTask()) return;
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
