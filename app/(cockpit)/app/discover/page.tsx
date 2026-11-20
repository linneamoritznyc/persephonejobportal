import { db } from "@/lib/supabase/admin";
import Graph from "./Graph";

export const metadata = { title: "Discover" };

export default async function Discover() {
  const sb = db();
  const [{ data: occ }, { data: edges }, { data: jobs }, { data: gifts }] = await Promise.all([
    sb.from("ps_occupations").select("id,name,alt_titles,pagerank,overlap,gap_skills,gift_id,is_seed,source"),
    sb.from("ps_occupation_edges").select("source_id,target_id,score"),
    sb.from("ps_v_jobs").select("id,title,company_name,found_by_term").like("found_by_term", "discovery:%").eq("is_open", true).limit(300),
    sb.from("ps_gifts").select("id,professional_language"),
  ]);
  const near = (occ ?? []).filter((o: any) => o.source === "persephone_curated" || (o.pagerank ?? 0) > 0.002);
  const ids = new Set(near.map((o: any) => o.id));
  return (
    <div className="space-y-4">
      <header>
        <h1 className="display text-4xl">Discover</h1>
        <p className="text-muted text-sm mt-1">Kompetensgrafen: occupations your experience opens up, ranked with Personalized PageRank from your 8 seed occupations. Size is PageRank, colour is overlap.</p>
      </header>
      <Graph nodes={near} edges={(edges ?? []).filter((e: any) => ids.has(e.source_id) && ids.has(e.target_id))} jobs={jobs ?? []} gifts={Object.fromEntries((gifts ?? []).map((g: any) => [g.id, g.professional_language[0]]))} />
    </div>
  );
}
