'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { showToast } from '@/app/components/ui/Toast';
import PageHeader from '@/app/components/ui/PageHeader';

const formatDate = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export default function AdminVaultPage() {
  const router = useRouter();
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unseen' | 'seen'>('all');

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/vault-files');
      const data = await res.json();
      if (res.ok) {
        setFiles(data.files || []);
      } else {
        showToast(data.error || 'Failed to load vault files', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    }
    setLoading(false);
  };

  useEffect(() => {
    // Check admin status
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
      if (!profile?.is_admin) return router.push('/dashboard/client');
      fetchFiles();
    };
    checkAdmin();
  }, []);

  const handleDelete = async (fileId: number) => {
    if (!confirm('Delete this file permanently? This action cannot be undone.')) return;
    const res = await fetch('/api/admin/delete-vault-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId }),
    });
    if (res.ok) {
      showToast('File deleted', 'success');
      fetchFiles();
    } else {
      const data = await res.json();
      showToast(data.error || 'Delete failed', 'error');
    }
  };

  // Hooks stay above the loading return.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return files.filter((f) => {
      const seen = !!f.downloaded_at;
      if (filter === 'seen' && !seen) return false;
      if (filter === 'unseen' && seen) return false;
      if (!q) return true;
      return [f.file_name, f.order_id, f.orders?.legal_name, f.orders?.email].some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [files, query, filter]);

  if (loading) return <LoadingScreen label="Loading vault..." accent="brand" />;

  const seenCount = files.filter((f) => f.downloaded_at).length;

  return (
    <div className="p-6 md:p-10 max-w-6xl space-y-6">
      <PageHeader
        title="Vault files"
        description="Deliverables uploaded to client vaults, and whether each client has opened them."
        icon={<lucide.FolderArchive className="w-7 h-7 text-accent" />}
        actions={
          <button onClick={fetchFiles} className="h-10 px-4 rounded-xl border border-theme hover:bg-hover text-sm font-medium inline-flex items-center gap-2">
            <lucide.RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Files', value: files.length },
          { label: 'Opened by client', value: seenCount },
          { label: 'Not opened yet', value: files.length - seenCount },
        ].map((x) => (
          <div key={x.label} className="bg-card border border-theme rounded-2xl p-4 min-w-0">
            <p className="text-xs font-semibold text-secondary truncate">{x.label}</p>
            <p className="text-xl font-black mt-1 tabular-nums">{x.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <lucide.Search className="w-4 h-4 text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search file, order or client" aria-label="Search the vault" className="w-full h-10 rounded-xl border border-theme bg-card pl-9 pr-3 text-sm" />
        </div>
        {([['all', 'All'], ['unseen', 'Not opened'], ['seen', 'Opened']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k} className={`h-10 px-4 rounded-xl text-sm font-medium border ${filter === k ? 'border-accent bg-accent/10 text-accent' : 'border-theme text-secondary hover:bg-hover'}`}>{label}</button>
        ))}
      </div>

      <div className="bg-card border border-theme rounded-2xl">
        {shown.length === 0 ? (
          <div className="py-16 text-center text-secondary">
            <lucide.FolderOpen className="w-9 h-9 mx-auto opacity-40 mb-2" />
            <p className="text-sm font-medium">{files.length === 0 ? 'No files in the vault yet' : 'Nothing matches'}</p>
          </div>
        ) : (
          <ul className="divide-y divide-theme">
            {shown.map((file) => {
              const seen = !!file.downloaded_at;
              return (
                <li key={file.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0"><lucide.FileText className="w-5 h-5" /></div>
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="text-sm font-semibold truncate" title={file.file_name}>{file.file_name}</p>
                    <p className="text-xs text-secondary truncate">
                      <span className="font-mono">{file.order_id}</span> · {file.orders?.legal_name || '—'}{file.orders?.email ? ` · ${file.orders.email}` : ''}
                    </p>
                  </div>
                  <div className="text-xs text-secondary shrink-0 sm:text-right">
                    <p>Uploaded {formatDate(file.uploaded_at)}</p>
                    {seen && <p>Last opened {formatDate(file.downloaded_at)}</p>}
                  </div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold ${seen ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                    {seen ? `Opened · ${file.download_count || 1}×` : 'Not opened'}
                  </span>
                  <button onClick={() => handleDelete(file.id)} aria-label={`Delete ${file.file_name}`} className="h-9 w-9 rounded-lg border border-danger/30 text-danger hover:bg-danger/10 inline-flex items-center justify-center shrink-0"><lucide.Trash2 className="w-4 h-4" /></button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
