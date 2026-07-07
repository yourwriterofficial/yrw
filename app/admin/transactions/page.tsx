'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';
import { showToast, ToastContainer } from '@/app/components/ui/Toast';

const naira = (amount: number) => '₦' + Math.round(amount || 0).toLocaleString('en-NG');

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 25;

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('transactions')
        .select('*, profiles(email, full_name)', { count: 'exact' });

      // Apply filters
      if (statusFilter !== 'all') {
        q = q.eq('status', statusFilter);
      }
      if (typeFilter !== 'all') {
        q = q.eq('type', typeFilter);
      }

      // Pagination
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      q = q.order('created_at', { ascending: false }).range(from, to);

      const { data, count, error } = await q;
      if (error) throw error;

      let filtered = data || [];
      if (search.trim()) {
        const s = search.toLowerCase().trim();
        filtered = filtered.filter(tx => 
          tx.reference?.toLowerCase().includes(s) ||
          tx.profiles?.email?.toLowerCase().includes(s) ||
          tx.profiles?.full_name?.toLowerCase().includes(s)
        );
      }

      setTransactions(filtered);
      setTotalCount(count || 0);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to load transactions', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [page, statusFilter, typeFilter]);

  // Handle Search Trigger
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTransactions();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'failed':
        return 'bg-red-500/10 text-red-400 border border-red-500/20';
      default:
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    }
  };

  const getTypeBadge = (type: string) => {
    return type === 'deposit'
      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
      : 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
  };

  return (
    <div className="p-6 md:p-10 space-y-6">
      <ToastContainer />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-primary flex items-center gap-2">
            <lucide.History className="w-6 h-6 text-purple-500" /> Transactions List
          </h1>
          <p className="text-xs text-secondary mt-1">Review, monitor, and query all financial movements inside the system.</p>
        </div>
        <button 
          onClick={() => { setPage(1); fetchTransactions(); }}
          className="px-4 py-2 bg-secondary border border-theme hover:bg-white/5 text-primary text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
        >
          <lucide.RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="bg-card border border-theme rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <form onSubmit={handleSearch} className="relative flex-1 w-full">
          <lucide.Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-secondary" />
          <input 
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by reference, email, or client name..." 
            className="w-full bg-secondary border border-theme rounded-xl pl-11 pr-24 py-3 text-sm text-primary outline-none focus:border-purple-500 transition"
          />
          <button 
            type="submit"
            className="absolute right-2 top-1.2 bg-purple-500 hover:bg-purple-400 text-white text-xs font-bold px-4 py-2 rounded-lg transition"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <select 
            value={statusFilter} 
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-secondary border border-theme rounded-xl px-4 py-3 text-sm text-primary outline-none focus:border-purple-500 flex-1 md:flex-none"
          >
            <option value="all">🟢 All Statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>

          <select 
            value={typeFilter} 
            onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
            className="bg-secondary border border-theme rounded-xl px-4 py-3 text-sm text-primary outline-none focus:border-purple-500 flex-1 md:flex-none"
          >
            <option value="all">📂 All Types</option>
            <option value="deposit">Deposit</option>
            <option value="payment">Payment</option>
          </select>
        </div>
      </div>

      {/* TRANSACTION TABLE */}
      <div className="bg-card border border-theme rounded-3xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 text-center text-sm text-secondary flex items-center justify-center gap-2">
            <lucide.Loader2 className="w-5 h-5 animate-spin text-purple-500" /> Loading transactions...
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-20 text-center text-secondary">
            <div className="text-4xl mb-3">💸</div>
            <h3 className="text-base font-bold text-primary">No transactions found</h3>
            <p className="text-xs">Adjust filters or search parameters and try again.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-theme bg-secondary/30 text-secondary text-[11px] font-black uppercase tracking-wider">
                  <th className="p-4">Reference</th>
                  <th className="p-4">Client</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme/45">
                {transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-white/5 transition">
                    <td className="p-4 font-mono text-xs font-bold text-primary select-all">{tx.reference}</td>
                    <td className="p-4">
                      <div className="font-bold text-primary">{tx.profiles?.full_name || 'Guest Client'}</div>
                      <div className="text-xs text-secondary">{tx.profiles?.email || 'N/A'}</div>
                    </td>
                    <td className="p-4">
                      <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${getTypeBadge(tx.type)}`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="p-4 font-mono font-bold text-primary">
                      {naira(tx.amount)}
                    </td>
                    <td className="p-4">
                      <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${getStatusBadge(tx.status)}`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-secondary font-semibold">
                      {new Date(tx.created_at).toLocaleString('en-NG')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PAGINATION BAR */}
      {!loading && Math.ceil(totalCount / PAGE_SIZE) > 1 && (
        <div className="flex justify-between items-center bg-card border border-theme px-6 py-4 rounded-2xl">
          <span className="text-xs text-secondary font-bold">
            Showing Page {page} of {Math.ceil(totalCount / PAGE_SIZE)} ({totalCount} total transactions)
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
