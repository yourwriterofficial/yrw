#!/usr/bin/env node
/**
 * Local stand-in for the parts of the Paystack API that Developa uses, for development and tests only.
 * It mimics Paystack's response shapes and error cases, and serves a tiny "checkout page" so a payment can
 * be completed without the real hosted page (which sits behind a bot check).
 *
 *   node scripts/mock-paystack.mjs            (listens on http://localhost:4010)
 *
 * Point the app at it with PAYSTACK_API_URL=http://localhost:4010 (ignored in production builds).
 *
 * Behaviours worth knowing:
 *   - Only keys starting sk_test_ are accepted (401 otherwise), like test mode.
 *   - A .test / .local email is rejected on initialize, as the real API does.
 *   - Subaccounts: bank 001 -> "Account details are invalid" (422); account 1111111111 -> api_error (503);
 *     account 2222222222 -> daily limit message (429); anything else succeeds.
 */
import http from 'node:http';
import { randomBytes } from 'node:crypto';

const PORT = Number(process.env.MOCK_PAYSTACK_PORT || 4010);
const BANKS = [
  { name: 'Access Bank', code: '044' }, { name: 'Guaranty Trust Bank', code: '058' },
  { name: 'Zenith Bank', code: '057' }, { name: 'First Bank of Nigeria', code: '011' }, { name: 'Test Bank', code: '001' },
];
const txs = new Map();
const subs = new Map();

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'Content-Type': typeof body === 'string' ? 'text/html; charset=utf-8' : 'application/json', ...headers });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};
const ok = (res, message, data) => send(res, 200, { status: true, message, data });
const fail = (res, status, message, type = 'validation_error', code = 'invalid_params') => send(res, status, { status: false, message, type, code });
const readJson = (req) => new Promise((resolve) => {
  let d = '';
  req.on('data', (c) => (d += c));
  req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); } });
});
const naira = (kobo) => `₦${(kobo / 100).toLocaleString('en-NG')}`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // ---- the stand-in hosted checkout page (no auth, like the real one)
  const pay = path.match(/^\/pay\/([^/]+)$/);
  if (req.method === 'GET' && pay) {
    const tx = txs.get(decodeURIComponent(pay[1]));
    if (!tx) return send(res, 404, '<h1>Unknown payment</h1>');
    const split = tx.subaccount ? `<p>Split: platform keeps ${naira(tx.transaction_charge || 0)}, seller (${esc(tx.subaccount)}) receives ${naira(tx.amount - (tx.transaction_charge || 0))}.</p>` : '';
    return send(res, 200, `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Mock Paystack checkout</title>
<body style="font-family:system-ui;max-width:420px;margin:48px auto;padding:0 16px">
<h2>Mock Paystack checkout <small style="color:#888">(test)</small></h2>
<p>Pay <strong>${naira(tx.amount)}</strong> to Developa</p><p>${esc(tx.email)} &middot; ref <code>${esc(tx.reference)}</code></p>${split}
<form method=post action="/pay/${encodeURIComponent(tx.reference)}/complete"><button id=pay style="padding:12px 20px;font-size:16px;border-radius:10px;border:0;background:#0ba4db;color:#fff;cursor:pointer">Pay ${naira(tx.amount)} (test card)</button></form>
<form method=post action="/pay/${encodeURIComponent(tx.reference)}/cancel" style="margin-top:12px"><button id=cancel style="background:none;border:0;color:#666;cursor:pointer;text-decoration:underline">Cancel</button></form></body>`);
  }
  const act = path.match(/^\/pay\/([^/]+)\/(complete|cancel)$/);
  if (req.method === 'POST' && act) {
    const tx = txs.get(decodeURIComponent(act[1]));
    if (!tx) return send(res, 404, '<h1>Unknown payment</h1>');
    tx.status = act[2] === 'complete' ? 'success' : 'abandoned';
    const back = new URL(tx.callback_url || 'http://localhost:3000/');
    back.searchParams.set('reference', tx.reference);
    back.searchParams.set('trxref', tx.reference);
    res.writeHead(303, { Location: back.toString() });
    return res.end();
  }

  // ---- API (needs a test secret key)
  const auth = req.headers.authorization || '';
  if (!/^Bearer sk_test_/.test(auth)) return fail(res, 401, 'Invalid key', 'validation_error', 'invalid_Key');

  if (req.method === 'POST' && path === '/transaction/initialize') {
    const b = await readJson(req);
    if (!b.email || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(b.email) || /\.(test|local|invalid|localhost)$/i.test(b.email)) return fail(res, 400, 'Invalid Email Address Passed');
    if (!Number.isInteger(b.amount) || b.amount < 100) return fail(res, 400, 'Invalid Amount Passed');
    if (!b.reference) return fail(res, 400, 'Reference is required');
    if (txs.has(b.reference)) return fail(res, 400, 'Duplicate Transaction Reference');
    if (b.subaccount && !subs.has(b.subaccount)) return fail(res, 400, 'Subaccount specified is invalid');
    txs.set(b.reference, { ...b, status: 'pending' });
    const code = randomBytes(6).toString('hex');
    return ok(res, 'Authorization URL created', { authorization_url: `http://localhost:${PORT}/pay/${encodeURIComponent(b.reference)}`, access_code: code, reference: b.reference });
  }
  const ver = path.match(/^\/transaction\/verify\/(.+)$/);
  if (req.method === 'GET' && ver) {
    const tx = txs.get(decodeURIComponent(ver[1]));
    if (!tx) return fail(res, 404, 'Transaction reference not found', 'validation_error', 'transaction_not_found');
    return ok(res, 'Verification successful', { status: tx.status, reference: tx.reference, amount: tx.amount, currency: tx.currency || 'NGN', metadata: tx.metadata, customer: { email: tx.email }, subaccount: tx.subaccount ? { subaccount_code: tx.subaccount } : null });
  }
  if (req.method === 'GET' && path === '/bank') return ok(res, 'Banks retrieved', BANKS.map((b) => ({ ...b, active: true })));
  if (req.method === 'GET' && path === '/bank/resolve') {
    const n = url.searchParams.get('account_number') || '';
    if (!/^\d{10}$/.test(n)) return fail(res, 422, 'Could not resolve account name. Check parameters or try again.');
    return ok(res, 'Account number resolved', { account_number: n, account_name: `TEST ACCOUNT ${n}` });
  }
  if (req.method === 'POST' && path === '/subaccount') {
    const b = await readJson(req);
    if (b.account_number === '1111111111') return fail(res, 500, 'Sorry, We cannot add subaccount at the moment', 'api_error', 'unknown');
    if (b.account_number === '2222222222') return fail(res, 400, 'Test mode daily limit of 3 live bank resolves exceeded.', 'validation_error', 'rate_limit');
    if (b.settlement_bank === '001' || !BANKS.some((x) => x.code === b.settlement_bank)) return fail(res, 400, 'Account details are invalid');
    const code = `ACCT_mock${randomBytes(5).toString('hex')}`;
    subs.set(code, b);
    return ok(res, 'Subaccount created', { subaccount_code: code, business_name: b.business_name, account_number: b.account_number, percentage_charge: b.percentage_charge });
  }
  return fail(res, 404, 'Not found', 'validation_error', 'not_found');
});

server.listen(PORT, () => console.log(`Mock Paystack on http://localhost:${PORT}`));
