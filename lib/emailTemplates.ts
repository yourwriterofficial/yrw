// lib/emailTemplates.ts

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
};

const formatNaira = (amount: number) =>
  `₦${amount.toLocaleString('en-NG')}`;

// Base HTML template with responsive design
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
      background-color: #050505;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.5;
      padding: 20px;
    }
    .container {
      max-width: 560px;
      margin: 0 auto;
      background: #0a0a0a;
      border-radius: 32px;
      border: 1px solid #1DB954;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .header {
      background: linear-gradient(135deg, #0a2e1a, #050505);
      padding: 32px 28px;
      text-align: center;
      border-bottom: 1px solid #1DB954;
    }
    .logo {
      font-size: 28px;
      font-weight: 800;
      background: linear-gradient(135deg, #1DB954, #10b981);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      letter-spacing: -0.5px;
    }
    .tagline {
      font-size: 10px;
      color: #1DB954;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-top: 8px;
    }
    .content {
      padding: 32px 28px;
      color: #e5e5e5;
    }
    h1, h2 {
      font-weight: 800;
      margin-bottom: 16px;
    }
    h1 { font-size: 24px; color: white; }
    h2 { font-size: 18px; color: #1DB954; }
    .order-card {
      background: #050505;
      border: 1px solid #1DB954;
      border-radius: 20px;
      padding: 20px;
      margin: 24px 0;
      text-align: center;
    }
    .order-id {
      font-size: 20px;
      font-weight: 800;
      color: white;
      letter-spacing: 1px;
      font-family: monospace;
    }
    .label {
      font-size: 10px;
      color: #1DB954;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }
    .price {
      font-size: 36px;
      font-weight: 800;
      color: #1DB954;
      margin: 16px 0;
    }
    .amount {
      font-size: 28px;
      font-weight: 800;
      color: #1DB954;
    }
    .button {
      display: inline-block;
      background: #1DB954;
      color: #000 !important;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 40px;
      font-weight: 800;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 20px;
      transition: background 0.2s;
    }
    .button:hover {
      background: #17a44b;
    }
    .divider {
      height: 1px;
      background: #222;
      margin: 24px 0;
    }
    .footer {
      padding: 20px 28px;
      text-align: center;
      font-size: 11px;
      color: #555;
      border-top: 1px solid #222;
      background: #050505;
    }
    .status-badge {
      display: inline-block;
      background: #1DB95420;
      border: 1px solid #1DB954;
      border-radius: 50px;
      padding: 4px 12px;
      font-size: 10px;
      font-weight: 800;
      color: #1DB954;
      text-transform: uppercase;
    }
    @media (max-width: 600px) {
      .content, .header, .footer { padding-left: 20px; padding-right: 20px; }
      .price { font-size: 28px; }
      .amount { font-size: 22px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">YourResearchWriter</div>
      <div class="tagline">Academic & Professional Excellence</div>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} YourResearchWriter – All documents encrypted. <br>
      Need help? <a href="https://wa.me/2348121443666" style="color: #1DB954; text-decoration: none;">Contact Support</a>
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
      <h1>Thank you, ${order.legal_name}!</h1>
      <p>We have securely received your request. Our team will review your brief and send a formal quote within 24 hours.</p>
      <div class="order-card">
        <div class="label">Order ID</div>
        <div class="order-id">${order.order_id}</div>
        <div class="divider"></div>
        <div class="label">Project Topic</div>
        <div style="margin: 8px 0 16px;">${order.topic}</div>
        <div class="label">Estimated Quote</div>
        <div class="price">${formatNaira(order.financial_quote)}</div>
        <div style="font-size: 12px;">60% Deposit: ${formatNaira(order.financial_quote * 0.6)}<br>40% Balance: ${formatNaira(order.financial_quote * 0.4)}</div>
      </div>
      <p>You can track progress and make payments from your dashboard.</p>
      <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/client" class="button">Go to Dashboard</a>
    `),
  }),

  // Admin: New order notification
  adminNewOrder: (order: OrderEmailData) => ({
    subject: `🔔 NEW ORDER: ${order.order_id}`,
    html: baseLayout(`
      <h2>New Order Alert</h2>
      <div class="order-card">
        <div><span class="label">Order ID</span><br><strong>${order.order_id}</strong></div>
        <div style="margin-top: 12px;"><span class="label">Client</span><br>${order.legal_name} (${order.email})</div>
        <div style="margin-top: 12px;"><span class="label">Topic</span><br>${order.topic}</div>
        <div style="margin-top: 12px;"><span class="label">Quote</span><br>${formatNaira(order.financial_quote)}</div>
        <div style="margin-top: 12px;"><span class="label">Deadline</span><br>${order.deadline || 'Not set'}</div>
      </div>
      <a href="${process.env.NEXT_PUBLIC_BASE_URL}/admin" class="button">Review in Admin</a>
    `),
  }),

  // Quote Sent (when admin sets status to "Quote Sent")
  quoteSent: (order: OrderEmailData) => ({
    subject: `📄 Your Quote is Ready – ${order.order_id}`,
    html: baseLayout(`
      <h1>Your Quote is Ready</h1>
      <p>Dear ${order.legal_name},</p>
      <p>We have reviewed your project brief and finalized the quote. Please find the details below:</p>
      <div class="order-card">
        <div class="label">Total Project Cost</div>
        <div class="price">${formatNaira(order.financial_quote)}</div>
        <div class="divider"></div>
        <div><span class="label">To begin work, pay 60% deposit</span><br><span class="amount">${formatNaira(order.financial_quote * 0.6)}</span></div>
        <div style="margin-top: 12px;"><span class="label">Balance due on completion</span><br><span class="amount">${formatNaira(order.financial_quote * 0.4)}</span></div>
      </div>
      <p>Click the button below to log in and make the deposit. Your project will start immediately after confirmation.</p>
      <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/client" class="button">Pay Deposit</a>
    `),
  }),

  // Deposit Paid (60%) – triggered by webhook
  depositPaid: (order: OrderEmailData) => ({
    subject: `💳 Deposit Confirmed – Work Started (${order.order_id})`,
    html: baseLayout(`
      <h1>Payment Received!</h1>
      <p>Dear ${order.legal_name},</p>
      <p>Your 60% deposit of <strong>${formatNaira(order.financial_quote * 0.6)}</strong> has been cleared. The research phase is now active.</p>
      <div class="order-card">
        <div class="label">Order ID</div>
        <div class="order-id">${order.order_id}</div>
        <div class="divider"></div>
        <div class="status-badge">Synthesis in progress</div>
        <p style="margin-top: 16px;">Our experts have begun working on your topic: <strong>${order.topic}</strong></p>
      </div>
      <p>You can track progress in your dashboard. We will notify you when the draft is ready for review.</p>
      <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/client" class="button">Track Progress</a>
    `),
  }),

  // Work Submitted (when admin uploads draft)
  workSubmitted: (order: OrderEmailData) => ({
    subject: `📝 Draft Ready for Review – ${order.order_id}`,
    html: baseLayout(`
      <h1>Your Draft is Ready</h1>
      <p>Hello ${order.legal_name},</p>
      <p>The first draft of your project has been completed and uploaded to the secure vault. Please log in to review it.</p>
      <div class="order-card">
        <div class="label">To download the file, pay the remaining 40% balance</div>
        <div class="price">${formatNaira(order.financial_quote * 0.4)}</div>
        <div class="status-badge">Awaiting final payment</div>
      </div>
      <p>Once the balance is cleared, you will be able to download the complete document instantly.</p>
      <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/client" class="button">Pay Balance & Download</a>
    `),
  }),

  // Balance Paid (40%) – triggered by webhook
  balancePaid: (order: OrderEmailData) => ({
    subject: `🔓 Final Payment Cleared – Download Files (${order.order_id})`,
    html: baseLayout(`
      <h1>Order Completed!</h1>
      <p>Dear ${order.legal_name},</p>
      <p>Thank you for the final payment of <strong>${formatNaira(order.financial_quote * 0.4)}</strong>. Your complete document is now unlocked.</p>
      <div class="order-card">
        <div class="label">Order ID</div>
        <div class="order-id">${order.order_id}</div>
        <div class="divider"></div>
        <div class="status-badge">Contract fulfilled</div>
        <p style="margin-top: 16px;">You have <strong>3 days</strong> to request any revisions (comments in Word document). After that, the contract is finalized.</p>
      </div>
      <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/client" class="button">Download Files</a>
    `),
  }),

  // Order Completed (manual admin action)
  orderCompleted: (order: OrderEmailData) => ({
    subject: `🎉 Order ${order.order_id} Completed`,
    html: baseLayout(`
      <h1>Project Successfully Completed</h1>
      <p>Dear ${order.legal_name},</p>
      <p>We have marked your order as complete. Thank you for choosing YourResearchWriter.</p>
      <div class="order-card">
        <div class="label">Your final files remain in the secure vault for 30 days.</div>
        <div class="status-badge" style="background: #10b98120; border-color: #10b981;">Completed</div>
      </div>
      <p>If you need any further assistance, please contact support.</p>
      <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/client" class="button">View Order</a>
    `),
  }),

  // Admin Notifications
  adminDepositPaid: (order: OrderEmailData) => ({
    subject: `💳 ADMIN ALERT: Deposit Paid – ${order.order_id}`,
    html: baseLayout(`
      <h2>Deposit Confirmed</h2>
      <p>A deposit of <strong>${formatNaira(order.financial_quote * 0.6)}</strong> (60%) has been cleared for order <strong>${order.order_id}</strong>.</p>
      <div class="order-card">
        <div><span class="label">Order ID</span><br><strong>${order.order_id}</strong></div>
        <div style="margin-top: 12px;"><span class="label">Client</span><br>${order.legal_name} (${order.email})</div>
        <div style="margin-top: 12px;"><span class="label">Topic</span><br>${order.topic}</div>
        <div style="margin-top: 12px;"><span class="label">Total Cost</span><br>${formatNaira(order.financial_quote)}</div>
      </div>
      <a href="${process.env.NEXT_PUBLIC_BASE_URL}/admin" class="button">Go to Admin Dashboard</a>
    `),
  }),

  adminBalancePaid: (order: OrderEmailData) => ({
    subject: `🔓 ADMIN ALERT: Balance Paid – ${order.order_id}`,
    html: baseLayout(`
      <h2>Final Balance Paid</h2>
      <p>The final balance of <strong>${formatNaira(order.financial_quote * 0.4)}</strong> (40%) has been cleared for order <strong>${order.order_id}</strong>.</p>
      <div class="order-card">
        <div><span class="label">Order ID</span><br><strong>${order.order_id}</strong></div>
        <div style="margin-top: 12px;"><span class="label">Client</span><br>${order.legal_name} (${order.email})</div>
        <div style="margin-top: 12px;"><span class="label">Topic</span><br>${order.topic}</div>
      </div>
      <a href="${process.env.NEXT_PUBLIC_BASE_URL}/admin" class="button">Go to Admin Dashboard</a>
    `),
  }),

  adminWalletTopup: (data: { email: string; full_name: string; amount: number; reference: string }) => ({
    subject: `💰 ADMIN ALERT: Wallet Funded – ₦${data.amount.toLocaleString('en-NG')}`,
    html: baseLayout(`
      <h2>Wallet Deposit Completed</h2>
      <p>A client has topped up their wallet balance.</p>
      <div class="order-card">
        <div><span class="label">Client</span><br><strong>${data.full_name} (${data.email})</strong></div>
        <div style="margin-top: 12px;"><span class="label">Amount</span><br>₦${data.amount.toLocaleString('en-NG')}</div>
        <div style="margin-top: 12px;"><span class="label">Reference</span><br>${data.reference}</div>
      </div>
      <a href="${process.env.NEXT_PUBLIC_BASE_URL}/admin" class="button">Go to Admin Dashboard</a>
    `),
  }),
};