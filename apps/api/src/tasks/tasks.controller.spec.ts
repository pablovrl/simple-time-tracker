import { UnauthorizedException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { SessionsService } from '../auth/sessions.service.js';
import { TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';

describe('Tasks endpoints', () => {
  let app: INestApplication;
  const list = vi.fn();
  const create = vi.fn();
  const projectId = 'e7e283f0-7750-46f5-866f-41d0225c529e';
  const input = { projectId, title: 'Implement login' };

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.stubEnv('FRONTEND_URL', 'http://localhost:4200');
    vi.stubEnv('NODE_ENV', 'test');
    const module = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        { provide: TasksService, useValue: { list, create } },
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

  it('requires a session', async () => {
    await request(app.getHttpServer())
      .get(`/tasks?projectId=${projectId}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/tasks')
      .set('Origin', 'http://localhost:4200')
      .send(input)
      .expect(401);
  });

  it('lists tasks using the authenticated owner', async () => {
    list.mockResolvedValue({ tasks: [] });
    await request(app.getHttpServer())
      .get(`/tasks?projectId=${projectId}`)
      .set('Cookie', 'session=valid')
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(list).toHaveBeenCalledWith('owner', {
      projectId,
    });
  });

  it('creates a task with a trimmed title and default status', async () => {
    create.mockResolvedValue({ task: { id: 'task-id' } });
    await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', 'session=valid')
      .set('Origin', 'http://localhost:4200')
      .send({ ...input, title: ' Implement login ' })
      .expect(201);
    expect(create).toHaveBeenCalledWith('owner', {
      ...input,
      status: 'pending',
    });
  });

  it('rejects invalid payloads and injected ownership', async () => {
    for (const change of [
      { title: ' ' },
      { title: 'x'.repeat(256) },
      { status: 'invalid' },
      { projectId: 'invalid' },
      { userId: 'another-user' },
    ]) {
      await request(app.getHttpServer())
        .post('/tasks')
        .set('Cookie', 'session=valid')
        .set('Origin', 'http://localhost:4200')
        .send({ ...input, ...change })
        .expect(400);
    }
    expect(create).not.toHaveBeenCalled();
  });

  it('allows listing without a project filter', async () => {
    list.mockResolvedValue({ tasks: [] });
    await request(app.getHttpServer())
      .get('/tasks')
      .set('Cookie', 'session=valid')
      .expect(200);
    expect(list).toHaveBeenCalledWith('owner', {});
  });

  it('validates the optional project filter and rejects unknown query parameters', async () => {
    for (const query of [
      '?projectId=invalid',
      `?projectId=${projectId}&limit=101`,
    ]) {
      await request(app.getHttpServer())
        .get(`/tasks${query}`)
        .set('Cookie', 'session=valid')
        .expect(400);
    }
    expect(list).not.toHaveBeenCalled();
  });

  it('rejects untrusted origins for creation', async () => {
    await request(app.getHttpServer())
      .post('/tasks')
      .set('Cookie', 'session=valid')
      .set('Origin', 'https://evil.example')
      .send(input)
      .expect(403);
    expect(create).not.toHaveBeenCalled();
  });
});
