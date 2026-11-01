import { createAdminClient } from '../supabase/admin';
import type { Provider } from '../pricing';
import type { WebhookDeps } from './webhook';
import { createRazorpayPlan, fetchRazorpayState } from './razorpay';
import { resolvePlanId, type PlanStore } from './plans';

/** Production dependencies for processWebhook, backed by the service-role client (server only). */
export function productionDeps(): WebhookDeps {
  const db = createAdminClient();
  return {
    async claim(provider, eventId) {
      const { data, error } = await db.rpc('claim_webhook_event', { p_provider: provider, p_event_id: eventId });
      if (error) throw new Error('claim failed');
      return data as 'claimed' | 'duplicate' | 'in_flight';
    },
    async finish(provider, eventId, status) { await db.rpc('finish_webhook_event', { p_provider: provider, p_event_id: eventId, p_status: status }); },
    fetchState: (_p, id) => fetchRazorpayState(id),
    async applyState(provider: Provider, id, state) {
      const patch: Record<string, unknown> = { status: state.status };
      if (state.currentPeriodEnd) patch.current_period_end = state.currentPeriodEnd;
      const { data, error } = await db.from('subscriptions').update(patch).eq('provider', provider).eq('provider_subscription_id', id).select('id');
      if (error) throw new Error('apply failed');
      return (data?.length ?? 0) > 0;
    },
  };
}

function planStore(): PlanStore {
  const db = createAdminClient();
  return {
    async get(currency, amountMinor) { const { data } = await db.from('razorpay_plans').select('plan_id').eq('currency', currency).eq('amount_minor', amountMinor).maybeSingle(); return (data?.plan_id as string | undefined) ?? null; },
    async put(currency, amountMinor, planId) { await db.from('razorpay_plans').upsert({ currency, amount_minor: amountMinor, plan_id: planId }, { onConflict: 'currency,amount_minor', ignoreDuplicates: true }); },
  };
}
/** The monthly Razorpay plan for this currency and price. Created automatically the first time it is needed. */
export const ensureRazorpayPlan = (currency: string, amountMajor: number) => resolvePlanId(currency, amountMajor, planStore(), createRazorpayPlan);