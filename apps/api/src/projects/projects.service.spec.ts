import { getDrizzleToken } from '@nestjs/drizzle';
import { Test } from '@nestjs/testing';
import { PgDialect } from 'drizzle-orm/pg-core';
import { ProjectsService } from './projects.service.js';

describe('ProjectsService', () => {
  const where = vi.fn();
  const limit = vi.fn();
  const offset = vi.fn();
  const values = vi.fn();
  const returning = vi.fn();
  let service: ProjectsService;

  beforeEach(async () => {
    vi.resetAllMocks();
    where.mockReturnValue({ orderBy: () => ({ limit }) });
    limit.mockReturnValue({ offset });
    values.mockReturnValue({ returning });
    const module = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: getDrizzleToken(),
          useValue: {
            select: () => ({ from: () => ({ where }) }),
            insert: () => ({ values }),
          },
        },
      ],
    }).compile();
    service = module.get(ProjectsService);
  });

  it('filters by ownership and archive status and paginates deterministically', async () => {
    offset.mockResolvedValue([{ id: 'one' }, { id: 'two' }, { id: 'extra' }]);
    const result = await service.list('owner-id', {
      page: 2,
      limit: 2,
      status: 'active',
    });
    const query = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(query.sql).toContain('"projects"."user_id" =');
    expect(query.sql).toContain('"projects"."archived_at" is null');
    expect(query.params).toContain('owner-id');
    expect(limit).toHaveBeenCalledWith(3);
    expect(offset).toHaveBeenCalledWith(2);
    expect(result).toEqual({
      projects: [{ id: 'one' }, { id: 'two' }],
      pagination: { page: 2, limit: 2, hasMore: true },
    });
  });

  it('retains ownership filtering when requesting all projects', async () => {
    offset.mockResolvedValue([]);
    await service.list('owner-id', { page: 1, limit: 20, status: 'all' });
    const query = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(query.params).toEqual(['owner-id']);
    expect(query.sql).not.toContain('archived_at');
  });

  it('persists the owner and exact decimal string', async () => {
    const input = { name: 'Website', hourlyRate: '25.123456', currency: 'USD' };
    returning.mockResolvedValue([{ id: 'project-id', ...input }]);
    await expect(service.create('owner-id', input)).resolves.toEqual({
      project: { id: 'project-id', ...input },
    });
    expect(values).toHaveBeenCalledWith({
      ...input,
      userId: 'owner-id',
      description: null,
    });
  });
});
