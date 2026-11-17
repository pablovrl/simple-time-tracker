import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Card } from '../../components/card/card';
import { Task, TasksService } from '../../services/tasks.service';

@Component({
  selector: 'app-tasks',
  imports: [Card],
  templateUrl: './tasks.html',
})
export class Tasks implements OnInit {
  private readonly service = inject(TasksService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly tasks = signal<Task[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);

  ngOnInit() {
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
}
