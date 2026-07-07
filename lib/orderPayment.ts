// Single source of truth for "is this order fully paid?" — used both server-side
// (to gate vault downloads) and client-side (to show/hide the download button).

export interface PaymentMilestoneLike {
  paid?: boolean;
  delivered?: boolean;
}

export interface OrderPaymentLike {
  payment_structure_type?: string | null;
  payment_milestones?: PaymentMilestoneLike[] | null;
  sixty_percent_paid?: boolean | null;
  forty_percent_paid?: boolean | null;
  topic?: string | null;
}

/** Coerce the various truthy shapes the DB/views return (bool, "yes", 1, "t"). */
export function toBool(val: any): boolean {
  if (val === true || val === 1) return true;
  if (typeof val === 'string') return ['yes', 'true', '1', 't', 'y'].includes(val.toLowerCase().trim());
  return false;
}

export function isCustomPayment(order: OrderPaymentLike): boolean {
  return order?.payment_structure_type === 'CUSTOM';
}

/**
 * Fully paid iff:
 *  - Project catalog topic: instantly unlocked ([PROJECT] prefix)
 *  - CUSTOM milestones: at least one milestone exists AND every milestone is paid
 *  - Standard 60/40:   both the 60% deposit and 40% balance are paid
 */
export function isOrderFullyPaid(order: OrderPaymentLike): boolean {
  if (order?.topic && order.topic.startsWith('[PROJECT]')) {
    return true;
  }
  if (isCustomPayment(order)) {
    const ms = order.payment_milestones;
    return Array.isArray(ms) && ms.length > 0 && ms.every(m => !!m.paid);
  }
  return toBool(order.sixty_percent_paid) && toBool(order.forty_percent_paid);
}

/** Index of the next unpaid milestone (custom orders), or -1 if all paid / n/a. */
export function nextUnpaidMilestoneIndex(order: OrderPaymentLike): number {
  const ms = order.payment_milestones;
  if (!Array.isArray(ms)) return -1;
  return ms.findIndex(m => !m.paid);
}
