import {
  ConflictException,
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
import { projects, tasks, timeEntries } from '../database/schema.js';
import { calculateAmount } from './calculate-amount.js';
import type { HistoryQuery, StartTimer } from './time-entries.schemas.js';

@Injectable()
export class TimeEntriesService {
  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  async active(userId: string) {
    const [timeEntry] = await this.db
      .select({
        ...getTableColumns(timeEntries),
        projectName: projects.name,
        taskTitle: tasks.title,
      })
      .from(timeEntries)
      .innerJoin(projects, eq(timeEntries.projectId, projects.id))
      .leftJoin(tasks, eq(timeEntries.taskId, tasks.id))
      .where(
        and(
          eq(timeEntries.userId, userId),
          eq(projects.userId, userId),
          isNull(timeEntries.endedAt),
        ),
      )
      .limit(1);
    return { timeEntry: timeEntry ?? null };
  }

  async start(userId: string, input: StartTimer) {
    try {
      return await this.db.transaction(async (tx) => {
        const [project] = await tx
          .select()
          .from(projects)
          .where(
            and(eq(projects.id, input.projectId), eq(projects.userId, userId)),
          )
          .limit(1)
          .for('share');
        if (!project) throw new NotFoundException('Project not found');
        if (project.archivedAt)
          throw new ConflictException('The project is archived');

        if (input.taskId) {
          const [task] = await tx
            .select()
            .from(tasks)
            .where(
              and(eq(tasks.id, input.taskId), eq(tasks.projectId, project.id)),
            )
            .limit(1)
            .for('share');
          if (!task)
            throw new NotFoundException('Task not found in this project');
          if (task.archivedAt)
            throw new ConflictException('The task is archived');
        }

        const [timeEntry] = await tx
          .insert(timeEntries)
          .values({
            userId,
            projectId: project.id,
            taskId: input.taskId ?? null,
            description: input.description ?? null,
            startedAt: new Date(),
            hourlyRate: project.hourlyRate,
            currency: project.currency,
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
        projectName: projects.name,
        taskTitle: tasks.title,
      })
      .from(timeEntries)
      .innerJoin(projects, eq(timeEntries.projectId, projects.id))
      .leftJoin(tasks, eq(timeEntries.taskId, tasks.id))
      .where(
        and(
          eq(timeEntries.userId, userId),
          eq(projects.userId, userId),
          query.projectId
            ? eq(timeEntries.projectId, query.projectId)
            : undefined,
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
