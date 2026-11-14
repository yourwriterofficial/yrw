'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Lock, Plus, ArrowRight, ShoppingBag, MessageSquare, Layers } from 'lucide-react';
import { FORUM_ACCENTS, normalizeForumSlug, validateForumSlug, getForumHref } from '@/lib/forums';
import { SITE_TEMPLATES, TEMPLATE_GROUPS, getTemplateById, templateGroup, type TemplateGroup } from '@/lib/siteTemplates';
import Button from '@/app/components/ui/Button';

interface Props {
  onCreated?: () => void;
}

export default function CreateForumForm({ onCreated }: Props) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState<string>(SITE_TEMPLATES[0].id);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [accent, setAccent] = useState<string>(SITE_TEMPLATES[0].accent_color);
  const [currency, setCurrency] = useState<'NGN' | 'USD' | 'GBP'>('NGN');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [group, setGroup] = useState<TemplateGroup>('sell');
  const selectedTemplate = getTemplateById(templateId);
  const hasStore = selectedTemplate.site_mode !== 'forum';

  const handleSelectTemplate = (id: string) => {
    setTemplateId(id);
    setGroup(templateGroup(getTemplateById(id)));
    const tpl = getTemplateById(id);
    setAccent(tpl.accent_color);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slugTouched) setSlug(normalizeForumSlug(val));
  };

  const handleSlugChange = (val: string) => {
    setSlugTouched(true);
    setSlug(normalizeForumSlug(val));
  };

  const slugError = slug ? validateForumSlug(slug) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const validationErr = validateForumSlug(slug);
    if (validationErr) {
      setError(validationErr);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/forums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          name,
          description,
          is_public: isPublic,
          accent_color: accent,
          template_id: selectedTemplate.id,
          site_mode: selectedTemplate.site_mode,
          currency,
          whatsapp_number: whatsappNumber,
          bank_name: bankName,
          bank_account_number: bankAccountNumber,
          bank_account_name: bankAccountName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not launch site.');
        return;
      }
      onCreated?.();
      const target = getForumHref(data.forum.slug, typeof window !== 'undefined' ? window.location.host : undefined);
      if (target.startsWith('http')) {
        window.location.href = target;
      } else {
        router.push(target);
      }
    } catch {
      setError('Network error while launching site.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card border border-theme rounded-2xl p-6 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-primary flex items-center gap-2">
          <Plus className="w-4 h-4 text-accent" />
          Launch Your Store or Forum on developa.me
        </h2>
        <p className="text-xs text-secondary mt-0.5">
          Pick a ready-made template — zero coding required. Your site goes live at{' '}
          <span className="font-mono text-accent">[name].developa.me</span>.
        </p>
      </div>

      {/* Template Picker */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-secondary">1. Choose a Template</label>
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
          {TEMPLATE_GROUPS.map((g) => (
            <button key={g.key} type="button" role="tab" aria-selected={group === g.key} onClick={() => setGroup(g.key)}
              className={`shrink-0 px-4 h-9 rounded-full text-xs font-semibold border transition ${group === g.key ? 'bg-accent text-[var(--accent-foreground)] border-transparent' : 'border-theme text-secondary hover:bg-hover'}`}>
              {g.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {SITE_TEMPLATES.filter((t) => templateGroup(t) === group).map((tpl) => {
            const active = tpl.id === templateId;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleSelectTemplate(tpl.id)}
                className={`text-left p-3.5 rounded-xl border transition space-y-1.5 ${
                  active
                    ? 'border-accent bg-accent/10'
                    : 'border-theme bg-primary/60 hover:border-accent/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-primary">{tpl.label}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary/50 text-secondary flex items-center gap-1">
                    {tpl.site_mode === 'store' ? (
                      <><ShoppingBag className="w-2.5 h-2.5 text-emerald-400" /> Store</>
                    ) : tpl.site_mode === 'both' ? (
                      <><Layers className="w-2.5 h-2.5 text-amber-400" /> Both</>
                    ) : (
                      <><MessageSquare className="w-2.5 h-2.5 text-accent" /> Forum</>
                    )}
                  </span>
                </div>
                <p className="text-[11px] text-secondary line-clamp-2">{tpl.tagline}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-secondary mb-1.5">
            {hasStore ? 'Store / Brand Name' : 'Forum Name'}
          </label>
          <input
            type="text"
            required
            maxLength={80}
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder={hasStore ? 'e.g. Kolawole Apparel' : 'e.g. Naija SaaS Builders'}
            className="w-full px-3.5 py-2.5 rounded-xl bg-primary border border-theme text-sm text-primary focus:outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-secondary mb-1.5">Subdomain Address</label>
          <div className="flex items-center rounded-xl bg-primary border border-theme focus-within:border-accent overflow-hidden">
            <input
              type="text"
              required
              maxLength={32}
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="my-store"
              className="flex-1 px-3.5 py-2.5 bg-transparent text-sm font-mono text-primary focus:outline-none min-w-0"
            />
            <span className="px-3 py-2.5 text-xs font-mono text-accent bg-secondary/40 border-l border-theme shrink-0">
              .developa.me
            </span>
          </div>
          {slugError && <p className="text-[11px] text-danger mt-1">{slugError}</p>}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-secondary mb-1.5">Short Description</label>
        <textarea
          rows={2}
          maxLength={300}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={hasStore ? 'What do you sell?' : 'What is this community about?'}
          className="w-full px-3.5 py-2.5 rounded-xl bg-primary border border-theme text-sm text-primary focus:outline-none focus:border-accent resize-none"
        />
      </div>

      {hasStore && (
        <div className="rounded-xl border border-theme bg-primary/50 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-primary">Manual Bank Transfer & Contact (Optional — editable anytime)</span>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as 'NGN' | 'USD' | 'GBP')}
              className="px-2.5 py-1 rounded-lg bg-card border border-theme text-xs font-semibold text-primary"
            >
              <option value="NGN">NGN (₦)</option>
              <option value="USD">USD ($)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Bank Name (e.g. GTBank)"
              className="px-3 py-2 rounded-lg bg-card border border-theme text-xs text-primary focus:outline-none focus:border-accent"
            />
            <input
              type="text"
              value={bankAccountNumber}
              onChange={(e) => setBankAccountNumber(e.target.value)}
              placeholder="Account Number"
              className="px-3 py-2 rounded-lg bg-card border border-theme text-xs font-mono text-primary focus:outline-none focus:border-accent"
            />
            <input
              type="text"
              value={bankAccountName}
              onChange={(e) => setBankAccountName(e.target.value)}
              placeholder="Account Name"
              className="px-3 py-2 rounded-lg bg-card border border-theme text-xs text-primary focus:outline-none focus:border-accent"
            />
            <input
              type="text"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="WhatsApp (e.g. 23480...)"
              className="px-3 py-2 rounded-lg bg-card border border-theme text-xs text-primary focus:outline-none focus:border-accent"
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsPublic(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition ${
              isPublic ? 'bg-accent/15 border-accent/40 text-accent' : 'border-theme text-secondary'
            }`}
          >
            <Globe className="w-3.5 h-3.5" /> Public
          </button>
          <button
            type="button"
            onClick={() => setIsPublic(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition ${
              !isPublic ? 'bg-amber-500/15 border-amber-500/40 text-amber-400' : 'border-theme text-secondary'
            }`}
          >
            <Lock className="w-3.5 h-3.5" /> Private
          </button>

          <div className="flex items-center gap-1.5 pl-2 border-l border-theme">
            {FORUM_ACCENTS.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-label={item.label}
                onClick={() => setAccent(item.value)}
                className={`w-5 h-5 rounded-full transition-transform ${
                  accent === item.value ? 'scale-125 ring-2 ring-white/60' : 'opacity-70 hover:opacity-100'
                }`}
                style={{ backgroundColor: item.value }}
              />
            ))}
          </div>
        </div>

        <Button type="submit" variant="primary" disabled={submitting || !slug || !!slugError} icon={<ArrowRight className="w-4 h-4" />}>
          {submitting ? 'Launching...' : hasStore ? 'Launch Store' : 'Create Forum'}
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-xs text-danger">
          {error}
        </div>
      )}
    </form>
  );
}
