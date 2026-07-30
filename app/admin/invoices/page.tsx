'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import * as lucide from 'lucide-react';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { showToast } from '@/app/components/ui/Toast';
import PageHeader from '@/app/components/ui/PageHeader';
import Link from 'next/link';
import type { CustomInvoice, CustomInvoiceMilestone } from '@/lib/types';

const formatNaira = (amount: number, currency: string = '₦') => currency + amount.toLocaleString();

export default function InvoicesListPage() {
  const [invoices, setInvoices] = useState<CustomInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingInvoice, setEditingInvoice] = useState<CustomInvoice | null>(null);
  const [milestonesForm, setMilestonesForm] = useState<CustomInvoiceMilestone[]>([]);

  const fetchInvoices = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('custom_invoices')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      showToast(`Failed to load invoices: ${error.message}`, 'error');
    } else {
      setInvoices(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this invoice? This cannot be undone.')) return;
    const { error } = await supabase
      .from('custom_invoices')
      .delete()
      .eq('id', id);
    if (error) {
      showToast(`Failed to delete: ${error.message}`, 'error');
    } else {
      showToast('Invoice deleted', 'success');
      fetchInvoices();
    }
  };

  const handleCopyLink = (invoiceNumber: string) => {
    const link = `${window.location.origin}/invoice/${invoiceNumber}`;
    navigator.clipboard.writeText(link);
    showToast('Invoice link copied to clipboard!', 'success');
  };

  const [sendingId, setSendingId] = useState<number | null>(null);
  const [sendFormat, setSendFormat] = useState<Record<number, 'link' | 'image' | 'pdf'>>({});
  const sendInvoice = async (invoice: CustomInvoice, via: 'EMAIL' | 'WHATSAPP') => {
    setSendingId(invoice.id);
    const fmt = sendFormat[invoice.id] || 'link';
    try {
      const res = await fetch('/api/admin/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceNumber: invoice.invoice_number, via, format: fmt === 'link' ? undefined : fmt }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Failed to send invoice', 'error'); return; }
      if (via === 'WHATSAPP' && data.whatsappUrl) {
        window.open(data.whatsappUrl, '_blank');
        showToast('Opening WhatsApp — invoice marked as sent', 'success');
      } else {
        showToast(fmt === 'link' ? 'Invoice emailed to client' : `Invoice emailed with ${fmt.toUpperCase()} attached`, 'success');
      }
      fetchInvoices();
    } catch {
      showToast('Network error', 'error');
    } finally {
      setSendingId(null);
    }
  };

  const openMilestoneModal = (invoice: CustomInvoice) => {
    setEditingInvoice(invoice);
    setMilestonesForm(JSON.parse(JSON.stringify(invoice.milestones || [])));
  };

  const updateMilestoneField = (index: number, field: keyof CustomInvoiceMilestone, value: any) => {
    const updated = [...milestonesForm];
    updated[index] = {
      ...updated[index],
      [field]: value,
      paid_at: field === 'paid' && value ? new Date().toISOString() : (field === 'paid' && !value ? null : updated[index].paid_at),
    };
    setMilestonesForm(updated);
  };

  const saveMilestones = async () => {
    if (!editingInvoice) return;
    
    const allPaid = milestonesForm.every(m => m.paid);
    const anyPaid = milestonesForm.some(m => m.paid);
    const newStatus = allPaid ? 'PAID' : (anyPaid ? 'PARTIALLY_PAID' : 'PENDING');

    const { error } = await supabase
      .from('custom_invoices')
      .update({
        milestones: milestonesForm,
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', editingInvoice.id);

    if (error) {
      showToast(`Failed to save milestones: ${error.message}`, 'error');
    } else {
      showToast('Invoice milestones updated', 'success');
      setEditingInvoice(null);
      fetchInvoices();
    }
  };

  if (loading) return <LoadingScreen label="Loading invoices..." accent="purple" />;

  return (
    <div className="p-6 md:p-10 space-y-10">

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader
          title="Custom Invoices"
          description="Create, prefill, and manage custom milestone invoices for clients and third-party buyers."
          breadcrumb="Admin / Invoices"
          icon={<lucide.FileSpreadsheet className="w-8 h-8 text-purple-500" />}
        />
        <Link
          href="/admin/invoices/new"
          className="px-6 py-4 bg-purple-500 hover:bg-purple-600 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition flex items-center gap-2 shadow-xl shadow-purple-500/20"
        >
          <lucide.Plus className="w-4 h-4" /> Create Custom Invoice
        </Link>
      </div>

      {/* ========== MODAL: Manage Milestones ========== */}
      {editingInvoice && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-primary border border-purple-500/30 rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-black text-primary mb-2 flex items-center gap-2">
              <lucide.Milestone className="w-5 h-5 text-purple-500" /> Manage Milestones
            </h2>
            <p className="text-secondary text-sm mb-6">
              Invoice #{editingInvoice.invoice_number} — {editingInvoice.project_title}
            </p>

            <div className="space-y-4">
              <div className="bg-secondary/50 border border-theme rounded-2xl p-4 grid grid-cols-12 gap-3 text-[10px] uppercase font-black tracking-widest text-secondary">
                <div className="col-span-5">Milestone Description</div>
                <div className="col-span-3 text-right">Amount</div>
                <div className="col-span-2 text-center">Paid Status</div>
                <div className="col-span-2 text-center">Delivery</div>
              </div>

              {milestonesForm.map((m, idx) => (
                <div key={idx} className="bg-secondary border border-theme rounded-2xl p-4 grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-5 text-sm font-bold text-primary">
                    {m.name} <span className="text-[10px] text-secondary font-medium block">Trigger: {m.trigger || 'Manual'}</span>
                  </div>
                  <div className="col-span-3 text-right font-mono text-sm text-primary font-black">
                    {formatNaira(m.amount, editingInvoice.currency)}
                    <span className="text-[10px] text-secondary block font-normal">{m.percentage}%</span>
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <button
                      type="button"
                      onClick={() => updateMilestoneField(idx, 'paid', !m.paid)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition ${
                        m.paid
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}
                    >
                      {m.paid ? 'PAID ✓' : 'UNPAID ✗'}
                    </button>
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <button
                      type="button"
                      onClick={() => updateMilestoneField(idx, 'delivered', !m.delivered)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition ${
                        m.delivered
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-secondary text-secondary border border-theme'
                      }`}
                    >
                      {m.delivered ? 'DELIVERED' : 'PENDING'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-8">
              <button
                type="button"
                onClick={() => setEditingInvoice(null)}
                className="flex-1 py-4 bg-white/5 border border-theme text-primary rounded-xl font-bold transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveMilestones}
                className="flex-1 py-4 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-black transition"
              >
                Save Milestone Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== Invoices List Table ========== */}
      <div className="bg-secondary border border-theme rounded-2xl overflow-hidden table-row-hover">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-primary border-b border-theme text-[10px] uppercase text-secondary">
              <tr>
                <th className="px-6 py-4">Invoice #</th>
                <th className="px-6 py-4">Client / Company</th>
                <th className="px-6 py-4">Project Title</th>
                <th className="px-6 py-4">Total Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Created Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(invoice => (
                <tr key={invoice.id} className="border-b border-theme hover:bg-white/5">
                  <td className="px-6 py-4 font-black text-primary">#{invoice.invoice_number}</td>
                  <td className="px-6 py-4">
                    <div className="text-primary font-bold">{invoice.client_name}</div>
                    <div className="text-xs text-secondary">{invoice.company_name || 'Individual'}</div>
                  </td>
                  <td className="px-6 py-4 text-xs font-semibold text-primary max-w-xs truncate">{invoice.project_title}</td>
                  <td className="px-6 py-4 font-mono font-black text-primary">
                    {formatNaira(invoice.total_amount, invoice.currency)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                      invoice.status === 'PAID'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : invoice.status === 'PARTIALLY_PAID'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                      {invoice.status === 'PAID' ? 'FULLY PAID ✓' : invoice.status === 'PARTIALLY_PAID' ? 'PART PAID' : 'UNPAID'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-secondary">
                    {new Date(invoice.created_at).toLocaleDateString()}
                    {(invoice as any).sent_via && (
                      <span className="block text-[10px] text-emerald-400 font-bold mt-0.5">
                        Sent via {(invoice as any).sent_via === 'EMAIL' ? 'Email' : 'WhatsApp'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap space-x-2">
                    <select
                      value={sendFormat[invoice.id] || 'link'}
                      onChange={e => setSendFormat(prev => ({ ...prev, [invoice.id]: e.target.value as 'link' | 'image' | 'pdf' }))}
                      className="bg-white/5 border border-theme rounded-lg text-[10px] font-bold text-secondary px-2 py-2 outline-none align-middle"
                      title="What to send"
                    >
                      <option value="link">Link Only</option>
                      <option value="image">As Image</option>
                      <option value="pdf">As PDF</option>
                    </select>
                    <button
                      onClick={() => sendInvoice(invoice, 'EMAIL')}
                      disabled={sendingId === invoice.id}
                      className="p-2.5 bg-white/5 hover:bg-emerald-500/10 text-secondary hover:text-emerald-400 rounded-xl border border-theme transition disabled:opacity-50"
                      title="Send by Email"
                    >
                      <lucide.Mail className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => sendInvoice(invoice, 'WHATSAPP')}
                      disabled={sendingId === invoice.id}
                      className="p-2.5 bg-white/5 hover:bg-[#25D366]/10 text-secondary hover:text-[#25D366] rounded-xl border border-theme transition disabled:opacity-50"
                      title="Send by WhatsApp"
                    >
                      <lucide.MessageCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleCopyLink(invoice.invoice_number)}
                      className="p-2.5 bg-white/5 hover:bg-purple-500/10 text-secondary hover:text-purple-400 rounded-xl border border-theme transition"
                      title="Copy Public Link"
                    >
                      <lucide.Copy className="w-4 h-4" />
                    </button>
                    <Link
                      href={`/invoice/${invoice.invoice_number}`}
                      target="_blank"
                      className="inline-flex p-2.5 bg-white/5 hover:bg-blue-500/10 text-secondary hover:text-blue-400 rounded-xl border border-theme transition"
                      title="View Invoice"
                    >
                      <lucide.ExternalLink className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => openMilestoneModal(invoice)}
                      className="px-3.5 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 font-bold rounded-xl border border-purple-500/30 transition text-xs"
                      title="Manage Milestones"
                    >
                      Milestones
                    </button>
                    <button
                      onClick={() => handleDelete(invoice.id)}
                      className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl border border-red-500/20 transition"
                      title="Delete Invoice"
                    >
                      <lucide.Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-secondary">
                    No custom invoices generated yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
