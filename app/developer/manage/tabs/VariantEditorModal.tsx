'use client';

import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { SiteProduct } from '@/lib/forums';
import { planFor } from '@/lib/plans';
import { jsonFetch, type Site } from '../types';

interface DraftVariant {
  id?: string;
  label: string;
  price: string;
  stock_qty: string;
  sku: string;
  is_active: boolean;
}

export default function VariantEditorModal({
  site,
  product,
  onClose,
  onSaved,
}: {
  site: Site;
  product: SiteProduct;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const plan = planFor(site.plan_tier, site.plan_expires_at);
  const [optionsText, setOptionsText] = useState((product.variant_options || []).join(', '));
  const [rows, setRows] = useState<DraftVariant[]>(() =>
    (product.variants || []).map((v) => ({
      id: v.id,
      label: v.label,
      price: String(v.price),
      stock_qty: v.stock_qty == null ? '' : String(v.stock_qty),
      sku: v.sku || '',
      is_active: v.is_active,
    }))
  );
  const [comboA, setComboA] = useState('');
  const [comboB, setComboB] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const addBlank = () => {
    setRows((prev) => [
      ...prev,
      { label: '', price: String(product.price), stock_qty: '', sku: '', is_active: true },
    ]);
  };

  const generateCombinations = () => {
    const listA = comboA.split(',').map((s) => s.trim()).filter(Boolean);
    const listB = comboB.split(',').map((s) => s.trim()).filter(Boolean);
    if (listA.length === 0) return;
    const labels = listB.length > 0
      ? listA.flatMap((a) => listB.map((b) => `${a} / ${b}`))
      : listA;
    const existing = new Set(rows.map((r) => r.label.toLowerCase()));
    const added: DraftVariant[] = labels
      .filter((l) => !existing.has(l.toLowerCase()))
      .map((l) => ({ label: l, price: String(product.price), stock_qty: '', sku: '', is_active: true }));
    setRows((prev) => [...prev, ...added]);
  };

  const updateRow = (idx: number, patch: Partial<DraftVariant>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const variant_options = optionsText.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 5);
    const variants = rows
      .filter((r) => r.label.trim())
      .map((r, i) => ({
        ...(r.id ? { id: r.id } : {}),
        label: r.label.trim(),
        price: Number(r.price || product.price),
        stock_qty: r.stock_qty === '' ? null : Number(r.stock_qty),
        sku: r.sku.trim(),
        sort_order: i,
        is_active: r.is_active,
      }));
    const res = await jsonFetch(`/api/forums/${site.slug}/products/${product.id}/variants`, {
      method: 'PUT',
      body: { variant_options, variants },
    });
    if (res.ok) {
      await onSaved();
      onClose();
    } else {
      setError(res.data.error || 'Could not save variants.');
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-[250] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4" onClick={onClose}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-primary border border-theme rounded-3xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto space-y-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="g-h3">Variants for {product.title}</h3>
            <p className="text-sm text-secondary mt-0.5">Add sizes, colours or storage options, each with its own price and stock.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close variants" className="w-10 h-10 rounded-full hover:bg-hover flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!plan.variants && (
          <p className="text-sm text-warning border border-warning/30 rounded-2xl p-3.5">
            Product variants are included on the Pro plan. Upgrade on the Plan tab to save variants.
          </p>
        )}

        <div>
          <label htmlFor="v-opts" className="block text-sm font-medium mb-1.5">Option names (comma-separated)</label>
          <input
            id="v-opts"
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            placeholder="Size, Colour"
            className="input-box w-full"
          />
        </div>

        <div className="g-tonal p-4 space-y-3">
          <p className="text-sm font-medium">Quick combination builder</p>
          <div className="grid sm:grid-cols-2 gap-2.5">
            <input
              value={comboA}
              onChange={(e) => setComboA(e.target.value)}
              placeholder="First options (e.g. S, M, L)"
              aria-label="First option values"
              className="input-box !py-2.5 text-sm"
            />
            <input
              value={comboB}
              onChange={(e) => setComboB(e.target.value)}
              placeholder="Second options (e.g. Black, White)"
              aria-label="Second option values"
              className="input-box !py-2.5 text-sm"
            />
          </div>
          <button type="button" onClick={generateCombinations} className="px-4 h-9 rounded-full border border-theme hover:bg-hover text-sm font-medium">
            Generate combinations
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Options ({rows.length})</span>
            <button type="button" onClick={addBlank} className="px-3.5 h-9 rounded-full border border-theme hover:bg-hover text-sm inline-flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Add row
            </button>
          </div>

          {rows.length === 0 ? (
            <p className="text-sm text-secondary border border-dashed border-theme rounded-2xl p-6 text-center">
              No variants yet. Use the combination builder above or click “Add row”.
            </p>
          ) : (
            <div className="space-y-2.5">
              {rows.map((r, idx) => (
                <div key={idx} className="g-card p-3 grid grid-cols-2 sm:grid-cols-12 gap-2 items-center">
                  <input
                    value={r.label}
                    onChange={(e) => updateRow(idx, { label: e.target.value })}
                    placeholder="e.g. Black / L"
                    aria-label="Variant label"
                    className="input-box !py-2 text-sm col-span-2 sm:col-span-4"
                  />
                  <input
                    type="number"
                    min={0}
                    value={r.price}
                    onChange={(e) => updateRow(idx, { price: e.target.value })}
                    placeholder="Price"
                    aria-label="Variant price"
                    className="input-box !py-2 text-sm sm:col-span-3"
                  />
                  <input
                    type="number"
                    min={0}
                    value={r.stock_qty}
                    onChange={(e) => updateRow(idx, { stock_qty: e.target.value })}
                    placeholder="Stock"
                    aria-label="Variant stock"
                    className="input-box !py-2 text-sm sm:col-span-2"
                  />
                  <input
                    value={r.sku}
                    onChange={(e) => updateRow(idx, { sku: e.target.value })}
                    placeholder="SKU"
                    aria-label="Variant SKU"
                    className="input-box !py-2 text-sm sm:col-span-2"
                  />
                  <button
                    type="button"
                    onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                    aria-label="Remove variant"
                    className="p-2 text-danger hover:bg-hover rounded-full justify-self-end sm:col-span-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-danger" role="alert">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={busy || !plan.variants}
            className="bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] font-medium text-sm px-6 h-11 rounded-full disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save variants'}
          </button>
          <button type="button" onClick={onClose} className="px-5 h-11 rounded-full border border-theme text-sm">Cancel</button>
        </div>
      </form>
    </div>
  );
}
