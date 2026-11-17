import { getDrizzleToken } from '@nestjs/drizzle';
import { Test } from '@nestjs/testing';
import { PgDialect } from 'drizzle-orm/pg-core';
import { TasksService } from './tasks.service.js';

describe('TasksService', () => {
  const where = vi.fn();
  const orderBy = vi.fn();
  const values = vi.fn();
  const returning = vi.fn();
  let service: TasksService;
  const input = {
    client: 'Acme',
    title: 'Task',
    hourlyRate: '18000',
    currency: 'CLP',
    status: 'pending' as const,
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    where.mockReturnValue({ orderBy });
    values.mockReturnValue({ returning });
    const module = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: getDrizzleToken(),
          useValue: {
            select: () => ({ from: () => ({ where }) }),
            insert: () => ({ values }),
          },
        },
      ],
    }).compile();
    service = module.get(TasksService);
  });

  it('lists only the owner non-archived tasks', async () => {
    orderBy.mockResolvedValue([{ id: 'one', ...input }]);
    await expect(service.list('owner', {})).resolves.toEqual({
      tasks: [{ id: 'one', ...input }],
    });
    const query = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(query.params).toEqual(['owner']);
    expect(query.sql).toContain('"tasks"."user_id" =');
    expect(query.sql).toContain('"tasks"."archived_at" is null');
  });

  it('filters by client without dropping ownership', async () => {
    orderBy.mockResolvedValue([]);
    await expect(service.list('owner', { client: 'Acme' })).resolves.toEqual({
      tasks: [],
    });
    expect(new PgDialect().sqlToQuery(where.mock.calls[0][0]).params).toEqual([
      'owner',
      'Acme',
    ]);
  });

  it('creates a task with its owner, client and billing settings', async () => {
    returning.mockResolvedValue([{ id: 'task-id', ...input }]);
    await expect(service.create('owner', input)).resolves.toEqual({
      task: { id: 'task-id', ...input },
    });
    expect(values).toHaveBeenCalledWith({
      ...input,
      userId: 'owner',
      description: null,
    });
  });
});
