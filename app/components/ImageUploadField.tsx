'use client';

import { useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { resizeAndUploadImage } from '@/lib/imageUpload';

interface ImageUploadFieldProps {
  label: string;
  value: string | null | undefined;
  onChange: (url: string) => void;
}

export default function ImageUploadField({ label, value, onChange }: ImageUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const url = await resizeAndUploadImage(file);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="block text-xs font-bold text-secondary mb-1">{label}</label>
      <div className="flex items-center gap-3">
        {value ? (
          <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-theme bg-secondary shrink-0">
            <img src={value} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5"
              aria-label="Remove image"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        ) : (
          <div className="w-16 h-16 rounded-xl border border-dashed border-theme flex items-center justify-center text-secondary shrink-0">
            <Upload className="w-5 h-5" />
          </div>
        )}
        <label className="flex-1 cursor-pointer px-3 py-2 rounded-xl bg-secondary border border-theme text-xs font-bold text-center hover:bg-white/10 transition">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (value ? 'Replace Image' : 'Upload Image')}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={e => handleFile(e.target.files?.[0])}
          />
        </label>
      </div>
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}
