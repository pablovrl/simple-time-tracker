import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
  input,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  TimeEntry,
  TimeEntriesService,
  UpdateTimeEntry,
} from '../../services/time-entries.service';
import { TasksService } from '../../services/tasks.service';
import { Modal } from '../modal/modal';
import { Input } from '../input/input';
import { Select, SelectItem } from '../select/select';

function localDateTime(value: string) {
  const date = new Date(value);
  const pad = (number: number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

@Component({
  selector: 'app-edit-entry',
  imports: [Modal, Input, Select, ReactiveFormsModule],
  templateUrl: './edit-entry.html',
})
export class EditEntry implements OnInit {
  readonly entry = input<TimeEntry>();
  readonly dismissed = output<void>();
  private readonly service = inject(TimeEntriesService);
  private readonly tasksService = inject(TasksService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly modal = viewChild.required(Modal);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly tasksError = signal(false);
  protected readonly taskOptions = signal<SelectItem[]>([]);
  protected readonly submitted = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      description: ['', Validators.maxLength(10000)],
      taskId: ['', Validators.required],
      startedAt: ['', Validators.required],
      endedAt: ['', Validators.required],
    },
    {
      validators: (control) => {
        const start = Date.parse(control.get('startedAt')?.value);
        const end = Date.parse(control.get('endedAt')?.value);
        return Number.isFinite(start) && Number.isFinite(end) && end >= start
          ? null
          : { dateRange: true };
      },
    },
  );
  private initialStart = '';
  private initialEnd = '';

  ngOnInit() {
    const entry = this.entry();
    const now = new Date().toISOString();
    this.initialStart = localDateTime(entry?.startedAt ?? now);
    this.initialEnd = entry
      ? entry.endedAt
        ? localDateTime(entry.endedAt)
        : ''
      : localDateTime(now);
    this.form.setValue({
      description: entry?.description ?? '',
      taskId: entry?.taskId ?? '',
      startedAt: this.initialStart,
      endedAt: this.initialEnd,
    });
    if (!entry) {
      this.form.controls.startedAt.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((startedAt) => {
          this.form.controls.endedAt.setValue(startedAt);
        });
    }
    this.taskOptions.set(
      entry
        ? [
            {
              value: entry.taskId,
              label: entry.taskTitle || 'current task',
            },
          ]
        : [],
    );
    this.loadTasks();
  }

  protected loadTasks() {
    this.tasksError.set(false);
    this.tasksService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ tasks }) => {
          const options = tasks
            .filter((task) => !task.archivedAt)
            .map((task) => ({ value: task.id, label: `${task.title} — ${task.client}` }));
          const entry = this.entry();
          if (entry && !options.some((option) => option.value === entry.taskId)) {
            options.unshift(this.taskOptions()[0]);
          }
          if (!entry) options.unshift({ value: '', label: 'select a task' });
          this.taskOptions.set(options);
        },
        error: () => this.tasksError.set(true),
      });
  }

  protected save() {
    if (this.saving()) return;
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const entry = this.entry();
    const changes: UpdateTimeEntry = {};
    if (value.description !== (entry?.description ?? '')) {
      changes.description = value.description.trim() || null;
    }
    if (value.taskId !== entry?.taskId) changes.taskId = value.taskId;
    // Preserve the original timestamps (and UTC offset during DST transitions)
    // when editing unrelated fields.
    if (value.startedAt !== this.initialStart)
      changes.startedAt = new Date(value.startedAt).toISOString();
    if (value.endedAt !== this.initialEnd) changes.endedAt = new Date(value.endedAt).toISOString();
    if (entry && !Object.keys(changes).length) {
      void this.modal().close();
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const request = entry
      ? this.service.update(entry.id, changes)
      : this.service.create({
          taskId: value.taskId,
          description: value.description.trim() || null,
          startedAt: new Date(value.startedAt).toISOString(),
          endedAt: new Date(value.endedAt).toISOString(),
        });
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.changeDetector.detectChanges();
        void this.modal().close();
      },
      error: () => {
        this.saving.set(false);
        this.error.set('unable to save entry. check the dates and task, then try again.');
      },
    });
  }
}
