import { NextResponse } from 'next/server';
import { extractRazorpaySubscriptionId, verifyWebhookSignature } from '@/lib/billing/razorpay';
import { processWebhook } from '@/lib/billing/webhook';
import { productionDeps } from '@/lib/billing/service';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const raw = await req.text(); // signature is computed over the raw body
  if (!verifyWebhookSignature(raw, req.headers.get('x-razorpay-signature'), process.env.RAZORPAY_WEBHOOK_SECRET)) return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  const eventId = req.headers.get('x-razorpay-event-id');
  if (!eventId) return NextResponse.json({ error: 'missing event id' }, { status: 400 });
  let event: unknown; try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }
  try {
    const result = await processWebhook(productionDeps(), 'razorpay', eventId, extractRazorpaySubscriptionId(event));
    return NextResponse.json({ result }, { status: result === 'in_flight' ? 409 : 200 });
  } catch { return NextResponse.json({ error: 'processing failed' }, { status: 500 }); }
}
