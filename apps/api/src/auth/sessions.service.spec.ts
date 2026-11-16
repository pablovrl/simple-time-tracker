import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDrizzleToken } from '@nestjs/drizzle';
import { createHash } from 'node:crypto';
import { SessionsService, SESSION_DURATION } from './sessions.service.js';

describe('SessionsService', () => {
  const values = vi.fn();
  const whereDelete = vi.fn();
  const limit = vi.fn();
  let service: SessionsService;

  beforeEach(async () => {
    vi.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        SessionsService,
        {
          provide: getDrizzleToken(),
          useValue: {
            insert: () => ({ values }),
            select: () => ({
              from: () => ({ innerJoin: () => ({ where: () => ({ limit }) }) }),
            }),
            delete: () => ({ where: whereDelete }),
          },
        },
      ],
    }).compile();
    service = module.get(SessionsService);
  });

  it('stores only a hash and creates unique tokens expiring in seven days', async () => {
    const before = Date.now();
    const session = await service.create('user-id');
    expect(session.token).toMatch(/^[\w-]{43}$/);
    expect(values).toHaveBeenCalledWith({
      userId: 'user-id',
      tokenHash: createHash('sha256').update(session.token).digest('hex'),
      expiresAt: session.expiresAt,
    });
    expect(session.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + SESSION_DURATION,
    );
    expect((await service.create('user-id')).token).not.toBe(session.token);
  });

  it('returns the user for a valid session', async () => {
    const user = { id: 'user-id', name: 'User', email: 'user@example.com' };
    limit.mockResolvedValue([user]);
    await expect(service.authenticate('a'.repeat(43))).resolves.toEqual(user);
  });

  it('rejects missing and malformed tokens before querying', async () => {
    await expect(service.authenticate(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(service.authenticate('bad')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(limit).not.toHaveBeenCalled();
  });

  it('rejects a session not returned by the unexpired-session query', async () => {
    limit.mockResolvedValue([]);
    await expect(service.authenticate('a'.repeat(43))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('deletes the session on logout', async () => {
    await service.revoke('a'.repeat(43));
    expect(whereDelete).toHaveBeenCalledOnce();
  });
});
