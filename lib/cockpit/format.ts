export const FAMILY: Record<string, string> = {
  "1": "AI automation",
  "2": "Martech",
  "3": "AI startup, customer-facing",
  "4": "Creative technologist",
  "5": "Trust & Safety",
  "6": "AI consulting",
};

export function sek(min?: number | null, max?: number | null) {
  if (!min && !max) return "";
  const k = (n: number) => Math.round(n / 1000);
  return min && max ? `${k(min)}–${k(max)}k SEK` : `${k((min || max)!)}k SEK`;
}

export function days(d?: string | null) {
  if (!d) return null;
  return Math.ceil((new Date(d + "T23:59:59").getTime() - Date.now()) / 86_400_000);
}

export function ago(iso?: string | null) {
  if (!iso) return "";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? "today" : d === 1 ? "1 day" : `${d} days`;
}
