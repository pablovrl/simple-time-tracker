import { Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ChartComponent } from 'ng-apexcharts';
import type {
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexYAxis,
  ApexTooltip,
} from 'ng-apexcharts';
import {
  LucideClock,
  LucideWallet,
  LucideCalendarDays,
  LucideChartNoAxesColumn,
} from '@lucide/angular';
import { Input } from '../../components/input/input';
import { Card } from '../../components/card/card';
import { MoneyPipe } from '../../pipes/money.pipe';
import { DashboardService, DashboardSummary } from '../../services/dashboard.service';
import { TimeEntriesService } from '../../services/time-entries.service';

function localMidnight(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character]!,
  );
}

function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
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
  imports: [
    Input,
    Card,
    FormsModule,
    MoneyPipe,
    LucideClock,
    LucideWallet,
    LucideCalendarDays,
    LucideChartNoAxesColumn,
    ChartComponent,
  ],
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
  protected readonly averageDailyTime = computed(() => {
    const seconds = Math.floor(this.summary()?.averageDailySeconds ?? 0);
    return `${Math.floor(seconds / 3600)}h ${Math.floor(seconds / 60) % 60}m ${seconds % 60}s`;
  });
  protected readonly dailyHours = computed(() => {
    if (this.invalidRange() || !this.summary()) return [];
    const recorded = new Map(
      this.summary()!.dailyHours.map((day) => [day.date, day.workedSeconds]),
    );
    const days = [];
    const end = localMidnight(this.endDate());
    for (
      const date = localMidnight(this.startDate());
      date <= end;
      date.setDate(date.getDate() + 1)
    ) {
      const key = dateKey(date);
      const seconds = recorded.get(key) ?? 0;
      days.push({
        date: key,
        label: date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        seconds,
      });
    }
    return days;
  });
  protected readonly chart: ApexChart = {
    type: 'bar',
    height: 280,
    toolbar: { show: false },
    fontFamily: 'inherit',
    foreColor: '#525252',
  };
  protected readonly chartSeries = computed<ApexAxisChartSeries>(() => [
    {
      name: 'hours worked',
      data: this.dailyHours().map((day) => day.seconds / 3600),
    },
  ]);
  protected readonly chartXAxis = computed<ApexXAxis>(() => ({
    categories: this.dailyHours().map((day) => day.label),
  }));
  protected readonly chartYAxis: ApexYAxis = {
    min: 0,
    title: { text: 'hours' },
    labels: { formatter: (value) => `${Number(value.toFixed(2))} h` },
  };
  protected readonly taskDistribution = computed(() =>
    (this.summary()?.taskDistribution ?? []).filter((task) => task.workedSeconds > 0),
  );
  protected readonly taskSeries = computed(() =>
    this.taskDistribution().map((task) => task.workedSeconds / 3600),
  );
  protected readonly taskLabels = computed(() =>
    this.taskDistribution().map((task) => `${task.title} — ${task.client}`),
  );
  protected readonly taskChart: ApexChart = {
    type: 'donut',
    height: 280,
    fontFamily: 'inherit',
    toolbar: { show: false },
  };
  protected readonly taskTooltip: ApexTooltip = {
    custom: ({ seriesIndex }) => {
      const task = this.taskDistribution()[seriesIndex];
      if (!task) return '';
      const seconds = Math.floor(task.workedSeconds);
      const percentage = this.summary()?.workedSeconds
        ? (task.workedSeconds / this.summary()!.workedSeconds) * 100
        : 0;
      const money = task.earnings
        .map(
          (earning) =>
            `<div>${escapeHtml(earning.currency)} ${escapeHtml(new MoneyPipe().transform(earning.amount, earning.currency))}</div>`,
        )
        .join('');
      return `<div style="padding:12px;background:white;color:#171717">
        <strong>${escapeHtml(task.title)}</strong>
        <div>${escapeHtml(task.client)}</div>
        <div>${Math.floor(seconds / 3600)}h ${Math.floor(seconds / 60) % 60}m ${seconds % 60}s</div>
        <div>${percentage.toFixed(1)}%</div>${money}</div>`;
    },
  };

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
