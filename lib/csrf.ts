// lib/csrf.ts
import { randomBytes } from 'crypto';

export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

export function setCsrfCookie(res: any, token: string) {
  res.setHeader('Set-Cookie', `csrf-token=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600`);
}

export function getCsrfTokenFromCookie(req: any): string | null {
  const cookie = req.headers.cookie;
  if (!cookie) return null;
  const match = cookie.match(/csrf-token=([^;]+)/);
  return match ? match[1] : null;
}