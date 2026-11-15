import { NextResponse } from 'next/server';
import { settleDevelopaPayment } from '@/lib/developaPay';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get('reference') || url.searchParams.get('trxref') || '';
  const result = await settleDevelopaPayment(reference);

  if (!result.ok) {
    return NextResponse.redirect(
      `${url.origin}/create?pay_error=${encodeURIComponent(result.error || 'Payment could not be verified.')}`
    );
  }

  return NextResponse.redirect(`${url.origin}${result.redirectPath || '/create?paid=1'}`);
}
