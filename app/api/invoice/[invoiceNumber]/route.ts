import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Public, no-login invoice lookup by invoice_number — the intended use case
 * for custom_invoices' "view via emailed link" flow. Fetches a single row
 * server-side with the service-role client instead of exposing the whole
 * table to a public SELECT policy (which let anyone list every invoice
 * ever created, including client PII and payment/bank details).
 */
export async function GET(request: Request, { params }: { params: Promise<{ invoiceNumber: string }> }) {
  const { invoiceNumber } = await params;
  if (!invoiceNumber) {
    return NextResponse.json({ error: 'Missing invoice number' }, { status: 400 });
  }

  const { data, error } = await admin
    .from('custom_invoices')
    .select('*')
    .eq('invoice_number', invoiceNumber)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  return NextResponse.json({ invoice: data });
}
