import { UnauthorizedException } from '@nestjs/common';
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
          useValue: { start, stop, history, active },
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
