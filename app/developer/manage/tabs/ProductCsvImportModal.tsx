'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { jsonFetch, type Site } from '../types';

const SAMPLE_CSV = [
  'title,price,compare_at_price,category,type,stock,description,image_url',
  '"Cotton Tote Bag",4500,5500,Bags,physical,20,"Durable heavyweight canvas tote",',
  '"Minimalist Logo Kit",15000,,Templates,digital,,"Editable brand starter files",',
].join('\n');

interface ImportPreview {
  validCount: number;
  errors: { row: number; reason: string }[];
  sample: { title: string; price: number; category: string; product_type: string }[];
}

export default function ProductCsvImportModal({
  site,
  onClose,
  onImported,
}: {
  site: Site;
  onClose: () => void;
  onImported: () => Promise<void>;
}) {
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${site.slug}-products-template.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsv(text);
    setPreview(null);
    setError('');
  };

  const runPreview = async () => {
    setBusy(true);
    setError('');
    setPreview(null);
    const r = await jsonFetch<ImportPreview>(`/api/forums/${site.slug}/products/import`, {
      method: 'POST',
      body: { csv, preview: true },
    });
    if (!r.ok && r.status !== 200) {
      setError(r.data.error || 'Could not check this CSV file.');
      if (typeof r.data.validCount === 'number') {
        setPreview({
          validCount: r.data.validCount,
          errors: r.data.errors || [],
          sample: r.data.sample || [],
        });
      }
    } else {
      setPreview({
        validCount: r.data.validCount || 0,
        errors: r.data.errors || [],
        sample: r.data.sample || [],
      });
    }
    setBusy(false);
  };

  const confirmImport = async () => {
    setBusy(true);
    setError('');
    const r = await jsonFetch<{ imported?: number }>(`/api/forums/${site.slug}/products/import`, {
      method: 'POST',
      body: { csv, preview: false },
    });
    if (!r.ok) {
      setError(r.data.error || 'Import failed.');
      setBusy(false);
      return;
    }
    await onImported();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="g-card p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-theme pb-3">
          <div>
            <h3 className="font-medium">Import products from CSV</h3>
            <p className="text-xs text-secondary mt-0.5">Columns: title, price, compare_at_price, category, type, stock, description, image_url</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full hover:bg-hover flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <input type="file" accept=".csv,text/csv" onChange={(e) => handleFile(e.target.files)} className="text-xs" aria-label="Upload CSV file" />
          <button type="button" onClick={downloadSample} className="text-xs font-medium text-accent hover:underline h-9 px-3 rounded-full border border-theme">
            Download sample CSV
          </button>
        </div>

        <div>
          <label htmlFor="csv-paste" className="block text-xs font-medium mb-1">Or paste CSV rows</label>
          <textarea
            id="csv-paste"
            rows={6}
            value={csv}
            onChange={(e) => { setCsv(e.target.value); setPreview(null); }}
            placeholder={SAMPLE_CSV}
            className="input-box w-full font-mono text-xs"
          />
        </div>

        {error && <p className="text-xs text-danger" role="alert">{error}</p>}

        {preview && (
          <div className="p-3.5 rounded-xl bg-secondary/30 border border-theme space-y-2 text-xs">
            <p className="font-medium">
              {preview.validCount} valid {preview.validCount === 1 ? 'row' : 'rows'}
              {preview.errors.length > 0 && <span className="text-danger"> · {preview.errors.length} {preview.errors.length === 1 ? 'error' : 'errors'}</span>}
            </p>
            {preview.errors.length > 0 && (
              <ul className="space-y-1 text-danger max-h-28 overflow-y-auto">
                {preview.errors.slice(0, 10).map((e) => (
                  <li key={`${e.row}-${e.reason}`}>Row {e.row}: {e.reason}</li>
                ))}
              </ul>
            )}
            {preview.sample.length > 0 && (
              <ul className="space-y-1 text-secondary">
                {preview.sample.map((s, idx) => (
                  <li key={idx}>· {s.title} ({s.category}, {s.product_type}) — {s.price}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={runPreview}
            disabled={busy || !csv.trim()}
            className="px-5 h-10 rounded-full border border-theme hover:bg-hover text-sm font-medium disabled:opacity-50"
          >
            {busy ? 'Checking…' : 'Preview import'}
          </button>
          {preview && preview.validCount > 0 && preview.errors.length === 0 && !error && (
            <button
              type="button"
              onClick={confirmImport}
              disabled={busy}
              className="px-5 h-10 rounded-full bg-accent hover:bg-accent-hover text-[var(--accent-foreground)] text-sm font-medium disabled:opacity-50"
            >
              {busy ? 'Importing…' : `Import ${preview.validCount} products`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
