import type { Provider } from '../pricing';
import type { ProviderState } from './types';

export interface WebhookDeps {
  claim(provider: Provider, eventId: string): Promise<'claimed' | 'duplicate' | 'in_flight'>;
  finish(provider: Provider, eventId: string, status: 'processed' | 'failed' | 'ignored'): Promise<void>;
  fetchState(provider: Provider, subscriptionId: string): Promise<ProviderState>;
  /** Updates the stored subscription. Returns false when we never created that subscription (so it is ignored). */
  applyState(provider: Provider, subscriptionId: string, state: ProviderState): Promise<boolean>;
}
export type WebhookResult = 'processed' | 'duplicate' | 'ignored' | 'in_flight';

/**
 * The payload only tells us WHICH subscription changed. Its state is re-read from the provider's API, so a spoofed,
 * replayed or out-of-order event can never unlock or revoke Pro on its own. A verified signature is still required upstream.
 */
export async function processWebhook(deps: WebhookDeps, provider: Provider, eventId: string, subscriptionId: string | null): Promise<WebhookResult> {
  const claim = await deps.claim(provider, eventId);
  if (claim === 'duplicate') return 'duplicate';
  if (claim === 'in_flight') return 'in_flight';
  try {
    if (!subscriptionId) { await deps.finish(provider, eventId, 'ignored'); return 'ignored'; }
    const state = await deps.fetchState(provider, subscriptionId);
    const known = await deps.applyState(provider, subscriptionId, state);
    await deps.finish(provider, eventId, known ? 'processed' : 'ignored');
    return known ? 'processed' : 'ignored';
  } catch (e) {
    await deps.finish(provider, eventId, 'failed').catch(() => {});
    throw e; // route returns 500 so the provider retries; claim() lets a failed event be reclaimed
  }
}
