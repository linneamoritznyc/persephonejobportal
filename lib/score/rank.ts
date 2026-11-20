/** Final rank (03 section 4 + 8): 0.5 vetlanda + 0.5 crosstrees CI low + gift bonus + big-company bonus. */
export const RARE_GIFTS = ["interpretation", "vision", "craftsmanship", "stewardship"];

export function finalRank(o: {
  vetlanda: number;
  crosstreesCiLow: number | null;
  giftFit?: number | null;
  primaryGift?: string | null;
  isBig?: boolean;
  deadline?: string | null;
}): number {
  let r = 0.5 * o.vetlanda + 0.5 * (o.crosstreesCiLow ?? o.vetlanda * 0.6);
  if (o.giftFit != null) r += Math.round(o.giftFit * 15);
  if (o.primaryGift && RARE_GIFTS.includes(o.primaryGift)) r += 5;
  if (o.isBig) r += 10;
  if (o.deadline) {
    const days = (new Date(o.deadline).getTime() - Date.now()) / 86_400_000;
    if (days < -1) r -= 100;
  }
  return Math.round(r * 10) / 10;
}

export function daysLeft(deadline?: string | null): number | null {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline + "T23:59:59").getTime() - Date.now()) / 86_400_000);
}
