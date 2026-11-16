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
  const projectId = 'e7e283f0-7750-46f5-866f-41d0225c529e';

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.stubEnv('FRONTEND_URL', 'http://localhost:4200');
    vi.stubEnv('NODE_ENV', 'test');
    const module = await Test.createTestingModule({
      controllers: [TimeEntriesController],
      providers: [
        { provide: TimeEntriesService, useValue: { start, stop, history } },
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
    for (const endpoint of ['start', 'stop']) {
      await request(app.getHttpServer())
        .post(`/timer/${endpoint}`)
        .set('Origin', 'http://localhost:4200')
        .send({ projectId })
        .expect(401);
    }
  });

  it('starts with server-controlled ownership and validated input', async () => {
    start.mockResolvedValue({ timeEntry: { id: 'entry' } });
    await request(app.getHttpServer())
      .post('/timer/start')
      .set('Cookie', 'session=valid')
      .set('Origin', 'http://localhost:4200')
      .send({ projectId })
      .expect(201)
      .expect('Cache-Control', 'no-store');
    expect(start).toHaveBeenCalledWith('owner', { projectId });
  });

  it('rejects invalid IDs and client-controlled billing or timestamps', async () => {
    for (const body of [
      { projectId: 'invalid' },
      { projectId, hourlyRate: '1' },
      { projectId, userId: 'foreign' },
      { projectId, startedAt: '2026-01-01T00:00:00Z' },
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
      'from=2026-11-17T00:00:00Z&to=2026-11-16T00:00:00Z',
    ]) {
      await request(app.getHttpServer())
        .get(`/time-entries?${query}`)
        .set('Cookie', 'session=valid')
        .expect(400);
    }
  });

  it('rejects cross-origin timer mutations', async () => {
    for (const endpoint of ['start', 'stop']) {
      await request(app.getHttpServer())
        .post(`/timer/${endpoint}`)
        .set('Cookie', 'session=valid')
        .set('Origin', 'https://evil.example')
        .send({ projectId })
        .expect(403);
    }
  });
});
