import { db } from "@/lib/supabase/admin";
import Mirror from "./Mirror";

export const metadata = { title: "Me" };

export default async function Me() {
  const sb = db();
  const [{ data: profile }, { data: exps }, { data: facts }, { data: stories }, { data: cvs }, { data: rules }, { data: gifts }, { data: skills }] = await Promise.all([
    sb.from("ps_profile").select("*").eq("id", 1).single(),
    sb.from("ps_experiences").select("*").order("sort"),
    sb.from("ps_facts").select("id,text,tags,strength,source_file").order("strength", { ascending: false }).order("id"),
    sb.from("ps_stories").select("*").order("title"),
    sb.from("ps_cv_versions").select("*").order("code"),
    sb.from("ps_writing_rules").select("*").order("sort"),
    sb.from("ps_gifts").select("*").order("sort"),
    sb.from("ps_skills").select("name,category,level").order("category"),
  ]);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="display text-4xl">Me</h1>
        <p className="text-muted mt-1">{profile?.headline} · Stockholm · English and Swedish (native), Mandarin HSK 3 · target {Math.round((profile?.salary_min_sek ?? 45000) / 1000)}–{Math.round((profile?.salary_max_sek ?? 60000) / 1000)}k SEK</p>
        <p className="text-sm text-muted mt-1">&ldquo;{profile?.salary_answer}&rdquo; · &ldquo;{profile?.stability_answer}&rdquo;</p>
      </header>
      <Mirror exps={exps ?? []} facts={facts ?? []} stories={stories ?? []} cvs={cvs ?? []} rules={rules ?? []} gifts={gifts ?? []} skills={skills ?? []} />
    </div>
  );
}
