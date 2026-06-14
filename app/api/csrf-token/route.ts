import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

export async function GET() {
  const token = randomBytes(32).toString('hex');
  const response = NextResponse.json({ token });
  response.cookies.set('csrf-token', token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 3600 });
  return response;
}