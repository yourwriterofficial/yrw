'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

let toastId = 0;
const showToast = (message: string, type: 'success' | 'error' = 'success') => {
  const event = new CustomEvent('app:toast', { detail: { id: toastId++, message, type } });
  window.dispatchEvent(event);
};

export default function MassEmailPage() {
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState('all');
  const [userIds, setUserIds] = useState<string[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [toasts, setToasts] = useState<{ id: number; message: string; type: string }[]>([]);

  useEffect(() => {
    const handler = (e: any) => {
      setToasts(prev => [...prev, e.detail]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== e.detail.id)), 4000);
    };
    window.addEventListener('app:toast', handler);
    return () => window.removeEventListener('app:toast', handler);
  }, []);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase.from('profiles').select('id, email, full_name').order('full_name');
      if (data) setUsers(data);
    };
    fetchUsers();
  }, []);

  const sendEmail = async () => {
    if (!subject || !html) {
      showToast('Subject and HTML content required', 'error');
      return;
    }
    setSending(true);
    const recipients = filter === 'selected' ? userIds : filter === 'active' ? users.map(u => u.id) : users.map(u => u.id);
    if (recipients.length === 0) {
      showToast('No recipients selected', 'error');
      setSending(false);
      return;
    }
    const res = await fetch('/api/admin/send-mass-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, html, userIds: recipients }),
    });
    const data = await res.json();
    if (res.ok) showToast(`Email sent to ${data.sentCount || recipients.length} users`, 'success');
    else showToast(data.error, 'error');
    setSending(false);
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto">
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-2 rounded-lg shadow-lg text-sm font-bold ${t.type === 'success' ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'}`}>
            {t.message}
          </div>
        ))}
      </div>

      <h1 className="text-3xl font-black mb-6">Mass Email</h1>

      <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-6 space-y-6">
        <div>
          <label className="text-[10px] uppercase font-black text-zinc-500">Recipients</label>
          <div className="flex gap-4 mt-2">
            <label className="flex items-center gap-2"><input type="radio" name="filter" value="all" checked={filter === 'all'} onChange={() => setFilter('all')} /> All Users</label>
            <label className="flex items-center gap-2"><input type="radio" name="filter" value="active" checked={filter === 'active'} onChange={() => setFilter('active')} /> Active Users (has orders)</label>
            <label className="flex items-center gap-2"><input type="radio" name="filter" value="selected" checked={filter === 'selected'} onChange={() => setFilter('selected')} /> Selected Users</label>
          </div>
          {filter === 'selected' && (
            <div className="mt-4 border border-white/10 rounded-xl p-4 max-h-48 overflow-y-auto">
              {users.map(user => (
                <label key={user.id} className="flex items-center gap-2 py-1">
                  <input type="checkbox" value={user.id} checked={userIds.includes(user.id)} onChange={e => {
                    if (e.target.checked) setUserIds([...userIds, user.id]);
                    else setUserIds(userIds.filter(id => id !== user.id));
                  }} />
                  <span>{user.full_name || user.email}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-[10px] uppercase font-black text-zinc-500">Subject</label>
          <input type="text" value={subject} onChange={e => setSubject(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-3 mt-1" placeholder="Your email subject" />
        </div>

        <div>
          <label className="text-[10px] uppercase font-black text-zinc-500">HTML Content</label>
          <textarea value={html} onChange={e => setHtml(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-3 mt-1 h-64 font-mono text-sm" placeholder="<p>Hello,</p><p>Your message here...</p>" />
        </div>

        <button onClick={sendEmail} disabled={sending} className="w-full py-3 bg-purple-500 text-black font-black rounded-xl">
          {sending ? 'Sending...' : 'Send Mass Email'}
        </button>
      </div>
    </div>
  );
}