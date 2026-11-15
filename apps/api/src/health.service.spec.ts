import { ServiceUnavailableException } from '@nestjs/common';
import { getDrizzleToken } from '@nestjs/drizzle';
import { Test } from '@nestjs/testing';
import { HealthService } from './health.service.js';

describe('HealthService', () => {
  const execute = vi.fn();
  let service: HealthService;

  beforeEach(async () => {
    execute.mockReset();
    const module = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: getDrizzleToken(), useValue: { execute } },
      ],
    }).compile();
    service = module.get(HealthService);
  });

  it('reports a healthy database when the query succeeds', async () => {
    execute.mockResolvedValue({});
    await expect(service.check()).resolves.toEqual({
      status: 'ok',
      database: { status: 'up' },
    });
    expect(execute).toHaveBeenCalledOnce();
  });

  it('returns 503 without exposing database errors', async () => {
    execute.mockRejectedValue(new Error('sensitive connection details'));
    const error = await service.check().catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getStatus()).toBe(503);
    expect((error as ServiceUnavailableException).getResponse()).toEqual({
      status: 'error',
      database: { status: 'down' },
    });
  });
});
