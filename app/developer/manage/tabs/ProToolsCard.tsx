'use client';

import { useState } from 'react';
import { Printer, QrCode, ShieldCheck } from 'lucide-react';
import { pluginOn } from '@/lib/plugins';
import { openPrintWindow } from '@/lib/storefrontTools';
import { jsonFetch, type Site } from '../types';

export default function ProToolsCard({ site, reload }: { site: Site; reload: () => Promise<void> }) {
  const plugins = (site.plugins || {}) as Record<string, unknown>;
  const [vatPct, setVatPct] = useState(String(plugins._cfg_vat_pct ?? '0'));
  const [pixelMeta, setPixelMeta] = useState(String(plugins._cfg_pixel_meta ?? ''));
  const [passcode, setPasscode] = useState(String(plugins._cfg_passcode ?? ''));
  const [comingNote, setComingNote] = useState(String(plugins._cfg_coming_soon_note ?? ''));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const hasVat = pluginOn('vat_calculator', site.plan_tier, site.plan_expires_at, site.plugins);
  const hasPixel = pluginOn('meta_ga4_pixel', site.plan_tier, site.plan_expires_at, site.plugins);
  const hasPrivate = pluginOn('private_store', site.plan_tier, site.plan_expires_at, site.plugins);
  const hasComing = pluginOn('coming_soon', site.plan_tier, site.plan_expires_at, site.plugins);
  const hasQrFlyer = pluginOn('qr_flyer', site.plan_tier, site.plan_expires_at, site.plugins);
  const hasSkuLabels = pluginOn('sku_labels', site.plan_tier, site.plan_expires_at, site.plugins);

  if (!hasVat && !hasPixel && !hasPrivate && !hasComing && !hasQrFlyer && !hasSkuLabels) {
    return null;
  }

  const saveCfg = async () => {
    setBusy(true);
    setMsg(null);
    const r = await jsonFetch(`/api/forums/${encodeURIComponent(site.slug)}/plugins`, {
      method: 'PATCH',
      body: {
        _cfg_vat_pct: Math.max(0, Math.min(100, Number(vatPct) || 0)),
        _cfg_pixel_meta: pixelMeta.trim(),
        _cfg_passcode: passcode.trim(),
        _cfg_coming_soon_note: comingNote.trim(),
      },
    });
    setBusy(false);
    if (r.ok) {
      setMsg({ ok: true, text: 'Plugin settings saved.' });
      await reload();
    } else {
      setMsg({ ok: false, text: (r.data.error as string) || 'Could not save plugin settings.' });
    }
  };

  const printQrFlyer = () => {
    const url = `${window.location.origin}/forums/${site.slug}`;
    const qr = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}`;
    openPrintWindow(
      `${site.name} — Store QR Flyer`,
      `<div style="text-align:center;padding:40px;font-family:system-ui,sans-serif;border:2px dashed #cbd5e1;border-radius:16px">
        <h1 style="margin:0 0 8px">${site.name}</h1>
        <p style="color:#475569;margin:0 0 24px">Scan to browse products & order online</p>
        <img src="${qr}" alt="Store QR" width="240" height="240" style="margin:0 auto 20px" />
        <p style="font-family:monospace;font-size:14px;color:#0f172a">${url}</p>
      </div>`
    );
  };

  const printSkuLabels = () => {
    const code = site.slug.toUpperCase();
    const cells = Array.from({ length: 8 }, (_, i) => {
      const sku = `${code}-${String(i + 1).padStart(3, '0')}`;
      return `<div style="border:1px solid #cbd5e1;padding:10px;border-radius:6px;text-align:center">
        <div style="font-weight:700;font-size:12px">${site.name}</div>
        <div style="font-family:monospace;font-size:14px;margin:6px 0">${sku}</div>
        <div style="font-size:10px;color:#64748b">Scan / Pack Label</div>
      </div>`;
    }).join('');
    openPrintWindow(
      `${site.name} — SKU Labels`,
      `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;font-family:system-ui,sans-serif">${cells}</div>`
    );
  };

  return (
    <section className="g-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-accent" />
        <h3 className="font-medium">Active Pro plugin settings & print tools</h3>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {hasVat && (
          <div>
            <label htmlFor="cfg-vat" className="block text-sm font-medium mb-1">VAT / Sales tax (%)</label>
            <input id="cfg-vat" type="number" min={0} max={100} step="0.5" value={vatPct} onChange={(e) => setVatPct(e.target.value)} className="input-box w-full" />
          </div>
        )}
        {hasPixel && (
          <div>
            <label htmlFor="cfg-pixel" className="block text-sm font-medium mb-1">Meta Pixel / GA4 ID</label>
            <input id="cfg-pixel" value={pixelMeta} onChange={(e) => setPixelMeta(e.target.value)} placeholder="e.g. G-XXXXXXXXXX" className="input-box w-full font-mono text-xs" />
          </div>
        )}
        {hasPrivate && (
          <div>
            <label htmlFor="cfg-pass" className="block text-sm font-medium mb-1">Private store passcode</label>
            <input id="cfg-pass" value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="Optional VIP code" className="input-box w-full font-mono text-xs" />
          </div>
        )}
        {hasComing && (
          <div>
            <label htmlFor="cfg-soon" className="block text-sm font-medium mb-1">Coming-soon banner note</label>
            <input id="cfg-soon" value={comingNote} onChange={(e) => setComingNote(e.target.value)} placeholder="Opening Friday 9am..." className="input-box w-full" />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        {(hasVat || hasPixel || hasPrivate || hasComing) && (
          <button type="button" onClick={saveCfg} disabled={busy} className="bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] font-medium text-xs px-5 h-9 rounded-full disabled:opacity-50">
            {busy ? 'Saving…' : 'Save plugin settings'}
          </button>
        )}
        {hasQrFlyer && (
          <button type="button" onClick={printQrFlyer} className="inline-flex items-center gap-1.5 px-4 h-9 rounded-full border border-theme hover:bg-hover text-xs font-medium">
            <QrCode className="w-3.5 h-3.5" /> Print QR Flyer
          </button>
        )}
        {hasSkuLabels && (
          <button type="button" onClick={printSkuLabels} className="inline-flex items-center gap-1.5 px-4 h-9 rounded-full border border-theme hover:bg-hover text-xs font-medium">
            <Printer className="w-3.5 h-3.5" /> Print SKU Labels
          </button>
        )}
        {msg && <span className={`text-xs ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</span>}
      </div>
    </section>
  );
}
