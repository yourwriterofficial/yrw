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

// Rendered as a table, not flexbox — Outlook and most mail clients ignore
// `display:flex`, which collapsed the label/amount onto separate lines.
const milestoneBreakdownHtml = (order: OrderEmailData) => {
  const milestones = milestonesFromOrder(order);
  const rows = milestones
    .map((m: { name: string; percentage: number; amount: number }, i: number) => {
      const border = i > 0 ? 'border-top: 1px solid #e4e4e7;' : '';
      return `
          <tr>
            <td style="padding: 9px 0; ${border} font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #71717a; font-weight: 700;">${i === 0 ? `Initial Deposit (${m.name})` : m.name}</td>
            <td align="right" style="padding: 9px 0; ${border} font-size: 14px; color: #059669; font-weight: 800; white-space: nowrap;">${formatNaira(m.amount)} (${m.percentage}%)</td>
          </tr>`;
    })
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
};

// High-End Professional Base HTML Template
// Table-based layout with explicit widths/bgcolor attributes so it degrades
// gracefully in Outlook desktop (which ignores max-width on divs, CSS
// gradients, and border-radius) while still looking sharp in Gmail/Apple
// Mail/etc. Keep this light-background + solid-color approach — no
// gradients or background-clip:text — to avoid unreadable text in clients
// that strip unsupported CSS.
const baseLayout = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>YourResearchWriter</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background-color: #f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #18181b;
    }
    .brand-badge {
      display: inline-block;
      padding: 4px 12px;
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 100px;
      color: #a7f3d0;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .logo {
      font-size: 24px;
      font-weight: 900;
      color: #ffffff;
      letter-spacing: -0.5px;
      text-decoration: none;
    }
    .logo span {
      color: #6ee7b7;
    }
    h1 {
      font-size: 21px;
      font-weight: 800;
      color: #18181b;
      margin-bottom: 14px;
      letter-spacing: -0.3px;
    }
    h2 {
      font-size: 16px;
      font-weight: 800;
      color: #059669;
      margin-bottom: 12px;
    }
    p {
      font-size: 14px;
      color: #3f3f46;
      margin-bottom: 16px;
    }
    .card {
      background: #f9fafb;
      border: 1px solid #e4e4e7;
      border-radius: 12px;
      padding: 22px;
      margin: 20px 0;
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
      color: #18181b;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .price-tag {
      font-size: 30px;
      font-weight: 900;
      color: #059669;
      margin: 10px 0;
    }
    .cta-button {
      display: inline-block;
      background-color: #059669;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 6px;
      font-weight: 800;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 20px;
    }
    .divider {
      height: 1px;
      background: #e4e4e7;
      margin: 18px 0;
    }
    .badge-status {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 100px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      background: #ecfdf5;
      color: #059669;
      border: 1px solid #a7f3d0;
    }
    .footer {
      padding: 22px 32px;
      text-align: center;
      font-size: 11px;
      color: #a1a1aa;
      border-top: 1px solid #e4e4e7;
      background: #fafafa;
    }
    .footer a {
      color: #059669;
      text-decoration: none;
      font-weight: 600;
    }
  </style>
</head>
<body style="background-color:#f4f4f5;">
<!--[if mso]>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding: 30px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#ffffff; border:1px solid #e4e4e7; border-radius:16px; overflow:hidden;">
          <tr>
            <td bgcolor="#065f46" style="background-color:#065f46; padding:32px 32px; text-align:center;">
              <div class="brand-badge">Official Service Notification</div>
              <div><a href="${SITE_URL}" class="logo">YourResearch<span>Writer</span></a></div>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td class="footer">
              © ${new Date().getFullYear()} YourResearchWriter. Plagiarism-Free Academic &amp; Professional Writing.<br>
              Direct Support: <a href="https://wa.me/2348121443666">WhatsApp Customer Desk</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
<!--[if mso]></td></tr></table><![endif]-->
</body>
</html>
`;

/**
 * "Bulletproof" CTA button. Outlook's Word rendering engine ignores padding on
 * <a>, which turned the old .cta-button into a plain text link — so we emit a
 * VML rounded rect for MSO and a normal padded anchor everywhere else.
 */
export const ctaButton = (text: string, url: string) => `
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 22px;">
        <tr><td align="center">
          <!--[if mso]>
          <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:46px;v-text-anchor:middle;width:300px;" arcsize="13%" fillcolor="#059669" stroke="f">
            <w:anchorlock/>
            <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;">${text}</center>
          </v:roundrect>
          <![endif]-->
          <!--[if !mso]><!-->
          <a href="${url}" class="cta-button" style="display:inline-block;background-color:#059669;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:800;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">${text}</a>
          <!--<![endif]-->
        </td></tr>
      </table>`;

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
        <p style="color: #18181b; font-weight: 700; margin-top: 4px; margin-bottom: 12px;">${order.topic}</p>
        <div class="card-label">Project Quote</div>
        <div class="price-tag">${formatNaira(order.financial_quote)}</div>
        <div class="divider"></div>
        ${milestoneBreakdownHtml(order)}
      </div>
      ${ctaButton('Access Client Vault & Track', `${SITE_URL}/dashboard/client`)}
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
        <p style="color: #18181b; font-weight: 700; margin-bottom: 8px;">${order.legal_name} (${order.email})</p>
        <div class="card-label">Topic</div>
        <p style="color: #18181b; font-weight: 700; margin-bottom: 8px;">${order.topic}</p>
        <div class="card-label">Total Value</div>
        <div class="price-tag">${formatNaira(order.financial_quote)}</div>
      </div>
      ${ctaButton('Open Admin Control Panel', `${SITE_URL}/admin`)}
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
      ${ctaButton('Pay Deposit & Unlock', `${SITE_URL}/dashboard/client`)}
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
      ${ctaButton('Track Live Progress', `${SITE_URL}/dashboard/client`)}
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
      ${ctaButton('Pay Balance & Download', `${SITE_URL}/dashboard/client`)}
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
      ${ctaButton('Download Full Files', `${SITE_URL}/dashboard/client`)}
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
      ${ctaButton('View Final Deliverables', `${SITE_URL}/dashboard/client`)}
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
        <p style="color: #18181b; font-weight: 700;">${order.legal_name} (${order.email})</p>
      </div>
      ${ctaButton('Open Admin Dashboard', `${SITE_URL}/admin`)}
    `),
  }),

  adminBalancePaid: (order: OrderEmailData) => ({
    subject: `🔓 ADMIN ALERT: Balance Paid – ${order.order_id}`,
    html: baseLayout(`
      <h2>Final Balance Cleared</h2>
      <p>Final payment cleared for order <strong>${order.order_id}</strong>.</p>
      ${ctaButton('Open Admin Dashboard', `${SITE_URL}/admin`)}
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
      ${ctaButton('View Wallet Balance', `${SITE_URL}/dashboard/client?tab=wallet`)}
    `),
  }),

  milestonePaid: (order: OrderEmailData, milestone: { name: string; amount: number; percentage: number }, allPaid: boolean) => ({
    subject: `💳 Payment Confirmed: ${milestone.name} – ${order.order_id}`,
    html: baseLayout(`
      <h1>Milestone Payment Received</h1>
      <p>Dear ${order.legal_name}, payment for <strong>${milestone.name}</strong> (${formatNaira(milestone.amount)}) has cleared.</p>
      ${ctaButton('View Order', `${SITE_URL}/dashboard/client`)}
    `),
  }),

  milestoneDelivered: (order: OrderEmailData, milestone: { name: string; percentage: number }) => ({
    subject: `📦 Milestone Delivered: ${milestone.name} – ${order.order_id}`,
    html: baseLayout(`
      <h1>Milestone Delivered</h1>
      <p>Dear ${order.legal_name}, the team delivered <strong>${milestone.name}</strong> for ${order.topic}.</p>
      ${ctaButton('Review Progress', `${SITE_URL}/dashboard/client`)}
    `),
  }),

  vaultFileAdded: (order: OrderEmailData, fileName?: string) => ({
    subject: `🔐 New File in Your Vault – ${order.order_id}`,
    html: baseLayout(`
      <h1>New Vault File Added</h1>
      <p>A new deliverable ${fileName ? `(<strong>${fileName}</strong>)` : ''} has been added to your vault.</p>
      ${ctaButton('Open Vault', `${SITE_URL}/dashboard/client?tab=vault`)}
    `),
  }),

  invoiceIssued: (data: { legal_name: string; invoice_number: string; total_amount: number; invoice_url: string; project_title?: string }) => ({
    subject: `🧾 Invoice ${data.invoice_number} from YourResearchWriter`,
    html: baseLayout(`
      <h1>Invoice Ready</h1>
      <p>Dear ${data.legal_name}, invoice <strong>#${data.invoice_number}</strong> (${formatNaira(data.total_amount)}) is ready.</p>
      ${ctaButton('Pay Invoice Online', data.invoice_url)}
    `),
  }),

  magicLinkLogin: (data: { name: string; actionLink: string; title?: string; introHtml?: string; ctaText?: string }) => ({
    subject: data.title || 'Your login link — YourResearchWriter',
    html: baseLayout(`
      <h1>${data.title || 'Access Your Dashboard'}</h1>
      <p>Hi ${data.name},</p>
      ${data.introHtml || '<p>Click the button below to securely log in — no password needed.</p>'}
      ${ctaButton(data.ctaText || 'Log In Now', data.actionLink)}
    `),
  }),

  adSubmittedUser: (data: { title: string; position: string; amount: number }) => ({
    subject: `📢 Ad Campaign Submitted – Pending Review`,
    html: baseLayout(`
      <h1>Ad Campaign Submitted</h1>
      <p>Your advertisement campaign has been received and queued for review.</p>
      <div class="card">
        <div class="card-label">Campaign Title</div>
        <p style="color: #18181b; font-weight: 700; margin-bottom: 8px;">${data.title}</p>
        <div class="card-label">Placement Slot</div>
        <p style="color: #059669; font-weight: 700; text-transform: uppercase; margin-bottom: 8px;">${data.position}</p>
        <div class="card-label">Total Amount</div>
        <div class="price-tag">${formatNaira(data.amount)}</div>
        <div class="badge-status">Awaiting Admin Verification</div>
      </div>
      ${ctaButton('Manage Your Campaigns', `${SITE_URL}/advertise`)}
    `),
  }),

  adApprovedUser: (data: { title: string; position: string }) => ({
    subject: `🚀 Ad Campaign Approved & Live!`,
    html: baseLayout(`
      <h1>Your Ad is Now Live!</h1>
      <p>Great news! Your advertisement campaign has passed review and is now rendering live sitewide.</p>
      <div class="card">
        <div class="card-label">Campaign Title</div>
        <p style="color: #18181b; font-weight: 700; margin-bottom: 8px;">${data.title}</p>
        <div class="card-label">Placement Slot</div>
        <p style="color: #059669; font-weight: 700; text-transform: uppercase; margin-bottom: 12px;">${data.position}</p>
        <div class="badge-status">Active & Live</div>
      </div>
      ${ctaButton('View Live Campaign Stats', `${SITE_URL}/advertise`)}
    `),
  }),

  adRejectedUser: (data: { title: string; reason: string }) => ({
    subject: `❌ Update Regarding Your Ad Campaign`,
    html: baseLayout(`
      <h1>Ad Campaign Review Status</h1>
      <p>Your advertisement submission was declined during our quality review.</p>
      <div class="card">
        <div class="card-label">Campaign Title</div>
        <p style="color: #18181b; font-weight: 700; margin-bottom: 8px;">${data.title}</p>
        <div class="card-label">Rejection Reason</div>
        <p style="color: #dc2626; font-weight: 700; margin-top: 4px;">${data.reason}</p>
      </div>
      ${ctaButton('Return to Ad Portal', `${SITE_URL}/advertise`)}
    `),
  }),

  genericMessage: (data: { name?: string; title: string; body: string; ctaText?: string; ctaUrl?: string }) => ({
    subject: data.title,
    html: baseLayout(`
      <h1>${data.title}</h1>
      ${data.name ? `<p>Hello <strong>${data.name}</strong>,</p>` : ''}
      <div style="margin: 16px 0;">${data.body}</div>
      ${data.ctaText && data.ctaUrl ? ctaButton(data.ctaText, data.ctaUrl) : ''}
    `),
  }),
};

export function emailShell(bodyHtml: string, ctaText?: string, ctaUrl?: string): string {
  return baseLayout(`
    ${bodyHtml}
    ${ctaText && ctaUrl ? ctaButton(ctaText, ctaUrl) : ''}
  `);
}