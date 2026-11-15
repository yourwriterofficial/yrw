/**
 * Developa checkout & Paystack subaccount helper (server side only).
 *
 * Uses the shared Paystack account (PAYSTACK_SECRET_KEY / PAYSTACK_TEST_SECRET_KEY)
 * with `metadata.app = 'developa'` and `dev_` reference prefixes so there is
 * zero collision with ProsePen's webhook or transactions.
 */

const API = 'https://api.paystack.co';
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
    if (!t || !t.startsWith('sk_test_')) throw new Error('PAYSTACK_TEST_SECRET_KEY is not set');
    return t;
  }
  const k = process.env.PAYSTACK_SECRET_KEY;
  if (!k) throw new Error('PAYSTACK_SECRET_KEY is not set');
  return k;
}

export interface DevelopaPayMeta {
  app: 'developa';
  kind: 'plan' | 'theme' | 'ad_booking' | 'store_order';
  siteId?: string;
  slug?: string;
  userId?: string;
  planTier?: string;
  months?: number;
  templateId?: string;
  bookingId?: string;
  orderId?: string;
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
      // Paystack subaccount split: `bearer: 'account'` means main account bears Paystack fee or default;
      // `transaction_charge` is flat kobo fee. Using subaccount's configured percentage_charge or flat override:
      payload.transaction_charge = Math.round((p.amountKobo * p.percentageCharge) / 100);
    }
  }

  const res = await fetch(`${API}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getKey(p.reference)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.status || !json?.data?.authorization_url) {
    throw new Error(json?.message || 'Could not start Paystack checkout.');
  }
  return json.data;
}

export interface PaystackVerifiedTx {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  metadata?: Partial<DevelopaPayMeta>;
}

export async function verifyTransaction(reference: string): Promise<PaystackVerifiedTx> {
  const res = await fetch(`${API}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${getKey(reference)}` },
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.status || !json?.data) {
    throw new Error(json?.message || 'Could not verify Paystack payment.');
  }
  return json.data as PaystackVerifiedTx;
}

export async function listNigerianBanks(): Promise<{ name: string; code: string }[]> {
  const res = await fetch(`${API}/bank?country=nigeria&perPage=100`, {
    headers: { Authorization: `Bearer ${getKey()}` },
    next: { revalidate: 86400 },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.status || !Array.isArray(json?.data)) return [];
  return (json.data as { name: string; code: string; active?: boolean }[])
    .filter((b) => b.active !== false)
    .map((b) => ({ name: b.name, code: b.code }));
}

export async function resolveBankAccount(accountNumber: string, bankCode: string): Promise<{ account_name: string; account_number: string }> {
  const res = await fetch(
    `${API}/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
    { headers: { Authorization: `Bearer ${getKey()}` }, cache: 'no-store' }
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.status || !json?.data?.account_name) {
    throw new Error(json?.message || 'Could not verify bank account details.');
  }
  return json.data;
}

export async function createSubaccount(p: {
  businessName: string;
  settlementBank: string;
  accountNumber: string;
  percentageCharge: number;
  description?: string;
}): Promise<{ subaccount_code: string; business_name: string; account_number: string }> {
  const res = await fetch(`${API}/subaccount`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      business_name: p.businessName,
      settlement_bank: p.settlementBank,
      account_number: p.accountNumber,
      percentage_charge: p.percentageCharge,
      settlement_schedule: 'monthly',
      description: p.description || 'Developa seller split subaccount',
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.status || !json?.data?.subaccount_code) {
    throw new Error(json?.message || 'Could not create Paystack subaccount.');
  }
  return json.data;
}
