/**
 * Pure credit-redemption rules. No database, no network, no `Date.now()` —
 * "now" is always passed in so tests can pin time exactly.
 */

export type CreditRecord = {
  id: string;
  account_id?: string;
  expires_at: string;
  consumed_lesson_id?: string | null;
  refunded_at?: string | null;
};

/** A credit is usable when it is unspent, un-refunded, and not yet expired. */
export function isCreditUsable(credit: CreditRecord, now: Date): boolean {
  if (credit.consumed_lesson_id) return false;
  if (credit.refunded_at) return false;
  const expires = new Date(credit.expires_at).getTime();
  if (Number.isNaN(expires)) return false;
  // Expiry is exclusive: a credit expiring exactly "now" is already gone.
  return expires > now.getTime();
}

/**
 * Choose which credit to burn for a booking: the usable credit that expires
 * soonest, so credits are never wasted. Returns null when the account must pay.
 * When `accountId` is given, credits from other accounts are ignored.
 */
export function pickCreditToConsume(
  credits: CreditRecord[],
  now: Date,
  accountId?: string,
): CreditRecord | null {
  const usable = credits
    .filter((c) => (accountId ? c.account_id === accountId : true))
    .filter((c) => isCreditUsable(c, now))
    .sort((a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime());
  return usable[0] ?? null;
}
