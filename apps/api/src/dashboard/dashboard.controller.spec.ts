import { UnauthorizedException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { SessionsService } from '../auth/sessions.service.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

describe('Dashboard summary endpoint', () => {
  let app: INestApplication;
  const summary = vi.fn();
  const range = {
    from: '2026-11-23T00:00:00-03:00',
    to: '2026-11-30T00:00:00-03:00',
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const module = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: DashboardService, useValue: { summary } },
        {
          provide: SessionsService,
          useValue: {
            authenticate: async (token: string | undefined) => {
              if (token !== 'valid') throw new UnauthorizedException();
              return { id: 'owner' };
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
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer())
      .get('/dashboard/summary')
      .query(range)
      .expect(401);
    expect(summary).not.toHaveBeenCalled();
  });

  it('returns only the authenticated user summary without caching', async () => {
    const result = {
      workedSeconds: 3600,
      earnings: [{ currency: 'USD', amount: '40.000000' }],
    };
    summary.mockResolvedValue(result);
    const response = await request(app.getHttpServer())
      .get('/dashboard/summary')
      .query(range)
      .set('Cookie', 'session=valid')
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(response.body).toEqual(result);
    expect(summary).toHaveBeenCalledWith('owner', range);
  });

  it('rejects missing, invalid, reversed ranges and ownership overrides', async () => {
    for (const query of [
      {},
      { from: range.from },
      { ...range, from: 'invalid' },
      { ...range, from: '2026-02-30T00:00:00Z' },
      { ...range, from: '2026-11-23' },
      { ...range, to: range.from },
      { from: range.to, to: range.from },
      { ...range, userId: 'foreign' },
    ]) {
      await request(app.getHttpServer())
        .get('/dashboard/summary')
        .query(query)
        .set('Cookie', 'session=valid')
        .expect(400);
    }
    expect(summary).not.toHaveBeenCalled();
  });
});
