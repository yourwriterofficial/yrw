'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import PageHeader from '@/app/components/ui/PageHeader';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import Button from '@/app/components/ui/Button';
import { showToast } from '@/app/components/ui/Toast';

type Status = 'NEW' | 'REPLIED' | 'WON' | 'LOST' | 'SPAM';

type Quote = {
  id: number;
  created_at: string;
  name: string;
  email: string;
  whatsapp: string | null;
  service: string;
  deadline: string | null;
  details: string;
  brand: string;
  status: Status;
  notified: boolean;
  notes: string | null;
};

const SERVICE_LABEL: Record<string, string> = {
  academic: 'Academic writing',
  statistics: 'Statistics & fieldwork',
  content: 'Content writing',
  resume: 'CV & resume',
  dev: 'Software',
};

const STATUSES: { value: Status; label: string }[] = [
  { value: 'NEW', label: 'New' },
  { value: 'REPLIED', label: 'Replied' },
  { value: 'WON', label: 'Won' },
  { value: 'LOST', label: 'Lost' },
  { value: 'SPAM', label: 'Spam' },
];

const STATUS_TONE: Record<Status, string> = {
  NEW: 'bg-accent text-[var(--accent-foreground)]',
  REPLIED: 'bg-[var(--info-bg)] text-info',
  WON: 'bg-[var(--success-bg)] text-success',
  LOST: 'bg-secondary text-secondary',
  SPAM: 'bg-[var(--danger-bg)] text-danger',
};

/** Nigerian numbers are often typed as 080..., wa.me needs the country code and digits only. */
function waNumber(raw: string) {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('234')) return digits;
  if (digits.startsWith('0')) return '234' + digits.slice(1);
  return digits;
}

function ago(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  return days < 30 ? `${days} d ago` : new Date(iso).toLocaleDateString('en-GB');
}

export default function AdminQuoteRequestsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Quote[]>([]);
  const [filter, setFilter] = useState<Status | 'ALL'>('NEW');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError('');
    const { data, error: loadError } = await supabase
      .from('quote_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (loadError) {
      setError(
        /relation|does not exist|schema cache/i.test(loadError.message)
          ? 'The quote_requests table has not been created yet. Apply migration 20261114000000_quote_requests.sql.'
          : loadError.message
      );
    } else {
      setRows((data as Quote[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: rows.length };
    rows.forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== 'ALL' && r.status !== filter) return false;
      if (!q) return true;
      return [r.name, r.email, r.details, r.whatsapp || ''].some((v) => v.toLowerCase().includes(q));
    });
  }, [rows, filter, query]);

  const update = async (row: Quote, patch: Partial<Pick<Quote, 'status' | 'notes'>>) => {
    setSavingId(row.id);
    const { error: updateError } = await supabase.from('quote_requests').update(patch).eq('id', row.id);
    if (updateError) {
      showToast(updateError.message, 'error');
    } else {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...patch } : r)));
    }
    setSavingId(null);
  };

  const mailto = (r: Quote) => {
    const subject = encodeURIComponent(`Your quote request: ${SERVICE_LABEL[r.service] || r.service}`);
    const body = encodeURIComponent(`Hello ${r.name.split(' ')[0]},\n\nThank you for your request. `);
    return `mailto:${r.email}?subject=${subject}&body=${body}`;
  };

  const whatsapp = (r: Quote) => {
    const text = encodeURIComponent(`Hello ${r.name.split(' ')[0]}, this is ResearchWriter about your ${SERVICE_LABEL[r.service] || r.service} request.`);
    return `https://wa.me/${waNumber(r.whatsapp || '')}?text=${text}`;
  };

  if (loading) return <LoadingScreen label="Loading quote requests..." />;

  return (
    <div className="p-6 md:p-10 max-w-5xl">
      <PageHeader
        title="Quote requests"
        description="Requests from the home page and the developa page. Reply by email or WhatsApp, then set the status."
        actions={<Button variant="outline" size="sm" onClick={() => { setLoading(true); load(); }}>Refresh</Button>}
      />

      {error && <p className="text-sm text-danger border border-danger/30 rounded-xl p-4 mb-6" role="alert">{error}</p>}

      <div className="flex flex-wrap gap-2 mb-4">
        {[{ value: 'ALL' as const, label: 'All' }, ...STATUSES].map((s) => (
          <button
            key={s.value}
            onClick={() => setFilter(s.value)}
            className={`px-4 h-9 rounded-full text-sm font-medium border transition-colors ${
              filter === s.value ? 'bg-accent text-[var(--accent-foreground)] border-accent' : 'border-theme text-secondary hover:bg-hover hover:text-primary'
            }`}
          >
            {s.label} <span className="opacity-70">{counts[s.value] || 0}</span>
          </button>
        ))}
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name, email, WhatsApp or details"
        aria-label="Search quote requests"
        className="input-box w-full mb-6"
      />

      {visible.length === 0 && !error ? (
        <p className="text-sm text-secondary border border-dashed border-theme rounded-2xl p-8 text-center">
          {rows.length === 0 ? 'No quote requests yet. They will appear here as soon as someone submits the form.' : 'Nothing matches this filter.'}
        </p>
      ) : (
        <ul className="space-y-4">
          {visible.map((r) => (
            <li key={r.id} className="border border-theme rounded-2xl bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-sm text-secondary mt-0.5">
                    {SERVICE_LABEL[r.service] || r.service}
                    {r.brand === 'developa' ? ' · developa' : ''}
                    {' · '}{ago(r.created_at)}
                    {r.deadline ? ` · wants it by ${r.deadline}` : ''}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_TONE[r.status]}`}>
                  {STATUSES.find((s) => s.value === r.status)?.label}
                </span>
              </div>

              <p className="text-sm mt-4 whitespace-pre-wrap break-words">{r.details}</p>

              <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-sm">
                <a href={mailto(r)} className="text-accent font-medium hover:underline">{r.email}</a>
                {r.whatsapp && waNumber(r.whatsapp).length >= 10 && (
                  <a href={whatsapp(r)} target="_blank" rel="noopener noreferrer" className="text-accent font-medium hover:underline">
                    WhatsApp {r.whatsapp}
                  </a>
                )}
                {!r.notified && <span className="text-warning">Admin email may not have sent</span>}
              </div>

              <div className="grid sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-theme">
                <div>
                  <label htmlFor={`st-${r.id}`} className="block text-xs text-secondary mb-1">Status</label>
                  <select
                    id={`st-${r.id}`}
                    value={r.status}
                    disabled={savingId === r.id}
                    onChange={(e) => update(r, { status: e.target.value as Status })}
                    className="input-box w-full !py-2.5 text-sm"
                  >
                    {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor={`nt-${r.id}`} className="block text-xs text-secondary mb-1">Private note</label>
                  <input
                    id={`nt-${r.id}`}
                    defaultValue={r.notes || ''}
                    placeholder="Quote sent, price, follow-up date…"
                    onBlur={(e) => { if (e.target.value !== (r.notes || '')) update(r, { notes: e.target.value }); }}
                    className="input-box w-full !py-2.5 text-sm"
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
