import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Task, TasksService } from '../../services/tasks.service';
import { Modal } from '../modal/modal';
import { Input } from '../input/input';
import { Select } from '../select/select';

@Component({
  selector: 'app-create-task',
  imports: [Modal, Input, Select, ReactiveFormsModule],
  templateUrl: './create-task.html',
})
export class CreateTask {
  readonly created = output<Task>();
  readonly dismissed = output<void>();
  private readonly service = inject(TasksService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly modal = viewChild.required(Modal);
  protected readonly saving = signal(false);
  protected readonly error = signal(false);
  protected readonly submitted = signal(false);
  protected readonly currencies = [
    { value: 'CLP', label: 'CLP' },
    { value: 'EUR', label: 'EUR' },
    { value: 'USD', label: 'USD' },
  ];
  protected readonly form = inject(FormBuilder).nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(255), Validators.pattern(/\S/)]],
    client: ['', [Validators.required, Validators.maxLength(120), Validators.pattern(/\S/)]],
    hourlyRate: ['', [Validators.required, Validators.pattern(/^(0|[1-9]\d{0,11})(\.\d{1,6})?$/)]],
    currency: ['CLP', [Validators.required, Validators.pattern(/^[A-Z]{3}$/)]],
    description: ['', Validators.maxLength(10000)],
  });

  protected create() {
    if (this.saving()) return;
    this.submitted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const input = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(false);
    this.service
      .create({
        ...input,
        title: input.title.trim(),
        client: input.client.trim(),
        description: input.description.trim(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ task }) => {
          this.saving.set(false);
          this.created.emit(task);
          this.changeDetector.detectChanges();
          void this.modal().close();
        },
        error: () => {
          this.saving.set(false);
          this.error.set(true);
        },
      });
  }
}
