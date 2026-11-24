import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ChartComponent } from 'ng-apexcharts';
import { Subject } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Home } from './home';
import { DashboardService, DashboardSummary } from '../../services/dashboard.service';
import { TimeEntriesService } from '../../services/time-entries.service';

describe('Home summary', () => {
  const summary = vi.fn();
  let changes: Subject<void>;
  let response: Subject<DashboardSummary>;

  beforeEach(() => {
    summary.mockReset();
    changes = new Subject<void>();
    response = new Subject<DashboardSummary>();
    summary.mockReturnValue(response);
    TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        { provide: DashboardService, useValue: { summary } },
        { provide: TimeEntriesService, useValue: { changes } },
      ],
    });
  });

  it('loads the current local week and displays time and currencies', async () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    await fixture.whenStable();
    const [from, to] = summary.mock.calls[0];
    expect(new Date(from).getDay()).toBe(1);
    expect(new Date(from).getHours()).toBe(0);
    expect(new Date(to).getDay()).toBe(1);
    expect(new Date(to).getHours()).toBe(0);
    response.next({
      workedSeconds: 3661,
      taskDistribution: [
        {
          taskId: 'task',
          title: '<b>Website</b>',
          client: 'Acme',
          workedSeconds: 3661,
          earnings: [{ currency: 'USD', amount: '40.000000' }],
        },
      ],
      activeDays: 2,
      averageDailySeconds: 1830.5,
      dailyHours: [],
      earnings: [{ currency: 'USD', amount: '40.000000' }],
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('1h 1m 1s');
    expect(fixture.nativeElement.textContent).toContain('USD');
    expect(fixture.nativeElement.textContent).toContain('0h 30m 30s');
    expect(fixture.nativeElement.querySelectorAll('dl').length).toBe(4);
    const chart = fixture.debugElement.query(By.directive(ChartComponent)).componentInstance;
    expect(chart.series()[0].data).toEqual([0, 0, 0, 0, 0, 0, 0]);
    const donut = fixture.debugElement.queryAll(By.directive(ChartComponent))[1].componentInstance;
    expect(donut.series()).toEqual([3661 / 3600]);
    const tooltip = donut.tooltip().custom({ seriesIndex: 0 });
    expect(tooltip).toContain('&lt;b&gt;Website&lt;/b&gt;');
    expect(tooltip).toContain('100.0%');
    expect(tooltip).toContain('1h 1m 1s');
    expect(tooltip).toContain('USD');
    expect(tooltip).toContain('Acme');
    changes.next();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(summary).toHaveBeenCalledTimes(2);
  });

  it('shows a recoverable error and an empty result after retry', async () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    await fixture.whenStable();
    response.error(new Error('offline'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('unable to load summary');
    response = new Subject<DashboardSummary>();
    summary.mockReturnValue(response);
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    await fixture.whenStable();
    response.next({
      workedSeconds: 0,
      taskDistribution: [],
      activeDays: 0,
      averageDailySeconds: 0,
      earnings: [],
      dailyHours: [],
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('0h 0m 0s');
    expect(fixture.nativeElement.textContent).toContain('no earnings');
  });
});
