import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TimeEntry, TimeEntriesService } from '../../services/time-entries.service';
import { MoneyPipe } from '../../pipes/money.pipe';
import { Modal } from '../modal/modal';

@Component({
  selector: 'app-delete-entry',
  imports: [Modal, DatePipe, MoneyPipe],
  templateUrl: './delete-entry.html',
})
export class DeleteEntry {
  readonly entry = input.required<TimeEntry>();
  readonly dismissed = output<void>();
  private readonly service = inject(TimeEntriesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly modal = viewChild.required(Modal);
  protected readonly deleting = signal(false);
  protected readonly error = signal(false);

  protected remove() {
    if (this.deleting() || !this.entry().endedAt) return;
    this.deleting.set(true);
    this.error.set(false);
    this.service
      .remove(this.entry().id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleting.set(false);
          this.changeDetector.detectChanges();
          void this.modal().close();
        },
        error: () => {
          this.deleting.set(false);
          this.error.set(true);
        },
      });
  }
}
