/** Company career feeds: Ashby, Lever, Greenhouse and Teamtailor RSS. */
import type { RawJob } from "../../dedupe";
import { NON_PERMANENT } from "../../guard";

const UA = { "user-agent": "Persephone/1.0 (personal job search)", accept: "application/json" };

function stripHtml(html: string): string {
  return (html || "")
    .replace(/<\s*(br|\/p|\/li|\/h\d)\s*\/?>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

const SWEDEN = /stockholm|sweden|sverige|remote|europe|emea|nordic/i;

export interface CompanyFeed {
  name: string;
  ats: string;
  feed_url: string;
}

export async function fetchCompanyFeed(c: CompanyFeed): Promise<RawJob[]> {
  const res = await fetch(c.feed_url, { headers: UA, cache: "no-store" });
  if (!res.ok) throw new Error(`${c.name}: HTTP ${res.status}`);
  const src = `company:${c.name}`;
  if (c.ats === "ashby") {
    const data = await res.json();
    return (data.jobs ?? [])
      .filter((j: any) => SWEDEN.test(`${j.location} ${(j.secondaryLocations ?? []).map((l: any) => l.location).join(" ")} ${j.isRemote ? "remote" : ""}`))
      .map((j: any) => ({
        source: src,
        external_id: String(j.id),
        title: j.title,
        company_name: c.name,
        url: j.jobUrl ?? j.applyUrl,
        location: j.location ?? "",
        remote: Boolean(j.isRemote) || /remote/i.test(j.workplaceType ?? ""),
        language: "en",
        description: j.descriptionPlain ?? stripHtml(j.descriptionHtml ?? ""),
        employment_type: j.employmentType === "FullTime" ? "Permanent, full-time" : String(j.employmentType ?? ""),
        raw: { department: j.department, team: j.team, published: j.publishedAt },
      }))
      .filter((j: any) => /full-time/i.test(j.employment_type));
  }
  if (c.ats === "lever") {
    const data = await res.json();
    return (data ?? [])
      .filter((j: any) => SWEDEN.test(`${j.categories?.location ?? ""} ${(j.categories?.allLocations ?? []).join(" ")} ${j.workplaceType ?? ""}`))
      .map((j: any) => ({
        source: src,
        external_id: String(j.id),
        title: j.text,
        company_name: c.name,
        url: j.hostedUrl,
        location: j.categories?.location ?? "",
        remote: /remote/i.test(`${j.workplaceType} ${j.categories?.location}`),
        language: "en",
        description: [j.descriptionPlain, ...(j.lists ?? []).map((l: any) => `${l.text}\n${stripHtml(l.content)}`), j.additionalPlain]
          .filter(Boolean)
          .join("\n\n"),
        employment_type: /full|permanent/i.test(j.categories?.commitment ?? "") ? "Permanent, full-time" : String(j.categories?.commitment ?? ""),
        raw: { team: j.categories?.team, commitment: j.categories?.commitment },
      }))
      .filter((j: any) => /full-time/i.test(j.employment_type) && !NON_PERMANENT.test(j.title));
  }
  if (c.ats === "greenhouse") {
    const data = await res.json();
    return (data.jobs ?? [])
      .filter((j: any) => SWEDEN.test(j.location?.name ?? ""))
      .map((j: any) => ({
        source: src,
        external_id: String(j.id),
        title: j.title,
        company_name: c.name,
        url: j.absolute_url,
        location: j.location?.name ?? "",
        remote: /remote/i.test(j.location?.name ?? ""),
        language: "en",
        description: stripHtml(j.content ?? ""),
        employment_type: NON_PERMANENT.test(`${j.title} ${stripHtml(j.content ?? "").slice(0, 1500)}`) ? "Not permanent" : "Permanent, full-time",
      }))
      .filter((j: any) => j.employment_type.startsWith("Permanent"));
  }
  // Teamtailor and other RSS feeds
  const xml = await res.text();
  return parseRss(xml).map((it) => ({
    source: src,
    external_id: it.guid || it.link,
    title: it.title,
    company_name: c.name,
    url: it.link,
    location: it.location || "Stockholm",
    remote: /remote|distans/i.test(`${it.title} ${it.location}`),
    language: /\b(the|and|you)\b/i.test(it.description) ? "en" : "sv",
    description: stripHtml(it.description),
    employment_type: NON_PERMANENT.test(`${it.title} ${stripHtml(it.description).slice(0, 1500)}`) ? "Not permanent" : "Permanent, full-time",
  })).filter((j) => j.employment_type.startsWith("Permanent"));
}

/** Detects the ATS behind a careers or job URL. */
export function detectAts(url: string): { ats: string; slug?: string } {
  const u = url.toLowerCase();
  let m;
  if ((m = u.match(/jobs\.ashbyhq\.com\/([^/?#]+)/))) return { ats: "ashby", slug: m[1] };
  if ((m = u.match(/(?:jobs|boards)\.lever\.co\/([^/?#]+)/))) return { ats: "lever", slug: m[1] };
  if ((m = u.match(/greenhouse\.io\/(?:embed\/job_board\?for=)?([^/?#&]+)/))) return { ats: "greenhouse", slug: m[1] };
  if (u.includes("teamtailor") || /\/jobs\/\d+-/.test(u)) return { ats: "teamtailor" };
  return { ats: "generic" };
}

export function feedUrlFor(ats: string, slug: string): string {
  if (ats === "ashby") return `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`;
  if (ats === "lever") return `https://api.lever.co/v0/postings/${slug}?mode=json`;
  if (ats === "greenhouse") return `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
  return slug;
}

export function parseRss(xml: string): { title: string; link: string; guid: string; description: string; location: string; pubDate: string }[] {
  const items = xml.split(/<item[\s>]/i).slice(1);
  const pick = (s: string, tag: string) => {
    const m = s.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
    return (m?.[1] ?? "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
  };
  return items.map((s) => ({
    title: stripHtml(pick(s, "title")),
    link: pick(s, "link"),
    guid: pick(s, "guid"),
    description: pick(s, "description"),
    location: stripHtml(pick(s, "tt:location") || pick(s, "location") || pick(s, "region")),
    pubDate: pick(s, "pubDate"),
  }));
}

export { stripHtml };
