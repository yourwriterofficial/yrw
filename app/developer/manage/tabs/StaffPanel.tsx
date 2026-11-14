'use client';

import { useCallback, useEffect, useState } from 'react';
import { planFor } from '@/lib/plans';
import type { SiteRole } from '@/lib/forumServer';
import { jsonFetch, type Site } from '../types';

interface StaffRow {
  id: string;
  email: string;
  role: 'manager' | 'packer' | 'support';
  user_id: string | null;
  created_at: string;
}

const ROLE_NOTES: Record<StaffRow['role'], string> = {
  manager: 'Products, orders, customers, delivery, coupons, settings',
  packer: 'Orders & shipping dispatch only',
  support: 'Orders, customers & community replies',
};

export default function StaffPanel({ site, goToPlan }: { site: Site; goToPlan: () => void }) {
  const plan = planFor(site.plan_tier, site.plan_expires_at);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRow['role']>('manager');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await jsonFetch<{ staff?: StaffRow[] }>(`/api/forums/${site.slug}/staff`);
    setStaff(Array.isArray(r.data.staff) ? r.data.staff : []);
    setLoading(false);
  }, [site.slug]);

  useEffect(() => {
    if (plan.staffAccounts) load();
    else setLoading(false);
  }, [plan.staffAccounts, load]);

  const invite = async () => {
    setBusy(true);
    setMsg(null);
    const r = await jsonFetch(`/api/forums/${site.slug}/staff`, {
      method: 'POST',
      body: { email, role },
    });
    if (r.ok) {
      setEmail('');
      setMsg({ ok: true, text: 'Team member invited.' });
      await load();
    } else {
      setMsg({ ok: false, text: r.data.error || 'Could not add team member.' });
    }
    setBusy(false);
  };

  const changeRole = async (id: string, nextRole: StaffRow['role']) => {
    const r = await jsonFetch(`/api/forums/${site.slug}/staff`, {
      method: 'PATCH',
      body: { id, role: nextRole },
    });
    if (r.ok) await load();
  };

  const remove = async (id: string, targetEmail: string) => {
    if (!confirm(`Remove ${targetEmail} from your team?`)) return;
    const r = await jsonFetch(`/api/forums/${site.slug}/staff?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (r.ok) await load();
  };

  return (
    <section className="g-card p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-medium">Staff & roles</h3>
          <p className="text-sm text-secondary mt-0.5">Give team members controlled access without sharing your login.</p>
        </div>
        {!plan.staffAccounts && (
          <button type="button" onClick={goToPlan} className="text-xs font-medium px-4 h-9 rounded-full border border-theme hover:bg-hover">
            Upgrade to Business
          </button>
        )}
      </div>

      {!plan.staffAccounts ? (
        <p className="text-sm text-secondary">Available on the Business plan for up to 5 team members (Manager, Packer, or Support).</p>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-3 items-end">
            <div className="sm:col-span-2">
              <label htmlFor="staff-email" className="block text-xs font-medium mb-1">Staff email</label>
              <input
                id="staff-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@example.com"
                className="input-box w-full text-sm"
              />
            </div>
            <div>
              <label htmlFor="staff-role" className="block text-xs font-medium mb-1">Role</label>
              <select id="staff-role" value={role} onChange={(e) => setRole(e.target.value as StaffRow['role'])} className="input-box w-full text-sm">
                <option value="manager">Manager</option>
                <option value="packer">Packer</option>
                <option value="support">Support</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-secondary">{ROLE_NOTES[role]}</p>
            <button
              type="button"
              onClick={invite}
              disabled={busy || !email.trim()}
              className="px-5 h-10 rounded-full border border-theme hover:bg-hover text-xs font-medium disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Invite member'}
            </button>
          </div>
          {msg && <p className={`text-xs ${msg.ok ? 'text-success' : 'text-danger'}`} role="status">{msg.text}</p>}

          {loading ? (
            <p className="text-xs text-secondary">Loading team…</p>
          ) : staff.length === 0 ? (
            <p className="text-xs text-secondary">No staff invited yet.</p>
          ) : (
            <ul className="divide-y divide-theme pt-2">
              {staff.map((m) => (
                <li key={m.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{m.email}</p>
                    <p className="text-xs text-secondary">{ROLE_NOTES[m.role as Exclude<SiteRole, 'owner'>]}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      aria-label={`Role for ${m.email}`}
                      value={m.role}
                      onChange={(e) => changeRole(m.id, e.target.value as StaffRow['role'])}
                      className="input-box !py-1.5 text-xs"
                    >
                      <option value="manager">Manager</option>
                      <option value="packer">Packer</option>
                      <option value="support">Support</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => remove(m.id, m.email)}
                      className="px-3 h-9 rounded-full text-xs text-danger hover:bg-hover"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
