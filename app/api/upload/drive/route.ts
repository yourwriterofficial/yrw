import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { overLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Please sign in to upload images.' }, { status: 401 });
    }

    if (overLimit(`upload:${user.id}`, 30, 60 * 60 * 1000)) {
      return NextResponse.json({ error: 'Upload limit reached. Please try again later.' }, { status: 429 });
    }

    const appsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_UPLOAD_URL;
    const uploadSecret = process.env.DRIVE_UPLOAD_SECRET;
    if (!appsScriptUrl || !appsScriptUrl.startsWith('https://script.google.com/') || !uploadSecret) {
      return NextResponse.json({ error: 'Image uploads are not set up yet.' }, { status: 503 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    // An explicit list: no SVG (it can carry scripts), and not just "anything starting with image/".
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      return NextResponse.json({ error: 'Please upload a JPG, PNG, WebP or GIF image.' }, { status: 400 });
    }

    // Limit to 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be under 5MB.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = buffer.toString('base64');

    try {
      const gasRes = await fetch(appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data, mimeType: file.type, fileName: file.name, secret: uploadSecret }),
      });
      const gasData = gasRes.ok ? await gasRes.json() : null;
      if (gasData?.url) {
        return NextResponse.json({ url: gasData.url, provider: 'google_drive' });
      }
      console.warn('Drive upload returned no URL:', gasData?.error || gasRes.status);
    } catch (gasErr) {
      console.warn('Google Apps Script upload failed:', gasErr);
    }

    // Deliberately no data-URL fallback: a multi-megabyte string in every product row slows every page that lists products.
    return NextResponse.json({ error: 'The image could not be uploaded right now. Please try again.' }, { status: 502 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
