import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { GoogleAuthService } from './google-auth.service.js';
import { AuthUsersService } from './auth-users.service.js';
import {
  frontendUrl,
  readCookie,
  SESSION_COOKIE,
  SESSION_DURATION,
  sessionCookieOptions,
  SessionsService,
} from './sessions.service.js';
import { SessionGuard } from './session.guard.js';
import type { SessionRequest } from './session.guard.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly googleAuth: GoogleAuthService,
    private readonly authUsers: AuthUsersService,
    private readonly sessions: SessionsService,
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
    @Res() response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    const redirect = frontendUrl().toString();
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
    const previousToken = readCookie(request.headers.cookie, SESSION_COOKIE);
    if (previousToken) await this.sessions.revoke(previousToken);
    const session = await this.sessions.create(user.id);
    response.cookie(SESSION_COOKIE, session.token, {
      ...sessionCookieOptions(),
      maxAge: SESSION_DURATION,
      expires: session.expiresAt,
    });
    response.redirect(302, redirect);
  }

  @Get('me')
  @UseGuards(SessionGuard)
  getMe(
    @Req() request: SessionRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return { user: request.user };
  }

  @Post('logout')
  @UseGuards(SessionGuard)
  async logout(
    @Req() request: SessionRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.sessions.revoke(
      readCookie(request.headers.cookie, SESSION_COOKIE)!,
    );
    response.setHeader('Cache-Control', 'no-store');
    response.clearCookie(SESSION_COOKIE, sessionCookieOptions());
    return { status: 'ok' };
  }
}
