export function buildOrderConfirmationEmail(order: any) {
  const total = order.financial_quote;
  const deposit = total * 0.6;
  const balance = total * 0.4;

  return `
    <div style="font-family: 'Inter', sans-serif; max-width: 560px; margin: 0 auto; background: #050505; border-radius: 32px; border: 1px solid #1DB954;">
      <div style="background: linear-gradient(135deg,#0a2e1a,#050505); padding: 28px; text-align: center;">
        <div style="font-size: 28px; font-weight: 800; background: linear-gradient(135deg,#1DB954,#10b981); -webkit-background-clip: text; background-clip: text; color: transparent;">YourWriterOfficial</div>
      </div>
      <div style="padding: 28px;">
        <div style="background: #0a0a0a; border: 1px solid #1DB954; border-radius: 16px; padding: 16px; text-align: center; margin: 20px 0;">
          <div style="font-size: 10px; color: #1DB954;">ORDER ID</div>
          <div style="font-size: 22px; font-weight: 800; color: #fff;">${order.order_id}</div>
        </div>
        <div style="margin-bottom: 24px;">
          <div style="font-size: 11px; font-weight: 700; color: #1DB954;">📋 Order Summary</div>
          <table style="width:100%; border-collapse:collapse; margin-top:12px;">
            <tr><td style="padding:8px 0; color:#aaa;">Client</td><td style="text-align:right;">${order.legal_name}</td></tr>
            <tr><td style="padding:8px 0; color:#aaa;">Topic</td><td style="text-align:right;">${order.topic}</td></tr>
            <tr><td style="padding:8px 0; color:#aaa;">Words</td><td style="text-align:right;">${order.word_count}</td></tr>
            <tr><td style="padding:8px 0; color:#aaa;">Deadline</td><td style="text-align:right;">${order.deadline}</td></tr>
          </table>
        </div>
        <div style="background: #0a0a0a; border-radius: 24px; padding: 24px; text-align: center;">
          <div style="font-size: 38px; font-weight: 800; margin: 16px 0 8px; color: #fff;">₦${deposit.toLocaleString()}</div>
          <div style="font-size: 12px; color: #aaa;">60% Deposit (Pending)</div>
          <div style="width: 80px; height: 1px; background: #2a2a2a; margin: 18px auto;"></div>
          <div style="font-size: 22px; font-weight: 600; color: #fff;">₦${balance.toLocaleString()}</div>
          <div style="font-size: 12px; color: #aaa;">40% Balance (Pending)</div>
        </div>
        <div style="font-size: 10px; color: #444; text-align: center; margin-top: 28px;">You will receive a quote and payment instructions within 24 hours.</div>
      </div>
    </div>
  `;
}