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

const baseStyle = `
  <style>
    body { font-family: 'Inter', -apple-system, sans-serif; background-color: #050505; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 0 auto; background: #0a0a0a; border-radius: 32px; border: 1px solid #1DB954; overflow: hidden; }
    .header { background: linear-gradient(135deg, #0a2e1a, #050505); padding: 28px; text-align: center; border-bottom: 1px solid #1DB954; }
    .logo { font-size: 24px; font-weight: 800; background: linear-gradient(135deg, #1DB954, #10b981); -webkit-background-clip: text; background-clip: text; color: transparent; }
    .content { padding: 28px; color: #e5e5e5; }
    .order-card { background: #050505; border: 1px solid #1DB954; border-radius: 16px; padding: 16px; margin: 20px 0; text-align: center; }
    .order-id { font-size: 22px; font-weight: 800; color: #fff; letter-spacing: 1px; }
    .label { font-size: 10px; color: #1DB954; text-transform: uppercase; font-weight: 700; }
    .price { font-size: 36px; font-weight: 800; color: #1DB954; margin: 16px 0; }
    .button { display: inline-block; background: #1DB954; color: #000; text-decoration: none; padding: 12px 24px; border-radius: 40px; font-weight: 800; font-size: 12px; margin-top: 20px; }
    .footer { padding: 20px; text-align: center; font-size: 10px; color: #444; border-top: 1px solid #222; }
  </style>
`;

export const emailTemplates = {
  // Immediately after order creation (to client)
  clientOrderConfirmation: (order: OrderEmailData) => ({
    subject: `Order Received: ${order.order_id}`,
    html: `<!DOCTYPE html><html><head>${baseStyle}</head><body><div class="container">
      <div class="header"><div class="logo">YourResearchWriter</div></div>
      <div class="content">
        <h2 style="margin-bottom: 8px;">Thank you, ${order.legal_name}</h2>
        <p>We have securely received your request. Your order ID is <strong>${order.order_id}</strong>.</p>
        <div class="order-card">
          <div class="label">Project Topic</div>
          <div style="margin-bottom: 12px;">${order.topic}</div>
          <div class="label">Estimated Quote</div>
          <div class="price">${formatNaira(order.financial_quote)}</div>
          <div style="font-size: 12px;">60% Deposit: ${formatNaira(order.financial_quote * 0.6)}<br>40% Balance: ${formatNaira(order.financial_quote * 0.4)}</div>
        </div>
        <p>Our team will review your requirements and send a formal quote within 24 hours. You will be able to make the deposit and track progress from your dashboard.</p>
        <a href="${process.env.NEXT_PUBLIC_BASE_URL}/login" class="button">Access Dashboard</a>
      </div>
      <div class="footer">© ${new Date().getFullYear()} YourResearchWriter – All documents are encrypted.</div>
    </div></body></html>`,
  }),

  // To admin (immediately)
  adminNewOrder: (order: OrderEmailData) => ({
    subject: `🔔 NEW ORDER: ${order.order_id}`,
    html: `<!DOCTYPE html><html><head>${baseStyle}</head><body><div class="container">
      <div class="header"><div class="logo">Admin Alert</div></div>
      <div class="content">
        <h2 style="color: #1DB954;">New Order Submitted</h2>
        <div class="order-card">
          <div><strong>Order ID:</strong> ${order.order_id}</div>
          <div><strong>Client:</strong> ${order.legal_name} (${order.email})</div>
          <div><strong>Topic:</strong> ${order.topic}</div>
          <div><strong>Quote:</strong> ${formatNaira(order.financial_quote)}</div>
          <div><strong>Tier:</strong> ${order.service_tier || 'Custom'}</div>
          <div><strong>Deadline:</strong> ${order.deadline || 'Not set'}</div>
        </div>
        <p>Log into the admin panel to review the brief and send a formal quote.</p>
        <a href="${process.env.NEXT_PUBLIC_BASE_URL}/admin" class="button">Go to Admin</a>
      </div>
      <div class="footer">Secure system notification</div>
    </div></body></html>`,
  }),

  // When admin sends quote (status = 'Quote Sent')
  quoteApproved: (order: OrderEmailData, depositAmount: number) => ({
    subject: `Quote Approved – Deposit Required (${order.order_id})`,
    html: `<!DOCTYPE html><html><head>${baseStyle}</head><body><div class="container">
      <div class="header"><div class="logo">YourResearchWriter</div></div>
      <div class="content">
        <h2>Your Quote is Ready</h2>
        <p>Dear ${order.legal_name},</p>
        <p>We have finalized your project quote based on the provided brief.</p>
        <div class="order-card">
          <div class="price">${formatNaira(order.financial_quote)}</div>
          <div class="label">Total Project Cost</div>
          <hr style="margin: 16px 0; border-color: #222;">
          <div>To begin research, please pay the 60% deposit: <strong>${formatNaira(depositAmount)}</strong></div>
        </div>
        <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/client" class="button">Pay Deposit Now</a>
      </div>
      <div class="footer">Payment is processed securely via Flutterwave.</div>
    </div></body></html>`,
  }),

  // Deposit paid (sent via webhook)
  depositPaid: (order: OrderEmailData) => ({
    subject: `Deposit Confirmed – Work Started (${order.order_id})`,
    html: `<!DOCTYPE html><html><head>${baseStyle}</head><body><div class="container">
      <div class="header"><div class="logo">YourResearchWriter</div></div>
      <div class="content">
        <h2>Payment Received</h2>
        <p>Hello ${order.legal_name},</p>
        <p>Your 60% deposit of <strong>${formatNaira(order.financial_quote * 0.6)}</strong> has been cleared. The research phase is now active.</p>
        <p>You can track progress in your dashboard. We'll notify you when the draft is ready.</p>
        <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/client" class="button">Track Progress</a>
      </div>
      <div class="footer">Synthesis in progress</div>
    </div></body></html>`,
  }),

  // Balance paid & vault unlocked (sent via webhook)
  balancePaid: (order: OrderEmailData) => ({
    subject: `Final Payment Cleared – Download Files (${order.order_id})`,
    html: `<!DOCTYPE html><html><head>${baseStyle}</head><body><div class="container">
      <div class="header"><div class="logo">YourResearchWriter</div></div>
      <div class="content">
        <h2>Delivery Vault Unlocked</h2>
        <p>Dear ${order.legal_name},</p>
        <p>Thank you for the final 40% balance. Your complete document is now available for secure download.</p>
        <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/client" class="button">Download Files</a>
      </div>
      <div class="footer">This concludes your contract. Feedback window: 3 days.</div>
    </div></body></html>`,
  }),
};