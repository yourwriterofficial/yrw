import { NextResponse } from 'next/server';

/**
 * Paystack Webhook Handler (Decommissioned)
 *
 * Payment processing has transitioned entirely to direct manual bank transfers
 * with admin verification. This endpoint returns 200 OK to acknowledge any
 * historical or pending webhook retries from Paystack without processing them.
 */
export async function POST(request: Request) {
  try {
    return NextResponse.json(
      {
        status: 'success',
        message: 'Paystack gateway disabled. Platform has transitioned to manual bank transfers.',
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}