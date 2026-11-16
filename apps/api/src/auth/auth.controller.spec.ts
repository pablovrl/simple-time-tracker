import type { Request, Response } from 'express';
import { Test } from '@nestjs/testing';
import { AuthUsersService } from './auth-users.service.js';
import { AuthController } from './auth.controller.js';
import { GoogleAuthService } from './google-auth.service.js';
import { SessionsService } from './sessions.service.js';
import type { SessionRequest } from './session.guard.js';

describe('AuthController', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('returns the current user without caching', () => {
    const controller = new AuthController(
      {} as GoogleAuthService,
      {} as AuthUsersService,
      {} as SessionsService,
    );
    const user = { id: 'id', name: 'User', email: 'user@example.com' };
    const response = { setHeader: vi.fn() };
    expect(
      controller.getMe(
        { user } as SessionRequest,
        response as unknown as Response,
      ),
    ).toEqual({ user });
    expect(response.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'no-store',
    );
  });

  it('revokes the session and clears its cookie on logout', async () => {
    const revoke = vi.fn().mockResolvedValue(undefined);
    const controller = new AuthController(
      {} as GoogleAuthService,
      {} as AuthUsersService,
      { revoke } as unknown as SessionsService,
    );
    const response = { setHeader: vi.fn(), clearCookie: vi.fn() };
    await expect(
      controller.logout(
        { headers: { cookie: 'session=token' } } as SessionRequest,
        response as unknown as Response,
      ),
    ).resolves.toEqual({ status: 'ok' });
    expect(revoke).toHaveBeenCalledWith('token');
    expect(response.clearCookie).toHaveBeenCalledWith(
      'session',
      expect.objectContaining({
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
      }),
    );
  });
  it('sets a temporary protected cookie and redirects to Google', () => {
    const service = new GoogleAuthService();
    vi.spyOn(service, 'startLogin').mockReturnValue({
      url: 'https://accounts.google.com/o/oauth2/v2/auth',
      cookie: 'encrypted-attempt',
      secure: true,
    });
    const response = {
      setHeader: vi.fn(),
      cookie: vi.fn(),
      redirect: vi.fn(),
    };
    const users = { findOrCreate: vi.fn() };
    const controller = new AuthController(
      service,
      users as unknown as AuthUsersService,
      {} as SessionsService,
    );
    controller.startGoogleLogin(response as unknown as Response);
    expect(response.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'no-store',
    );
    expect(response.cookie).toHaveBeenCalledWith(
      'google_oauth',
      'encrypted-attempt',
      {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/auth/google',
        maxAge: 600000,
      },
    );
    expect(response.redirect).toHaveBeenCalledWith(
      302,
      'https://accounts.google.com/o/oauth2/v2/auth',
    );
  });

  it('persists the user, creates a session and redirects to the frontend', async () => {
    vi.stubEnv('FRONTEND_URL', 'http://localhost:4200');
    vi.stubEnv('NODE_ENV', 'test');
    const create = vi
      .fn()
      .mockResolvedValue({ token: 'session-token', expiresAt: new Date() });
    const identity = {
      provider: 'google' as const,
      subject: 'google-sub',
      email: 'user@example.com',
      name: 'User',
    };
    const completeLogin = vi.fn().mockResolvedValue(identity);
    const findOrCreate = vi.fn().mockResolvedValue({
      id: 'user-id',
      name: 'User',
      email: identity.email,
      googleSubject: identity.subject,
    });
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: GoogleAuthService, useValue: { completeLogin } },
        { provide: AuthUsersService, useValue: { findOrCreate } },
        { provide: SessionsService, useValue: { create } },
      ],
    }).compile();
    const response = {
      setHeader: vi.fn(),
      clearCookie: vi.fn(),
      cookie: vi.fn(),
      redirect: vi.fn(),
    };
    const request = { headers: { cookie: 'google_oauth=encrypted-attempt' } };
    await expect(
      module
        .get(AuthController)
        .googleCallback(
          'code',
          'state',
          request as Request,
          response as unknown as Response,
        ),
    ).resolves.toBeUndefined();
    expect(create).toHaveBeenCalledWith('user-id');
    expect(response.cookie).toHaveBeenCalledWith(
      'session',
      'session-token',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 604800000,
      }),
    );
    expect(response.redirect).toHaveBeenCalledWith(
      302,
      'http://localhost:4200/',
    );
    expect(completeLogin).toHaveBeenCalledWith(
      'code',
      'state',
      'encrypted-attempt',
    );
    expect(findOrCreate).toHaveBeenCalledWith(identity);
    expect(response.clearCookie).toHaveBeenCalled();
  });
});
