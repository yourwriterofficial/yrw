'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';
import { showToast } from '@/app/components/ui/Toast';
import PageHeader from '@/app/components/ui/PageHeader';

export default function AdminLogsPage() {
  const [activeTab, setActiveTab] = useState<'system' | 'notifications' | 'emails'>('system');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Raw Data lists from DB
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [notificationLogs, setNotificationLogs] = useState<any[]>([]);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  
  // Grouped logs for rendering
  const [displayNotifications, setDisplayNotifications] = useState<any[]>([]);
  const [displayEmails, setDisplayEmails] = useState<any[]>([]);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 25;

  // Selected Log Details Modal
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [selectedType, setSelectedType] = useState<'notification' | 'email' | null>(null);

  // Grouping helper function
  const groupLogs = useCallback((logs: any[], tabType: 'notifications' | 'emails') => {
    const grouped: any[] = [];
    const batchMap = new Map<string, any>();

    logs.forEach(log => {
      const batchId = log.batch_id;
      if (batchId) {
        if (batchMap.has(batchId)) {
          const existing = batchMap.get(batchId);
          existing.recipient_count += 1;
          existing.recipients.push({
            email: tabType === 'notifications' ? (log.profiles?.email || 'N/A') : (log.recipient || 'N/A'),
            name: tabType === 'notifications' ? (log.profiles?.full_name || 'Client') : 'Client',
            status: tabType === 'notifications' ? (log.read ? 'Read' : 'Unread') : (log.status || 'sent')
          });
          // Update timestamp to show most recent activity in group
          const logTime = new Date(log.created_at || log.sent_at).getTime();
          const existingTime = new Date(existing.created_at || existing.sent_at).getTime();
          if (logTime > existingTime) {
            existing.created_at = log.created_at;
            existing.sent_at = log.sent_at;
          }
        } else {
          const groupObj = {
            ...log,
            is_group: true,
            recipient_count: 1,
            recipients: [{
              email: tabType === 'notifications' ? (log.profiles?.email || 'N/A') : (log.recipient || 'N/A'),
              name: tabType === 'notifications' ? (log.profiles?.full_name || 'Client') : 'Client',
              status: tabType === 'notifications' ? (log.read ? 'Read' : 'Unread') : (log.status || 'sent')
            }]
          };
          batchMap.set(batchId, groupObj);
          grouped.push(groupObj);
        }
      } else {
        grouped.push({
          ...log,
          is_group: false,
          recipient_count: 1,
          recipients: [{
            email: tabType === 'notifications' ? (log.profiles?.email || 'N/A') : (log.recipient || 'N/A'),
            name: tabType === 'notifications' ? (log.profiles?.full_name || 'Client') : 'Client',
            status: tabType === 'notifications' ? (log.read ? 'Read' : 'Unread') : (log.status || 'sent')
          }]
        });
      }
    });

    return grouped;
  }, []);

  const fetchLogs = useCallback(async () => {
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
        setDisplayNotifications(groupLogs(data || [], 'notifications'));
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
        setDisplayEmails(groupLogs(data || [], 'emails'));
        setTotalCount(count || 0);
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to load logs', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, search, groupLogs]);

  useEffect(() => {
    fetchLogs();
  }, [activeTab, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const openLogDetails = (log: any, type: 'notification' | 'email') => {
    setSelectedLog(log);
    setSelectedType(type);
  };

  return (
    <div className="p-6 md:p-10 space-y-6">

      <PageHeader
        title="System & Audit Logs"
        description="Review live notifications, transactions, and email transmission audits."
        breadcrumb="Admin / System Logs"
        icon={<lucide.FileText className="w-8 h-8 text-purple-500" />}
        actions={
          <button
            onClick={() => { setPage(1); fetchLogs(); }}
            className="px-4 py-2 bg-secondary border border-theme hover:bg-white/5 text-primary text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
          >
            <lucide.RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Logs
          </button>
        }
      />

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
            className="absolute right-2 top-1.5 bg-purple-500 hover:bg-purple-400 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition cursor-pointer"
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

            {/* 2. NOTIFICATION LOGS TAB (WITH GROUPING & DETAILS MODAL) */}
            {activeTab === 'notifications' && (
              displayNotifications.length === 0 ? (
                <div className="py-16 text-center text-secondary text-xs">No notification logs available.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-theme bg-secondary/30 text-secondary font-black uppercase tracking-wider text-[10px]">
                        <th className="p-4">Recipient</th>
                        <th className="p-4">Notification Topic</th>
                        <th className="p-4">Category</th>
                        <th className="p-4">Channels</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Sent At</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme/45">
                      {displayNotifications.map(log => (
                        <tr key={log.id} className="hover:bg-white/5 transition">
                          <td className="p-4">
                            {log.is_group ? (
                              <span className="font-extrabold text-purple-400 flex items-center gap-1.5">
                                <lucide.Users className="w-3.5 h-3.5" /> Group ({log.recipient_count} users)
                              </span>
                            ) : (
                              <>
                                <span className="font-bold text-primary">{log.profiles?.full_name || 'Admin'}</span>
                                <span className="block text-secondary text-[10px]">{log.profiles?.email || 'N/A'}</span>
                              </>
                            )}
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
                            <div>In-App: <span className={log.send_in_app ? 'text-emerald-400' : 'text-muted'}>{log.send_in_app ? 'YES' : 'NO'}</span></div>
                            <div>Email: <span className={log.send_email ? 'text-emerald-400' : 'text-muted'}>{log.send_email ? 'YES' : 'NO'}</span></div>
                          </td>
                          <td className="p-4">
                            {log.is_group ? (
                              <span className="text-[10px] font-bold text-secondary">Mixed Status</span>
                            ) : (
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${log.read ? 'bg-secondary text-muted' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                {log.read ? 'Read' : 'Unread'}
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-secondary font-semibold">{new Date(log.created_at).toLocaleString()}</td>
                          <td className="p-4 text-right">
                            <button 
                              onClick={() => openLogDetails(log, 'notification')}
                              className="px-2.5 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/25 rounded-md font-bold text-[10px] transition cursor-pointer"
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* 3. EMAIL LOGS TAB (WITH GROUPING, DETAILS MODAL & CONTENT BODY) */}
            {activeTab === 'emails' && (
              displayEmails.length === 0 ? (
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
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme/45">
                      {displayEmails.map(log => (
                        <tr key={log.id} className="hover:bg-white/5 transition">
                          <td className="p-4">
                            {log.is_group ? (
                              <span className="font-extrabold text-purple-400 flex items-center gap-1.5">
                                <lucide.Users className="w-3.5 h-3.5" /> Group ({log.recipient_count} users)
                              </span>
                            ) : (
                              <span className="font-bold text-primary select-all">{log.recipient}</span>
                            )}
                          </td>
                          <td className="p-4 font-bold text-primary max-w-xs truncate">{log.subject || '—'}</td>
                          <td className="p-4">
                            {log.is_group ? (
                              <span className="text-[10px] font-bold text-secondary">Mixed Status</span>
                            ) : (
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${log.status === 'sent' || log.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                {log.status}
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-secondary italic text-[10px] max-w-xs truncate">{log.error_message || '—'}</td>
                          <td className="p-4 text-secondary font-semibold">{new Date(log.sent_at).toLocaleString()}</td>
                          <td className="p-4 text-right">
                            <button 
                              onClick={() => openLogDetails(log, 'email')}
                              className="px-2.5 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/25 rounded-md font-bold text-[10px] transition cursor-pointer"
                            >
                              Details
                            </button>
                          </td>
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

      {/* LOG DETAILS DRAWER / MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-primary h-screen border-l border-theme flex flex-col shadow-2xl animate-in slide-in-from-right duration-350">
            <header className="p-6 border-b border-theme flex justify-between items-center shrink-0">
              <div>
                <span className="text-[10px] font-black uppercase text-purple-400 tracking-widest">{selectedType === 'email' ? 'Email Dispatch Audit' : 'In-App Notification Audit'}</span>
                <h3 className="text-lg font-black text-primary mt-1">{selectedLog.subject || selectedLog.title || 'Log Details'}</h3>
              </div>
              <button onClick={() => { setSelectedLog(null); setSelectedType(null); }} className="w-11 h-11 rounded-full bg-secondary hover:bg-white/5 text-primary flex items-center justify-center transition cursor-pointer">
                <lucide.X className="w-4 h-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Metadata details */}
              <div className="bg-secondary/45 border border-theme rounded-2xl p-5 space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-secondary">Dispatch Information</h4>
                
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-secondary block font-bold">Category / Type</span>
                    <span className="text-primary font-black uppercase mt-1 block">{selectedLog.type || (selectedType === 'email' ? 'system_email' : 'notification')}</span>
                  </div>
                  <div>
                    <span className="text-secondary block font-bold">Dispatched Date</span>
                    <span className="text-primary font-black mt-1 block">{new Date(selectedLog.created_at || selectedLog.sent_at).toLocaleString()}</span>
                  </div>
                  {selectedLog.batch_id && (
                    <div className="col-span-2 border-t border-theme/40 pt-3">
                      <span className="text-secondary block font-bold">Batch Group ID</span>
                      <span className="text-purple-400 font-mono font-bold mt-1 block select-all">{selectedLog.batch_id}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Group recipients block */}
              <div className="bg-card border border-theme rounded-2xl p-5 space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-secondary flex items-center gap-1.5">
                  {selectedLog.is_group ? <lucide.Users className="w-4 h-4 text-purple-400" /> : <lucide.User className="w-4 h-4 text-purple-400" />}
                  Recipient(s) List ({selectedLog.recipients?.length || 1})
                </h4>
                
                <div className="max-h-40 overflow-y-auto border border-theme/50 rounded-xl divide-y divide-theme/40 bg-secondary/20">
                  {selectedLog.recipients?.map((r: any, idx: number) => (
                    <div key={idx} className="p-3 text-xs flex justify-between items-center gap-3">
                      <div className="truncate">
                        <span className="font-bold text-primary block truncate">{r.email}</span>
                        {r.name && r.name !== 'Client' && <span className="text-secondary text-[10px] truncate">{r.name}</span>}
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${r.status === 'sent' || r.status === 'success' || r.status === 'Read' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Message contents */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-secondary">Logged Message Contents</h4>
                
                {selectedType === 'email' ? (
                  <div className="border border-theme rounded-2xl overflow-hidden bg-primary">
                    <iframe
                      srcDoc={selectedLog.body || '<div style="color: #999; text-align: center; padding: 20px; font-family: sans-serif;">(No content body logged for this record)</div>'}
                      className="w-full h-[360px] bg-white"
                      title="Logged Email Content Body"
                    />
                  </div>
                ) : (
                  <div className="bg-secondary/40 border border-theme rounded-2xl p-5 space-y-4">
                    <div>
                      <span className="text-[9px] font-black uppercase text-secondary">Notification Title</span>
                      <p className="text-sm font-bold text-primary mt-1">{selectedLog.title}</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-secondary">In-App Body Message</span>
                      <p className="text-xs text-primary leading-relaxed mt-1 font-semibold whitespace-pre-wrap">{selectedLog.message}</p>
                    </div>
                    {selectedLog.link && (
                      <div className="border-t border-theme/40 pt-4">
                        <span className="text-[9px] font-black uppercase text-secondary">Redirect Target Link</span>
                        <a 
                          href={selectedLog.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-purple-400 hover:underline block mt-1 font-mono truncate"
                        >
                          {selectedLog.link}
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <footer className="p-6 border-t border-theme bg-secondary/10 shrink-0 flex justify-end">
              <button 
                onClick={() => { setSelectedLog(null); setSelectedType(null); }}
                className="px-5 py-2.5 bg-secondary hover:bg-white/5 border border-theme text-primary font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Close Audit details
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
