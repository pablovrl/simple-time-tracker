import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { projects, tasks } from '../database/schema.js';
import type { CreateTask, ListTasks } from './tasks.schemas.js';

@Injectable()
export class TasksService {
  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  async list(userId: string, query: ListTasks) {
    if (query.projectId) await this.ownedProject(userId, query.projectId);
    const rows = await this.db
      .select()
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(
          eq(projects.userId, userId),
          query.projectId ? eq(tasks.projectId, query.projectId) : undefined,
          isNull(tasks.archivedAt),
        ),
      )
      .orderBy(desc(tasks.createdAt), desc(tasks.id));
    return {
      tasks: rows.map((row) => row.tasks),
    };
  }

  async create(userId: string, input: CreateTask) {
    const project = await this.ownedProject(userId, input.projectId);
    if (project.archivedAt)
      throw new ConflictException('The project is archived');
    const [task] = await this.db
      .insert(tasks)
      .values({
        projectId: project.id,
        title: input.title,
        description: input.description ?? null,
        status: input.status,
      })
      .returning();
    return { task };
  }

  private async ownedProject(userId: string, projectId: string) {
    const [project] = await this.db
      .select()
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }
}
