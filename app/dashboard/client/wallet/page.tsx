'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import LoadingScreen from '@/app/components/ui/LoadingScreen';
import { showToast } from '@/app/components/ui/Toast';
import Button from '@/app/components/ui/Button';
import ManualPaymentModal from '@/app/components/ManualPaymentModal';
import { getEffectiveUser } from '@/lib/impersonate';

type WalletPageProps = { embedded?: boolean };

const PRESETS = [5000, 10000, 20000, 50000, 100000];
const naira = (n: number) => '₦' + Math.round(n || 0).toLocaleString('en-NG');

const STATUS_LABEL: Record<string, string> = {
  completed: 'Done',
  success: 'Done',
  pending: 'Waiting',
  failed: 'Failed',
};

export default function WalletPage({ embedded = false }: WalletPageProps) {
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState(5000);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<{ isOpen: boolean; reference: string; amount: number; bankDetails: any }>({
    isOpen: false, reference: '', amount: 0, bankDetails: null,
  });

  const fetchWallet = async () => {
    const { user } = await getEffectiveUser();
    if (!user) { router.push('/login'); return; }

    const { data: wallet, error: walletError } = await supabase.from('wallets').select('balance').eq('user_id', user.id).single();
    setBalance(walletError ? 0 : wallet?.balance || 0);

    const { data: txns, error: txError } = await supabase
      .from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
    if (!txError) setTransactions(txns || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchWallet();
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true') {
      window.history.replaceState({}, '', embedded ? window.location.pathname : '/dashboard/client/wallet');
      fetchWallet();
      showToast('Wallet funded successfully!', 'success');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded]);

  const payByBank = async () => {
    const { user } = await getEffectiveUser();
    if (!user) { router.push('/login'); return; }
    if (amount < 100) { showToast('The minimum top-up is ₦100.', 'error'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/wallet/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, amount }),
      });
      const data = await res.json();
      if (data.manual_transfer && data.bankDetails) {
        setModal({ isOpen: true, reference: data.reference, amount: data.amount, bankDetails: data.bankDetails });
      } else {
        showToast(data.error || 'Could not start the top-up.', 'error');
      }
    } catch {
      showToast('Network error. Please try again.', 'error');
    }
    setBusy(false);
  };

  if (loading) return <LoadingScreen label="Loading wallet..." fullScreen={!embedded} />;

  return (
    <div className={`max-w-3xl mx-auto ${embedded ? '' : 'p-6 md:p-10'}`}>
      {!embedded && (
        <header className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight">Wallet</h2>
          <p className="text-secondary text-sm mt-1">Add money once, then pay for orders from your balance.</p>
        </header>
      )}

      <div className="border border-theme rounded-lg bg-card p-6 mb-6">
        <p className="text-xs text-secondary">Balance</p>
        <p className="text-4xl font-bold mt-1">{naira(balance)}</p>
      </div>

      <section className="border border-theme rounded-lg bg-card p-6 mb-8">
        <h3 className="font-semibold">Add money</h3>
        <div className="flex flex-wrap gap-2 mt-4">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setAmount(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                amount === p ? 'bg-accent text-[var(--accent-foreground)] border-accent' : 'border-theme hover:border-strong'
              }`}
            >
              {naira(p)}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <label htmlFor="topup-amount" className="block text-sm font-medium mb-1.5">Amount (₦)</label>
          <input
            id="topup-amount"
            type="number"
            min={100}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="input-box w-full sm:w-56"
          />
        </div>

        <div className="mt-5">
          <Button onClick={payByBank} loading={busy} loadingText="Please wait…" disabled={busy || amount < 100}>
            Pay by bank transfer
          </Button>
        </div>
        <p className="text-xs text-secondary mt-3">
          You will see our account details and a reference. Your balance is updated once we confirm the transfer.
        </p>
      </section>

      <section>
        <h3 className="font-semibold mb-3">History</h3>
        {transactions.length === 0 ? (
          <p className="text-sm text-secondary border border-dashed border-theme rounded-lg p-6 text-center">Nothing here yet.</p>
        ) : (
          <ul className="divide-y divide-theme border-y border-theme">
            {transactions.map((t) => {
              const money = t.type === 'deposit';
              return (
                <li key={t.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{money ? 'Wallet top-up' : 'Payment'}</p>
                    <p className="text-xs text-secondary truncate">
                      {new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {t.reference}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${money ? 'text-accent' : ''}`}>{money ? '+' : '−'} {naira(Number(t.amount))}</p>
                    <p className="text-xs text-secondary">{STATUS_LABEL[String(t.status).toLowerCase()] || t.status}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {modal.isOpen && modal.bankDetails && (
        <ManualPaymentModal
          isOpen
          onClose={() => { setModal((p) => ({ ...p, isOpen: false })); fetchWallet(); }}
          reference={modal.reference}
          amount={modal.amount}
          bankDetails={modal.bankDetails}
          paymentType="WALLET_TOPUP"
          title="Add money by bank transfer"
          onSuccess={() => fetchWallet()}
        />
      )}
    </div>
  );
}
