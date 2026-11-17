import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MoneyPipe } from '../../pipes/money.pipe';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Card } from '../../components/card/card';
import { CreateTask } from '../../components/create-task/create-task';
import { Task, TasksService } from '../../services/tasks.service';

@Component({
  selector: 'app-tasks',
  imports: [Card, CreateTask, DatePipe, MoneyPipe],
  templateUrl: './tasks.html',
})
export class Tasks implements OnInit {
  private readonly service = inject(TasksService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly tasks = signal<Task[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly showCreateTask = signal(false);

  ngOnInit() {
    this.loadTasks();
  }

  protected onCreated(task: Task) {
    this.tasks.update((tasks) => [task, ...tasks]);
    this.error.set(false);
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
}
