export type SubStatus = 'pending' | 'active' | 'past_due' | 'cancelled' | 'expired';
/** Authoritative subscription state fetched from the provider's API (never taken from the browser). */
export interface ProviderState { status: SubStatus; currentPeriodEnd: string | null }
