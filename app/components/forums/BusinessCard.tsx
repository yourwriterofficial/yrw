'use client';

import { Clock, MapPin, MessageCircle, Phone } from 'lucide-react';
import type { ForumSummary } from '@/lib/forums';
import { waLink } from '@/lib/phone';

/**
 * A contact strip for people who advertise a business: call, WhatsApp, directions and opening hours.
 * Reads only fields the owner already fills in under Settings, so there is nothing new to set up.
 */
export default function BusinessCard({ site, accent }: { site: ForumSummary; accent: string }) {
  const phone = (site.whatsapp_number || '').replace(/[^\d+]/g, '');
  const wa = site.whatsapp_number ? waLink(site.whatsapp_number, `Hi ${site.name}, I found you online.`) : null;
  const address = (site.pickup_address || '').trim();
  const hours = (site.page_contact_note || '').trim();
  if (!phone && !address && !hours) return null;
  const btn = 'h-10 px-4 rounded-full text-sm font-medium inline-flex items-center gap-2 transition hover:brightness-95';
  return (
    <section aria-label="Contact" className="rounded-2xl border border-theme bg-card p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
      <div className="min-w-0 flex-1 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {address && <p className="flex items-start gap-2"><MapPin className="w-4 h-4 mt-0.5 shrink-0" style={{ color: accent }} /><span>{address}</span></p>}
        {!address && !hours && <p className="font-medium">Chat or call to order from {site.name}</p>}
        {hours && <p className="flex items-start gap-2"><Clock className="w-4 h-4 mt-0.5 shrink-0" style={{ color: accent }} /><span className="whitespace-pre-line">{hours}</span></p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {phone && <a href={`tel:${phone}`} className={`${btn} text-white`} style={{ background: accent }}><Phone className="w-4 h-4" /> Call</a>}
        {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={`${btn} bg-[#25D366] text-white`}><MessageCircle className="w-4 h-4" /> WhatsApp</a>}
        {address && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer" className={`${btn} border border-theme bg-card text-primary`}><MapPin className="w-4 h-4" /> Directions</a>}
      </div>
    </section>
  );
}
