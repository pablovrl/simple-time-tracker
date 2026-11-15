import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { GoogleAuthService } from './google-auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly googleAuth: GoogleAuthService) {}

  @Get('google')
  startGoogleLogin(@Res() response: Response): void {
    const login = this.googleAuth.startLogin();
    response.setHeader('Cache-Control', 'no-store');
    response.cookie('google_oauth', login.cookie, {
      httpOnly: true,
      secure: login.secure,
      sameSite: 'lax',
      path: '/auth/google',
      maxAge: 10 * 60 * 1000,
    });
    response.redirect(302, login.url);
  }
}
