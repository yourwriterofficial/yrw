/**
 * Developa checkout & Paystack subaccount helper (server side only).
 *
 * Uses the shared Paystack account (PAYSTACK_SECRET_KEY / PAYSTACK_TEST_SECRET_KEY)
 * with `metadata.app = 'developa'` and `dev_` reference prefixes so there is
 * zero collision with ProsePen's webhook or transactions.
 */

import { NextResponse } from 'next/server';

const LIVE_API = 'https://api.paystack.co';
/**
 * Development only: PAYSTACK_API_URL points the helper at a local stand-in (scripts/mock-paystack.mjs) so the
 * whole payment flow can be exercised without the hosted checkout page. Production always uses the real API.
 */
const API = process.env.NODE_ENV !== 'production' && process.env.PAYSTACK_API_URL ? process.env.PAYSTACK_API_URL.replace(/\/$/, '') : LIVE_API;
const TEST_MARK = '_t';

export const isTestReference = (reference: string) => reference.endsWith(TEST_MARK);

/** Local/dev switch: when PAYSTACK_FORCE_TEST=true every call uses the test key, so dev can never touch live money. */
const forceTest = () => process.env.PAYSTACK_FORCE_TEST === 'true' && !!process.env.PAYSTACK_TEST_SECRET_KEY;

export function referenceFor(base: string, isTestAccount = false): string {
  if ((isTestAccount || forceTest()) && process.env.PAYSTACK_TEST_SECRET_KEY) return `${base}${TEST_MARK}`;
  return base;
}

function getKey(reference = ''): string {
  if (isTestReference(reference) || forceTest()) {
    const t = process.env.PAYSTACK_TEST_SECRET_KEY;
    if (!t || !t.startsWith('sk_test_')) throw new PaystackError('Online payments are not set up yet. Please contact support.', 503, 'not_configured');
    return t;
  }
  const k = process.env.PAYSTACK_SECRET_KEY;
  if (!k) throw new PaystackError('Online payments are not set up yet. Please contact support.', 503, 'not_configured');
  return k;
}

/* ------------------------------------------------------------------ errors */

/** A failure from Paystack, already translated into a status code and a message a shop owner can act on. */
export class PaystackError extends Error {
  constructor(message: string, public status: number, public code: string) {
    super(message);
    this.name = 'PaystackError';
  }
}

interface PaystackBody { status?: boolean; message?: string; type?: string; code?: string; data?: unknown }

/** Maps what Paystack said to the right HTTP status: our caller's mistake (4xx), a rate limit (429), or their outage (503). */
function failure(status: number, body: PaystackBody, fallback: string): PaystackError {
  const raw = String(body?.message || '');
  if (status === 401 || status === 403) return new PaystackError('Online payments are not set up correctly on our side. Please contact support.', 502, 'provider_auth');
  if (status === 429 || /daily limit|rate limit|too many/i.test(raw)) return new PaystackError('Too many attempts right now. Please try again in a few minutes.', 429, 'rate_limited');
  if (/account details are invalid|could not resolve account|invalid account/i.test(raw)) {
    return new PaystackError('We could not verify that bank account. Check the account number and the bank, then try again.', 422, 'bank_invalid');
  }
  if (/email/i.test(raw) && /valid/i.test(raw)) return new PaystackError('Enter a valid email address.', 422, 'email_invalid');
  if (status >= 500 || body?.type === 'api_error' || /cannot add subaccount|try again later/i.test(raw)) {
    return new PaystackError('Our payment partner is unavailable right now. Please try again shortly.', 503, 'provider_unavailable');
  }
  if (status >= 400) return new PaystackError(raw || fallback, 422, 'provider_rejected');
  return new PaystackError(fallback, 502, 'provider_error');
}

/** The one place that talks to Paystack. Network problems and bad replies become PaystackErrors too. */
async function call<T>(path: string, key: string, fallback: string, init: { method?: 'GET' | 'POST'; body?: unknown; cache?: RequestCache } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: init.method || 'GET',
      headers: { Authorization: `Bearer ${key}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: init.cache || 'no-store',
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new PaystackError('We could not reach our payment partner. Please try again shortly.', 503, 'network');
  }
  const json = (await res.json().catch(() => ({}))) as PaystackBody;
  if (!res.ok || json?.status !== true || json?.data === undefined || json?.data === null) throw failure(res.status, json, fallback);
  return json.data as T;
}

/** For route handlers: a PaystackError keeps its own status and message; anything else is a plain 500 with a safe message. */
export function paystackErrorResponse(err: unknown, fallback: string) {
  if (err instanceof PaystackError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  console.error('Unexpected payment error:', err);
  return NextResponse.json({ error: fallback, code: 'internal' }, { status: 500 });
}

/* --------------------------------------------------------------- operations */

export interface DevelopaPayMeta {
  app: 'developa';
  kind: 'plan' | 'theme' | 'ad_booking' | 'store_order' | 'email_pack';
  siteId?: string;
  slug?: string;
  userId?: string;
  planTier?: string;
  months?: number;
  templateId?: string;
  bookingId?: string;
  orderId?: string;
  packId?: string;
}

export async function initializeCheckout(p: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  meta: DevelopaPayMeta;
  subaccount?: string | null;
  percentageCharge?: number;
}): Promise<{ authorization_url: string; access_code: string; reference: string }> {
  // Paystack rejects reserved domains such as .test. In test mode only, send a deliverable-looking address.
  const testMode = isTestReference(p.reference) || forceTest();
  const email = testMode && /@[^@]+\.(test|local|invalid|localhost)$/i.test(p.email) ? `${p.email.split('@')[0]}@example.com` : p.email;
  const payload: Record<string, unknown> = {
    email,
    amount: Math.round(p.amountKobo),
    currency: 'NGN',
    reference: p.reference,
    callback_url: p.callbackUrl,
    metadata: p.meta,
  };
  if (p.subaccount) {
    payload.subaccount = p.subaccount;
    if (typeof p.percentageCharge === 'number' && p.percentageCharge >= 0) {
      // The platform's cut, in kobo. Paystack sends the rest of the payment to the seller's subaccount.
      payload.transaction_charge = Math.round((p.amountKobo * p.percentageCharge) / 100);
    }
  }
  const data = await call<{ authorization_url: string; access_code: string; reference: string }>(
    '/transaction/initialize', getKey(p.reference), 'Could not start checkout.', { method: 'POST', body: payload }
  );
  if (!data.authorization_url) throw new PaystackError('Could not start checkout.', 502, 'provider_error');
  return data;
}

export interface PaystackVerifiedTx {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  metadata?: Partial<DevelopaPayMeta>;
}

export function verifyTransaction(reference: string): Promise<PaystackVerifiedTx> {
  return call<PaystackVerifiedTx>(`/transaction/verify/${encodeURIComponent(reference)}`, getKey(reference), 'Could not verify the payment.');
}

export async function listNigerianBanks(): Promise<{ name: string; code: string }[]> {
  const data = await call<{ name: string; code: string; active?: boolean }[]>(
    '/bank?country=nigeria&perPage=100', getKey(), 'Could not load banks.', { cache: 'force-cache' }
  );
  return (Array.isArray(data) ? data : []).filter((b) => b.active !== false).map((b) => ({ name: b.name, code: b.code }));
}

export function resolveBankAccount(accountNumber: string, bankCode: string): Promise<{ account_name: string; account_number: string }> {
  return call(
    `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
    getKey(), 'Could not verify the bank account.'
  );
}

export function createSubaccount(p: {
  businessName: string;
  settlementBank: string;
  accountNumber: string;
  percentageCharge: number;
  description?: string;
}): Promise<{ subaccount_code: string; business_name: string; account_number: string }> {
  return call('/subaccount', getKey(), 'Could not connect the bank account.', {
    method: 'POST',
    body: {
      business_name: p.businessName,
      settlement_bank: p.settlementBank,
      account_number: p.accountNumber,
      percentage_charge: p.percentageCharge,
      settlement_schedule: 'monthly',
      description: p.description || 'Developa seller split subaccount',
    },
  });
}
