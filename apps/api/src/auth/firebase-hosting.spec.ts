import { UnauthorizedException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from './auth.controller.js';
import { AuthUsersService } from './auth-users.service.js';
import { GoogleAuthService } from './google-auth.service.js';
import { SessionsService } from './sessions.service.js';

describe('Firebase Hosting authentication', () => {
  let app: INestApplication;
  const frontend = 'https://simple-time-tracker-514822.web.app';
  const token = 'a'.repeat(43);
  const previousToken = 'b'.repeat(43);
  const completeLogin = vi.fn();
  const revoke = vi.fn();
  const identity = {
    provider: 'google',
    subject: 'google-user',
    email: 'user@example.com',
    name: 'User',
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('FIREBASE_HOSTING', 'true');
    vi.stubEnv('FRONTEND_URL', frontend);
    vi.stubEnv('GOOGLE_CALLBACK_URL', `${frontend}/api/auth/google/callback`);
    completeLogin.mockResolvedValue(identity);
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: GoogleAuthService,
          useValue: {
            startLogin: () => ({
              cookie: 'encrypted-attempt',
              url: 'https://accounts.google.com/o/oauth2/v2/auth',
              secure: true,
            }),
            completeLogin,
          },
        },
        {
          provide: AuthUsersService,
          useValue: { findOrCreate: async () => ({ id: 'owner' }) },
        },
        {
          provide: SessionsService,
          useValue: {
            create: async () => ({
              token,
              expiresAt: new Date(Date.now() + 604800000),
            }),
            revoke,
            authenticate: async (value: string | undefined) => {
              if (value !== token && value !== previousToken)
                throw new UnauthorizedException();
              return { id: 'owner', name: 'User', email: 'user@example.com' };
            },
          },
        },
      ],
    }).compile();
    app = module.createNestApplication(new ExpressAdapter());
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
    vi.unstubAllEnvs();
  });

  it('completes login with only the __session cookie forwarded by Hosting', async () => {
    const start = await request(app.getHttpServer())
      .get('/api/auth/google')
      .set('Cookie', `__session=${previousToken}`)
      .expect(302);
    const cookies = start.headers['set-cookie'] as unknown as string[];
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toContain(
      `__session=oauth.${previousToken}.encrypted-attempt`,
    );
    expect(cookies[0]).toContain('Path=/;');
    expect(cookies[0]).toContain('HttpOnly');
    expect(cookies[0]).toContain('Secure');
    expect(cookies[0]).toContain('SameSite=Lax');

    const callback = await request(app.getHttpServer())
      .get('/api/auth/google/callback?code=code&state=state')
      .set('Cookie', cookies[0].split(';')[0])
      .expect(302)
      .expect('Location', `${frontend}/`)
      .expect('Cache-Control', 'no-store');
    expect(completeLogin).toHaveBeenCalledWith(
      'code',
      'state',
      'encrypted-attempt',
    );
    expect(revoke).toHaveBeenCalledWith(previousToken);
    expect(
      callback.headers['set-cookie'].some((cookie: string) =>
        cookie.startsWith(`__session=${token};`),
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', `__session=${token}`)
      .expect(200)
      .expect('Cache-Control', 'no-store');
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', `__session=${token}`)
      .set('Origin', frontend)
      .expect(201);
    expect(revoke).toHaveBeenLastCalledWith(token);
  });

  it('still enforces authentication and origin checks', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', `session=${token}`)
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', '__session=oauth..encrypted-attempt')
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', `__session=${token}`)
      .set('Origin', 'https://attacker.example')
      .expect(403);
  });
});
