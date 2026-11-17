import { ConflictException, NotFoundException } from '@nestjs/common';
import { getDrizzleToken } from '@nestjs/drizzle';
import { Test } from '@nestjs/testing';
import { PgDialect } from 'drizzle-orm/pg-core';
import { TimeEntriesService } from './time-entries.service.js';

describe('TimeEntriesService', () => {
  const rowLock = vi.fn();
  const whereRead = vi.fn();
  const values = vi.fn();
  const returning = vi.fn();
  const set = vi.fn();
  const updateWhere = vi.fn();
  const transaction = vi.fn();
  const historyWhere = vi.fn();
  const historyOffset = vi.fn();
  const activeLimit = vi.fn();
  let service: TimeEntriesService;
  const task = {
    id: 'task-id',
    hourlyRate: '18000.000000',
    currency: 'CLP',
    archivedAt: null,
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    whereRead.mockReturnValue({ limit: () => ({ for: rowLock }) });
    values.mockReturnValue({ returning });
    set.mockReturnValue({ where: updateWhere });
    updateWhere.mockReturnValue({ returning });
    historyWhere.mockReturnValue({
      orderBy: () => ({ limit: () => ({ offset: historyOffset }) }),
      limit: activeLimit,
    });
    const tx = {
      select: () => ({ from: () => ({ where: whereRead }) }),
      insert: () => ({ values }),
      update: () => ({ set }),
    };
    transaction.mockImplementation(async (callback) => callback(tx));
    const module = await Test.createTestingModule({
      providers: [
        TimeEntriesService,
        {
          provide: getDrizzleToken(),
          useValue: {
            transaction,
            select: () => ({
              from: () => ({
                innerJoin: () => ({ where: historyWhere }),
              }),
            }),
          },
        },
      ],
    }).compile();
    service = module.get(TimeEntriesService);
  });

  afterEach(() => vi.restoreAllMocks());

  it('returns only the current user active entry', async () => {
    activeLimit.mockResolvedValue([{ id: 'entry', client: 'Acme' }]);
    await expect(service.active('owner')).resolves.toEqual({
      timeEntry: { id: 'entry', client: 'Acme' },
    });
    const query = new PgDialect().sqlToQuery(historyWhere.mock.calls[0][0]);
    expect(query.params).toEqual(['owner']);
    expect(query.sql).toContain('"time_entries"."ended_at" is null');
    expect(activeLimit).toHaveBeenCalledWith(1);
  });

  it('returns null when no timer is active', async () => {
    activeLimit.mockResolvedValue([]);
    await expect(service.active('owner')).resolves.toEqual({ timeEntry: null });
  });

  it('starts using the owned task and snapshots its billing settings', async () => {
    rowLock.mockResolvedValue([task]);
    returning.mockResolvedValue([{ id: 'entry-id' }]);
    await expect(service.start('owner', { taskId: task.id })).resolves.toEqual({
      timeEntry: { id: 'entry-id' },
    });
    expect(values).toHaveBeenCalledWith({
      userId: 'owner',
      taskId: task.id,
      description: null,
      startedAt: expect.any(Date),
      hourlyRate: task.hourlyRate,
      currency: task.currency,
    });
    expect(
      new PgDialect().sqlToQuery(whereRead.mock.calls[0][0]).params,
    ).toEqual(['task-id', 'owner']);
  });

  it('rejects a missing or foreign task', async () => {
    rowLock.mockResolvedValue([]);
    await expect(
      service.start('owner', { taskId: 'foreign-task' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(values).not.toHaveBeenCalled();
  });

  it('rejects archived tasks', async () => {
    rowLock.mockResolvedValue([{ ...task, archivedAt: new Date() }]);
    await expect(
      service.start('owner', { taskId: task.id }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('reports simultaneous or duplicate starts as a conflict', async () => {
    transaction.mockRejectedValueOnce({
      cause: {
        code: '23505',
        constraint: 'time_entries_one_active_per_user',
      },
    });
    await expect(
      service.start('owner', { taskId: task.id }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('locks and stops only the current user timer using the saved rate', async () => {
    const endedAt = new Date('2026-11-16T12:00:00Z');
    vi.spyOn(Date, 'now').mockReturnValue(endedAt.getTime());
    vi.useFakeTimers();
    vi.setSystemTime(endedAt);
    try {
      rowLock.mockResolvedValue([
        {
          id: 'entry-id',
          hourlyRate: '18000.000000',
          currency: 'CLP',
          startedAt: new Date('2026-11-16T11:30:00Z'),
        },
      ]);
      returning.mockResolvedValue([{ id: 'entry-id', amount: '9000' }]);
      await expect(service.stop('owner')).resolves.toEqual({
        timeEntry: { id: 'entry-id', amount: '9000' },
      });
      expect(rowLock).toHaveBeenCalledWith('update');
      expect(set).toHaveBeenCalledWith({ endedAt, amount: '9000' });
      expect(
        new PgDialect().sqlToQuery(whereRead.mock.calls[0][0]).params,
      ).toEqual(['owner']);
      expect(
        new PgDialect().sqlToQuery(updateWhere.mock.calls[0][0]).params,
      ).toEqual(['entry-id', 'owner']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns 404 if there is no active timer', async () => {
    rowLock.mockResolvedValue([]);
    await expect(service.stop('owner')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(set).not.toHaveBeenCalled();
  });

  it('filters history by user and returns bounded pagination', async () => {
    historyOffset.mockResolvedValue([{ id: 'entry' }, { id: 'extra' }]);
    await expect(
      service.history('owner', { page: 1, limit: 1, status: 'completed' }),
    ).resolves.toEqual({
      timeEntries: [{ id: 'entry' }],
      pagination: { page: 1, limit: 1, hasMore: true },
    });
    const query = new PgDialect().sqlToQuery(historyWhere.mock.calls[0][0]);
    expect(query.params).toEqual(['owner']);
    expect(query.sql).toContain('"time_entries"."ended_at" is not null');
  });

  it('filters history by client and task while retaining ownership', async () => {
    historyOffset.mockResolvedValue([]);
    await service.history('owner', {
      page: 1,
      limit: 20,
      status: 'all',
      client: 'Acme',
      taskId: 'task-id',
    });
    const query = new PgDialect().sqlToQuery(historyWhere.mock.calls[0][0]);
    expect(query.params).toEqual(['owner', 'Acme', 'task-id']);
  });
});
