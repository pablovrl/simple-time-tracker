import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';

@Injectable()
export class GoogleAuthService {
  // Temporary login attempts become invalid on restart. No tokens are stored.
  private readonly encryptionKey = randomBytes(32);

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
}
