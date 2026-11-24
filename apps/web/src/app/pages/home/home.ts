import { Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { LucideClock, LucideWallet } from '@lucide/angular';
import { Input } from '../../components/input/input';
import { Card } from '../../components/card/card';
import { MoneyPipe } from '../../pipes/money.pipe';
import { DashboardService, DashboardSummary } from '../../services/dashboard.service';
import { TimeEntriesService } from '../../services/time-entries.service';

function localMidnight(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function currentWeek() {
  const start = new Date();
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const format = (date: Date) =>
    [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');

  return { start: format(start), end: format(end) };
}

@Component({
  selector: 'app-home',
  imports: [Input, Card, FormsModule, MoneyPipe, LucideClock, LucideWallet],
  templateUrl: './home.html',
})
export class Home {
  private readonly dashboard = inject(DashboardService);
  private readonly entries = inject(TimeEntriesService);
  private readonly refresh = signal(0);
  private readonly week = currentWeek();
  protected readonly startDate = signal(this.week.start);
  protected readonly endDate = signal(this.week.end);
  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly invalidRange = computed(
    () => !this.startDate() || !this.endDate() || this.startDate() > this.endDate(),
  );
  protected readonly workedTime = computed(() => {
    const seconds = Math.floor(this.summary()?.workedSeconds ?? 0);
    return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds / 60) % 60}m ${seconds % 60}s`;
  });

  constructor() {
    this.entries.changes.pipe(takeUntilDestroyed()).subscribe(() => this.reload());

    effect((onCleanup) => {
      this.refresh();
      this.summary.set(null);
      this.error.set(false);
      if (this.invalidRange()) {
        this.loading.set(false);
        return;
      }
      const from = localMidnight(this.startDate());
      const to = localMidnight(this.endDate());
      // Advance a calendar day, not 24 hours, to respect daylight saving changes.
      to.setDate(to.getDate() + 1);
      this.loading.set(true);
      const subscription = this.dashboard.summary(from.toISOString(), to.toISOString()).subscribe({
        next: (summary) => {
          this.summary.set(summary);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  protected reload() {
    this.refresh.update((value) => value + 1);
  }
}
