/**
 * Shrinks a photo in the browser before it is uploaded. Phone cameras make 4 to 8 MB pictures that load
 * slowly for buyers and can hit upload limits. This keeps them sharp but small (about 200 to 500 KB).
 * GIFs, SVGs and images that are already small are returned unchanged. Falls back to the original file
 * if anything goes wrong, so an upload never fails because of this step.
 */
export async function shrinkImage(file: File, maxSide = 1600, quality = 0.85): Promise<File> {
  try {
    if (typeof window === 'undefined' || !file.type.startsWith('image/')) return file;
    if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 400_000) { bitmap.close?.(); return file; }
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close?.(); return file; }
    // PNGs with transparency keep a white background when saved as JPEG, which suits product photos.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}
