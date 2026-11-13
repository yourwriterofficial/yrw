'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** A QR code for a payment link, generated in the browser (nothing is sent to a third party). */
export default function PaymentQR({ value, size = 96 }: { value: string; size?: number }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { margin: 1, width: size * 3, errorCorrectionLevel: 'M', color: { dark: '#111111', light: '#ffffff' } })
      .then((url) => { if (!cancelled) setSrc(url); })
      .catch(() => { if (!cancelled) setSrc(''); });
    return () => { cancelled = true; };
  }, [value, size]);

  if (!src) return <div style={{ width: size, height: size }} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} alt="QR code for the payment link" />;
}
