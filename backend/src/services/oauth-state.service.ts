import crypto from 'crypto';
import { AppError } from '../middleware/error.middleware';
import { config } from '../config';

type OAuthProvider = 'GOOGLE' | 'OUTLOOK';

interface OAuthStatePayload {
  userId: string;
  provider: OAuthProvider;
  exp: number;
  nonce: string;
}

interface StateOptions {
  now?: number;
  ttlMs?: number;
  nonce?: string;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;

function sign(payload: string): string {
  return crypto.createHmac('sha256', config.jwt.secret).update(payload).digest('base64url');
}

export function createOAuthState(userId: string, provider: OAuthProvider, options: StateOptions = {}): string {
  const now = options.now ?? Date.now();
  const payload: OAuthStatePayload = {
    userId,
    provider,
    exp: now + (options.ttlMs ?? DEFAULT_TTL_MS),
    nonce: options.nonce ?? crypto.randomBytes(16).toString('base64url'),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyOAuthState(state: string | undefined, options: Pick<StateOptions, 'now'> = {}) {
  if (!state) throw new AppError('Invalid OAuth state', 400);
  const [encodedPayload, signature] = state.split('.');
  if (!encodedPayload || !signature) throw new AppError('Invalid OAuth state', 400);

  const expectedSignature = sign(encodedPayload);
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    throw new AppError('Invalid OAuth state', 400);
  }

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    throw new AppError('Invalid OAuth state', 400);
  }

  if (!payload.userId || !['GOOGLE', 'OUTLOOK'].includes(payload.provider) || typeof payload.exp !== 'number') {
    throw new AppError('Invalid OAuth state', 400);
  }
  if ((options.now ?? Date.now()) > payload.exp) throw new AppError('OAuth state expired', 400);

  return { userId: payload.userId, provider: payload.provider };
}
