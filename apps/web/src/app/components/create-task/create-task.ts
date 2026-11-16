import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { EMPTY, expand, reduce } from 'rxjs';
import { Project, ProjectsService } from '../../services/projects.service';
import { Task, TasksService } from '../../services/tasks.service';
import { Button } from '../button/button';
import { Modal } from '../modal/modal';
import { Select } from '../select/select';

@Component({
  selector: 'app-create-task',
  imports: [Button, Modal, Select, ReactiveFormsModule],
  templateUrl: './create-task.html',
})
export class CreateTask implements OnInit {
  readonly initialTitle = input('');
  readonly closed = output<void>();
  readonly created = output<Task>();
  private readonly projectsService = inject(ProjectsService);
  private readonly tasksService = inject(TasksService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly projects = signal<{ value: string; label: string }[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly loadError = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    title: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(255)]],
    description: ['', Validators.maxLength(10000)],
    projectId: ['', Validators.required],
  });

  ngOnInit() {
    this.form.controls.title.setValue(this.initialTitle().slice(0, 255));
    this.loadProjects();
  }

  protected loadProjects() {
    this.loading.set(true);
    this.loadError.set(false);
    this.projectsService
      .list()
      .pipe(
        expand((page) =>
          page.pagination.hasMore ? this.projectsService.list(page.pagination.page + 1) : EMPTY,
        ),
        reduce((projects, page) => projects.concat(page.projects), [] as Project[]),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (projects) => {
          this.projects.set(
            projects.map((project) => ({ value: project.id, label: project.name })),
          );
          if (projects.length) this.form.controls.projectId.setValue(projects[0].id);
          this.loading.set(false);
        },
        error: () => {
          this.loadError.set(true);
          this.loading.set(false);
        },
      });
  }

  protected create() {
    if (this.saving() || this.loading() || this.loadError()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const input = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.tasksService
      .create({
        ...input,
        title: input.title.trim(),
        description: input.description.trim(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ task }) => {
          this.saving.set(false);
          this.created.emit(task);
        },
        error: (error: HttpErrorResponse) => {
          this.saving.set(false);
          this.error.set(
            error.status === 401
              ? 'Your session has expired. Please sign in again.'
              : 'Unable to create the task. Please try again.',
          );
        },
      });
  }
}
