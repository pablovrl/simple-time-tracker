import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, eq, gte, isNotNull, lt, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { tasks, timeEntries } from '../database/schema.js';
import type { SummaryQuery } from './dashboard.schemas.js';

@Injectable()
export class DashboardService {
  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  async summary(userId: string, query: SummaryQuery) {
    const filter = and(
      eq(timeEntries.userId, userId),
      isNotNull(timeEntries.endedAt),
      gte(timeEntries.startedAt, new Date(query.from)),
      lt(timeEntries.startedAt, new Date(query.to)),
    );
    const duration = sql<string>`sum(extract(epoch from (${timeEntries.endedAt} - ${timeEntries.startedAt})))`;
    const totals = await this.db
      .select({
        currency: timeEntries.currency,
        workedSeconds: duration,
        amount: sql<string>`sum(${timeEntries.amount})`,
      })
      .from(timeEntries)
      .where(filter)
      .groupBy(timeEntries.currency)
      .orderBy(timeEntries.currency);

    // Attribute the full entry to its start day, matching summary range semantics.
    const date = sql<string>`to_char(${timeEntries.startedAt} AT TIME ZONE ${query.timeZone ?? 'UTC'}, 'YYYY-MM-DD')`;
    const days = await this.db
      .select({ date, workedSeconds: duration })
      .from(timeEntries)
      .where(filter)
      // Reference the selected date to avoid repeating its timezone parameter.
      // PostgreSQL treats separate placeholders as different GROUP BY expressions.
      .groupBy(sql`1`)
      .orderBy(sql`1`);

    const taskRows = await this.db
      .select({
        taskId: timeEntries.taskId,
        title: tasks.title,
        client: tasks.client,
        currency: timeEntries.currency,
        workedSeconds: duration,
        amount: sql<string>`sum(${timeEntries.amount})`,
      })
      .from(timeEntries)
      .innerJoin(tasks, eq(timeEntries.taskId, tasks.id))
      .where(filter)
      .groupBy(
        timeEntries.taskId,
        tasks.title,
        tasks.client,
        timeEntries.currency,
      )
      .orderBy(tasks.title, timeEntries.taskId, timeEntries.currency);
    const byTask = new Map<
      string,
      {
        taskId: string;
        title: string;
        client: string;
        workedSeconds: number;
        earnings: { currency: string; amount: string }[];
      }
    >();
    for (const row of taskRows) {
      const task = byTask.get(row.taskId) ?? {
        taskId: row.taskId,
        title: row.title,
        client: row.client,
        workedSeconds: 0,
        earnings: [],
      };
      task.workedSeconds += Number(row.workedSeconds);
      task.earnings.push({ currency: row.currency, amount: row.amount });
      byTask.set(row.taskId, task);
    }

    const workedSeconds = totals.reduce(
      (seconds, total) => seconds + Number(total.workedSeconds),
      0,
    );
    const activeDays = days.filter(
      (day) => Number(day.workedSeconds) > 0,
    ).length;

    return {
      workedSeconds,
      activeDays,
      averageDailySeconds: activeDays ? workedSeconds / activeDays : 0,
      taskDistribution: [...byTask.values()],
      earnings: totals.map(({ currency, amount }) => ({ currency, amount })),
      dailyHours: days.map((day) => ({
        date: day.date,
        workedSeconds: Number(day.workedSeconds),
      })),
    };
  }
}
