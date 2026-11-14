'use client';

import { useState } from 'react';
import { FORUM_ACCENTS } from '@/lib/forums';
import { planFor } from '@/lib/plans';
import { jsonFetch, type Site } from '../types';
import StaffPanel from './StaffPanel';

export default function SettingsTab({ site, reload, goToPlan }: { site: Site; reload: () => Promise<void>; goToPlan: () => void }) {
  const [f, setF] = useState({
    name: site.name || '',
    description: site.description || '',
    hero_headline: site.hero_headline || '',
    hero_subheadline: site.hero_subheadline || '',
    whatsapp_number: site.whatsapp_number || '',
    bank_name: site.bank_name || '',
    bank_account_number: site.bank_account_number || '',
    bank_account_name: site.bank_account_name || '',
    payment_instructions: site.payment_instructions || '',
    currency: site.currency || 'NGN',
    accent_color: site.accent_color || '#3b82f6',
    logo_url: site.logo_url || '',
    announcement: site.announcement || '',
    announcement_active: !!site.announcement_active,
    seo_title: site.seo_title || '',
    seo_description: site.seo_description || '',
    is_public: site.is_public,
    hide_branding: !!site.hide_branding,
    page_about: site.page_about || '',
    page_delivery: site.page_delivery || '',
    page_returns: site.page_returns || '',
    page_contact_note: site.page_contact_note || '',
    summary_email: site.summary_email ?? true,
    weekly_backup_email: site.weekly_backup_email ?? false,
    social_links: {
      instagram: site.social_links?.instagram || '',
      tiktok: site.social_links?.tiktok || '',
      facebook: site.social_links?.facebook || '',
      x: site.social_links?.x || '',
      youtube: site.social_links?.youtube || '',
      website: site.social_links?.website || '',
    },
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const plan = planFor(site.plan_tier, site.plan_expires_at);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));
  const isStore = site.site_mode !== 'forum';

  const uploadLogo = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/upload/drive', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok && data.url) set('logo_url', data.url);
      else setMsg({ ok: false, text: data.error || 'Upload failed.' });
    } catch { setMsg({ ok: false, text: 'Upload failed. Check your connection.' }); }
    setUploading(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await jsonFetch(`/api/forums/${site.slug}`, { method: 'PATCH', body: f });
    if (r.ok) { setMsg({ ok: true, text: 'Saved.' }); await reload(); }
    else setMsg({ ok: false, text: r.data.error || 'Could not save.' });
    setBusy(false);
  };

  const Field = ({ id, label, children, hint }: { id: string; label: string; children: React.ReactNode; hint?: string }) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-secondary mt-1">{hint}</p>}
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
    <form onSubmit={save} className="space-y-6">
      <section className="g-card p-5 space-y-4">
        <h3 className="font-medium">About your site</h3>
        <Field id="s-name" label="Name"><input id="s-name" required minLength={2} value={f.name} onChange={(e) => set('name', e.target.value)} className="input-box w-full" /></Field>
        <Field id="s-desc" label="Short description" hint="Shown under your name and in search."><textarea id="s-desc" rows={2} maxLength={300} value={f.description} onChange={(e) => set('description', e.target.value)} className="input-box w-full" /></Field>
        {isStore && (
          <>
            <Field id="s-head" label="Banner headline"><input id="s-head" maxLength={160} value={f.hero_headline} onChange={(e) => set('hero_headline', e.target.value)} className="input-box w-full" /></Field>
            <Field id="s-sub" label="Banner sentence"><input id="s-sub" maxLength={300} value={f.hero_subheadline} onChange={(e) => set('hero_subheadline', e.target.value)} className="input-box w-full" /></Field>
          </>
        )}
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={f.is_public} onChange={(e) => set('is_public', e.target.checked)} className="w-4 h-4" /> Visible to everyone (turn off to hide the site while you set it up)</label>
      </section>

      <section className="g-card p-5 space-y-4">
        <h3 className="font-medium">Look and feel</h3>
        <div>
          <p className="text-sm font-medium mb-2">Colour</p>
          <div className="flex flex-wrap gap-2">
            {FORUM_ACCENTS.map((a) => (
              <button key={a.value} type="button" aria-label={a.label} onClick={() => set('accent_color', a.value)}
                className={`w-9 h-9 rounded-full border-2 ${f.accent_color === a.value ? 'border-[var(--text-primary)]' : 'border-transparent'}`} style={{ background: a.value }} />
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium mb-2">Logo</p>
          {f.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.logo_url} alt="" className="w-16 h-16 rounded-2xl object-cover border border-theme mb-2" />
          )}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => uploadLogo(e.target.files?.[0])} className="text-sm" />
          {uploading && <p className="text-xs text-secondary mt-1">Uploading…</p>}
        </div>
        <Field id="s-ann" label="Announcement bar" hint="A line across the top of your site, for a sale or news.">
          <input id="s-ann" maxLength={200} value={f.announcement} onChange={(e) => set('announcement', e.target.value)} placeholder="Free delivery this weekend" className="input-box w-full" />
        </Field>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={f.announcement_active} onChange={(e) => set('announcement_active', e.target.checked)} className="w-4 h-4" /> Show the announcement bar</label>
        <label className={`flex items-center gap-3 text-sm ${plan.hideBranding ? '' : 'opacity-60'}`}>
          <input type="checkbox" disabled={!plan.hideBranding} checked={f.hide_branding} onChange={(e) => set('hide_branding', e.target.checked)} className="w-4 h-4" />
          Hide the “Powered by Developa” badge
          {!plan.hideBranding && <button type="button" onClick={goToPlan} className="text-accent font-medium hover:underline">Pro plan</button>}
        </label>
      </section>

      <section className="g-card p-5 space-y-4">
        <h3 className="font-medium">How you appear on Google</h3>
        <p className="text-sm text-secondary">The title and sentence people see when your site shows up in search. Leave blank and we use your name and description.</p>
        <div className="rounded-2xl border border-theme p-4 bg-secondary/40" aria-label="Search preview">
          <p className="text-xs text-secondary break-all">{(site.custom_domain && site.custom_domain_verified ? site.custom_domain : `${site.slug}.developa.me`)}</p>
          <p className="text-lg text-accent leading-snug">{f.seo_title || f.name || 'Your site name'}</p>
          <p className="text-sm text-secondary mt-0.5">{f.seo_description || f.description || 'Your description will appear here.'}</p>
        </div>
        <Field id="s-seot" label={`Search title (${f.seo_title.length}/70)`} hint="About 50 to 60 characters works best.">
          <input id="s-seot" maxLength={70} value={f.seo_title} onChange={(e) => set('seo_title', e.target.value)} placeholder="Naija Mega Mart | Phones, fashion and home deals" className="input-box w-full" />
        </Field>
        <Field id="s-seod" label={`Search description (${f.seo_description.length}/170)`} hint="One or two sentences about what you sell or discuss.">
          <textarea id="s-seod" rows={2} maxLength={170} value={f.seo_description} onChange={(e) => set('seo_description', e.target.value)} className="input-box w-full" />
        </Field>
      </section>

      {isStore && (
        <section className="g-card p-5 space-y-4">
          <h3 className="font-medium">How buyers pay you</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field id="s-bank" label="Bank name"><input id="s-bank" value={f.bank_name} onChange={(e) => set('bank_name', e.target.value)} className="input-box w-full" /></Field>
            <Field id="s-acc" label="Account number"><input id="s-acc" inputMode="numeric" value={f.bank_account_number} onChange={(e) => set('bank_account_number', e.target.value)} className="input-box w-full" /></Field>
            <Field id="s-accname" label="Account name"><input id="s-accname" value={f.bank_account_name} onChange={(e) => set('bank_account_name', e.target.value)} className="input-box w-full" /></Field>
            <Field id="s-cur" label="Currency">
              <select id="s-cur" value={f.currency} onChange={(e) => set('currency', e.target.value as 'NGN' | 'USD' | 'GBP')} className="input-box w-full">
                <option value="NGN">Naira (₦)</option><option value="USD">US dollar ($)</option><option value="GBP">Pound (£)</option>
              </select>
            </Field>
          </div>
          <Field id="s-wa" label="WhatsApp number" hint="Buyers can message you here. Use the format 0803… or 234803…."><input id="s-wa" type="tel" value={f.whatsapp_number} onChange={(e) => set('whatsapp_number', e.target.value)} className="input-box w-full" /></Field>
          <Field id="s-instr" label="Payment instructions"><textarea id="s-instr" rows={2} maxLength={400} value={f.payment_instructions} onChange={(e) => set('payment_instructions', e.target.value)} placeholder="Send the exact amount, then add your order code as the reference." className="input-box w-full" /></Field>
        </section>
      )}

      <section className="g-card p-6 space-y-4">
        <h3 className="font-medium">Store pages & policies</h3>
        <p className="text-sm text-secondary">Any section you fill in appears in your storefront footer.</p>
        <Field id="s-about" label="About us"><textarea id="s-about" rows={3} maxLength={3000} value={f.page_about} onChange={(e) => set('page_about', e.target.value)} placeholder="Who we are, what we make, and where we ship from." className="input-box w-full" /></Field>
        <Field id="s-deliv" label="Delivery details"><textarea id="s-deliv" rows={2} maxLength={3000} value={f.page_delivery} onChange={(e) => set('page_delivery', e.target.value)} placeholder="Same-day Lagos dispatch before 2pm; 2-4 days nationwide." className="input-box w-full" /></Field>
        <Field id="s-ret" label="Returns & exchanges"><textarea id="s-ret" rows={2} maxLength={3000} value={f.page_returns} onChange={(e) => set('page_returns', e.target.value)} placeholder="Unworn items accepted within 7 days of delivery." className="input-box w-full" /></Field>
        <Field id="s-contact-note" label="Contact hours & address note"><textarea id="s-contact-note" rows={2} maxLength={3000} value={f.page_contact_note} onChange={(e) => set('page_contact_note', e.target.value)} placeholder="Open Mon-Sat 9am-6pm · Lekki Phase 1, Lagos" className="input-box w-full" /></Field>
      </section>

      <section className="g-card p-6 space-y-4">
        <h3 className="font-medium">Social links</h3>
        <p className="text-sm text-secondary">Paste a handle (like @myshop) or a full https:// link.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {([
            ['instagram', 'Instagram', '@yourbrand'],
            ['tiktok', 'TikTok', '@yourbrand'],
            ['facebook', 'Facebook', 'https://facebook.com/yourbrand'],
            ['x', 'X (Twitter)', '@yourbrand'],
            ['youtube', 'YouTube', '@yourchannel'],
            ['website', 'Website', 'https://yourbrand.com'],
          ] as const).map(([key, label, ph]) => (
            <Field key={key} id={`s-soc-${key}`} label={label}>
              <input
                id={`s-soc-${key}`}
                value={f.social_links[key]}
                onChange={(e) => set('social_links', { ...f.social_links, [key]: e.target.value })}
                placeholder={ph}
                maxLength={200}
                className="input-box w-full"
              />
            </Field>
          ))}
        </div>
      </section>

      <section className="g-card p-6 space-y-3">
        <h3 className="font-medium">Email reports</h3>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={f.summary_email} onChange={(e) => set('summary_email', e.target.checked)} className="w-4 h-4" />
          Send daily store summary & low-stock alerts to my email (Pro & Business)
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={f.weekly_backup_email} onChange={(e) => set('weekly_backup_email', e.target.checked)} className="w-4 h-4" />
          Email me a weekly JSON backup of products and orders
        </label>
        {(!site.my_role || site.my_role === 'owner') && (
          <div className="pt-2">
            <a
              href={`/api/forums/${encodeURIComponent(site.slug)}/export`}
              download
              className="inline-flex items-center px-4 h-10 rounded-full border border-theme hover:bg-hover text-xs font-medium"
            >
              Download store backup (JSON)
            </a>
          </div>
        )}
      </section>

      <div className="flex items-center gap-4">
        <button type="submit" disabled={busy || uploading} className="bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] font-medium text-sm px-7 h-11 rounded-full disabled:opacity-50">{busy ? 'Saving…' : 'Save changes'}</button>
        {msg && <p className={`text-sm ${msg.ok ? 'text-success' : 'text-danger'}`} role="status">{msg.text}</p>}
      </div>
    </form>
    {(!site.my_role || site.my_role === 'owner') && <StaffPanel site={site} goToPlan={goToPlan} />}
    </div>
  );
}
