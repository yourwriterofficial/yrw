'use client';

import { useState } from 'react';
import { Copy, Check, MessageCircle, Share2, Camera } from 'lucide-react';

/**
 * Quick ways to get the store in front of people: copy the link, send it on WhatsApp or Facebook, or copy it
 * for an Instagram bio. (The QR code for print has its own card on this page.)
 */
export default function ShareCard({ name, link, accent }: { name: string; link: string; accent: string }) {
  const [copied, setCopied] = useState<'link' | 'bio' | null>(null);
  const text = encodeURIComponent(`Check out ${name}: ${link}`);
  const btn = 'h-9 px-3.5 rounded-full text-sm font-medium inline-flex items-center gap-2 border border-theme hover:bg-hover transition';

  const copy = async (what: 'link' | 'bio', value: string) => {
    try { await navigator.clipboard.writeText(value); setCopied(what); setTimeout(() => setCopied(null), 1500); } catch { /* clipboard blocked */ }
  };

  return (
    <section className="g-card p-5 space-y-3" aria-label="Share your store">
      <div>
        <h3 className="font-semibold">Share your store</h3>
        <p className="text-sm text-secondary mt-1">Every share is a chance for a sale. Send your link to customers and followers.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => copy('link', link)} className={btn}>{copied === 'link' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied === 'link' ? 'Copied' : 'Copy link'}</button>
        <a href={`https://wa.me/?text=${text}`} target="_blank" rel="noopener noreferrer" className={btn}><MessageCircle className="w-4 h-4" style={{ color: '#25D366' }} /> WhatsApp</a>
        <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`} target="_blank" rel="noopener noreferrer" className={btn}><Share2 className="w-4 h-4" style={{ color: '#1877f2' }} /> Facebook</a>
        <button type="button" onClick={() => copy('bio', link)} className={btn} title="Copies your link so you can paste it in your Instagram bio"><Camera className="w-4 h-4" style={{ color: accent }} /> {copied === 'bio' ? 'Copied. Paste in your bio' : 'For Instagram bio'}</button>
      </div>
    </section>
  );
}
