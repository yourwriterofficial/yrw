// lib/emailTemplates.ts

import { milestonesFromOrder } from './invoices';

export type OrderEmailData = {
  order_id: string;
  legal_name: string;
  email: string;
  topic: string;
  financial_quote: number;
  service_tier?: string;
  deadline?: string;
  word_count?: number;
  reference_style?: string;
  font_specification?: string;
  payment_milestones?: Array<{ name: string; percentage: number; amount?: number }> | null;
  sixty_percent_paid?: boolean | null;
  forty_percent_paid?: boolean | null;
};

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://yourresearchwriter.com.ng';

const formatNaira = (amount: number) =>
  `₦${amount.toLocaleString('en-NG')}`;

const milestoneBreakdownHtml = (order: OrderEmailData) => {
  const milestones = milestonesFromOrder(order);
  return milestones
    .map((m: { name: string; percentage: number; amount: number }, i: number) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; ${i < milestones.length - 1 ? 'border-bottom: 1px solid #27272a;' : ''}">
          <span style="font-size: 11px; text-transform: uppercase; tracking-wider: 1px; color: #a1a1aa; font-weight: 700;">${i === 0 ? `Initial Deposit (${m.name})` : m.name}</span>
          <span style="font-size: 14px; color: #10b981; font-weight: 800;">${formatNaira(m.amount)} (${m.percentage}%)</span>
        </div>`)
    .join('');
};

// High-End Professional Base HTML Template
const baseLayout = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>YourResearchWriter</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background-color: #09090b;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #f4f4f5;
      padding: 30px 12px;
    }
    .wrapper {
      max-width: 580px;
      margin: 0 auto;
      background: #121215;
      border-radius: 24px;
      border: 1px solid #27272a;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }
    .header {
      background: linear-gradient(135deg, #064e3b 0%, #022c22 100%);
      padding: 36px 32px;
      text-align: center;
      border-bottom: 1px solid #059669;
    }
    .brand-badge {
      display: inline-block;
      padding: 4px 12px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 100px;
      color: #34d399;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .logo {
      font-size: 26px;
      font-weight: 900;
      color: #ffffff;
      letter-spacing: -0.5px;
      text-decoration: none;
    }
    .logo span {
      color: #34d399;
    }
    .body-content {
      padding: 36px 32px;
    }
    h1 {
      font-size: 22px;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 14px;
      letter-spacing: -0.3px;
    }
    h2 {
      font-size: 16px;
      font-weight: 800;
      color: #34d399;
      margin-bottom: 12px;
    }
    p {
      font-size: 14px;
      color: #a1a1aa;
      margin-bottom: 16px;
    }
    .card {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 18px;
      padding: 24px;
      margin: 24px 0;
    }
    .card-label {
      font-size: 10px;
      color: #71717a;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 1px;
      margin-bottom: 6px;
    }
    .order-id {
      font-size: 18px;
      font-weight: 800;
      color: #ffffff;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .price-tag {
      font-size: 32px;
      font-weight: 900;
      color: #34d399;
      margin: 12px 0;
    }
    .cta-button {
      display: inline-block;
      width: 100%;
      text-align: center;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #000000 !important;
      text-decoration: none;
      padding: 15px 30px;
      border-radius: 100px;
      font-weight: 900;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 24px;
      box-shadow: 0 10px 20px rgba(16, 185, 129, 0.25);
    }
    .divider {
      height: 1px;
      background: #27272a;
      margin: 20px 0;
    }
    .badge-status {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 100px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .footer {
      padding: 24px 32px;
      text-align: center;
      font-size: 11px;
      color: #71717a;
      border-top: 1px solid #27272a;
      background: #09090b;
    }
    .footer a {
      color: #34d399;
      text-decoration: none;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="brand-badge">Official Service Notification</div>
      <div><a href="${SITE_URL}" class="logo">YourResearch<span>Writer</span></a></div>
    </div>
    <div class="body-content">
      ${content}
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} YourResearchWriter. Plagiarism-Free Academic & Professional Writing.<br>
      Direct Support: <a href="https://wa.me/2348121443666">WhatsApp Customer Desk</a>
    </div>
  </div>
</body>
</html>
`;

export const emailTemplates = {
  // Client: Order confirmation (immediately after submission)
  clientOrderConfirmation: (order: OrderEmailData) => ({
    subject: `✅ Order Received: ${order.order_id}`,
    html: baseLayout(`
      <h1>Order Confirmation</h1>
      <p>Hello <strong>${order.legal_name}</strong>,</p>
      <p>We have securely logged your research project submission. Our academic specialists are reviewing your requirements and preparing your brief.</p>
      <div class="card">
        <div class="card-label">Order Reference</div>
        <div class="order-id">${order.order_id}</div>
        <div class="divider"></div>
        <div class="card-label">Project Title</div>
        <p style="color: #ffffff; font-weight: 700; margin-top: 4px; margin-bottom: 12px;">${order.topic}</p>
        <div class="card-label">Project Quote</div>
        <div class="price-tag">${formatNaira(order.financial_quote)}</div>
        <div class="divider"></div>
        ${milestoneBreakdownHtml(order)}
      </div>
      <a href="${SITE_URL}/dashboard/client" class="cta-button">Access Client Vault & Track</a>
    `),
  }),

  // Admin: New order notification
  adminNewOrder: (order: OrderEmailData) => ({
    subject: `🔔 NEW ORDER: ${order.order_id}`,
    html: baseLayout(`
      <h2>New Client Order Submitted</h2>
      <div class="card">
        <div class="card-label">Order ID</div>
        <div class="order-id">${order.order_id}</div>
        <div class="divider"></div>
        <div class="card-label">Client</div>
        <p style="color: #ffffff; font-weight: 700; margin-bottom: 8px;">${order.legal_name} (${order.email})</p>
        <div class="card-label">Topic</div>
        <p style="color: #ffffff; font-weight: 700; margin-bottom: 8px;">${order.topic}</p>
        <div class="card-label">Total Value</div>
        <div class="price-tag">${formatNaira(order.financial_quote)}</div>
      </div>
      <a href="${SITE_URL}/admin" class="cta-button">Open Admin Control Panel</a>
    `),
  }),

  // Quote Sent (when admin sets status to "Quote Sent")
  quoteSent: (order: OrderEmailData) => ({
    subject: `📄 Your Quote is Ready – ${order.order_id}`,
    html: baseLayout(`
      <h1>Your Quote is Ready</h1>
      <p>Dear ${order.legal_name},</p>
      <p>We have reviewed your project brief and finalized the quote. Details are provided below:</p>
      <div class="card">
        <div class="card-label">Total Project Cost</div>
        <div class="price-tag">${formatNaira(order.financial_quote)}</div>
        <div class="divider"></div>
        ${milestoneBreakdownHtml(order)}
      </div>
      <a href="${SITE_URL}/dashboard/client" class="cta-button">Pay Deposit & Unlock</a>
    `),
  }),

  // Deposit Paid (60%) – triggered by webhook
  depositPaid: (order: OrderEmailData) => ({
    subject: `💳 Deposit Confirmed – Work Started (${order.order_id})`,
    html: baseLayout(`
      <h1>Payment Confirmed!</h1>
      <p>Dear ${order.legal_name},</p>
      <p>Your deposit has cleared successfully. Our academic specialists have initiated research and drafting for <strong>${order.topic}</strong>.</p>
      <div class="card">
        <div class="card-label">Order ID</div>
        <div class="order-id">${order.order_id}</div>
        <div class="divider"></div>
        <div class="badge-status">Synthesis in progress</div>
      </div>
      <a href="${SITE_URL}/dashboard/client" class="cta-button">Track Live Progress</a>
    `),
  }),

  // Work Submitted (when admin uploads draft)
  workSubmitted: (order: OrderEmailData) => ({
    subject: `📝 Draft Ready for Review – ${order.order_id}`,
    html: baseLayout(`
      <h1>Your Draft is Ready</h1>
      <p>Hello ${order.legal_name},</p>
      <p>The draft for your project has been uploaded to your secure client vault. Pay the remaining balance to download the full manuscript.</p>
      <div class="card">
        <div class="card-label">Remaining Balance</div>
        <div class="price-tag">${formatNaira(order.financial_quote * 0.4)}</div>
        <div class="badge-status">Awaiting Final Balance</div>
      </div>
      <a href="${SITE_URL}/dashboard/client" class="cta-button">Pay Balance & Download</a>
    `),
  }),

  // Balance Paid (40%) – triggered by webhook
  balancePaid: (order: OrderEmailData) => ({
    subject: `🔓 Final Payment Cleared – Download Files (${order.order_id})`,
    html: baseLayout(`
      <h1>Order Unlocked!</h1>
      <p>Dear ${order.legal_name},</p>
      <p>Thank you for clearing your balance. Your final documents are unlocked in your client vault.</p>
      <div class="card">
        <div class="card-label">Order Reference</div>
        <div class="order-id">${order.order_id}</div>
        <div class="divider"></div>
        <div class="badge-status">Fully Unlocked</div>
      </div>
      <a href="${SITE_URL}/dashboard/client" class="cta-button">Download Full Files</a>
    `),
  }),

  // Order Completed (manual admin action)
  orderCompleted: (order: OrderEmailData) => ({
    subject: `🎉 Order ${order.order_id} Completed`,
    html: baseLayout(`
      <h1>Project Completed</h1>
      <p>Dear ${order.legal_name},</p>
      <p>We have finalized and completed order <strong>${order.order_id}</strong>. Thank you for choosing YourResearchWriter!</p>
      <div class="card">
        <div class="badge-status">Contract Fulfilled</div>
      </div>
      <a href="${SITE_URL}/dashboard/client" class="cta-button">View Final Deliverables</a>
    `),
  }),

  // Admin Notifications
  adminDepositPaid: (order: OrderEmailData) => ({
    subject: `💳 ADMIN ALERT: Deposit Paid – ${order.order_id}`,
    html: baseLayout(`
      <h2>Deposit Confirmed</h2>
      <p>Deposit cleared for order <strong>${order.order_id}</strong>.</p>
      <div class="card">
        <div class="card-label">Client</div>
        <p style="color: #ffffff; font-weight: 700;">${order.legal_name} (${order.email})</p>
      </div>
      <a href="${SITE_URL}/admin" class="cta-button">Open Admin Dashboard</a>
    `),
  }),

  adminBalancePaid: (order: OrderEmailData) => ({
    subject: `🔓 ADMIN ALERT: Balance Paid – ${order.order_id}`,
    html: baseLayout(`
      <h2>Final Balance Cleared</h2>
      <p>Final payment cleared for order <strong>${order.order_id}</strong>.</p>
      <a href="${SITE_URL}/admin" class="cta-button">Open Admin Dashboard</a>
    `),
  }),

  adminWalletTopup: (data: { email: string; full_name: string; amount: number; reference: string }) => ({
    subject: `💰 ADMIN ALERT: Wallet Funded – ₦${data.amount.toLocaleString('en-NG')}`,
    html: baseLayout(`
      <h2>Client Wallet Top-Up</h2>
      <p>Client <strong>${data.full_name} (${data.email})</strong> added <strong>${formatNaira(data.amount)}</strong> to wallet (Ref: ${data.reference}).</p>
    `),
  }),

  clientWalletTopup: (data: { full_name: string; amount: number; balance?: number; reference: string }) => ({
    subject: `💰 Wallet Funded – ₦${data.amount.toLocaleString('en-NG')}`,
    html: baseLayout(`
      <h1>Wallet Funded Successfully</h1>
      <p>Dear ${data.full_name},</p>
      <p>Your wallet has been credited with <strong>${formatNaira(data.amount)}</strong>.</p>
      <a href="${SITE_URL}/dashboard/client?tab=wallet" class="cta-button">View Wallet Balance</a>
    `),
  }),

  milestonePaid: (order: OrderEmailData, milestone: { name: string; amount: number; percentage: number }, allPaid: boolean) => ({
    subject: `💳 Payment Confirmed: ${milestone.name} – ${order.order_id}`,
    html: baseLayout(`
      <h1>Milestone Payment Received</h1>
      <p>Dear ${order.legal_name}, payment for <strong>${milestone.name}</strong> (${formatNaira(milestone.amount)}) has cleared.</p>
      <a href="${SITE_URL}/dashboard/client" class="cta-button">View Order</a>
    `),
  }),

  milestoneDelivered: (order: OrderEmailData, milestone: { name: string; percentage: number }) => ({
    subject: `📦 Milestone Delivered: ${milestone.name} – ${order.order_id}`,
    html: baseLayout(`
      <h1>Milestone Delivered</h1>
      <p>Dear ${order.legal_name}, the team delivered <strong>${milestone.name}</strong> for ${order.topic}.</p>
      <a href="${SITE_URL}/dashboard/client" class="cta-button">Review Progress</a>
    `),
  }),

  vaultFileAdded: (order: OrderEmailData, fileName?: string) => ({
    subject: `🔐 New File in Your Vault – ${order.order_id}`,
    html: baseLayout(`
      <h1>New Vault File Added</h1>
      <p>A new deliverable ${fileName ? `(<strong>${fileName}</strong>)` : ''} has been added to your vault.</p>
      <a href="${SITE_URL}/dashboard/client?tab=vault" class="cta-button">Open Vault</a>
    `),
  }),

  invoiceIssued: (data: { legal_name: string; invoice_number: string; total_amount: number; invoice_url: string; project_title?: string }) => ({
    subject: `🧾 Invoice ${data.invoice_number} from YourResearchWriter`,
    html: baseLayout(`
      <h1>Invoice Ready</h1>
      <p>Dear ${data.legal_name}, invoice <strong>#${data.invoice_number}</strong> (${formatNaira(data.total_amount)}) is ready.</p>
      <a href="${data.invoice_url}" class="cta-button">Pay Invoice Online</a>
    `),
  }),

  magicLinkLogin: (data: { name: string; actionLink: string; title?: string; introHtml?: string; ctaText?: string }) => ({
    subject: data.title || 'Your login link — YourResearchWriter',
    html: baseLayout(`
      <h1>${data.title || 'Access Your Dashboard'}</h1>
      <p>Hi ${data.name},</p>
      ${data.introHtml || '<p>Click the button below to securely log in — no password needed.</p>'}
      <a href="${data.actionLink}" class="cta-button">${data.ctaText || 'Log In Now'}</a>
    `),
  }),

  adSubmittedUser: (data: { title: string; position: string; amount: number }) => ({
    subject: `📢 Ad Campaign Submitted – Pending Review`,
    html: baseLayout(`
      <h1>Ad Campaign Submitted</h1>
      <p>Your advertisement campaign has been received and queued for review.</p>
      <div class="card">
        <div class="card-label">Campaign Title</div>
        <p style="color: #ffffff; font-weight: 700; margin-bottom: 8px;">${data.title}</p>
        <div class="card-label">Placement Slot</div>
        <p style="color: #34d399; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">${data.position}</p>
        <div class="card-label">Total Amount</div>
        <div class="price-tag">${formatNaira(data.amount)}</div>
        <div class="badge-status">Awaiting Admin Verification</div>
      </div>
      <a href="${SITE_URL}/advertise" class="cta-button">Manage Your Campaigns</a>
    `),
  }),

  adApprovedUser: (data: { title: string; position: string }) => ({
    subject: `🚀 Ad Campaign Approved & Live!`,
    html: baseLayout(`
      <h1>Your Ad is Now Live!</h1>
      <p>Great news! Your advertisement campaign has passed review and is now rendering live sitewide.</p>
      <div class="card">
        <div class="card-label">Campaign Title</div>
        <p style="color: #ffffff; font-weight: 700; margin-bottom: 8px;">${data.title}</p>
        <div class="card-label">Placement Slot</div>
        <p style="color: #34d399; font-weight: 700; text-transform: uppercase; margin-bottom: 12px;">${data.position}</p>
        <div class="badge-status">Active & Live</div>
      </div>
      <a href="${SITE_URL}/advertise" class="cta-button">View Live Campaign Stats</a>
    `),
  }),

  adRejectedUser: (data: { title: string; reason: string }) => ({
    subject: `❌ Update Regarding Your Ad Campaign`,
    html: baseLayout(`
      <h1>Ad Campaign Review Status</h1>
      <p>Your advertisement submission was declined during our quality review.</p>
      <div class="card">
        <div class="card-label">Campaign Title</div>
        <p style="color: #ffffff; font-weight: 700; margin-bottom: 8px;">${data.title}</p>
        <div class="card-label">Rejection Reason</div>
        <p style="color: #f87171; font-weight: 700; margin-top: 4px;">${data.reason}</p>
      </div>
      <a href="${SITE_URL}/advertise" class="cta-button">Return to Ad Portal</a>
    `),
  }),

  genericMessage: (data: { name?: string; title: string; body: string; ctaText?: string; ctaUrl?: string }) => ({
    subject: data.title,
    html: baseLayout(`
      <h1>${data.title}</h1>
      ${data.name ? `<p>Hello <strong>${data.name}</strong>,</p>` : ''}
      <div style="margin: 16px 0;">${data.body}</div>
      ${data.ctaText && data.ctaUrl ? `<a href="${data.ctaUrl}" class="cta-button">${data.ctaText}</a>` : ''}
    `),
  }),
};

export function emailShell(bodyHtml: string, ctaText?: string, ctaUrl?: string): string {
  return baseLayout(`
    ${bodyHtml}
    ${ctaText && ctaUrl ? `<a href="${ctaUrl}" class="cta-button">${ctaText}</a>` : ''}
  `);
}