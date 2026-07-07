'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';
import { showToast, ToastContainer } from '@/app/components/ui/Toast';

export default function AdminLogsPage() {
  const [activeTab, setActiveTab] = useState<'system' | 'notifications' | 'emails'>('system');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Data lists
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [notificationLogs, setNotificationLogs] = useState<any[]>([]);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 25;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      if (activeTab === 'system') {
        let q = supabase
          .from('transactions')
          .select('*, profiles(email, full_name)', { count: 'exact' });

        if (search.trim()) {
          const s = search.trim();
          // Due to nested join filtering limits in client libraries, we fetch and client-side filter or use custom matches.
          // Let's filter directly or match by reference
          q = q.or(`reference.ilike.%${s}%,status.ilike.%${s}%`);
        }
        
        const { data, count, error } = await q
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) throw error;
        setSystemLogs(data || []);
        setTotalCount(count || 0);
      } else if (activeTab === 'notifications') {
        let q = supabase
          .from('notifications')
          .select('*, profiles(email, full_name)', { count: 'exact' });

        if (search.trim()) {
          const s = search.trim();
          q = q.or(`title.ilike.%${s}%,message.ilike.%${s}%,type.ilike.%${s}%`);
        }

        const { data, count, error } = await q
          .order('created_at', { ascending: false })
          .range(from, to);

        if (error) throw error;
        setNotificationLogs(data || []);
        setTotalCount(count || 0);
      } else if (activeTab === 'emails') {
        let q = supabase
          .from('email_logs')
          .select('*', { count: 'exact' });

        if (search.trim()) {
          const s = search.trim();
          q = q.or(`recipient.ilike.%${s}%,subject.ilike.%${s}%,status.ilike.%${s}%`);
        }

        const { data, count, error } = await q
          .order('sent_at', { ascending: false })
          .range(from, to);

        if (error) throw error;
        setEmailLogs(data || []);
        setTotalCount(count || 0);
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to load logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [activeTab, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  return (
    <div className="p-6 md:p-10 space-y-6">
      <ToastContainer />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-primary flex items-center gap-2">
            <lucide.FileText className="w-6 h-6 text-purple-500" /> System & Audit Logs
          </h1>
          <p className="text-xs text-secondary mt-1">Review live notifications, transactions, and email transmission audits.</p>
        </div>
        <button 
          onClick={() => { setPage(1); fetchLogs(); }}
          className="px-4 py-2 bg-secondary border border-theme hover:bg-white/5 text-primary text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
        >
          <lucide.RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Logs
        </button>
      </div>

      {/* TAB SELECTOR */}
      <div className="flex border-b border-theme gap-6">
        <button
          onClick={() => { setActiveTab('system'); setPage(1); setSearch(''); }}
          className={`pb-4 text-sm font-bold border-b-2 transition ${activeTab === 'system' ? 'border-purple-500 text-purple-500' : 'border-transparent text-secondary hover:text-primary'}`}
        >
          💳 System / Transaction Logs
        </button>
        <button
          onClick={() => { setActiveTab('notifications'); setPage(1); setSearch(''); }}
          className={`pb-4 text-sm font-bold border-b-2 transition ${activeTab === 'notifications' ? 'border-purple-500 text-purple-500' : 'border-transparent text-secondary hover:text-primary'}`}
        >
          🔔 In-App Notification Logs
        </button>
        <button
          onClick={() => { setActiveTab('emails'); setPage(1); setSearch(''); }}
          className={`pb-4 text-sm font-bold border-b-2 transition ${activeTab === 'emails' ? 'border-purple-500 text-purple-500' : 'border-transparent text-secondary hover:text-primary'}`}
        >
          ✉️ Email Delivery Logs
        </button>
      </div>

      {/* FILTER/SEARCH BAR */}
      <form onSubmit={handleSearchSubmit} className="bg-card border border-theme rounded-2xl p-4 flex gap-4">
        <div className="relative flex-1">
          <lucide.Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-secondary" />
          <input 
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${activeTab === 'system' ? 'references or statuses' : activeTab === 'notifications' ? 'titles or messages' : 'recipients or subjects'}...`} 
            className="w-full bg-secondary border border-theme rounded-xl pl-11 pr-24 py-3 text-sm text-primary outline-none focus:border-purple-500 transition"
          />
          <button 
            type="submit"
            className="absolute right-2 top-1.2 bg-purple-500 hover:bg-purple-400 text-white text-xs font-bold px-4 py-2 rounded-lg transition"
          >
            Filter
          </button>
        </div>
      </form>

      {/* LOG DATA CONTAINER */}
      <div className="bg-card border border-theme rounded-3xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-sm text-secondary flex items-center justify-center gap-2">
            <lucide.Loader2 className="w-5 h-5 animate-spin text-purple-500" /> Loading log entries...
          </div>
        ) : (
          <div>
            {/* 1. SYSTEM LOGS TAB */}
            {activeTab === 'system' && (
              systemLogs.length === 0 ? (
                <div className="py-16 text-center text-secondary text-xs">No transaction logs available.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-theme bg-secondary/30 text-secondary font-black uppercase tracking-wider text-[10px]">
                        <th className="p-4">Ref / ID</th>
                        <th className="p-4">User</th>
                        <th className="p-4">Action</th>
                        <th className="p-4">Amount</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme/45">
                      {systemLogs.map(log => (
                        <tr key={log.id} className="hover:bg-white/5 transition">
                          <td className="p-4 font-mono select-all font-bold text-primary">{log.reference}</td>
                          <td className="p-4">
                            <span className="font-bold text-primary">{log.profiles?.full_name || 'Guest'}</span>
                            <span className="block text-secondary text-[10px]">{log.profiles?.email || 'N/A'}</span>
                          </td>
                          <td className="p-4 uppercase font-bold text-[10px] text-purple-400">{log.type}</td>
                          <td className="p-4 font-mono font-bold text-primary">₦{Number(log.amount).toLocaleString()}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${log.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="p-4 text-secondary font-semibold">{new Date(log.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* 2. NOTIFICATION LOGS TAB */}
            {activeTab === 'notifications' && (
              notificationLogs.length === 0 ? (
                <div className="py-16 text-center text-secondary text-xs">No notification logs available.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-theme bg-secondary/30 text-secondary font-black uppercase tracking-wider text-[10px]">
                        <th className="p-4">Recipient</th>
                        <th className="p-4">Notification Topic</th>
                        <th className="p-4">Category</th>
                        <th className="p-4">Delivery Channels</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Sent At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme/45">
                      {notificationLogs.map(log => (
                        <tr key={log.id} className="hover:bg-white/5 transition">
                          <td className="p-4">
                            <span className="font-bold text-primary">{log.profiles?.full_name || 'Admin'}</span>
                            <span className="block text-secondary text-[10px]">{log.profiles?.email || 'N/A'}</span>
                          </td>
                          <td className="p-4 max-w-xs">
                            <div className="font-bold text-primary truncate">{log.title}</div>
                            <div className="text-secondary text-[10px] line-clamp-2 mt-0.5">{log.message}</div>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded bg-white/5 border border-theme text-primary text-[9px] font-bold uppercase">
                              {log.type}
                            </span>
                          </td>
                          <td className="p-4 text-[10px] font-bold text-secondary space-y-0.5">
                            <div>In-App: <span className={log.send_in_app ? 'text-emerald-400' : 'text-zinc-600'}>{log.send_in_app ? 'YES' : 'NO'}</span></div>
                            <div>Email: <span className={log.send_email ? 'text-emerald-400' : 'text-zinc-600'}>{log.send_email ? 'YES' : 'NO'}</span></div>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${log.read ? 'bg-zinc-500/10 text-zinc-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                              {log.read ? 'Read' : 'Unread'}
                            </span>
                          </td>
                          <td className="p-4 text-secondary font-semibold">{new Date(log.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* 3. EMAIL LOGS TAB */}
            {activeTab === 'emails' && (
              emailLogs.length === 0 ? (
                <div className="py-16 text-center text-secondary text-xs">No email delivery logs available.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-theme bg-secondary/30 text-secondary font-black uppercase tracking-wider text-[10px]">
                        <th className="p-4">Recipient</th>
                        <th className="p-4">Subject</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Error details</th>
                        <th className="p-4">Dispatched At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme/45">
                      {emailLogs.map(log => (
                        <tr key={log.id} className="hover:bg-white/5 transition">
                          <td className="p-4 font-bold text-primary select-all">{log.recipient}</td>
                          <td className="p-4 font-bold text-primary max-w-xs truncate">{log.subject || '—'}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${log.status === 'sent' || log.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="p-4 text-secondary italic text-[10px] max-w-xs truncate">{log.error_message || '—'}</td>
                          <td className="p-4 text-secondary font-semibold">{new Date(log.sent_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* PAGINATION BAR */}
      {!loading && Math.ceil(totalCount / PAGE_SIZE) > 1 && (
        <div className="flex justify-between items-center bg-card border border-theme px-6 py-4 rounded-2xl">
          <span className="text-xs text-secondary font-bold">
            Showing Page {page} of {Math.ceil(totalCount / PAGE_SIZE)} ({totalCount} total entries)
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="px-3.5 py-2 bg-secondary border border-theme text-primary text-xs font-bold rounded-xl transition hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              ◀ Previous
            </button>
            <button
              disabled={page >= Math.ceil(totalCount / PAGE_SIZE)}
              onClick={() => setPage(page + 1)}
              className="px-3.5 py-2 bg-secondary border border-theme text-primary text-xs font-bold rounded-xl transition hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              Next ▶
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
