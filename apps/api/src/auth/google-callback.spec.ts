import { UnauthorizedException } from '@nestjs/common';
import { createDecipheriv, createHash } from 'node:crypto';
import { LoginTicket, OAuth2Client } from 'google-auth-library';
import { GoogleAuthService } from './google-auth.service.js';

describe('Google callback', () => {
  beforeEach(() => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-secret');
    vi.stubEnv(
      'GOOGLE_CALLBACK_URL',
      'http://localhost:3000/auth/google/callback',
    );
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  function setup(nonceMatches = true) {
    const service = new GoogleAuthService();
    const login = service.startLogin();
    const url = new URL(login.url);
    const data = Buffer.from(login.cookie, 'base64url');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      service['encryptionKey'],
      data.subarray(0, 12),
    );
    decipher.setAuthTag(data.subarray(12, 28));
    const attempt = JSON.parse(
      Buffer.concat([
        decipher.update(data.subarray(28)),
        decipher.final(),
      ]).toString('utf8'),
    ) as { nonce: string; verifier: string };
    const exchange = vi
      .spyOn(OAuth2Client.prototype, 'getToken')
      .mockResolvedValue({ tokens: { id_token: 'mock-id-token' }, res: null });
    const verify = vi
      .spyOn(OAuth2Client.prototype, 'verifyIdToken')
      .mockResolvedValue(
        new LoginTicket('', {
          iss: 'https://accounts.google.com',
          aud: 'test-client',
          sub: 'google-user',
          email: 'user@example.com',
          email_verified: true,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          ...{ nonce: nonceMatches ? attempt.nonce : 'wrong-nonce' },
        }),
      );
    return { service, login, url, attempt, exchange, verify };
  }

  it('exchanges using PKCE and verifies the token before returning identity', async () => {
    const { service, login, url, attempt, exchange, verify } = setup();
    await expect(
      service.completeLogin(
        'code',
        url.searchParams.get('state'),
        login.cookie,
      ),
    ).resolves.toEqual({
      provider: 'google',
      subject: 'google-user',
      email: 'user@example.com',
      name: null,
    });
    expect(exchange).toHaveBeenCalledWith({
      code: 'code',
      codeVerifier: attempt.verifier,
    });
    expect(
      createHash('sha256').update(attempt.verifier).digest('base64url'),
    ).toBe(url.searchParams.get('code_challenge'));
    expect(verify).toHaveBeenCalledWith({
      idToken: 'mock-id-token',
      audience: 'test-client',
    });
    await expect(
      service.completeLogin(
        'code',
        url.searchParams.get('state'),
        login.cookie,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(exchange).toHaveBeenCalledTimes(1);
  });

  it('rejects missing cookies, mismatched state and tampered cookies before exchange', async () => {
    const { service, login, url, exchange } = setup();
    for (const [state, cookie] of [
      [url.searchParams.get('state'), undefined],
      ['wrong-state', login.cookie],
      [url.searchParams.get('state'), 'invalid-cookie'],
    ]) {
      await expect(
        service.completeLogin('code', state, cookie),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
    expect(exchange).not.toHaveBeenCalled();
  });

  it('rejects expired attempts', async () => {
    const { service, login, url, exchange } = setup();
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 600001);
    await expect(
      service.completeLogin(
        'code',
        url.searchParams.get('state'),
        login.cookie,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(exchange).not.toHaveBeenCalled();
  });

  it('rejects a nonce mismatch', async () => {
    const { service, login, url } = setup(false);
    await expect(
      service.completeLogin(
        'code',
        url.searchParams.get('state'),
        login.cookie,
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('does not expose token exchange errors', async () => {
    const { service, login, url, exchange } = setup();
    exchange.mockRejectedValue(new Error('secret token details'));
    await expect(
      service.completeLogin(
        'code',
        url.searchParams.get('state'),
        login.cookie,
      ),
    ).rejects.toThrow('Google authentication failed. Start a new login.');
  });
});
