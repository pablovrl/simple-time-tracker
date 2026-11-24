import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, eq, gte, isNotNull, lt, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { timeEntries } from '../database/schema.js';
import type { SummaryQuery } from './dashboard.schemas.js';

@Injectable()
export class DashboardService {
  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  async summary(userId: string, query: SummaryQuery) {
    const totals = await this.db
      .select({
        currency: timeEntries.currency,
        workedSeconds: sql<string>`sum(extract(epoch from (${timeEntries.endedAt} - ${timeEntries.startedAt})))`,
        amount: sql<string>`sum(${timeEntries.amount})`,
      })
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.userId, userId),
          isNotNull(timeEntries.endedAt),
          gte(timeEntries.startedAt, new Date(query.from)),
          lt(timeEntries.startedAt, new Date(query.to)),
        ),
      )
      .groupBy(timeEntries.currency)
      .orderBy(timeEntries.currency);

    return {
      workedSeconds: totals.reduce(
        (seconds, total) => seconds + Number(total.workedSeconds),
        0,
      ),
      earnings: totals.map(({ currency, amount }) => ({ currency, amount })),
    };
  }
}
