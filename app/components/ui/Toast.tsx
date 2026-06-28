'use client';

import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

let toastId = 0;

export function showToast(message: string, type: ToastType = 'info') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('app:toast', { detail: { id: toastId++, message, type } })
  );
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<{ id: number; message: string; type: ToastType }[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setToasts((prev) => [...prev, detail]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== detail.id)), 4000);
    };
    window.addEventListener('app:toast', handler);
    return () => window.removeEventListener('app:toast', handler);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-20 md:bottom-4 right-4 z-[60] space-y-2 max-w-sm"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-3 rounded-xl shadow-lg text-sm font-bold border animate-in slide-in-from-right duration-300 ${
            t.type === 'success'
              ? 'bg-emerald-500 text-black border-emerald-400'
              : t.type === 'error'
                ? 'bg-red-500 text-white border-red-400'
                : 'bg-card text-primary border-theme'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
