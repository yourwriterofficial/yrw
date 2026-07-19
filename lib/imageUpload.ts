/**
 * Resizes an image file client-side so it is under 100KB, then uploads it via
 * the `upload-image` edge function, which forwards it to the Google Apps
 * Script Web App and returns a public Drive (lh3.googleusercontent.com) URL.
 *
 * The Apps Script URL deliberately lives in the GOOGLE_APPS_SCRIPT_URL Supabase
 * secret rather than a NEXT_PUBLIC_ var: NEXT_PUBLIC_ vars are inlined into
 * the client bundle, and that endpoint can also send email.
 *
 * Throws when the upload fails rather than silently falling back to a base64
 * data URI — a misconfigured Drive should look broken, not identical to a
 * working one with every "uploaded" image really inlined into the database.
 */
import { supabase } from './supabaseClient';

export async function resizeAndUploadImage(file: File): Promise<string> {
  const base64Data = await resizeImageToMax100KB(file);

  const { data, error } = await supabase.functions.invoke('upload-image', {
    body: {
      filename: file.name,
      mimeType: file.type,
      base64: base64Data.split(',')[1],
    },
  });

  if (error) {
    let detail = error.message;
    try {
      const body = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.();
      if (body?.error) detail = body.error;
    } catch { /* fall back to error.message */ }
    throw new Error(detail || 'Image upload failed');
  }
  if (!data?.url) throw new Error(data?.error || 'Upload did not return a URL');

  return data.url as string;
}

/** Exposed for callers that want a local preview without uploading. */
export function resizeImageToMax100KB(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let quality = 0.9;
        let width = img.width;
        let height = img.height;

        const maxDimension = 800;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get 2D canvas context'));
          return;
        }

        const compress = () => {
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          const approxSize = (dataUrl.length * 3) / 4;
          if (approxSize > 100 * 1024 && quality > 0.1) {
            quality -= 0.15;
            compress();
          } else {
            resolve(dataUrl);
          }
        };

        compress();
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}
