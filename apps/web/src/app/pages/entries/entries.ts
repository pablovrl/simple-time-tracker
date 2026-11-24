import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TimeEntry, TimeEntriesService } from '../../services/time-entries.service';
import { Card } from '../../components/card/card';
import { MoneyPipe } from '../../pipes/money.pipe';
import { LucidePencil, LucideTrash2 } from '@lucide/angular';
import { EditEntry } from '../../components/edit-entry/edit-entry';
import { DeleteEntry } from '../../components/delete-entry/delete-entry';
import { IconButton } from '../../components/icon-button/icon-button';

@Component({
  selector: 'app-entries',
  imports: [
    Card,
    DatePipe,
    MoneyPipe,
    LucidePencil,
    LucideTrash2,
    EditEntry,
    DeleteEntry,
    IconButton,
  ],
  templateUrl: './entries.html',
})
export class Entries implements OnInit {
  private readonly service = inject(TimeEntriesService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly entries = signal<TimeEntry[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly page = signal(1);
  protected readonly hasMore = signal(false);
  protected readonly editingEntry = signal<TimeEntry | null>(null);
  protected readonly creatingEntry = signal(false);
  protected readonly deletingEntry = signal<TimeEntry | null>(null);

  ngOnInit() {
    this.loadEntries();
    this.service.changes.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.loadEntries();
    });
  }

  protected loadEntries(page = this.page()) {
    this.loading.set(true);
    this.error.set(false);
    this.service
      .history(page)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ timeEntries, pagination }) => {
          if (!timeEntries.length && pagination.page > 1) {
            this.loadEntries(pagination.page - 1);
            return;
          }
          this.entries.set(timeEntries);
          this.page.set(pagination.page);
          this.hasMore.set(pagination.hasMore);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  protected duration(entry: TimeEntry) {
    if (!entry.endedAt) return 'running';
    const seconds = Math.max(
      0,
      Math.floor((Date.parse(entry.endedAt) - Date.parse(entry.startedAt)) / 1000),
    );
    return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
      .map((value) => String(value).padStart(2, '0'))
      .join(':');
  }
}
