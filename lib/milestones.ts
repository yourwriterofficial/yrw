// Single source of truth for applying a payment to an order/invoice milestone.
//
// This exists because the Paystack webhook and the wallet-payment route had
// drifted: the wallet route validated range, double-payment and ordering, while
// the webhook validated none of it and additionally trusted `[].every()` — which
// returns TRUE for an empty array, so an order with no milestones was marked
// fully paid by a single charge. Every payment path now goes through here.

export interface Milestone {
  name: string;
  percentage?: number;
  amount: number;
  paid?: boolean;
  paid_at?: string | null;
  tx_ref?: string | null;
  delivered?: boolean;
  trigger?: string;
}

export type MilestoneFailureCode =
  | 'no_milestones'
  | 'out_of_range'
  | 'already_paid'
  | 'out_of_order'
  | 'amount_mismatch'
  | 'duplicate_reference';

export type ApplyMilestoneResult =
  | {
      ok: true;
      milestones: Milestone[];
      applied: Milestone;
      allPaid: boolean;
      firstPaid: boolean;
    }
  | { ok: false; code: MilestoneFailureCode; reason: string };

/** Naira tolerance for amount comparison — covers kobo rounding on Paystack's side. */
const AMOUNT_TOLERANCE = 1;

/**
 * True only when there is at least one milestone AND every one is paid.
 *
 * Guarding on length is the whole point: `[].every(...)` is vacuously true, which
 * previously flipped `forty_percent_paid` and released the vault for orders that
 * had no milestone structure at all.
 */
export function allMilestonesPaid(milestones: Milestone[] | null | undefined): boolean {
  return Array.isArray(milestones) && milestones.length > 0 && milestones.every(m => !!m.paid);
}

/**
 * Validate and apply a payment against milestone `index`.
 *
 * Returns a new array — never mutates the caller's. On any failure nothing is
 * applied and the caller is told why, so the payment can be recorded and
 * flagged for a human rather than silently swallowed.
 *
 * @param amountPaid When provided, the payment must match the milestone amount
 *   (within AMOUNT_TOLERANCE). Omit only for flows where the amount is already
 *   guaranteed by the caller, e.g. a wallet debit of exactly `m.amount`.
 * @param enforceOrder Require that this is the earliest unpaid milestone.
 * @param reference When given, a milestone already stamped with this tx_ref means
 *   the payment was processed before. This is the retry guard for webhooks: it
 *   lives on the order itself, so unlike a `transactions` lookup it also covers
 *   guest orders, which have no user row to log a transaction against.
 */
export function applyMilestonePayment(
  rawMilestones: unknown,
  index: number,
  opts: { amountPaid?: number; enforceOrder?: boolean; reference?: string } = {}
): ApplyMilestoneResult {
  const { amountPaid, enforceOrder = true, reference } = opts;

  if (!Array.isArray(rawMilestones) || rawMilestones.length === 0) {
    return {
      ok: false,
      code: 'no_milestones',
      reason: 'Order has no payment milestones defined, so a milestone payment cannot be applied.',
    };
  }

  const milestones: Milestone[] = rawMilestones.map((m: any) => ({ ...m }));

  if (reference && milestones.some(m => m.tx_ref === reference)) {
    return {
      ok: false,
      code: 'duplicate_reference',
      reason: `Reference ${reference} has already been applied to this order.`,
    };
  }

  if (!Number.isInteger(index) || index < 0 || index >= milestones.length) {
    return {
      ok: false,
      code: 'out_of_range',
      reason: `Milestone index ${index} is outside the range 0..${milestones.length - 1}.`,
    };
  }

  const target = milestones[index];

  if (target.paid) {
    return { ok: false, code: 'already_paid', reason: `Milestone "${target.name}" is already marked paid.` };
  }

  if (enforceOrder) {
    const nextUnpaid = milestones.findIndex(m => !m.paid);
    if (nextUnpaid !== index) {
      return {
        ok: false,
        code: 'out_of_order',
        reason: `Milestones must be paid in order — expected index ${nextUnpaid}, got ${index}.`,
      };
    }
  }

  if (amountPaid !== undefined) {
    const expected = Number(target.amount);
    if (!Number.isFinite(expected) || Math.abs(Number(amountPaid) - expected) > AMOUNT_TOLERANCE) {
      return {
        ok: false,
        code: 'amount_mismatch',
        reason: `Paid ${amountPaid} but milestone "${target.name}" expects ${expected}.`,
      };
    }
  }

  return {
    ok: true,
    milestones,
    applied: target,
    allPaid: false,
    firstPaid: false,
  };
}

/**
 * Stamp the milestone as paid and report the resulting order-level flags.
 * Split from validation so callers can record the tx reference they generated.
 */
export function markMilestonePaid(
  milestones: Milestone[],
  index: number,
  txRef: string,
  paidAt = new Date().toISOString()
): { milestones: Milestone[]; allPaid: boolean; firstPaid: boolean } {
  const next = milestones.map((m, i) =>
    i === index ? { ...m, paid: true, paid_at: paidAt, tx_ref: txRef } : { ...m }
  );
  return {
    milestones: next,
    allPaid: allMilestonesPaid(next),
    firstPaid: !!next[0]?.paid,
  };
}
