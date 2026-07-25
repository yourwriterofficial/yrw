// Derives the single "what is happening / what do I do next" answer for an
// order. Both the client dashboard and the admin panel read from here, so the
// two never disagree about whose turn it is.
//
// Tone is the whole colour system for order surfaces:
//   done — finished, money received, nothing owed
//   act  — the CLIENT must do something (this is the only tone that gets a
//          filled primary button)
//   prog — WE are working; nothing is required from the client
//   wait — not yet relevant

export type StatusTone = 'done' | 'act' | 'prog' | 'wait';

export interface OrderStatusView {
  tone: StatusTone;
  /** Short headline, sentence case. */
  title: string;
  /** One line of plain-language context. */
  subtitle: string;
  /** The single next action, when the client can take one. */
  action: null | {
    label: string;
    /** Payment reference suffix: 'DEPOSIT' | 'BALANCE' | `INDEX-${n}` */
    paymentType: string;
    amount: number;
  };
}

export interface MilestoneLike {
  name: string;
  percentage?: number;
  amount: number;
  paid?: boolean;
  trigger?: string;
}

export interface OrderStatusInput {
  workflowStatus?: string | null;
  total: number;
  isCustom: boolean;
  milestones: MilestoneLike[];
  paid60: boolean;
  paid40: boolean;
  workSubmitted: boolean;
}

const naira = (n: number) => '₦' + Math.round(n).toLocaleString('en-NG');

export function deriveOrderStatus(o: OrderStatusInput): OrderStatusView {
  const { workflowStatus, total, isCustom, milestones, paid60, paid40, workSubmitted } = o;

  if (workflowStatus === 'Cancelled') {
    return { tone: 'wait', title: 'Order cancelled', subtitle: 'This order is no longer active.', action: null };
  }

  // No quote yet — nothing the client can pay or do.
  if (workflowStatus === 'Briefing Received' || total <= 0) {
    return {
      tone: 'prog',
      title: 'Under review',
      subtitle: 'We are reviewing your brief and preparing your quote. We will email you as soon as it is ready.',
      action: null,
    };
  }

  if (isCustom) {
    const nextIdx = milestones.findIndex(m => !m.paid);
    const next = nextIdx >= 0 ? milestones[nextIdx] : null;

    if (next) {
      const isFirst = nextIdx === 0;
      return {
        tone: 'act',
        title: isFirst ? 'Deposit due to start work' : `Payment due: ${next.name}`,
        subtitle: isFirst
          ? 'Work begins the moment your first milestone clears.'
          : next.trigger || 'Clear this milestone to continue to the next stage.',
        action: { label: `Pay ${naira(next.amount)}`, paymentType: `INDEX-${nextIdx}`, amount: next.amount },
      };
    }

    // Every milestone settled.
    if (workflowStatus === 'Completed') {
      return { tone: 'done', title: 'Order complete', subtitle: 'All milestones paid and files released. Thank you.', action: null };
    }
    return {
      tone: 'done',
      title: 'Fully paid — files unlocked',
      subtitle: 'Everything is settled. Your files are available to download below.',
      action: null,
    };
  }

  // Standard 60/40
  if (!paid60) {
    const deposit = total * 0.6;
    return {
      tone: 'act',
      title: 'Deposit due to start work',
      subtitle: 'Work begins the moment your deposit clears.',
      action: { label: `Pay ${naira(deposit)}`, paymentType: 'DEPOSIT', amount: deposit },
    };
  }

  if (!workSubmitted) {
    return {
      tone: 'prog',
      title: 'Draft in progress',
      subtitle: 'Nothing needed from you. We will email you the moment your draft is ready.',
      action: null,
    };
  }

  if (!paid40) {
    const balance = total * 0.4;
    return {
      tone: 'act',
      title: 'Draft ready — balance due',
      subtitle: 'Clear the remaining balance to unlock and download your files.',
      action: { label: `Pay ${naira(balance)}`, paymentType: 'BALANCE', amount: balance },
    };
  }

  if (workflowStatus === 'Completed') {
    return { tone: 'done', title: 'Order complete', subtitle: 'Fully paid and delivered. Thank you.', action: null };
  }
  return {
    tone: 'done',
    title: 'Fully paid — files unlocked',
    subtitle: 'Everything is settled. Your files are available to download below.',
    action: null,
  };
}

/** How much of the order's value has actually been collected. */
export function amountPaid(o: {
  isCustom: boolean;
  milestones: MilestoneLike[];
  total: number;
  paid60: boolean;
  paid40: boolean;
}): number {
  if (o.isCustom) {
    return o.milestones.reduce((sum, m) => (m.paid ? sum + Number(m.amount || 0) : sum), 0);
  }
  if (o.paid40) return o.total;
  if (o.paid60) return o.total * 0.6;
  return 0;
}

/**
 * Milestone chips for display. Standard 60/40 orders have no milestone array,
 * so synthesise the equivalent two entries — the UI then has one shape to render
 * and custom orders stop needing a separate code path.
 */
export function displayMilestones(o: {
  isCustom: boolean;
  milestones: MilestoneLike[];
  total: number;
  paid60: boolean;
  paid40: boolean;
  workSubmitted: boolean;
}): MilestoneLike[] {
  if (o.isCustom) return o.milestones;
  return [
    { name: 'Initial Deposit', percentage: 60, amount: o.total * 0.6, paid: o.paid60, trigger: 'To start work' },
    {
      name: 'Final Payment',
      percentage: 40,
      amount: o.total * 0.4,
      paid: o.paid40,
      trigger: o.workSubmitted ? 'Due now' : 'After draft',
    },
  ];
}
