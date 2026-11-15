import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { GoogleAuthService } from './google-auth.service.js';
import { AuthUsersService } from './auth-users.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly googleAuth: GoogleAuthService,
    private readonly authUsers: AuthUsersService,
  ) {}

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

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: unknown,
    @Query('state') state: unknown,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.clearCookie('google_oauth', {
      httpOnly: true,
      secure: process.env.GOOGLE_CALLBACK_URL?.startsWith('https:') ?? false,
      sameSite: 'lax',
      path: '/auth/google',
    });
    const cookie = request.headers.cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('google_oauth='))
      ?.slice('google_oauth='.length);
    const identity = await this.googleAuth.completeLogin(code, state, cookie);
    const user = await this.authUsers.findOrCreate(identity);
    return {
      status: 'ok',
      user: { id: user.id, name: user.name, email: user.email },
    };
  }
}
