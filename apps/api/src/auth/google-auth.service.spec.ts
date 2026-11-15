import { ServiceUnavailableException } from '@nestjs/common';
import { GoogleAuthService } from './google-auth.service.js';

describe('GoogleAuthService', () => {
  beforeEach(() => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-secret');
    vi.stubEnv(
      'GOOGLE_CALLBACK_URL',
      'http://localhost:3000/auth/google/callback',
    );
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => vi.unstubAllEnvs());

  it('builds a Google authorization URL with state, nonce and PKCE', () => {
    const login = new GoogleAuthService().startLogin();
    const url = new URL(login.url);
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('client_id')).toBe('test-client');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/auth/google/callback',
    );
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    for (const parameter of ['state', 'nonce', 'code_challenge']) {
      expect(url.searchParams.get(parameter)).toMatch(/^[\w-]{43}$/);
    }
    expect(login.cookie).not.toContain('test-secret');
    expect(login.secure).toBe(false);
  });

  it('creates unique login attempts', () => {
    const service = new GoogleAuthService();
    const first = service.startLogin();
    const second = service.startLogin();
    expect(first.cookie).not.toBe(second.cookie);
    expect(first.url).not.toBe(second.url);
  });

  it('requires credentials', () => {
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '');
    expect(() => new GoogleAuthService().startLogin()).toThrow(
      ServiceUnavailableException,
    );
  });

  it('rejects insecure callbacks outside local development', () => {
    vi.stubEnv(
      'GOOGLE_CALLBACK_URL',
      'http://example.com/auth/google/callback',
    );
    expect(() => new GoogleAuthService().startLogin()).toThrow(
      ServiceUnavailableException,
    );
    vi.stubEnv(
      'GOOGLE_CALLBACK_URL',
      'http://localhost:3000/auth/google/callback',
    );
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => new GoogleAuthService().startLogin()).toThrow(
      ServiceUnavailableException,
    );
  });

  it('uses secure cookies with HTTPS', () => {
    vi.stubEnv(
      'GOOGLE_CALLBACK_URL',
      'https://example.com/auth/google/callback',
    );
    expect(new GoogleAuthService().startLogin().secure).toBe(true);
  });
});
