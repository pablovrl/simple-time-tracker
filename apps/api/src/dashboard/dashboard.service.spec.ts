import { getDrizzleToken } from '@nestjs/drizzle';
import { Test } from '@nestjs/testing';
import { PgDialect } from 'drizzle-orm/pg-core';
import { DashboardService } from './dashboard.service.js';

describe('DashboardService', () => {
  const where = vi.fn();
  const orderBy = vi.fn();
  const select = vi.fn();
  const groupBy = vi.fn();
  let service: DashboardService;
  const range = {
    from: '2026-11-23T00:00:00-03:00',
    to: '2026-11-30T00:00:00-03:00',
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    groupBy.mockReturnValue({ orderBy });
    where.mockReturnValue({ groupBy });
    select.mockReturnValue({ from: () => ({ where }) });
    const module = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getDrizzleToken(), useValue: { select } },
      ],
    }).compile();
    service = module.get(DashboardService);
  });

  it('returns zero time and no earnings for an empty range', async () => {
    orderBy.mockResolvedValue([]);
    await expect(service.summary('owner', range)).resolves.toEqual({
      workedSeconds: 0,
      activeDays: 0,
      averageDailySeconds: 0,
      earnings: [],
      dailyHours: [],
    });
  });

  it('sums time and preserves exact amounts separately by currency', async () => {
    orderBy
      .mockResolvedValueOnce([
        { currency: 'EUR', workedSeconds: '3600.500', amount: '25.123456' },
        {
          currency: 'USD',
          workedSeconds: '7200',
          amount: '9007199254740993.000001',
        },
      ])
      .mockResolvedValueOnce([
        { date: '2026-11-23', workedSeconds: '10800.5' },
      ]);
    await expect(service.summary('owner', range)).resolves.toEqual({
      workedSeconds: 10800.5,
      activeDays: 1,
      averageDailySeconds: 10800.5,
      dailyHours: [{ date: '2026-11-23', workedSeconds: 10800.5 }],
      earnings: [
        { currency: 'EUR', amount: '25.123456' },
        { currency: 'USD', amount: '9007199254740993.000001' },
      ],
    });
    const query = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(query.params).toEqual([
      'owner',
      new Date(range.from).toISOString(),
      new Date(range.to).toISOString(),
    ]);
    expect(query.sql).toContain('"time_entries"."ended_at" is not null');
    expect(query.sql).toContain('"time_entries"."started_at" >=');
    expect(query.sql).toContain('"time_entries"."started_at" <');
    const fields = select.mock.calls[0][0];
    expect(new PgDialect().sqlToQuery(fields.amount).sql).toContain(
      'sum("time_entries"."amount")',
    );
    expect(new PgDialect().sqlToQuery(fields.workedSeconds).sql).toContain(
      'extract(epoch',
    );
  });

  it('groups daily time in the requested zone with the same ownership and range filters', async () => {
    orderBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ date: '2026-11-24', workedSeconds: '1800' }]);
    const result = await service.summary('owner', {
      ...range,
      timeZone: 'America/Santiago',
    });
    expect(result.dailyHours).toEqual([
      { date: '2026-11-24', workedSeconds: 1800 },
    ]);
    const date = new PgDialect().sqlToQuery(select.mock.calls[1][0].date);
    expect(date.sql).toContain('AT TIME ZONE');
    expect(date.params).toEqual(['America/Santiago']);
    expect(new PgDialect().sqlToQuery(groupBy.mock.calls[1][0])).toMatchObject({
      sql: '1',
      params: [],
    });
    expect(new PgDialect().sqlToQuery(orderBy.mock.calls[1][0])).toMatchObject({
      sql: '1',
      params: [],
    });
    expect(new PgDialect().sqlToQuery(where.mock.calls[1][0])).toEqual(
      new PgDialect().sqlToQuery(where.mock.calls[0][0]),
    );
  });

  it('averages over active days only, excluding zero-duration records', async () => {
    orderBy
      .mockResolvedValueOnce([
        { currency: 'USD', workedSeconds: '10800', amount: '120' },
      ])
      .mockResolvedValueOnce([
        { date: '2026-11-23', workedSeconds: '3600' },
        { date: '2026-11-24', workedSeconds: '7200' },
        { date: '2026-11-25', workedSeconds: '0' },
      ]);
    const result = await service.summary('owner', range);
    expect(result.activeDays).toBe(2);
    expect(result.averageDailySeconds).toBe(5400);
  });
});
