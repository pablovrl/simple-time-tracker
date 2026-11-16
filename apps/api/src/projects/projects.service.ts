import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { projects } from '../database/schema.js';
import type { CreateProject, ListProjects } from './projects.schemas.js';

@Injectable()
export class ProjectsService {
  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  async list(userId: string, query: ListProjects) {
    const rows = await this.db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.userId, userId),
          query.status === 'active'
            ? isNull(projects.archivedAt)
            : query.status === 'archived'
              ? isNotNull(projects.archivedAt)
              : undefined,
        ),
      )
      .orderBy(desc(projects.createdAt), desc(projects.id))
      .limit(query.limit + 1)
      .offset((query.page - 1) * query.limit);
    return {
      projects: rows.slice(0, query.limit),
      pagination: {
        page: query.page,
        limit: query.limit,
        hasMore: rows.length > query.limit,
      },
    };
  }

  async create(userId: string, input: CreateProject) {
    const [project] = await this.db
      .insert(projects)
      .values({
        userId,
        name: input.name,
        description: input.description ?? null,
        hourlyRate: input.hourlyRate,
        currency: input.currency,
      })
      .returning();
    return { project };
  }
}
