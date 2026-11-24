import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { and, eq, gt } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createHash, randomBytes } from 'node:crypto';
import { sessions, users } from '../database/schema.js';

export const SESSION_COOKIE = 'session';
export const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

export function firebaseHosting() {
  return process.env.FIREBASE_HOSTING === 'true';
}

export function sessionCookieName() {
  return firebaseHosting() ? '__session' : SESSION_COOKIE;
}

// Hosting forwards only __session. During OAuth, retain the previous session
// alongside the encrypted attempt so it can be revoked after a successful login.
export function readSessionCookie(header: string | undefined) {
  const value = readCookie(header, sessionCookieName());
  if (firebaseHosting() && value?.startsWith('oauth.')) {
    return value.split('.')[1] || undefined;
  }
  return value;
}

export function oauthCookieName() {
  return firebaseHosting() ? '__session' : 'google_oauth';
}

export function oauthCookiePath() {
  return firebaseHosting() ? '/' : '/auth/google';
}

export function readOAuthCookie(header: string | undefined) {
  const value = readCookie(header, oauthCookieName());
  if (!firebaseHosting()) return value;
  const parts = value?.split('.');
  return parts?.length === 3 && parts[0] === 'oauth' ? parts[2] : undefined;
}

export function readCookie(header: string | undefined, name: string) {
  return header
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export function frontendUrl() {
  try {
    const url = new URL(process.env.FRONTEND_URL ?? '');
    if (
      url.username ||
      url.password ||
      (url.protocol !== 'https:' &&
        !(
          url.protocol === 'http:' &&
          ['localhost', '127.0.0.1'].includes(url.hostname) &&
          process.env.NODE_ENV !== 'production'
        ))
    )
      throw new Error('Invalid URL');
    return url;
  } catch {
    throw new ServiceUnavailableException('FRONTEND_URL is invalid');
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure:
      process.env.NODE_ENV === 'production' ||
      (process.env.GOOGLE_CALLBACK_URL?.startsWith('https:') ?? false),
    sameSite: 'lax' as const,
    path: '/',
  };
}

@Injectable()
export class SessionsService {
  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  async create(userId: string) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_DURATION);
    await this.db.insert(sessions).values({
      userId,
      tokenHash: this.hash(token),
      expiresAt,
    });
    return { token, expiresAt };
  }

  async authenticate(token: string | undefined) {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
      throw new UnauthorizedException();
    }
    const [user] = await this.db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(
          eq(sessions.tokenHash, this.hash(token)),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!user) throw new UnauthorizedException();
    return user;
  }

  async revoke(token: string) {
    await this.db
      .delete(sessions)
      .where(eq(sessions.tokenHash, this.hash(token)));
  }

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
