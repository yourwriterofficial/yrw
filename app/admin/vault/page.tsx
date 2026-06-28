'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { ToastContainer, showToast } from '@/app/components/ui/Toast';
import PageHeader from '@/app/components/ui/PageHeader';

const formatDate = (iso: string) => new Date(iso).toLocaleString();

export default function AdminVaultPage() {
  const router = useRouter();
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <LoadingScreen label="Loading vault..." accent="purple" />;

  return (
    <div className="p-6 md:p-10">
      <ToastContainer />

      <PageHeader
        title="Vault Management"
        description="View and manage encrypted deliverables uploaded to client vaults."
        breadcrumb="Admin / Vault"
        icon={<lucide.FolderArchive className="w-8 h-8 text-purple-500" />}
        actions={
          <button type="button" onClick={fetchFiles} className="btn-secondary flex items-center gap-2">
            <lucide.RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />
      <div className="bg-secondary border border-theme rounded-2xl overflow-x-auto table-row-hover">
        <table className="w-full text-left text-sm">
          <thead className="bg-primary border-b border-theme text-[10px] uppercase text-secondary">
            <tr>
              <th className="px-4 py-4">Order ID</th>
              <th className="px-4 py-4">Client</th>
              <th className="px-4 py-4">File Name</th>
              <th className="px-4 py-4">Uploaded</th>
              <th className="px-4 py-4">Downloaded</th>
              <th className="px-4 py-4 text-center">Downloads</th>
              <th className="px-4 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {files.map(file => (
              <tr key={file.id} className="border-b border-theme">
                <td className="px-4 py-4 font-mono text-xs text-primary">{file.order_id}</td>
                <td className="px-4 py-4 text-primary">
                  <div>{file.orders?.legal_name || '—'}</div>
                  <div className="text-xs text-secondary">{file.orders?.email}</div>
                </td>
                <td className="px-4 py-4 text-primary">{file.file_name}</td>
                <td className="px-4 py-4 text-xs text-primary">{formatDate(file.uploaded_at)}</td>
                <td className="px-4 py-4 text-xs text-primary">
                  {file.downloaded_at ? formatDate(file.downloaded_at) : 'Not viewed'}
                </td>
                <td className="px-4 py-4 text-center text-primary">{file.download_count || 0}</td>
                <td className="px-4 py-4 text-right">
                  <button
                    onClick={() => handleDelete(file.id)}
                    className="px-3 py-1 bg-red-500/20 text-red-400 rounded-lg text-xs hover:bg-red-500/30 transition"
                  >
                    <lucide.Trash2 className="w-4 h-4 inline" />
                  </button>
                </td>
              </tr>
            ))}
            {files.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-secondary">No files in vault.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}