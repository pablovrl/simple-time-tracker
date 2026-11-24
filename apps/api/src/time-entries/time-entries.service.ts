import {
  ConflictException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import {
  and,
  desc,
  eq,
  getTableColumns,
  gte,
  isNotNull,
  isNull,
  lt,
} from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { tasks, timeEntries } from '../database/schema.js';
import { calculateAmount } from './calculate-amount.js';
import type { HistoryQuery, StartTimer } from './time-entries.schemas.js';
import type { UpdateEntry } from './time-entries.schemas.js';

@Injectable()
export class TimeEntriesService {
  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  async update(userId: string, id: string, input: UpdateEntry) {
    return this.db.transaction(async (tx) => {
      const [entry] = await tx
        .select()
        .from(timeEntries)
        .where(and(eq(timeEntries.id, id), eq(timeEntries.userId, userId)))
        .limit(1)
        .for('update');
      if (!entry) throw new NotFoundException('Time entry not found');
      if (!entry.endedAt)
        throw new ConflictException('Stop the timer before editing');

      if (input.taskId && input.taskId !== entry.taskId) {
        const [task] = await tx
          .select()
          .from(tasks)
          .where(and(eq(tasks.id, input.taskId), eq(tasks.userId, userId)))
          .limit(1)
          .for('share');
        if (!task) throw new NotFoundException('Task not found');
        if (task.archivedAt)
          throw new ConflictException('The task is archived');
      }

      const startedAt = input.startedAt
        ? new Date(input.startedAt)
        : entry.startedAt;
      const endedAt = input.endedAt ? new Date(input.endedAt) : entry.endedAt;
      if (endedAt < startedAt) {
        throw new BadRequestException(
          'endedAt must not be earlier than startedAt',
        );
      }
      const changes: Partial<typeof timeEntries.$inferInsert> = {};
      if (input.description !== undefined)
        changes.description = input.description;
      if (input.taskId !== undefined) changes.taskId = input.taskId;
      if (input.startedAt !== undefined || input.endedAt !== undefined) {
        changes.startedAt = startedAt;
        changes.endedAt = endedAt;
        changes.amount = calculateAmount(
          entry.hourlyRate,
          entry.currency,
          endedAt.getTime() - startedAt.getTime(),
        );
      }
      const [timeEntry] = await tx
        .update(timeEntries)
        .set(changes)
        .where(and(eq(timeEntries.id, id), eq(timeEntries.userId, userId)))
        .returning();
      return { timeEntry };
    });
  }

  async active(userId: string) {
    const [timeEntry] = await this.db
      .select({
        ...getTableColumns(timeEntries),
        client: tasks.client,
        taskTitle: tasks.title,
      })
      .from(timeEntries)
      .innerJoin(tasks, eq(timeEntries.taskId, tasks.id))
      .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.endedAt)))
      .limit(1);
    return { timeEntry: timeEntry ?? null };
  }

  async start(userId: string, input: StartTimer) {
    try {
      return await this.db.transaction(async (tx) => {
        const [task] = await tx
          .select()
          .from(tasks)
          .where(and(eq(tasks.id, input.taskId), eq(tasks.userId, userId)))
          .limit(1)
          .for('share');
        if (!task) throw new NotFoundException('Task not found');
        if (task.archivedAt)
          throw new ConflictException('The task is archived');

        const [timeEntry] = await tx
          .insert(timeEntries)
          .values({
            userId,
            taskId: task.id,
            description: input.description ?? null,
            startedAt: new Date(),
            hourlyRate: task.hourlyRate,
            currency: task.currency,
          })
          .returning();
        return { timeEntry };
      });
    } catch (error) {
      let current: unknown = error;
      for (
        let depth = 0;
        depth < 5 && current && typeof current === 'object';
        depth++
      ) {
        const databaseError = current as {
          code?: string;
          constraint?: string;
          cause?: unknown;
        };
        if (
          databaseError.code === '23505' &&
          databaseError.constraint === 'time_entries_one_active_per_user'
        ) {
          throw new ConflictException('A timer is already running');
        }
        current = databaseError.cause;
      }
      throw error;
    }
  }

  async stop(userId: string) {
    return this.db.transaction(async (tx) => {
      const [active] = await tx
        .select()
        .from(timeEntries)
        .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.endedAt)))
        .limit(1)
        .for('update');
      if (!active) throw new NotFoundException('No active timer');
      const endedAt = new Date();
      const durationMs = endedAt.getTime() - active.startedAt.getTime();
      if (durationMs < 0)
        throw new ConflictException('The timer starts in the future');
      const amount = calculateAmount(
        active.hourlyRate,
        active.currency,
        durationMs,
      );
      const [timeEntry] = await tx
        .update(timeEntries)
        .set({ endedAt, amount })
        .where(
          and(eq(timeEntries.id, active.id), eq(timeEntries.userId, userId)),
        )
        .returning();
      return { timeEntry };
    });
  }

  async history(userId: string, query: HistoryQuery) {
    const rows = await this.db
      .select({
        ...getTableColumns(timeEntries),
        client: tasks.client,
        taskTitle: tasks.title,
      })
      .from(timeEntries)
      .innerJoin(tasks, eq(timeEntries.taskId, tasks.id))
      .where(
        and(
          eq(timeEntries.userId, userId),
          query.client ? eq(tasks.client, query.client) : undefined,
          query.taskId ? eq(timeEntries.taskId, query.taskId) : undefined,
          query.status === 'active'
            ? isNull(timeEntries.endedAt)
            : query.status === 'completed'
              ? isNotNull(timeEntries.endedAt)
              : undefined,
          query.from
            ? gte(timeEntries.startedAt, new Date(query.from))
            : undefined,
          query.to ? lt(timeEntries.startedAt, new Date(query.to)) : undefined,
        ),
      )
      .orderBy(desc(timeEntries.startedAt), desc(timeEntries.id))
      .limit(query.limit + 1)
      .offset((query.page - 1) * query.limit);
    return {
      timeEntries: rows.slice(0, query.limit),
      pagination: {
        page: query.page,
        limit: query.limit,
        hasMore: rows.length > query.limit,
      },
    };
  }
}
