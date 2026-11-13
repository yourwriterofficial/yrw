import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Please sign in to upload images.' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are supported.' }, { status: 400 });
    }

    // Limit to 5MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be under 5MB.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = buffer.toString('base64');
    const appsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_UPLOAD_URL;

    // 1. If Google Apps Script Web App is configured, upload directly to Google Drive
    if (appsScriptUrl && appsScriptUrl.startsWith('https://script.google.com/')) {
      try {
        const gasRes = await fetch(appsScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64Data,
            mimeType: file.type,
            fileName: file.name,
            secret: process.env.DRIVE_UPLOAD_SECRET || 'developa_drive_upload_secret_2026',
          }),
        });

        if (gasRes.ok) {
          const gasData = await gasRes.json();
          if (gasData.url) {
            return NextResponse.json({ url: gasData.url, provider: 'google_drive' });
          }
        }
      } catch (gasErr) {
        console.warn('Google Apps Script upload failed, falling back:', gasErr);
      }
    }

    // 2. High-reliability fallback (data URL or Supabase storage if available)
    const dataUrl = `data:${file.type};base64,${base64Data}`;
    return NextResponse.json({
      url: dataUrl,
      provider: 'base64_data',
      note: 'Stored as data URL. Set GOOGLE_APPS_SCRIPT_UPLOAD_URL in .env to store directly on your Google Drive.',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
