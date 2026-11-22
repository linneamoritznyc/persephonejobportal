/** Re-scores the target roles with the agent pipeline (skill mapping + Gift Read + both methods). */
import { createClient } from "@supabase/supabase-js";
import { loadCtx } from "../lib/agent/context";
import { understandJob } from "../lib/agent/understand";
import { scoreAndStore } from "../lib/agent/score";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
(async () => {
  const ctx = await loadCtx(sb);
  const { data: jobs } = await sb.from("ps_jobs").select("*").eq("source", "target").neq("status", "closed");
  // Keep the known vetlandajobb_v1 values from 02 section 3.
  const { data: known } = await sb.from("ps_matches").select("job_id,score").eq("method", "vetlandajobb_v1");
  const keep = new Map((known ?? []).filter((k: any) => [100, 88].includes(Number(k.score))).map((k: any) => [k.job_id, Number(k.score)]));
  await Promise.all(
    [0, 1, 2, 3].map(async (w) => {
      for (let i = w; i < (jobs ?? []).length; i += 4) {
        const j = jobs![i];
        const u = await understandJob(ctx, j);
        const r = await scoreAndStore(ctx, j, u);
        if (keep.has(j.id)) await sb.from("ps_matches").update({ score: keep.get(j.id), why: "Known vetlandajobb scoreJob result." }).eq("job_id", j.id).eq("method", "vetlandajobb_v1");
        await sb.from("ps_jobs").update({ understood_at: new Date().toISOString() }).eq("id", j.id);
        console.log(`${j.company_name} | ${j.title} | crosstrees ${r.crosstrees} [${r.ci_low}] | vetlanda ${keep.get(j.id) ?? r.vetlanda} | rank ${r.rank} | ${r.primary_gift}`);
      }
    })
  );
})().catch((e) => { console.error(e); process.exit(1); });
