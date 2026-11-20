/** Company career feeds: Ashby, Lever, Greenhouse and Teamtailor RSS. */
import type { RawJob } from "../dedupe";

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
        raw: { department: j.department, team: j.team, published: j.publishedAt },
      }));
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
        raw: { team: j.categories?.team, commitment: j.categories?.commitment },
      }));
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
      }));
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
  }));
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
