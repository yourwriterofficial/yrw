'use client';

import { useMemo, useState } from 'react';
import {
  ShoppingBag, CreditCard, CalendarCheck, Users, Newspaper, Palette, Download, MessageCircle,
  Bell, Smartphone, MessagesSquare, IdCard, Check, ArrowLeft, ArrowRight, Sparkles,
} from 'lucide-react';
import CreateForumForm from '@/app/components/forums/CreateForumForm';
import TemplateThumb from '@/app/developer/TemplateThumb';
import { PICKABLE_TEMPLATES, getTemplateById, type SiteTemplate } from '@/lib/siteTemplates';
import { archetypeOf } from '@/lib/demoContent';

type Goal = 'sell' | 'bookings' | 'community' | 'articles' | 'showcase' | 'digital';

const GOALS: { key: Goal; icon: typeof ShoppingBag; title: string; hint: string }[] = [
  { key: 'sell', icon: ShoppingBag, title: 'Sell products', hint: 'Clothes, food, gadgets, anything you ship or hand over' },
  { key: 'digital', icon: Download, title: 'Sell downloads or courses', hint: 'Ebooks, templates, lessons, coaching' },
  { key: 'bookings', icon: CalendarCheck, title: 'Take bookings', hint: 'Salon, studio, consulting, events' },
  { key: 'showcase', icon: Palette, title: 'Show my work', hint: 'Portfolio, services, a business website' },
  { key: 'articles', icon: Newspaper, title: 'Publish articles or news', hint: 'A blog, magazine or newsletter' },
  { key: 'community', icon: Users, title: 'Run a community', hint: 'A forum or group where people talk' },
];

type Order = 'online' | 'whatsapp';

const FEATURES: { id: string; icon: typeof Bell; title: string; hint: string; needs?: Goal[] }[] = [
  { id: 'push', icon: Bell, title: 'Phone alerts', hint: 'Get a ping on your phone for each new order', needs: ['sell', 'digital', 'bookings'] },
  { id: 'appinstall', icon: Smartphone, title: 'Install as a phone app', hint: 'Visitors can save your site to their home screen' },
  { id: 'chat', icon: MessagesSquare, title: 'Chat with visitors', hint: 'Customers can message you from your site', needs: ['sell', 'digital', 'bookings', 'showcase', 'community'] },
  { id: 'businesscard', icon: IdCard, title: 'Business card', hint: 'Show your hours, phone, WhatsApp and directions', needs: ['sell', 'bookings', 'showcase'] },
];

/** How well a theme fits what the owner said they want. */
function score(t: SiteTemplate, goals: Goal[]): number {
  const a = archetypeOf(t);
  let s = 0;
  for (const g of goals) {
    if (g === 'sell' && t.site_mode !== 'forum' && ['market', 'fashion', 'food', 'property', 'beauty'].includes(a)) s += 3;
    if (g === 'digital' && ['digital', 'course'].includes(a)) s += 4;
    if (g === 'bookings' && (['service', 'beauty', 'events'].includes(a) || /booking/.test(t.id))) s += 4;
    if (g === 'showcase' && (t.layout_style === 'portfolio' || ['creative', 'service'].includes(a))) s += 3;
    if (g === 'articles' && ['blog', 'news'].includes(a)) s += 4;
    if (g === 'community' && (['forum', 'social'].includes(a) || t.site_mode === 'both')) s += 3;
  }
  if (!goals.includes('community') && !goals.includes('articles') && t.site_mode === 'forum') s -= 3;
  if ((t.price_ngn || 0) === 0) s += 1;
  return s;
}

const STEPS = ['Your goal', 'Your theme', 'Your features', 'Launch'];

/**
 * A short, friendly walkthrough: ask what the site is for, show the themes that fit, let the owner switch on only the
 * features they want (not everyone needs payments), then name the site. The choices are saved when the site is created.
 */
export default function GuidedSetup({ onCreated }: { onCreated?: () => void }) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [order, setOrder] = useState<Order>('online');
  const [themeId, setThemeId] = useState<string>('');
  const [features, setFeatures] = useState<Record<string, boolean>>({ push: true, appinstall: true, chat: true, businesscard: true });

  const sells = goals.includes('sell') || goals.includes('digital');
  const go = (n: number) => { setDir(n > step ? 1 : -1); setStep(n); };
  const toggleGoal = (g: Goal) => setGoals((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));

  const picks = useMemo(() => {
    const ranked = [...PICKABLE_TEMPLATES].map((t) => ({ t, s: score(t, goals) })).sort((a, b) => b.s - a.s);
    return ranked.slice(0, 6).map((x) => x.t);
  }, [goals]);

  const shownFeatures = FEATURES.filter((f) => !f.needs || f.needs.some((g) => goals.includes(g)));

  // What gets switched on or off when the site is created.
  const plugins: Record<string, boolean> = { ...Object.fromEntries(shownFeatures.map((f) => [f.id, !!features[f.id]])) };
  if (sells) {
    plugins.online_payments = order === 'online';
    plugins.catalogue = order === 'whatsapp';
  }

  const next = () => {
    if (step === 0 && goals.length === 0) return;
    if (step === 0 && !themeId) setThemeId(picks[0]?.id || '');
    if (step === 1 && !themeId) return;
    go(step + 1);
  };

  const animClass = dir === 1 ? 'dv-in-right' : 'dv-in-left';

  return (
    <div className="g-card p-5 sm:p-7 overflow-hidden">
      <style>{`
        @keyframes dv-in-right { from { opacity: 0; transform: translateX(28px) } to { opacity: 1; transform: none } }
        @keyframes dv-in-left { from { opacity: 0; transform: translateX(-28px) } to { opacity: 1; transform: none } }
        @keyframes dv-check { 0% { transform: scale(0) } 70% { transform: scale(1.25) } 100% { transform: scale(1) } }
        .dv-in-right { animation: dv-in-right .45s cubic-bezier(.2,.7,.2,1) both }
        .dv-in-left { animation: dv-in-left .45s cubic-bezier(.2,.7,.2,1) both }
        .dv-tick { animation: dv-check .35s ease both }
        @media (prefers-reduced-motion: reduce) { .dv-in-right, .dv-in-left, .dv-tick { animation: none } }
      `}</style>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-secondary mb-2">
          <span className="font-medium text-primary">Step {step + 1} of {STEPS.length}: {STEPS[step]}</span>
          {step > 0 && <button type="button" onClick={() => go(step - 1)} className="inline-flex items-center gap-1 hover:text-primary"><ArrowLeft className="w-3.5 h-3.5" /> Back</button>}
        </div>
        <div className="h-2 rounded-full g-tonal-strong overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${((step + 1) / STEPS.length) * 100}%`, background: 'linear-gradient(90deg, var(--dv-a), var(--dv-b))' }} />
        </div>
      </div>

      <div key={step} className={animClass}>
        {step === 0 && (
          <div>
            <h3 className="g-h3">What will your site do?</h3>
            <p className="text-sm text-secondary mt-1">Pick everything that fits. We will show the right themes and turn on only what you need.</p>
            <div className="grid sm:grid-cols-2 gap-3 mt-5">
              {GOALS.map((g, i) => {
                const on = goals.includes(g.key);
                return (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => toggleGoal(g.key)}
                    aria-pressed={on}
                    className={`relative text-left rounded-2xl border p-4 flex gap-3 transition dv-lift ${on ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]' : 'border-theme bg-card'}`}
                    style={{ animation: `dv-pop .5s ease ${i * 70}ms both` }}
                  >
                    <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition ${on ? 'bg-[var(--accent)] text-white' : 'g-tonal-strong text-accent'}`}><g.icon className="w-5 h-5" /></span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold">{g.title}</span>
                      <span className="block text-xs text-secondary mt-0.5 leading-snug">{g.hint}</span>
                    </span>
                    {on && <span className="dv-tick absolute top-3 right-3 w-5 h-5 rounded-full bg-[var(--accent)] text-white flex items-center justify-center"><Check className="w-3 h-3" /></span>}
                  </button>
                );
              })}
            </div>

            {sells && (
              <div className="mt-6 dv-in-right">
                <h4 className="text-sm font-semibold">How should customers order?</h4>
                <div className="grid sm:grid-cols-2 gap-3 mt-3">
                  {([
                    { k: 'online', icon: CreditCard, t: 'Pay on my site', d: 'A cart and checkout. Customers pay online and you get the money in your bank.' },
                    { k: 'whatsapp', icon: MessageCircle, t: 'Order on WhatsApp', d: 'No checkout. Customers browse and message you to order. Good if you prefer to chat first.' },
                  ] as const).map((o) => (
                    <button key={o.k} type="button" onClick={() => setOrder(o.k)} aria-pressed={order === o.k}
                      className={`text-left rounded-2xl border p-4 flex gap-3 transition ${order === o.k ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]' : 'border-theme bg-card'}`}>
                      <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${order === o.k ? 'bg-[var(--accent)] text-white' : 'g-tonal-strong text-accent'}`}><o.icon className="w-5 h-5" /></span>
                      <span><span className="block text-sm font-semibold">{o.t}</span><span className="block text-xs text-secondary mt-0.5 leading-snug">{o.d}</span></span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button type="button" onClick={next} disabled={goals.length === 0}
              className="btn-primary w-full sm:w-auto mt-6 !rounded-full px-7 py-3.5 text-base font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50">
              Show me matching themes <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 1 && (
          <div>
            <h3 className="g-h3 flex items-center gap-2"><Sparkles className="w-5 h-5 text-accent" /> Best matches for you</h3>
            <p className="text-sm text-secondary mt-1">Tap one to choose it. You can preview any theme as a working site first.</p>
            <div className="grid grid-cols-2 gap-3 mt-5">
              {picks.map((t, i) => {
                const on = themeId === t.id;
                return (
                  <div key={t.id} className={`rounded-2xl overflow-hidden border transition dv-lift ${on ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]' : 'border-theme'}`} style={{ animation: `dv-pop .5s ease ${i * 80}ms both` }}>
                    <button type="button" onClick={() => setThemeId(t.id)} aria-pressed={on} className="block w-full text-left">
                      <TemplateThumb t={t} />
                      <div className="p-3 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-tight">{t.label}</p>
                          <p className="text-[11px] text-secondary mt-0.5">{(t.price_ngn || 0) > 0 ? `₦${(t.price_ngn || 0).toLocaleString('en-NG')}` : 'Free'}</p>
                        </div>
                        <span className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${on ? 'bg-[var(--accent)] border-transparent text-white' : 'border-theme'}`}>{on && <Check className="dv-tick w-3 h-3" />}</span>
                      </div>
                    </button>
                    <a href={`/developer/preview/${t.id}`} target="_blank" rel="noreferrer" className="block text-center text-xs font-medium text-accent border-t border-theme py-2 hover:bg-hover">Try it first</a>
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={next} disabled={!themeId}
              className="btn-primary w-full sm:w-auto mt-6 !rounded-full px-7 py-3.5 text-base font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50">
              Use this theme <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 className="g-h3">Switch on what you need</h3>
            <p className="text-sm text-secondary mt-1">Only the useful ones are shown. You can change any of these later.</p>
            <div className="mt-5 space-y-3">
              {sells && (
                <div className="rounded-2xl border border-theme p-4 flex items-center gap-3 bg-card" style={{ animation: 'dv-pop .5s ease both' }}>
                  <span className="w-10 h-10 rounded-xl g-tonal-strong text-accent flex items-center justify-center shrink-0">{order === 'online' ? <CreditCard className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{order === 'online' ? 'Customers pay on your site' : 'Customers order on WhatsApp'}</p>
                    <p className="text-xs text-secondary">{order === 'online' ? 'You will connect your bank after launch.' : 'No checkout is shown.'}</p>
                  </div>
                  <button type="button" onClick={() => setOrder(order === 'online' ? 'whatsapp' : 'online')} className="text-xs font-medium text-accent hover:underline shrink-0">Change</button>
                </div>
              )}
              {shownFeatures.map((f, i) => {
                const on = !!features[f.id];
                return (
                  <button key={f.id} type="button" role="switch" aria-checked={on} onClick={() => setFeatures((c) => ({ ...c, [f.id]: !c[f.id] }))}
                    className="w-full text-left rounded-2xl border border-theme bg-card p-4 flex items-center gap-3 transition hover:border-[var(--accent)]" style={{ animation: `dv-pop .5s ease ${(i + 1) * 80}ms both` }}>
                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition ${on ? 'bg-[var(--accent)] text-white' : 'g-tonal-strong text-accent'}`}><f.icon className="w-5 h-5" /></span>
                    <span className="flex-1 min-w-0"><span className="block text-sm font-semibold">{f.title}</span><span className="block text-xs text-secondary">{f.hint}</span></span>
                    <span className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${on ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]'}`}>
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
                    </span>
                  </button>
                );
              })}
              {!sells && shownFeatures.length === 0 && <p className="text-sm text-secondary">Nothing extra to switch on. Your site is ready to name.</p>}
            </div>
            <button type="button" onClick={next} className="btn-primary w-full sm:w-auto mt-6 !rounded-full px-7 py-3.5 text-base font-medium inline-flex items-center justify-center gap-2">
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 className="g-h3">Name your site and launch</h3>
            <p className="text-sm text-secondary mt-1">Almost there. Pick a name and an address, and you are live.</p>
            <div className="mt-5">
              <CreateForumForm
                guided
                initialTemplateId={themeId || getTemplateById(undefined).id}
                pluginChoices={plugins}
                onChangeTheme={() => go(1)}
                onCreated={onCreated}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
