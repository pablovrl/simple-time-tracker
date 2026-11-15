import type { Request, Response } from 'express';
import { Test } from '@nestjs/testing';
import { AuthUsersService } from './auth-users.service.js';
import { AuthController } from './auth.controller.js';
import { GoogleAuthService } from './google-auth.service.js';

describe('AuthController', () => {
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

  it('persists a verified identity and returns the application user', async () => {
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
      ],
    }).compile();
    const response = { setHeader: vi.fn(), clearCookie: vi.fn() };
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
    ).resolves.toEqual({
      status: 'ok',
      user: { id: 'user-id', name: 'User', email: identity.email },
    });
    expect(completeLogin).toHaveBeenCalledWith(
      'code',
      'state',
      'encrypted-attempt',
    );
    expect(findOrCreate).toHaveBeenCalledWith(identity);
    expect(response.clearCookie).toHaveBeenCalled();
  });
});
