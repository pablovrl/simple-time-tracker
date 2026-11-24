import { getDrizzleToken } from '@nestjs/drizzle';
import { Test } from '@nestjs/testing';
import { PgDialect } from 'drizzle-orm/pg-core';
import { DashboardService } from './dashboard.service.js';

describe('DashboardService', () => {
  const where = vi.fn();
  const orderBy = vi.fn();
  const select = vi.fn();
  let service: DashboardService;
  const range = {
    from: '2026-11-23T00:00:00-03:00',
    to: '2026-11-30T00:00:00-03:00',
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    where.mockReturnValue({ groupBy: () => ({ orderBy }) });
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
      earnings: [],
    });
  });

  it('sums time and preserves exact amounts separately by currency', async () => {
    orderBy.mockResolvedValue([
      { currency: 'EUR', workedSeconds: '3600.500', amount: '25.123456' },
      {
        currency: 'USD',
        workedSeconds: '7200',
        amount: '9007199254740993.000001',
      },
    ]);
    await expect(service.summary('owner', range)).resolves.toEqual({
      workedSeconds: 10800.5,
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
});
