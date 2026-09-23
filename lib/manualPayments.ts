import { createClient as createServiceClient, SupabaseClient } from '@supabase/supabase-js';
import { BankDetails } from './bankDetails';
import { applyMilestonePayment } from './milestones';
import { creditReferralCommission } from './affiliate';
import { notifyUser } from './notify';

let adminClient: SupabaseClient | null = null;

function getAdmin(): SupabaseClient {
  if (adminClient) return adminClient;
  adminClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  return adminClient;
}

export type ManualPaymentType =
  | 'ORDER_DEPOSIT'
  | 'ORDER_MILESTONE'
  | 'CUSTOM_INVOICE'
  | 'WALLET_TOPUP'
  | 'DEV_PRODUCT';

export interface ManualPaymentPayload {
  reference: string;
  userId?: string | null;
  orderId?: string | null;
  invoiceId?: string | null;
  milestoneIndex?: number | null;
  paymentType: ManualPaymentType;
  amount: number;
  bankDetails: BankDetails;
  senderName?: string | null;
  receiptUrl?: string | null;
  notes?: string | null;
}

/**
 * Creates or logs a manual bank transfer request.
 */
export async function createManualPaymentRequest(payload: ManualPaymentPayload) {
  const admin = getAdmin();
  const {
    reference,
    userId,
    orderId,
    invoiceId,
    milestoneIndex,
    paymentType,
    amount,
    bankDetails,
    senderName,
    receiptUrl,
    notes,
  } = payload;

  const metadata = {
    paymentType,
    orderId: orderId || null,
    invoiceId: invoiceId || null,
    milestoneIndex: milestoneIndex ?? null,
    bankName: bankDetails.bank_name,
    accountNumber: bankDetails.account_number,
    accountName: bankDetails.account_name,
    senderName: senderName || null,
    receiptUrl: receiptUrl || null,
    clientNotes: notes || null,
    submittedAt: new Date().toISOString(),
  };

  // 1. If user is logged in, log to `transactions` table (with pending status)
  if (userId) {
    try {
      await admin.from('transactions').insert({
        user_id: userId,
        amount: Math.round(amount),
        type: paymentType === 'WALLET_TOPUP' ? 'deposit' : 'payment',
        reference,
        status: 'pending',
        notes: JSON.stringify(metadata),
      });
    } catch (e) {
      console.warn('Failed to insert into transactions table:', e);
    }
  }

  // 2. Try inserting into `manual_payments` table if present
  try {
    await admin.from('manual_payments').insert({
      reference,
      user_id: userId || null,
      order_id: orderId || null,
      invoice_id: invoiceId || null,
      payment_type: paymentType,
      amount: Math.round(amount),
      bank_name: bankDetails.bank_name,
      account_number: bankDetails.account_number,
      account_name: bankDetails.account_name,
      sender_name: senderName || null,
      receipt_url: receiptUrl || null,
      status: 'PENDING',
      admin_notes: notes || null,
    });
  } catch {
    // Graceful fallback if migration not yet applied
  }

  // 3. If tied to an order, update order status and notes
  if (orderId && !orderId.startsWith('INV-')) {
    try {
      const { data: order } = await admin
        .from('orders')
        .select('additional_info, workflow_status')
        .eq('order_id', orderId)
        .maybeSingle();

      let infoObj: any = {};
      try {
        if (order?.additional_info && typeof order.additional_info === 'string' && order.additional_info.startsWith('{')) {
          infoObj = JSON.parse(order.additional_info);
        }
      } catch {}

      infoObj.latest_transfer_proof = {
        reference,
        amount,
        senderName,
        receiptUrl,
        submittedAt: new Date().toISOString(),
      };

      await admin
        .from('orders')
        .update({
          workflow_status: 'Pending Bank Transfer',
          additional_info: JSON.stringify(infoObj),
          last_activity: new Date().toISOString(),
        })
        .eq('order_id', orderId);
    } catch (err) {
      console.warn('Failed to attach proof to order:', err);
    }
  }

  return { success: true, reference };
}

/**
 * Fetch all pending manual transfers for the admin review queue.
 */
export async function getPendingManualPayments() {
  const admin = getAdmin();
  const list: any[] = [];

  // 1. Fetch from manual_payments table if available
  try {
    const { data: mpData } = await admin
      .from('manual_payments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (mpData && mpData.length > 0) {
      return mpData;
    }
  } catch {}

  // 2. Fallback to pending rows from transactions table
  try {
    const { data: txData } = await admin
      .from('transactions')
      .select('*, profiles(full_name, email, phone, whatsapp)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(100);

    if (txData) {
      for (const tx of txData) {
        let meta: any = {};
        try {
          if (tx.notes && typeof tx.notes === 'string' && tx.notes.startsWith('{')) {
            meta = JSON.parse(tx.notes);
          }
        } catch {}

        list.push({
          id: tx.id,
          reference: tx.reference,
          user_id: tx.user_id,
          amount: tx.amount,
          status: tx.status.toUpperCase(),
          payment_type: meta.paymentType || (tx.type === 'deposit' ? 'WALLET_TOPUP' : 'ORDER_DEPOSIT'),
          order_id: meta.orderId || null,
          invoice_id: meta.invoiceId || null,
          bank_name: meta.bankName || 'Opay',
          account_number: meta.accountNumber || '8121443666',
          account_name: meta.accountName || 'Richlord Jude',
          sender_name: meta.senderName || tx.profiles?.full_name || null,
          receipt_url: meta.receiptUrl || null,
          client_email: tx.profiles?.email || null,
          created_at: tx.created_at,
        });
      }
    }
  } catch (err) {
    console.warn('Error reading transactions for manual payments:', err);
  }

  return list;
}

/**
 * Approve a manual payment transfer and execute respective fulfillment routines.
 */
export async function approveManualPayment(reference: string, adminNotes?: string) {
  const admin = getAdmin();

  // 1. Find transaction or manual payment metadata
  let paymentMeta: any = null;
  let txRow: any = null;

  try {
    const { data: tx } = await admin
      .from('transactions')
      .select('*')
      .eq('reference', reference)
      .maybeSingle();

    if (tx) {
      txRow = tx;
      try {
        if (tx.notes && typeof tx.notes === 'string' && tx.notes.startsWith('{')) {
          paymentMeta = JSON.parse(tx.notes);
        }
      } catch {}
    }
  } catch {}

  // Also check manual_payments
  try {
    const { data: mp } = await admin
      .from('manual_payments')
      .select('*')
      .eq('reference', reference)
      .maybeSingle();

    if (mp) {
      paymentMeta = {
        paymentType: mp.payment_type,
        orderId: mp.order_id,
        invoiceId: mp.invoice_id,
        amount: mp.amount,
        userId: mp.user_id,
        ...paymentMeta,
      };
    }
  } catch {}

  const pType: ManualPaymentType = paymentMeta?.paymentType || (txRow?.type === 'deposit' ? 'WALLET_TOPUP' : 'ORDER_DEPOSIT');
  const userId = paymentMeta?.userId || txRow?.user_id;
  const amount = Number(paymentMeta?.amount || txRow?.amount || 0);
  const orderId = paymentMeta?.orderId;
  const invoiceId = paymentMeta?.invoiceId;

  // 2. Execute fulfillment according to payment type
  if (pType === 'WALLET_TOPUP' && userId && amount > 0) {
    // Credit user's wallet
    await admin.rpc('increment_wallet', {
      user_id: userId,
      add_amount: Math.round(amount),
    });

    try {
      await notifyUser({
        userId,
        title: 'Wallet Funded Successfully',
        message: `Your manual bank transfer of ₦${amount.toLocaleString('en-NG')} has been verified and credited to your wallet balance.`,
        type: 'payment',
        link: '/dashboard/client?tab=wallet',
      });
    } catch {}
  } else if ((pType === 'ORDER_DEPOSIT' || !pType) && orderId) {
    // Activate Order
    const { data: order } = await admin
      .from('orders')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (order) {
      const isInstantCatalog = !!(order.topic && order.topic.startsWith('[PROJECT]'));
      await admin
        .from('orders')
        .update({
          sixty_percent_paid: true,
          workflow_status: isInstantCatalog ? 'Delivered' : 'In Progress',
          vault_status: isInstantCatalog ? 'READY' : (order.vault_status || 'LOCKED'),
          last_activity: new Date().toISOString(),
        })
        .eq('order_id', orderId);

      // Trigger referral commission if client has referrer
      if (order.client_id) {
        try {
          await creditReferralCommission(admin, {
            buyerId: order.client_id,
            amount: amount || Number(order.financial_quote || 0),
            orderId: order.id,
            reference,
            note: `Referral commission for Order #${orderId}`,
          });
        } catch {}

        try {
          await notifyUser({
            userId: order.client_id,
            title: `Payment Confirmed: Order #${orderId}`,
            message: `Your transfer of ₦${amount.toLocaleString('en-NG')} was approved. Your research writing is now in progress!`,
            type: 'order_update',
            link: '/dashboard/client?tab=orders',
            orderDbId: order.id,
          });
        } catch {}
      }
    }
  } else if (pType === 'ORDER_MILESTONE' && orderId) {
    // Mark specific milestone paid
    const { data: order } = await admin
      .from('orders')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (order && Array.isArray(order.payment_milestones)) {
      const idx = paymentMeta?.milestoneIndex ?? 0;
      const res = applyMilestonePayment(order.payment_milestones, idx, {
        amountPaid: amount,
        reference,
        enforceOrder: false,
      });

      if (res.ok) {
        await admin
          .from('orders')
          .update({
            payment_milestones: res.milestones,
            forty_percent_paid: res.allPaid ? true : order.forty_percent_paid,
            last_activity: new Date().toISOString(),
          })
          .eq('order_id', orderId);

        if (order.client_id) {
          try {
            await notifyUser({
              userId: order.client_id,
              title: `Milestone Confirmed: Order #${orderId}`,
              message: `Milestone payment of ₦${amount.toLocaleString('en-NG')} has been verified.`,
              type: 'payment',
              link: '/dashboard/client?tab=orders',
              orderDbId: order.id,
            });
          } catch {}
        }
      }
    }
  } else if (pType === 'CUSTOM_INVOICE' && invoiceId) {
    // Update custom invoice milestone
    const { data: invoice } = await admin
      .from('custom_invoices')
      .select('*')
      .eq('invoice_number', invoiceId)
      .single();

    if (invoice && Array.isArray(invoice.milestones)) {
      const nextIdx = invoice.milestones.findIndex((m: any) => !m.paid);
      const targetIdx = paymentMeta?.milestoneIndex ?? (nextIdx >= 0 ? nextIdx : 0);
      const updatedMs = invoice.milestones.map((m: any, i: number) => {
        if (i === targetIdx) {
          return {
            ...m,
            paid: true,
            paid_at: new Date().toISOString(),
            tx_ref: reference,
          };
        }
        return m;
      });

      const allPaid = updatedMs.every((m: any) => m.paid);
      await admin
        .from('custom_invoices')
        .update({
          milestones: updatedMs,
          status: allPaid ? 'PAID' : 'PARTIALLY_PAID',
        })
        .eq('invoice_number', invoiceId);
    }
  }

  // 3. Mark transaction as completed
  try {
    await admin
      .from('transactions')
      .update({ status: 'completed' })
      .eq('reference', reference);
  } catch {}

  // 4. Mark manual_payments table as APPROVED
  try {
    await admin
      .from('manual_payments')
      .update({
        status: 'APPROVED',
        reviewed_at: new Date().toISOString(),
        admin_notes: adminNotes || 'Approved by admin',
      })
      .eq('reference', reference);
  } catch {}

  return { success: true };
}

/**
 * Reject a manual payment transfer.
 */
export async function rejectManualPayment(reference: string, reason?: string) {
  const admin = getAdmin();

  try {
    await admin
      .from('transactions')
      .update({
        status: 'failed',
      })
      .eq('reference', reference);
  } catch {}

  try {
    await admin
      .from('manual_payments')
      .update({
        status: 'REJECTED',
        reviewed_at: new Date().toISOString(),
        admin_notes: reason || 'Transfer declined by admin',
      })
      .eq('reference', reference);
  } catch {}

  return { success: true };
}
