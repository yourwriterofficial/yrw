import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { renderInvoicePng, renderInvoicePdf } from '@/lib/invoiceRender';

/**
 * Renders an invoice as a PNG or PDF for admin preview/download —
 * GET /api/admin/invoice-render?invoiceNumber=X&format=image|pdf
 */
export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const url = new URL(req.url);
  const invoiceNumber = url.searchParams.get('invoiceNumber');
  const format = url.searchParams.get('format') === 'pdf' ? 'pdf' : 'image';
  if (!invoiceNumber) return NextResponse.json({ error: 'invoiceNumber is required' }, { status: 400 });

  const { data: invoice, error } = await guard.admin
    .from('custom_invoices')
    .select('*')
    .eq('invoice_number', invoiceNumber)
    .single();
  if (error || !invoice) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });

  const buffer = format === 'pdf' ? await renderInvoicePdf(invoice) : await renderInvoicePng(invoice);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': format === 'pdf' ? 'application/pdf' : 'image/png',
      'Content-Disposition': `inline; filename="invoice-${invoiceNumber}.${format === 'pdf' ? 'pdf' : 'png'}"`,
    },
  });
}
