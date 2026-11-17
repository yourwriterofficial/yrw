'use client';

import { useEffect } from 'react';

/** The Developa "D" logo: a violet-to-pink tile with a bold D and a dot, like the .me in the address. */
export function DevelopaMark({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 192 192" className={className} role="img" aria-label="Developa">
      <defs>
        <linearGradient id="dvm-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c3aed" />
          <stop offset=".6" stopColor="#c026d3" />
          <stop offset="1" stopColor="#f43f5e" />
        </linearGradient>
      </defs>
      <rect width="192" height="192" rx="44" fill="url(#dvm-g)" />
      <path fillRule="evenodd" fill="#fff" d="M46 44 H92 C126 44 146 66 146 96 C146 126 126 148 92 148 H46 Z M74 68 V124 H90 C108 124 118 113 118 96 C118 79 108 68 90 68 Z" />
      <circle cx="158" cy="142" r="9" fill="#fbbf24" />
    </svg>
  );
}

/** On Developa pages, swaps the browser tab icon, home-screen icon and install manifest for the D. */
export function DevelopaIcons() {
  useEffect(() => {
    const apply = () => {
    const set = (rel: string, href: string, extra: Record<string, string> = {}) => {
      document.querySelectorAll(`link[rel="${rel}"], link[rel="shortcut ${rel}"]`).forEach((n) => n.remove());
      const l = document.createElement('link');
      l.rel = rel; l.href = href;
      Object.entries(extra).forEach(([k, v]) => l.setAttribute(k, v));
      document.head.appendChild(l);
    };
    set('icon', '/developa/favicon.ico', { sizes: '32x32 48x48' });
    set('icon', '/developa/icon.svg', { type: 'image/svg+xml' });
    set('apple-touch-icon', '/developa/apple-touch-icon.png');
    set('manifest', '/developa/manifest.json');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#7c3aed');
    // Pages that share the main site's title (login, register) should not call themselves YourResearchWriter on developa.me.
    const t = document.title;
    if (/YourResearchWriter/i.test(t)) document.title = /^YourResearchWriter/i.test(t) ? 'Developa | Build your website without coding' : t.replace(/s*|s*YourResearchWriter.*$/i, '');
    };
    apply();
    const t = setTimeout(apply, 800);
    return () => clearTimeout(t);
  }, []);
  return null;
}
