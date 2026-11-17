import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { tasks } from '../database/schema.js';
import type { CreateTask, ListTasks } from './tasks.schemas.js';

@Injectable()
export class TasksService {
  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  async list(userId: string, query: ListTasks) {
    const rows = await this.db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          query.client ? eq(tasks.client, query.client) : undefined,
          isNull(tasks.archivedAt),
        ),
      )
      .orderBy(desc(tasks.createdAt), desc(tasks.id));
    return {
      tasks: rows,
    };
  }

  async create(userId: string, input: CreateTask) {
    const [task] = await this.db
      .insert(tasks)
      .values({
        userId,
        client: input.client,
        hourlyRate: input.hourlyRate,
        currency: input.currency,
        title: input.title,
        description: input.description ?? null,
        status: input.status,
      })
      .returning();
    return { task };
  }
}
