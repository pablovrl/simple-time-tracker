import type { Response } from 'express';
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
    new AuthController(service).startGoogleLogin(
      response as unknown as Response,
    );
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
});
