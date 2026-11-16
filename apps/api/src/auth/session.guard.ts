import { ForbiddenException, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import {
  frontendUrl,
  readCookie,
  SESSION_COOKIE,
  SessionsService,
} from './sessions.service.js';

export type SessionRequest = Request & {
  user: { id: string; name: string; email: string };
};

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionsService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    // Reject cross-origin writes, including requests without an Origin header.
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
      request.headers.origin !== frontendUrl().origin
    ) {
      throw new ForbiddenException('Invalid request origin');
    }
    request.user = await this.sessions.authenticate(
      readCookie(request.headers.cookie, SESSION_COOKIE),
    );
    return true;
  }
}
