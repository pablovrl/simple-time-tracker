import { UnauthorizedException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { SessionsService } from '../auth/sessions.service.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';

describe('Projects endpoints', () => {
  let app: INestApplication;
  const list = vi.fn();
  const create = vi.fn();
  const input = { name: 'Website', hourlyRate: '25.50', currency: 'USD' };

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.stubEnv('FRONTEND_URL', 'http://localhost:4200');
    vi.stubEnv('NODE_ENV', 'test');
    const module = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        { provide: ProjectsService, useValue: { list, create } },
        {
          provide: SessionsService,
          useValue: {
            authenticate: vi.fn(async (token) => {
              if (token !== 'valid-session') throw new UnauthorizedException();
              return {
                id: 'session-user',
                name: 'User',
                email: 'user@example.com',
              };
            }),
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

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get('/projects').expect(401);
    expect(list).not.toHaveBeenCalled();
  });

  it('lists with defaults and the authenticated owner', async () => {
    list.mockResolvedValue({
      projects: [],
      pagination: { page: 1, limit: 20, hasMore: false },
    });
    await request(app.getHttpServer())
      .get('/projects')
      .set('Cookie', 'session=valid-session')
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(list).toHaveBeenCalledWith('session-user', {
      page: 1,
      limit: 20,
      status: 'active',
    });
  });

  it('validates and converts list filters', async () => {
    list.mockResolvedValue({ projects: [] });
    await request(app.getHttpServer())
      .get('/projects?page=2&limit=10&status=archived')
      .set('Cookie', 'session=valid-session')
      .expect(200);
    expect(list).toHaveBeenCalledWith('session-user', {
      page: 2,
      limit: 10,
      status: 'archived',
    });
    await request(app.getHttpServer())
      .get('/projects?limit=101')
      .set('Cookie', 'session=valid-session')
      .expect(400);
  });

  it('creates with validated input and owner from the session', async () => {
    create.mockResolvedValue({ project: { id: 'project-id', ...input } });
    await request(app.getHttpServer())
      .post('/projects')
      .set('Cookie', 'session=valid-session')
      .set('Origin', 'http://localhost:4200')
      .send({ ...input, name: ' Website ' })
      .expect(201);
    expect(create).toHaveBeenCalledWith('session-user', input);
  });

  it('rejects invalid rates, currencies, names and injected ownership', async () => {
    for (const change of [
      { hourlyRate: 25.5 },
      { hourlyRate: '-1' },
      { hourlyRate: '1.1234567' },
      { hourlyRate: '1000000000000' },
      { currency: 'ZZZ' },
      { name: ' ' },
      { userId: 'another-user' },
    ]) {
      await request(app.getHttpServer())
        .post('/projects')
        .set('Cookie', 'session=valid-session')
        .set('Origin', 'http://localhost:4200')
        .send({ ...input, ...change })
        .expect(400);
    }
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects cross-origin creation', async () => {
    await request(app.getHttpServer())
      .post('/projects')
      .set('Cookie', 'session=valid-session')
      .set('Origin', 'https://evil.example')
      .send(input)
      .expect(403);
    expect(create).not.toHaveBeenCalled();
  });
});
