'use client';

import { useEffect, useState } from 'react';
import { Bell, Download, X } from 'lucide-react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// The site worker lives on its own scope so it never replaces the main site worker (scope "/").
// Push alerts reach a worker no matter which pages it controls.
const SW_SCOPE = '/site-sw/';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(Array.from(atob(base64)).map((c) => c.charCodeAt(0)));
}

async function registerSiteWorker(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register('/site-sw.js', { scope: SW_SCOPE });
  const worker = reg.installing || reg.waiting;
  if (!reg.active && worker) {
    await new Promise<void>((resolve) => {
      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated') resolve();
      });
    });
  }
  return reg;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);
}

function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export default function SitePwa({
  slug,
  siteName,
  accent,
  canPush,
  installEnabled = true,
}: {
  slug: string;
  siteName: string;
  accent: string;
  canPush: boolean;
  installEnabled?: boolean;
}) {
  const dismissKey = `site-pwa-dismissed:${slug}`;
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(dismissKey) === '1'; } catch { return false; }
  });
  const [showIosHint] = useState(() => isIosSafari() && !isStandalone());
  const [alertsOn, setAlertsOn] = useState(false);
  const [alertsMessage, setAlertsMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = `/api/forums/${encodeURIComponent(slug)}/manifest`;
    document.head.appendChild(link);

    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const created = !meta;
    const previous = meta?.content;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = accent;

    return () => {
      link.remove();
      if (!meta) return;
      if (created) meta.remove();
      else if (previous !== undefined) meta.content = previous;
    };
  }, [slug, accent]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let active = true;
    registerSiteWorker()
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => { if (active && sub) setAlertsOn(true); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(dismissKey, '1'); } catch { /* private mode: dismissal only lasts for this visit */ }
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    setInstallEvent(null);
    if (outcome === 'dismissed') dismiss();
  };

  const turnOnAlerts = async () => {
    setBusy(true);
    setAlertsMessage('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setAlertsMessage('Alerts are blocked. Allow notifications in your browser settings, then try again.');
        return;
      }
      const reg = await registerSiteWorker();
      const keyRes = await fetch(`/api/forums/${encodeURIComponent(slug)}/push`);
      const { vapidPublicKey } = (await keyRes.json()) as { vapidPublicKey: string };
      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
        }));
      const res = await fetch(`/api/forums/${encodeURIComponent(slug)}/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sub.toJSON(), audience: 'owner' }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setAlertsMessage(data.error || 'Could not turn on order alerts. Please try again.');
        return;
      }
      setAlertsOn(true);
      setAlertsMessage('Order alerts are on for this phone.');
    } catch {
      setAlertsMessage('Could not turn on order alerts. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const showInstall = installEnabled && !installed && !dismissed && !!installEvent;
  const showIos = installEnabled && !installed && !dismissed && !installEvent && showIosHint;
  const showAlerts = canPush && pushSupported() && !alertsOn;

  if (!showInstall && !showIos && !showAlerts && !alertsMessage) return null;

  const pill = 'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-lg disabled:opacity-60';

  return (
    <div className="fixed bottom-20 right-4 z-[70] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2">
      {alertsMessage && (
        <p className="rounded-xl bg-black/80 px-3 py-2 text-xs text-white shadow-lg">{alertsMessage}</p>
      )}
      {showAlerts && (
        <button type="button" onClick={turnOnAlerts} disabled={busy} className={pill} style={{ backgroundColor: accent }}>
          <Bell className="h-4 w-4" />
          {busy ? 'Turning on...' : 'Turn on order alerts'}
        </button>
      )}
      {showInstall && (
        <div className="flex items-center gap-1">
          <button type="button" onClick={install} className={pill} style={{ backgroundColor: accent }}>
            <Download className="h-4 w-4" />
            Install app
          </button>
          <button type="button" onClick={dismiss} aria-label="Hide install button" className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {showIos && (
        <div className="flex items-center gap-2 rounded-full bg-black/80 py-2 pl-4 pr-2 text-xs text-white shadow-lg">
          <span>To install {siteName}: tap Share, then Add to Home Screen.</span>
          <button type="button" onClick={dismiss} aria-label="Hide install hint" className="flex h-6 w-6 items-center justify-center rounded-full">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
