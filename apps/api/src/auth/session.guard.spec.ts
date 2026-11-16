import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { SessionGuard } from './session.guard.js';
import type { SessionsService } from './sessions.service.js';

describe('SessionGuard', () => {
  const authenticate = vi.fn();
  const guard = new SessionGuard({
    authenticate,
  } as unknown as SessionsService);
  function context(method: string, origin?: string) {
    const request = {
      method,
      headers: { cookie: 'session=token', origin },
      user: undefined,
    };
    return {
      request,
      context: {
        switchToHttp: () => ({ getRequest: () => request }),
      } as ExecutionContext,
    };
  }
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('FRONTEND_URL', 'http://localhost:4200');
    vi.stubEnv('NODE_ENV', 'test');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('attaches the authenticated user', async () => {
    const user = { id: 'id', name: 'User', email: 'user@example.com' };
    authenticate.mockResolvedValue(user);
    const test = context('GET');
    await expect(guard.canActivate(test.context)).resolves.toBe(true);
    expect(test.request.user).toEqual(user);
    expect(authenticate).toHaveBeenCalledWith('token');
  });

  it('propagates invalid-session failures', async () => {
    authenticate.mockRejectedValue(new UnauthorizedException());
    await expect(
      guard.canActivate(context('GET').context),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects writes with missing or untrusted origins', async () => {
    for (const origin of [undefined, 'https://evil.example']) {
      await expect(
        guard.canActivate(context('POST', origin).context),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('allows authenticated writes from the frontend origin', async () => {
    authenticate.mockResolvedValue({ id: 'id' });
    await expect(
      guard.canActivate(context('POST', 'http://localhost:4200').context),
    ).resolves.toBe(true);
  });
});
