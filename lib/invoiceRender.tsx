import { ImageResponse } from 'next/og';
import { PDFDocument } from 'pdf-lib';

export type InvoiceRenderMilestone = { name: string; percentage: number; amount: number; paid: boolean };

export type InvoiceRenderData = {
  invoice_number: string;
  client_name: string;
  email?: string | null;
  company_name?: string | null;
  project_title?: string | null;
  total_amount: number;
  currency?: string | null;
  milestones?: InvoiceRenderMilestone[];
  created_at: string;
  status: string;
};

const WIDTH = 960;
const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`;

function buildElement(data: InvoiceRenderData) {
  const milestones = data.milestones || [];
  const allPaid = data.status === 'PAID';
  const currency = data.currency || '₦';

  return (
    <div
      style={{
        width: WIDTH,
        display: 'flex',
        flexDirection: 'column',
        background: '#0a0a0a',
        color: '#e5e5e5',
        fontFamily: 'sans-serif',
        border: '2px solid #1DB954',
        borderRadius: 24,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          padding: '36px 44px',
          background: 'linear-gradient(135deg, #0a2e1a, #050505)',
          borderBottom: '1px solid #1DB954',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, color: '#1DB954' }}>YourResearchWriter</div>
          <div style={{ display: 'flex', fontSize: 13, color: '#888', marginTop: 6 }}>
            {allPaid ? 'Official Receipt' : 'Invoice'} · {new Date(data.created_at).toLocaleDateString()}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', fontSize: 14, color: '#888' }}>Invoice</div>
          <div style={{ display: 'flex', fontSize: 22, fontWeight: 800, color: 'white', fontFamily: 'monospace' }}>
            #{data.invoice_number}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flexDirection: 'column', padding: '32px 44px' }}>
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 12, color: '#1DB954', textTransform: 'uppercase', fontWeight: 700 }}>Billed To</div>
            <div style={{ display: 'flex', fontSize: 20, fontWeight: 800, color: 'white', marginTop: 6 }}>{data.client_name}</div>
            {data.company_name ? <div style={{ display: 'flex', fontSize: 13, color: '#aaa', marginTop: 2 }}>{data.company_name}</div> : null}
            {data.email ? <div style={{ display: 'flex', fontSize: 13, color: '#aaa', marginTop: 2 }}>{data.email}</div> : null}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', fontSize: 12, color: '#1DB954', textTransform: 'uppercase', fontWeight: 700 }}>Total</div>
            <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, color: '#1DB954', marginTop: 4 }}>
              {currency}{Number(data.total_amount).toLocaleString('en-NG')}
            </div>
          </div>
        </div>

        {data.project_title ? (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 24, padding: 16, background: '#050505', border: '1px solid #222', borderRadius: 14 }}>
            <div style={{ display: 'flex', fontSize: 11, color: '#1DB954', textTransform: 'uppercase', fontWeight: 700 }}>Project</div>
            <div style={{ display: 'flex', fontSize: 15, color: 'white', marginTop: 4 }}>{data.project_title}</div>
          </div>
        ) : null}

        {milestones.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 24 }}>
            <div style={{ display: 'flex', fontSize: 12, color: '#1DB954', textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>
              Payment Milestones
            </div>
            {milestones.map((m, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 16px',
                  marginBottom: 8,
                  background: '#050505',
                  border: '1px solid #222',
                  borderRadius: 12,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', fontSize: 14, fontWeight: 700, color: 'white' }}>{m.name} ({m.percentage}%)</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                  <div style={{ display: 'flex', fontSize: 15, fontWeight: 800, color: 'white', marginRight: 12, fontFamily: 'monospace' }}>
                    {naira(m.amount)}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      fontSize: 10,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      padding: '4px 10px',
                      borderRadius: 20,
                      color: m.paid ? '#1DB954' : '#f59e0b',
                      background: m.paid ? 'rgba(29,185,84,0.12)' : 'rgba(245,158,11,0.12)',
                    }}
                  >
                    {m.paid ? 'Paid' : 'Unpaid'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', padding: '18px 44px', borderTop: '1px solid #222', fontSize: 11, color: '#555' }}>
        © {new Date().getFullYear()} YourResearchWriter — All documents encrypted.
      </div>
    </div>
  );
}

export async function renderInvoicePng(data: InvoiceRenderData): Promise<Buffer> {
  const milestoneCount = (data.milestones || []).length;
  const height = 400 + milestoneCount * 62 + (data.project_title ? 90 : 0);
  const image = new ImageResponse(buildElement(data), { width: WIDTH, height });
  const arrayBuffer = await image.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function renderInvoicePdf(data: InvoiceRenderData): Promise<Buffer> {
  const pngBuffer = await renderInvoicePng(data);
  const pdfDoc = await PDFDocument.create();
  const pngImage = await pdfDoc.embedPng(pngBuffer);
  const { width, height } = pngImage;
  const page = pdfDoc.addPage([width, height]);
  page.drawImage(pngImage, { x: 0, y: 0, width, height });
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
