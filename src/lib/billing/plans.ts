export interface PlanStore { get(currency: string, amountMinor: number): Promise<string | null>; put(currency: string, amountMinor: number, planId: string): Promise<void> }
/** Returns the stored Razorpay plan for this currency + price, creating (and remembering) it on first use. A price change creates a new plan automatically. */
export async function resolvePlanId(currency: string, amountMajor: number, store: PlanStore, create: (currency: string, amountMajor: number) => Promise<{ id: string }>): Promise<string> {
  const minor = Math.round(amountMajor * 100);
  const existing = await store.get(currency, minor); if (existing) return existing;
  const { id } = await create(currency, amountMajor);
  await store.put(currency, minor, id); // ignores a concurrent duplicate insert
  return (await store.get(currency, minor)) ?? id;
}
