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
  firebaseHosting,
  readSessionCookie,
  readOAuthCookie,
  oauthCookieName,
  oauthCookiePath,
  sessionCookieName,
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
  startGoogleLogin(@Res() response: Response, @Req() request: Request): void {
    const login = this.googleAuth.startLogin();
    response.setHeader('Cache-Control', 'no-store');
    const cookie = firebaseHosting()
      ? `oauth.${readSessionCookie(request.headers.cookie) ?? ''}.${login.cookie}`
      : login.cookie;
    response.cookie(oauthCookieName(), cookie, {
      httpOnly: true,
      secure: login.secure,
      sameSite: 'lax',
      path: oauthCookiePath(),
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
    response.clearCookie(oauthCookieName(), {
      httpOnly: true,
      secure: process.env.GOOGLE_CALLBACK_URL?.startsWith('https:') ?? false,
      sameSite: 'lax',
      path: oauthCookiePath(),
    });
    const cookie = readOAuthCookie(request.headers.cookie);
    const identity = await this.googleAuth.completeLogin(code, state, cookie);
    const user = await this.authUsers.findOrCreate(identity);
    const previousToken = readSessionCookie(request.headers.cookie);
    if (previousToken) await this.sessions.revoke(previousToken);
    const session = await this.sessions.create(user.id);
    response.cookie(sessionCookieName(), session.token, {
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
    await this.sessions.revoke(readSessionCookie(request.headers.cookie)!);
    response.setHeader('Cache-Control', 'no-store');
    response.clearCookie(sessionCookieName(), sessionCookieOptions());
    return { status: 'ok' };
  }
}
