import { DatePipe } from '@angular/common';
import { Table } from '../../components/table/table';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { Button } from '../../components/button/button';
import { Card } from '../../components/card/card';
import { TimeEntry, TimeEntriesService } from '../../services/time-entries.service';

@Component({
  selector: 'app-entries',
  imports: [Button, Card, DatePipe, Table],
  templateUrl: './entries.html',
})
export class Entries implements OnInit {
  private readonly service = inject(TimeEntriesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private request?: Subscription;
  private readonly now = signal(Date.now());
  protected readonly entries = signal<TimeEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly page = signal(1);
  protected readonly hasMore = signal(false);

  ngOnInit() {
    this.load();
    this.service.changes.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load(1));
    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.now.set(Date.now()));
  }

  protected load(page = this.page()) {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.request = this.service
      .history(page)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.entries.set(result.timeEntries);
          this.page.set(result.pagination.page);
          this.hasMore.set(result.pagination.hasMore);
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.loading.set(false);
          if (error.status === 401) {
            void this.router.navigateByUrl('/login');
          } else {
            this.error.set('Unable to load time entries. Please try again.');
          }
        },
      });
  }

  protected duration(entry: TimeEntry) {
    const end = entry.endedAt ? Date.parse(entry.endedAt) : this.now();
    const seconds = Math.max(0, Math.floor((end - Date.parse(entry.startedAt)) / 1000));
    return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
      .map((value) => String(value).padStart(2, '0'))
      .join(':');
  }

  protected amount(entry: TimeEntry) {
    if (entry.amount === null) return '—';
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: entry.currency,
      currencyDisplay: 'code',
    }).format(entry.amount as unknown as number);
  }
}
