import {
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { SessionsService } from '../auth/sessions.service.js';
import { TimeEntriesController } from './time-entries.controller.js';
import { TimeEntriesService } from './time-entries.service.js';

describe('Time entry endpoints', () => {
  let app: INestApplication;
  const start = vi.fn();
  const stop = vi.fn();
  const history = vi.fn();
  const active = vi.fn();
  const update = vi.fn();
  const create = vi.fn();
  const remove = vi.fn();
  const taskId = 'e7e283f0-7750-46f5-866f-41d0225c529e';

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.stubEnv('FRONTEND_URL', 'http://localhost:4200');
    vi.stubEnv('NODE_ENV', 'test');
    const module = await Test.createTestingModule({
      controllers: [TimeEntriesController],
      providers: [
        {
          provide: TimeEntriesService,
          useValue: { start, stop, history, active, update, create, remove },
        },
        {
          provide: SessionsService,
          useValue: {
            authenticate: async (token: string | undefined) => {
              if (token !== 'valid') throw new UnauthorizedException();
              return { id: 'owner', name: 'User', email: 'user@example.com' };
            },
          },
        },
      ],
    }).compile();
    app = module.createNestApplication(new ExpressAdapter());
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
    vi.unstubAllEnvs();
  });

  it('requires a session for history and timer operations', async () => {
    await request(app.getHttpServer()).get('/time-entries').expect(401);
    await request(app.getHttpServer()).get('/timer').expect(401);
    for (const endpoint of ['start', 'stop']) {
      await request(app.getHttpServer())
        .post(`/timer/${endpoint}`)
        .set('Origin', 'http://localhost:4200')
        .send({ taskId })
        .expect(401);
    }
  });

  it('deletes an owned entry with no response body', async () => {
    await request(app.getHttpServer())
      .delete(`/time-entries/${taskId}`)
      .set('Cookie', 'session=valid')
      .set('Origin', 'http://localhost:4200')
      .expect(204)
      .expect('Cache-Control', 'no-store')
      .expect('');
    expect(remove).toHaveBeenCalledWith('owner', taskId);
  });

  it('validates IDs and protects deletion with authentication and origin checks', async () => {
    await request(app.getHttpServer())
      .delete('/time-entries/invalid')
      .set('Cookie', 'session=valid')
      .set('Origin', 'http://localhost:4200')
      .expect(400);
    await request(app.getHttpServer())
      .delete(`/time-entries/${taskId}`)
      .set('Origin', 'http://localhost:4200')
      .expect(401);
    await request(app.getHttpServer())
      .delete(`/time-entries/${taskId}`)
      .set('Cookie', 'session=valid')
      .set('Origin', 'https://foreign.example')
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/time-entries/${taskId}`)
      .set('Cookie', 'session=valid')
      .expect(403);
    expect(remove).not.toHaveBeenCalled();
  });

  it('reports missing entries and active timer conflicts', async () => {
    for (const [error, status] of [
      [new NotFoundException(), 404],
      [new ConflictException(), 409],
    ] as const) {
      remove.mockRejectedValueOnce(error);
      await request(app.getHttpServer())
        .delete(`/time-entries/${taskId}`)
        .set('Cookie', 'session=valid')
        .set('Origin', 'http://localhost:4200')
        .expect(status);
    }
  });

  it('creates manual entries with authenticated ownership', async () => {
    const input = {
      taskId,
      startedAt: '2026-11-24T09:00:00Z',
      endedAt: '2026-11-24T10:00:00Z',
    };
    create.mockResolvedValue({ timeEntry: { id: 'entry' } });
    await request(app.getHttpServer())
      .post('/time-entries')
      .set('Cookie', 'session=valid')
      .set('Origin', 'http://localhost:4200')
      .send(input)
      .expect(201)
      .expect('Cache-Control', 'no-store');
    expect(create).toHaveBeenCalledWith('owner', input);
  });

  it('rejects invalid manual entries, billing overrides and unauthorized requests', async () => {
    const input = {
      taskId,
      startedAt: '2026-11-24T09:00:00Z',
      endedAt: '2026-11-24T10:00:00Z',
    };
    for (const body of [
      {},
      { taskId },
      { ...input, endedAt: null },
      { ...input, endedAt: '2026-11-23T00:00:00Z' },
      { ...input, amount: '1' },
      { ...input, userId: 'foreign' },
      { ...input, hourlyRate: '1' },
      { ...input, currency: 'EUR' },
    ]) {
      await request(app.getHttpServer())
        .post('/time-entries')
        .set('Cookie', 'session=valid')
        .set('Origin', 'http://localhost:4200')
        .send(body)
        .expect(400);
    }
    await request(app.getHttpServer())
      .post('/time-entries')
      .set('Origin', 'http://localhost:4200')
      .send(input)
      .expect(401);
    await request(app.getHttpServer())
      .post('/time-entries')
      .set('Cookie', 'session=valid')
      .send(input)
      .expect(403);
    expect(create).not.toHaveBeenCalled();
  });

  it('updates an owned entry with validated input', async () => {
    update.mockResolvedValue({ timeEntry: { id: taskId } });
    await request(app.getHttpServer())
      .patch(`/time-entries/${taskId}`)
      .set('Cookie', 'session=valid')
      .set('Origin', 'http://localhost:4200')
      .send({ description: '  corrected  ' })
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(update).toHaveBeenCalledWith('owner', taskId, {
      description: 'corrected',
    });
  });

  it('rejects invalid edits and protected billing fields', async () => {
    for (const body of [
      {},
      { amount: '10' },
      { hourlyRate: '20' },
      { currency: 'EUR' },
      { userId: 'foreign' },
      { taskId: 'invalid' },
      { startedAt: 'invalid' },
      { endedAt: null },
    ]) {
      await request(app.getHttpServer())
        .patch(`/time-entries/${taskId}`)
        .set('Cookie', 'session=valid')
        .set('Origin', 'http://localhost:4200')
        .send(body)
        .expect(400);
    }
    await request(app.getHttpServer())
      .patch('/time-entries/invalid')
      .set('Cookie', 'session=valid')
      .set('Origin', 'http://localhost:4200')
      .send({ description: 'test' })
      .expect(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('protects edits with authentication and origin checks', async () => {
    await request(app.getHttpServer())
      .patch(`/time-entries/${taskId}`)
      .set('Origin', 'http://localhost:4200')
      .send({ description: 'test' })
      .expect(401);
    await request(app.getHttpServer())
      .patch(`/time-entries/${taskId}`)
      .set('Cookie', 'session=valid')
      .set('Origin', 'https://foreign.example')
      .send({ description: 'test' })
      .expect(403);
    expect(update).not.toHaveBeenCalled();
  });

  it('returns the active timer or null for the authenticated user', async () => {
    for (const timeEntry of [null, { id: 'entry', endedAt: null }]) {
      active.mockResolvedValue({ timeEntry });
      const response = await request(app.getHttpServer())
        .get('/timer')
        .set('Cookie', 'session=valid')
        .expect(200)
        .expect('Cache-Control', 'no-store');
      expect(response.body).toEqual({ timeEntry });
      expect(active).toHaveBeenCalledWith('owner');
    }
  });

  it('starts with server-controlled ownership and validated input', async () => {
    start.mockResolvedValue({ timeEntry: { id: 'entry' } });
    await request(app.getHttpServer())
      .post('/timer/start')
      .set('Cookie', 'session=valid')
      .set('Origin', 'http://localhost:4200')
      .send({ taskId })
      .expect(201)
      .expect('Cache-Control', 'no-store');
    expect(start).toHaveBeenCalledWith('owner', { taskId });
  });

  it('rejects invalid IDs and client-controlled billing or timestamps', async () => {
    for (const body of [
      {},
      { taskId: 'invalid' },
      { taskId, projectId: taskId },
      { taskId, hourlyRate: '1' },
      { taskId, userId: 'foreign' },
      { taskId, startedAt: '2026-01-01T00:00:00Z' },
    ]) {
      await request(app.getHttpServer())
        .post('/timer/start')
        .set('Cookie', 'session=valid')
        .set('Origin', 'http://localhost:4200')
        .send(body)
        .expect(400);
    }
    expect(start).not.toHaveBeenCalled();
  });

  it('stops the authenticated user timer', async () => {
    stop.mockResolvedValue({ timeEntry: { id: 'entry', amount: '100' } });
    await request(app.getHttpServer())
      .post('/timer/stop')
      .set('Cookie', 'session=valid')
      .set('Origin', 'http://localhost:4200')
      .expect(200);
    expect(stop).toHaveBeenCalledWith('owner');
  });

  it('lists history with defaults and validates date range and pagination', async () => {
    history.mockResolvedValue({ timeEntries: [] });
    await request(app.getHttpServer())
      .get('/time-entries')
      .set('Cookie', 'session=valid')
      .expect(200);
    expect(history).toHaveBeenCalledWith('owner', {
      page: 1,
      limit: 20,
      status: 'all',
    });
    for (const query of [
      'limit=101',
      'from=invalid',
      'client=',
      `projectId=${taskId}`,
      'from=2026-11-17T00:00:00Z&to=2026-11-16T00:00:00Z',
    ]) {
      await request(app.getHttpServer())
        .get(`/time-entries?${query}`)
        .set('Cookie', 'session=valid')
        .expect(400);
    }
  });

  it('accepts client and task filters for history', async () => {
    history.mockResolvedValue({ timeEntries: [] });
    await request(app.getHttpServer())
      .get(`/time-entries?client=Acme&taskId=${taskId}`)
      .set('Cookie', 'session=valid')
      .expect(200);
    expect(history).toHaveBeenCalledWith('owner', {
      page: 1,
      limit: 20,
      status: 'all',
      client: 'Acme',
      taskId,
    });
  });

  it('rejects cross-origin timer mutations', async () => {
    for (const endpoint of ['start', 'stop']) {
      await request(app.getHttpServer())
        .post(`/timer/${endpoint}`)
        .set('Cookie', 'session=valid')
        .set('Origin', 'https://evil.example')
        .send({ taskId })
        .expect(403);
    }
  });
});
