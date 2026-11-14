import { NextResponse } from 'next/server';
import xss from 'xss';
import { requireSiteAccess, supabaseAdmin } from '@/lib/forumServer';
import { planFor } from '@/lib/plans';

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && next === '\n') i++;
      row.push(cell.trim());
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  row.push(cell.trim());
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const access = await requireSiteAccess(slug, ['owner', 'manager']);
    if ('error' in access) return access.error;

    const plan = planFor(access.site.plan_tier, access.site.plan_expires_at);
    if (!plan.bulkImport) {
      return NextResponse.json({ error: 'CSV bulk product import is available on Pro and Business plans.' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const csvText = typeof body?.csv === 'string' ? body.csv : '';
    const previewOnly = body?.preview === true;

    if (!csvText.trim()) {
      return NextResponse.json({ error: 'Paste or upload a CSV file first.' }, { status: 400 });
    }
    if (csvText.length > 512_000) {
      return NextResponse.json({ error: 'CSV file is too large (max 500 KB).' }, { status: 400 });
    }

    const rows = parseCsvRows(csvText);
    if (rows.length < 2) {
      return NextResponse.json({ error: 'Include a header row and at least one product row.' }, { status: 400 });
    }
    if (rows.length > 201) {
      return NextResponse.json({ error: 'Import up to 200 products at a time.' }, { status: 400 });
    }

    const headers = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, '_'));
    const idx = (names: string[]) => names.map((n) => headers.indexOf(n)).find((i) => i >= 0) ?? -1;

    const iTitle = idx(['title', 'name', 'product']);
    const iPrice = idx(['price', 'amount']);
    const iDesc = idx(['description', 'details']);
    const iCat = idx(['category']);
    const iType = idx(['type', 'product_type']);
    const iStock = idx(['stock', 'stock_qty', 'qty']);
    const iImg = idx(['image_url', 'image', 'photo']);
    const iCompare = idx(['compare_at_price', 'old_price']);

    if (iTitle < 0 || iPrice < 0) {
      return NextResponse.json({ error: 'Header must include at least "title" and "price" columns.' }, { status: 400 });
    }

    const errors: { row: number; reason: string }[] = [];
    const validRows: {
      site_id: string;
      title: string;
      description: string;
      category: string;
      product_type: 'physical' | 'digital' | 'service';
      price: number;
      compare_at_price: number | null;
      stock_qty: number | null;
      image_url: string;
      is_active: boolean;
    }[] = [];

    for (let r = 1; r < rows.length; r++) {
      const cols = rows[r];
      const title = (cols[iTitle] || '').trim();
      const rawPrice = Number(String(cols[iPrice] || '').replace(/[^0-9.]/g, ''));
      if (title.length < 2) {
        errors.push({ row: r + 1, reason: 'Title must be at least 2 characters.' });
        continue;
      }
      if (!Number.isFinite(rawPrice) || rawPrice < 0) {
        errors.push({ row: r + 1, reason: 'Invalid price.' });
        continue;
      }
      const rawType = (iType >= 0 ? cols[iType] : '').toLowerCase();
      const product_type = rawType === 'digital' || rawType === 'service' ? rawType : 'physical';
      const stockRaw = iStock >= 0 ? (cols[iStock] || '').trim() : '';
      const stock_qty = stockRaw === '' ? null : Math.max(0, Math.floor(Number(stockRaw)));
      if (stock_qty !== null && !Number.isFinite(stock_qty)) {
        errors.push({ row: r + 1, reason: 'Invalid stock number.' });
        continue;
      }
      const imgUrl = iImg >= 0 ? (cols[iImg] || '').trim() : '';
      if (imgUrl && !/^https:\/\//i.test(imgUrl)) {
        errors.push({ row: r + 1, reason: 'Image link must start with https://.' });
        continue;
      }
      const cmpRaw = iCompare >= 0 ? (cols[iCompare] || '').trim() : '';
      const compare_at_price = cmpRaw ? Number(cmpRaw.replace(/[^0-9.]/g, '')) : null;

      validRows.push({
        site_id: access.site.id,
        title: xss(title.slice(0, 140)),
        description: xss((iDesc >= 0 ? cols[iDesc] || '' : '').slice(0, 2000)),
        category: xss(((iCat >= 0 ? cols[iCat] : '') || 'General').slice(0, 60)),
        product_type,
        price: rawPrice,
        compare_at_price: compare_at_price && Number.isFinite(compare_at_price) && compare_at_price > rawPrice ? compare_at_price : null,
        stock_qty,
        image_url: imgUrl,
        is_active: true,
      });
    }

    const { count: existingCount } = await supabaseAdmin
      .from('site_products')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', access.site.id);

    if (plan.maxProducts !== null && (existingCount || 0) + validRows.length > plan.maxProducts) {
      return NextResponse.json(
        {
          error: `Importing ${validRows.length} items exceeds your ${plan.name} limit of ${plan.maxProducts} products (you have ${existingCount || 0}).`,
          validCount: validRows.length,
          errors,
        },
        { status: 403 }
      );
    }

    if (previewOnly) {
      return NextResponse.json({
        preview: true,
        validCount: validRows.length,
        errors,
        sample: validRows.slice(0, 5).map((v) => ({ title: v.title, price: v.price, category: v.category, product_type: v.product_type })),
      });
    }

    if (errors.length > 0 || validRows.length === 0) {
      return NextResponse.json({ error: 'Fix row errors before importing.', validCount: validRows.length, errors }, { status: 400 });
    }

    const { error: insErr } = await supabaseAdmin.from('site_products').insert(validRows);
    if (insErr) throw insErr;

    return NextResponse.json({ imported: validRows.length }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to import products' }, { status: 500 });
  }
}
