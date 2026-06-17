'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';

const formatDate = (iso: string) => new Date(iso).toLocaleString();
let toastId = 0;
const showToast = (message: string, type: 'success' | 'error' = 'success') => {
  const event = new CustomEvent('app:toast', { detail: { id: toastId++, message, type } });
  window.dispatchEvent(event);
};

export default function AdminVaultPage() {
  const router = useRouter();
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<{ id: number; message: string; type: string }[]>([]);

  useEffect(() => {
    const handler = (e: any) => {
      setToasts(prev => [...prev, e.detail]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== e.detail.id)), 4000);
    };
    window.addEventListener('app:toast', handler);
    return () => window.removeEventListener('app:toast', handler);
  }, []);

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

  if (loading) return <div className="p-10 text-center text-primary">Loading...</div>;

  return (
    <div className="p-6 md:p-10">
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-2 rounded-lg shadow-lg text-sm font-bold ${t.type === 'success' ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'}`}>
            {t.message}
          </div>
        ))}
      </div>

      <h1 className="text-3xl font-black text-primary mb-6">Vault Management</h1>
      <div className="bg-secondary border border-theme rounded-2xl overflow-x-auto">
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