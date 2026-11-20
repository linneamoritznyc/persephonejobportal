/**
 * Verifies a call comes from Vercel Cron (Authorization: Bearer CRON_SECRET).
 * From vetlandajobb lib/cron.ts, but fails closed when the secret is missing.
 */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** True when it is the 06:xx hour in Stockholm (cron fires at 04:30 and 05:30 UTC to cover DST). */
export function isStockholmRunHour(now = new Date()): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Stockholm", hour: "2-digit", hour12: false }).format(now)
  );
  return hour === 6;
}
