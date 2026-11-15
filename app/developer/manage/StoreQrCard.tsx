'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Printer } from 'lucide-react';
import { planFor } from '@/lib/plans';
import type { Site } from './types';

function escapeHtml(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default function StoreQrCard({ site }: { site: Site }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const plan = planFor(site.plan_tier, site.plan_expires_at);
  const usesCustomDomain = !!(site.custom_domain && site.custom_domain_verified && plan.customDomain);
  const displayHost = usesCustomDomain ? site.custom_domain! : `${site.slug}.developa.me`;
  const targetUrl = `https://${displayHost}`;

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(targetUrl, {
      margin: 2,
      width: 512,
      errorCorrectionLevel: 'M',
      color: { dark: '#111111', light: '#ffffff' },
    })
      .then((url) => { if (active) setQrDataUrl(url); })
      .catch(() => { if (active) setQrDataUrl(''); });
    return () => { active = false; };
  }, [targetUrl]);

  const downloadPng = () => {
    if (!qrDataUrl) return;
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 880;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#111111';
    ctx.font = 'bold 34px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(site.name.slice(0, 32), canvas.width / 2, 74);

    ctx.fillStyle = '#555555';
    ctx.font = '20px system-ui, -apple-system, sans-serif';
    ctx.fillText('Scan to browse products & order', canvas.width / 2, 112);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 104, 150, 512, 512);
      ctx.fillStyle = '#111111';
      ctx.font = '600 24px monospace';
      ctx.fillText(displayHost, canvas.width / 2, 725);

      if (!site.hide_branding || !plan.hideBranding) {
        ctx.fillStyle = '#777777';
        ctx.font = '16px system-ui, -apple-system, sans-serif';
        ctx.fillText('Built on Developa', canvas.width / 2, 790);
      }

      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `${site.slug}-qr-card.png`;
      a.click();
    };
    img.src = qrDataUrl;
  };

  const printQrCard = () => {
    if (!qrDataUrl) return;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    const footerLine = !site.hide_branding || !plan.hideBranding ? '<p class="foot">Powered by Developa</p>' : '';
    const html = `<!doctype html><html><head><title>${escapeHtml(site.name)} QR Card</title><style>
      body{margin:0;padding:24px;font-family:system-ui,-apple-system,sans-serif;display:flex;justify-content:center;align-items:center;min-height:90vh;color:#111}
      .card{border:2px solid #111;border-radius:20px;padding:36px 40px;text-align:center;max-width:360px}
      h1{font-size:24px;margin:0 0 8px}
      .sub{font-size:14px;color:#555;margin:0 0 20px}
      img{width:260px;height:260px;display:block;margin:0 auto 18px}
      .url{font-family:monospace;font-size:15px;font-weight:700;margin:0}
      .foot{font-size:11px;color:#777;margin:18px 0 0}
      @media print{@page{size:A5;margin:12mm}}
    </style></head><body><div class="card"><h1>${escapeHtml(site.name)}</h1><p class="sub">Scan to shop &amp; order</p><img src="${qrDataUrl}" alt="QR code"/><p class="url">${escapeHtml(displayHost)}</p>${footerLine}</div></body></html>`;
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => iframe.remove(), 1500);
      }, 150);
    } else {
      iframe.remove();
    }
  };

  return (
    <section className="g-card p-5">
      <div className="flex flex-col items-start gap-4">
        <div className="shrink-0 bg-white p-2 rounded-xl border border-theme">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt={`QR code for ${displayHost}`} width={104} height={104} />
          ) : (
            <div className="w-[104px] h-[104px] bg-secondary/20 rounded" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h3 className="font-medium">Store QR code</h3>
            <p className="text-sm text-secondary mt-0.5">
              Print this for your counter, packaging, or WhatsApp flyers. Scans straight to{' '}
              <span className="font-mono text-primary break-all">{displayHost}</span>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadPng}
              disabled={!qrDataUrl}
              className="min-h-10 px-4 rounded-full border border-theme hover:bg-hover text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" /> Download PNG
            </button>
            <button
              type="button"
              onClick={printQrCard}
              disabled={!qrDataUrl}
              className="min-h-10 px-4 rounded-full border border-theme hover:bg-hover text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" /> Print QR card
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
