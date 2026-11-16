import { ConflictException, NotFoundException } from '@nestjs/common';
import { getDrizzleToken } from '@nestjs/drizzle';
import { Test } from '@nestjs/testing';
import { PgDialect } from 'drizzle-orm/pg-core';
import { projects } from '../database/schema.js';
import { TasksService } from './tasks.service.js';

describe('TasksService', () => {
  const projectLimit = vi.fn();
  const projectWhere = vi.fn();
  const taskWhere = vi.fn();
  const orderBy = vi.fn();
  const values = vi.fn();
  const returning = vi.fn();
  let service: TasksService;
  const project = { id: 'project-id', name: 'Website', archivedAt: null };
  const input = {
    projectId: project.id,
    title: 'Task',
    status: 'pending' as const,
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    projectLimit.mockResolvedValue([project]);
    projectWhere.mockReturnValue({ limit: projectLimit });
    taskWhere.mockReturnValue({
      orderBy,
    });
    values.mockReturnValue({ returning });
    const module = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: getDrizzleToken(),
          useValue: {
            select: () => ({
              from: (table: unknown) =>
                table === projects
                  ? { where: projectWhere }
                  : { innerJoin: () => ({ where: taskWhere }) },
            }),
            insert: () => ({ values }),
          },
        },
      ],
    }).compile();
    service = module.get(TasksService);
  });

  it('checks ownership and returns all non-archived tasks', async () => {
    orderBy.mockResolvedValue([
      { tasks: { id: 'one' }, projects: project },
      { tasks: { id: 'extra' }, projects: project },
    ]);
    await expect(
      service.list('owner', { projectId: project.id }),
    ).resolves.toEqual({
      tasks: [{ id: 'one', projectName: 'Website' }, { id: 'extra', projectName: 'Website' }],
    });
    const dialect = new PgDialect();
    expect(dialect.sqlToQuery(projectWhere.mock.calls[0][0]).params).toEqual([
      'project-id',
      'owner',
    ]);
    const query = dialect.sqlToQuery(taskWhere.mock.calls[0][0]);
    expect(query.params).toEqual(['owner', 'project-id']);
    expect(query.sql).toContain('"tasks"."archived_at" is null');
  });

  it('creates in an owned, active project', async () => {
    returning.mockResolvedValue([{ id: 'task-id', ...input }]);
    await expect(service.create('owner', input)).resolves.toEqual({
      task: { id: 'task-id', ...input, projectName: 'Website' },
    });
    expect(values).toHaveBeenCalledWith({ ...input, description: null });
  });

  it('returns all user tasks without requiring a project filter', async () => {
    orderBy.mockResolvedValue([
      { tasks: { id: 'one' }, projects: project },
      { tasks: { id: 'two' }, projects: { name: 'Another project' } },
    ]);
    await expect(service.list('owner', {})).resolves.toEqual({
      tasks: [{ id: 'one', projectName: 'Website' }, { id: 'two', projectName: 'Another project' }],
    });
    expect(projectWhere).not.toHaveBeenCalled();
    const query = new PgDialect().sqlToQuery(taskWhere.mock.calls[0][0]);
    expect(query.params).toEqual(['owner']);
    expect(query.sql).toContain('"projects"."user_id" =');
  });

  it('rejects missing or unowned projects without listing or inserting tasks', async () => {
    projectLimit.mockResolvedValue([]);
    await expect(service.create('other-user', input)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.list('other-user', { projectId: project.id }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(values).not.toHaveBeenCalled();
    expect(taskWhere).not.toHaveBeenCalled();
  });

  it('rejects creation in archived projects', async () => {
    projectLimit.mockResolvedValue([{ ...project, archivedAt: new Date() }]);
    await expect(service.create('owner', input)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(values).not.toHaveBeenCalled();
  });
});
