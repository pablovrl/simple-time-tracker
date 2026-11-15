import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class GoogleAuthService {
  // Temporary login attempts become invalid on restart. No tokens are stored.
  private readonly encryptionKey = randomBytes(32);
  private readonly pending = new Map<string, number>();

  startLogin() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const callbackUrl = process.env.GOOGLE_CALLBACK_URL;
    if (!clientId || !callbackUrl || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new ServiceUnavailableException('Google login is not configured');
    }

    let callback: URL;
    try {
      callback = new URL(callbackUrl);
      if (
        callback.protocol !== 'https:' &&
        !(
          callback.protocol === 'http:' &&
          ['localhost', '127.0.0.1'].includes(callback.hostname) &&
          process.env.NODE_ENV !== 'production'
        )
      ) {
        throw new Error('Invalid callback protocol');
      }
    } catch {
      throw new ServiceUnavailableException('Google callback URL is invalid');
    }

    const state = randomBytes(32).toString('base64url');
    for (const [key, expiresAt] of this.pending) {
      if (expiresAt <= Date.now()) this.pending.delete(key);
    }
    if (this.pending.size >= 10000) {
      throw new ServiceUnavailableException('Please try again later');
    }
    this.pending.set(state, Date.now() + 10 * 60 * 1000);
    const nonce = randomBytes(32).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(
        JSON.stringify({
          state,
          nonce,
          verifier,
          expiresAt: Date.now() + 10 * 60 * 1000,
        }),
        'utf8',
      ),
      cipher.final(),
    ]);
    const cookie = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
      'base64url',
    );

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    }).toString();

    return {
      url: url.toString(),
      cookie,
      secure: callback.protocol === 'https:',
    };
  }

  async completeLogin(
    code: unknown,
    state: unknown,
    cookie: string | undefined,
  ) {
    try {
      if (
        typeof code !== 'string' ||
        !code ||
        code.length > 4096 ||
        typeof state !== 'string' ||
        !state ||
        !cookie ||
        cookie.length > 4096
      ) {
        throw new Error('Invalid callback');
      }
      const data = Buffer.from(cookie, 'base64url');
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.encryptionKey,
        data.subarray(0, 12),
      );
      decipher.setAuthTag(data.subarray(12, 28));
      const attempt = JSON.parse(
        Buffer.concat([
          decipher.update(data.subarray(28)),
          decipher.final(),
        ]).toString('utf8'),
      ) as {
        state: string;
        nonce: string;
        verifier: string;
        expiresAt: number;
      };
      if (
        attempt.state !== state ||
        attempt.expiresAt <= Date.now() ||
        (this.pending.get(state) ?? 0) <= Date.now()
      ) {
        throw new Error('Invalid or expired attempt');
      }
      // Consume before making network requests to prevent concurrent replay.
      this.pending.delete(state);
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const callbackUrl = process.env.GOOGLE_CALLBACK_URL;
      if (!clientId || !clientSecret || !callbackUrl) {
        throw new Error('Missing configuration');
      }
      const client = new OAuth2Client(clientId, clientSecret, callbackUrl);
      const { tokens } = await client.getToken({
        code,
        codeVerifier: attempt.verifier,
      });
      if (!tokens.id_token) throw new Error('Missing ID token');
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      if (
        !payload?.sub ||
        !payload.email ||
        !payload.email_verified ||
        (payload as { nonce?: string }).nonce !== attempt.nonce
      ) {
        throw new Error('Invalid identity');
      }
      return {
        provider: 'google' as const,
        subject: payload.sub,
        email: payload.email,
        name: payload.name ?? null,
      };
    } catch {
      throw new UnauthorizedException(
        'Google authentication failed. Start a new login.',
      );
    }
  }
}
