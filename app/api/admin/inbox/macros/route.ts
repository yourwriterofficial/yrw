import { NextResponse } from 'next/server';
import { z } from 'zod';
import { deleteMacro, getMacros, saveMacro } from '@/lib/inbox';
import { adminOnly, failure } from '../_util';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const a = await adminOnly();
  if (!a.ok) return a.res;
  try {
    return NextResponse.json({ macros: await getMacros(new URL(request.url).searchParams.get('brand') || undefined) });
  } catch (err) {
    return failure(err, 'Could not load saved replies.');
  }
}

const schema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(120),
  subject: z.string().trim().max(250).optional(),
  body: z.string().trim().min(2).max(8000),
  brand: z.enum(['developa', 'yourwriter']).nullable().optional(),
  category: z.string().trim().max(40).optional(),
});

export async function POST(request: Request) {
  const a = await adminOnly();
  if (!a.ok) return a.res;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Give the reply a title and some text.' }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, macro: await saveMacro(parsed.data, a.g.email) });
  } catch (err) {
    return failure(err, 'Could not save the reply.');
  }
}

export async function DELETE(request: Request) {
  const a = await adminOnly();
  if (!a.ok) return a.res;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id.' }, { status: 400 });
  try {
    await deleteMacro(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return failure(err, 'Could not delete it.');
  }
}
