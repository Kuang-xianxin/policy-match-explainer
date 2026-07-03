import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool.js';

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const actual = Buffer.from(hash, 'hex');
  const expected = scryptSync(password, salt, 64);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await pool.query('INSERT INTO user_sessions (token_hash, user_id) VALUES ($1, $2)', [hashToken(token), userId]);
  return token;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  if (!token) {
    res.status(401).json({ error_code: 'UNAUTHORIZED', message: 'Missing bearer token.' });
    return;
  }

  const result = await pool.query<AuthUser>(
    `
    SELECT users.id, users.email, users.display_name
    FROM user_sessions
    JOIN users ON users.id = user_sessions.user_id
    WHERE user_sessions.token_hash = $1
    `,
    [hashToken(token)]
  );

  const user = result.rows[0];
  if (!user) {
    res.status(401).json({ error_code: 'UNAUTHORIZED', message: 'Invalid session.' });
    return;
  }

  (req as AuthenticatedRequest).user = user;
  next();
}
