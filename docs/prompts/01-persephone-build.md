# PERSEPHONE: build my job portal, end to end, without asking me anything

You are building **Persephone** (repo: `linneamoritznyc/persephonejobportal`), my personal AI job-hunting portal. I'm Linnea Moritz. I'm tired and I want to start applying fast.

## How you work

- Do not ask me questions, show me plans, or wait for approval. Build, test, deploy and verify on your own.
- The only thing you may ask me for is a missing secret. First look for every secret yourself: in the env vars of my existing Vercel projects (use the Vercel MCP or `vercel env pull` on vetlandajobb, antiapathyjobportal / platsbanken-ai, crosstreeslaborintelligence), in `.env.example` files, and in Supabase via the Supabase MCP. Only if a secret truly can't be found, ask me for exactly that variable in one short line.
- Never send an email. Never call any send endpoint (Gmail `messages.send`, SMTP send, or any mail API's send). The app only creates drafts.
- All drafts go into the Drafts folder of **linneacv@gmail.com**. Reuse the IMAP draft method from antiapathyjobportal (it already put 29 working drafts with PDF attachments into linneamoritzcv@gmail.com): connect to imap.gmail.com and APPEND the message to `[Gmail]/Drafts` with `GMAIL_USER=linneacv@gmail.com` and `GMAIL_APP_PASSWORD`. That app password is the one secret you will probably need to ask me for.
- When everything is live, reply with only: the production URL, the list of env vars you set, and anything you could not finish. Nothing else.

## Repos to read first and reuse (leave them unchanged)

| Repo | Take |
|---|---|
| `linneamoritznyc/vetlandajobb` | `lib/jobtech.ts` (JobSearch API), `lib/match.ts` (fit score, direct match above 85, bridge 60 to 85), `lib/cvParse.ts`, `lib/cvExtract.ts`, `lib/masterCv.ts`, `lib/salary.ts`, `lib/cron.ts`, `lib/ratelimit.ts`, `lib/supabase/*`, `lib/careerGraph.ts`, the RLS policy style in `supabase/migrations/0001_init.sql` |
| `linneamoritznyc/antiapathyjobportal` | `v2/supabase_schema.sql` (my detailed profile model: user_experiences, user_experience_tags, user_skills, user_anecdotes, user_cover_letter_preferences, user_ai_feedback, user_job_interactions, applications, user_cv_versions, bransch_cvs), the cover letter prompt and the IMAP Gmail-draft code in `v2/api/index.py` |
| `linneamoritznyc/crosstreeslaborintelligence` | `services/matching-api/src/services/fit_score.py` (weighted TF-IDF overlap with a Wilson 95% confidence interval: never a fake default score), the substitutability career graph in `kompetensgrafen_service.py`, the seed data in `services/data-pipeline/seed/`, `libs/shared-types/*` |
| `linneamoritznyc/personalportfolio` | `llms-full.txt` and project cards, as a source of facts about me |
| `linneamoritznyc/bigquery-lead-scoring-sem` | Proof project to link in martech applications |

## Stack

- Next.js 15 App Router + TypeScript + Tailwind on **Vercel** (project name `persephonejobportal`).
- **Supabase**: create a new project called `persephone` in the EU (Stockholm or Frankfurt). Enable `pgvector` and `pg_trgm`. Apply migrations through the Supabase MCP. Single user (me), with RLS on every table.
- **Claude API** (`claude-sonnet-4-6` or newer) for skill extraction, scoring explanations and letters. Use pgvector embeddings for fact retrieval, which replaces Qdrant.
- **Vercel Cron** runs the agent. All calls to Arbetsförmedlingen and job feeds happen server-side.
- Auth: Supabase magic link, allowed only for my addresses (linnea.moritz@uni.minerva.edu, linneacv@gmail.com, linneacv@gmail.com).

## The smart database (prefix every table `ps_`)

**Who I am (the facts ledger: the app may only write what is in here)**
- `ps_profile`: name, headline, location (Stockholm), languages (Swedish native, English native, Mandarin HSK 3), target salary range (48,000 to 60,000 SEK/month; US contract floor $5,000/month), start date (1 January 2027).
- `ps_experiences`: org, title, start, end (null = current), location, employment type, summary. Same shape as antiapathy's `user_experiences`.
- `ps_facts`: one verified claim per row (text, numbers jsonb, experience_id, tags[], role_families[], source_file, embedding vector). Letters must cite fact ids.
- `ps_stories`: interview stories (situation, action, result, number, fact_ids[]).
- `ps_skills`: name, aliases[], category, level 1 to 5, af_concept_id, esco_uri, evidence_fact_ids[].
- `ps_cv_versions`: A AI Builder, B Martech, C Creative & Trust. Lead line, ordered fact ids, generated PDF path in Supabase Storage.
- `ps_writing_rules`: my style rules (below), injected into every prompt.

**The market**
- `ps_role_families`: the 6 families, each with keyword sets (Swedish and English), priority, and a big_company_bonus.
- `ps_companies`: name, size, is_big_company, ats (ashby / lever / teamtailor / other), feed_url, careers_url, blocked bool (Precis = true), notes.
- `ps_sources`: jobtech, company feeds, US remote boards. Each has enabled, last_run_at, last_status.
- `ps_jobs`: source, external_id (unique per source), company_id, title, url, location, remote, language, description, salary_min, salary_max, deadline, first_seen_at, last_seen_at, is_open, raw jsonb, embedding vector.
- `ps_job_skills`: job_id, skill_name, importance (required / preferred / bonus), years_required, extracted_by.
- `ps_occupations` and `ps_occupation_edges`: the AF substitutability graph (score 25/50/75) in Postgres, loaded from the crosstrees seed, then extended from AF where available.

**The pipeline**
- `ps_matches`: job_id, score, ci_low, ci_high, matched[], missing_required[], missing_preferred[], years_gap, family_id, rank_score (score plus salary, big company and deadline weighting), why (short text).
- `ps_applications`: job_id, status (found, shortlisted, drafted, sent, interview, offer, rejected, withdrawn), cv_version, salary_ask, applied_at, follow_up_at (applied + 5 days), next_action, notes.
- `ps_drafts`: application_id, kind (cover_letter / email / follow_up / linkedin_note), subject, body, fact_ids[], gmail_draft_uid, created_at, edited_by_me bool.
- `ps_contacts`: person, company_id, role, linkedin_url, email, last_contacted_at.
- `ps_events`: timeline of everything (job found, scored, drafted, sent, reply, interview).
- `ps_agent_runs`: started_at, finished_at, trigger (cron / manual), jobs_found, jobs_new, matches_created, drafts_created, errors jsonb, cost_usd.
- `ps_feedback`: my edits to drafts and my thumbs up or down on matches, used to tune future scoring and writing.

Add useful views: `ps_v_today` (new matches from the last 24 hours, ranked), `ps_v_pipeline` (counts per status), `ps_v_followups_due`.

## The agent (runs daily at 06:30 Europe/Stockholm, plus a Run now button)

1. **Collect:** JobTech JobSearch for Stockholm (municipality concept for Stockholm) plus remote-in-Sweden, with keywords from `ps_role_families`. Then the company feeds (Lovable, Klarna, Spotify, Epidemic Sound, Aarke, Sana, Legora, ElevenLabs, Fortnox, H&M, SEB, Swedbank, KPMG, Deloitte, Google Stockholm), then US remote contract boards for AI automation work.
2. **Clean:** upsert into `ps_jobs`, mark jobs missing from their source as closed, drop duplicates (reuse vetlandajobb `lib/dedupe.ts`), and skip blocked companies.
3. **Understand:** Claude extracts required and preferred skills and years required into `ps_job_skills`, and embeds the job.
4. **Score:** run the crosstrees fit score (with Wilson CI) and the vetlandajobb thresholds. Store a `why` sentence, and the years gap separately.
5. **Write:** for every match of 85 or higher with an open deadline, pick the CV version, retrieve the 6 most relevant facts by embedding, write an English cover letter and a short email following my writing rules, and cite fact ids. Save to `ps_drafts`.
6. **Draft:** create the email with the cover letter PDF and the right CV PDF attached as a draft in linneacv@gmail.com (IMAP APPEND to `[Gmail]/Drafts`). Never send it.
7. **Track:** create or update `ps_applications`, log `ps_events`, and finish the `ps_agent_runs` row.

**Agentic control:** a `/oracle` page plus API routes so I (or Claude, through an MCP-style JSON endpoint) can trigger runs, pause the cron, toggle sources, edit keyword families, re-score, regenerate a draft, and read run logs. Protect it with my login plus a `PERSEPHONE_ADMIN_TOKEN`.

## Writing rules (store in `ps_writing_rules`, apply to every text)

- Plain, direct English. Subject-verb-object. Short sentences.
- No em dashes.
- Say what something is. No "not X, but Y" framing and no defining by contrast.
- Real numbers only, each from a fact in `ps_facts`.
- Confident and specific. No filler like "I am passionate about".

## The interface, exactly

**Feel:** I open Persephone and feel powerful, rich and certain I will get the job. Persephone rules two worlds, and so do I: tech and art.

**Design tokens:**
- Background `#0B0E1A` (deep night), surface `#141A2E`, raised `#1C2440`, line `#2A3352`.
- Text `#EEF1F8`, muted `#9AA4C0`.
- Silver accent `#C9D1E3`, pomegranate accent `#C2364B` (primary buttons, the one strong colour), gold for wins `#D9B26A`, match green `#4FB38A`, gap amber `#E0A458`.
- Headings: Cormorant Garamond 600. Body: Inter. Numbers: Inter tabular.
- Radius 14px, generous spacing, soft 200ms transitions, no clutter. Fully responsive. It must work perfectly on my phone.

**Navigation:** a left rail on desktop and a bottom bar on mobile. Throne, Court, Harvest, Mirror, Oracle.

**1. Throne `/` (home)**
- Top line: "Good morning, Linnea." with today's date.
- Four stat tiles: Applications out, Interviews, Offers in play, Salary range in reach (for example "52–58k SEK").
- "Today's moves": the three most important actions right now (send these drafts, follow up with X, prepare for interview Y), each with one button.
- "New this morning": the top 10 new matches as cards (company, title, score ring, salary estimate, deadline, one-line why). Tap opens Sword.
- A small line chart of applications sent per week.

**2. Court `/court` (pipeline)**
- A kanban with the columns Shortlisted, Drafted, Sent, Interview, Offer, plus a collapsed Archive. Drag cards between columns, and each move writes `ps_events`.
- Each card shows the company logo, title, score, salary and days in stage. A follow-up badge appears when it's due.
- Filters: role family, big company only, remote, score of 85 or higher.

**3. Sword `/job/[id]` (one job)**
- Left: the ad, the company facts, the deadline and a link to the original.
- Right: the match panel. A big score ring with its confidence interval, skills I have as green chips, gaps as amber chips, the years gap, and the why.
- Below: the cover letter and email editor (editable, autosaved to `ps_drafts`) with the cited facts listed underneath, the CV version selector, and a "Create draft in linneacv@gmail.com" button. Show a toast when the draft exists. Add a regenerate button with a field for an instruction.
- Bottom: interview prep. The 3 most relevant stories from `ps_stories` and 5 likely questions.

**4. Harvest `/harvest` (all jobs)**
- A searchable, sortable table of every open job, with score, salary, deadline, source and status. Bulk actions: shortlist, draft, archive.

**5. Mirror `/mirror` (me)**
- My headline, my languages and target salary.
- The skills graph: my skills linked to the 6 role families, drawn from my data.
- My wins: the strongest facts as large quote cards (for example "Website launched 16 Oct 2026: 197 images, redirect plan, 68 staging bugs").
- My 3 CV versions with PDF preview and download.
- Facts and stories editors.

**6. Oracle `/oracle` (agent control)**
- Run now, pause or resume the cron, last 20 runs with counts, errors and cost, source toggles, keyword family editor, and the deployment status (from the Vercel API).

**Empty and loading states:** short, confident copy. Use skeleton loaders that keep the layout calm.

## Seed data (load all of this on first deploy)

1. Build `ps_experiences`, `ps_facts`, `ps_skills` and `ps_stories` from the Technical CV and SFW record below, plus personalportfolio `llms-full.txt`. Mark every fact with its source.
2. Correct these known errors from older material: the lead scoring numbers are **per month** (959 to 6,603, 6.9x), The Financial Healer and PrePartum work ran **Feb to Apr 2026**, the Minerva Alumni Ambassador role has **ended**, and SFW is the **only current job**.
3. Load the 6 role families, the companies above (Precis blocked), and the crosstrees occupation graph.
4. Generate the 3 CV PDFs into Supabase Storage.
5. Run the agent once, and check that at least one draft lands in linneacv@gmail.com.

## Deploy and verify (do all of this yourself)

1. Create the repo content, then the Vercel project and the Supabase project, apply the migrations, set every env var, deploy to production, and set up the cron.
2. Verify: the site loads, login works, the agent run completes, matches appear on Throne, one draft exists in linneacv@gmail.com, and nothing was sent.
3. Fix anything that fails, then redeploy.
4. Reply with the production URL, the env vars, and anything unfinished.

---

## Appendix A: Technical CV (facts)

LINNEA MORITZ. Full-stack developer, product builder, media solutions engineer. Stockholm. linneamoritzdev.vercel.app · linkedin.com/in/linneamoritz

Skills: Next.js 14, React 18, TypeScript, JavaScript (Node.js), Python, R, SQL (BigQuery, PostgreSQL), Supabase, Deno, PostGIS, Airtable, Row Level Security, REST APIs, Anthropic Claude API, Claude Code, MCP, ElevenLabs, Retell AI, Google Ads Scripts, Shopify API, Square, Stripe and Brevo webhooks, Google Ads, GA4, Google Tag Manager (including server container), BigQuery, Google Cloud, Vercel, Railway, Git/GitHub, Shopify, Lovable, Replit, Remotion, Jest, GitHub Actions.

- Lead Scoring for SEM (bigquery-lead-scoring-sem.replit.app, github.com/linneamoritznyc/bigquery-lead-scoring-sem): a propensity-tier scoring system in SQL on the GA4 BigQuery export, validated on the Google Merchandise Store dataset. Smart Bidding training events went from 959 to 6,603 per month (6.9x). 20% lower CPA. Found 28,224 high-intent users with 0% conversion. Modelled net impact of $22,000/month per client.
- The Financial Healer and PrePartum, Product and Technical Lead, Feb to Apr 2026 (remote, US founders). NEVER name the company that contracted this work; name only these two projects. Built Square and Railway webhook chains that run payment-to-CRM in under 60 seconds, an AI voice agent (Retell AI, ElevenLabs, Claude API) that replaced 16 manual calls a day, and AES-256 credential vaults. Fixed 18+ production bugs, including a user-isolation data-integrity flaw, before a US national TV campaign (All Access). Built a Notion COO command center. The client grew 5x.
- PrePartum (Mother of Many), Full-Stack Developer and Technical Lead, spring 2026: iOS app launched on the App Store in April 2026, with 5 personas, a 24-question intake, 95 reflection questions, AI practice conversations and a $9/month subscription.
- #ONEMILLIONTALENTS, Full-Stack Developer, Apr to May 2026: German campaign site, Airtable finalist import, GDPR double opt-in with Brevo, email copy in German and English.
- Independent AI developer: 11 production web apps in 2 months, including Bidragsguiden (Claude API, Supabase RLS), CBAM-Validator, NordiqFlow, Smålands Företagskarta, Jobbajobba / Vetlandajobb, and a GA4 high-intent signal (3+ product views) sent to Google Ads Smart Bidding for my own Shopify store.
- Human Bridge, Warehouse Associate (lagermedarbetare), ended 31 Oct 2026.
- Keeping Tabs, Multimedia Technical Specialist, Nov 2022 to Jun 2023: a digital art collection for Art Basel Hong Kong on a 70 x 30 m LED display.
- TikTok / ByteDance, Quality Reviewer (Trust & Safety), May to Jun 2022.
- YouTube Ads (Vaco for Google), Content Reviewer, Swedish market, Feb to Jun 2022.
- Clubhouse (Vaco), Content Moderator, Trust & Safety, Apr 2021 to Jan 2022: sole reviewer for the Scandinavian market across all 16 violation categories, 95% SLA and QA, throughput up 98%, SOP fixes adopted into the global playbook.
- Google Ads gTech (Vaco), Swedish Content Analyst, May 2018 to Apr 2019: reviewed 100+ Swedish Google Ad Suggestions a day. Worked in Sunnyvale, Seoul and Hyderabad. The team hit 100% of SLA targets.
- Minerva Project, Global Marketing, Sep 2019 to Apr 2020: guided 2,000+ applicants in 40+ countries through Intercom.
- Swedish-American Chamber of Commerce, Jun to Sep 2021: grew the community 20% and built 120 sales leads for 2 clients.
- Minerva University Alumni Ambassador, Western Europe, Sep 2024 to 2026 (ended): Nordic University Tour, a CRM of 196+ schools.
- Award: First Prize, Global Startup Weekend Stockholm, 2019 (Terra Finance, with Google for Startups and Techstars).
- Education: B.S. Social Sciences (Economics & Business Administration), Minerva University, 2017 to 2021, GPA 3.6, 1.8% admission rate. Studied in San Francisco, Seoul, Hyderabad, Berlin and Buenos Aires. Capstone TA, mentored 45 students. IB Bilingual Diploma, UWC Red Cross Nordic, 2015 to 2017, GPA 3.85, full scholarship.
- Artist: 39 exhibitions in 21 cities. 3 first prizes (Stockholms Konstsalong 2024, Greenpoint Gallery Brooklyn 2023, Murray's Creative Contest 2022).
- Founded The Right Solution Project at 15: raised 120,000 SEK and delivered 400+ care packages to Ethiopian schools.

## Appendix B: Soil Food Web Foundation work record

# Linnea Moritz: Work for the Soil Food Web Foundation

Role: Contractor (started 1 September 2026, still working). Paid USD 1,000 per month, fixed fee.
Team: Evan Buckman (Executive Director), Allison Duck, Stephanie McDaniel, Sammie Bass, Alex Andreou, Carla Portugal, Kavi Reddy, Ivan (video editor).
Last updated: 20 November 2026.

## CV version (copy this)

**Soil Food Web Foundation**, Contractor, Digital, Content and Grants | Sep 2026 to present | Remote

- Led images, copy and redirects for the new soilfoodweb.com, which launched 16 Oct 2026: chose 197 final workshop images across 13 folders, wrote the copy for every workshop page, planned the URL changes and redirects, and logged 68 staging bugs on monday.com.
- Set up SFW's first merch store (Shopify and Printful) within 2 weeks: designed the products, chose print-on-demand with worldwide shipping, and wrote a memo on unrelated business income for the lawyer.
- Took over grant research from the Executive Director, built the grant tracker, and is drafting 3 applications (Harry Chapin Foundation, Regenerative Agriculture Foundation, Clif Family Foundation) toward a goal of USD 1M in 12 months.
- Plans organic social media a month ahead (3 posts a week plus stories) and runs YouTube Shorts posting 4 times a week across YouTube, Instagram and Facebook (about 50,000 Instagram followers).
- Taught myself video editing: cut webinar Shorts, made workshop videos (Santa Fe done, Costa Rica in progress) and Reels with Remotion and ElevenLabs voiceover.
- Built internal tools with Claude Code: an asset library with an AI content pipeline, a post planner (Wormhole) and an interactive map of Dr. Elaine Ingham's publications.

## Everything, by area

### 1. New website (launched 16 Oct 2026)

- Owned the redirect plan for launch: sfw-link-map.xlsx (source of truth), sfw-redirects.csv (import file for the WordPress Redirection plugin) and a read-me handover, delivered 1 Oct 2026 in the "New Link Redirects" folder.
- Decided to move the old LifterLMS student platform to archive.soilfoodweb.com and redirect old course links there (agreed with Evan on 1 Oct 2026).
- Final URL plan (2 Oct 2026): 4 pages get new addresses, plus new pages /work-with-us/, /funding/, /governance/ and /year-one-report/ (for the Google Ad Grant).
- Wrote a staging bug list of 68 bugs (3 Oct 2026), mapped to the monday.com "Website Update" board.
- Stepped in to finish the site over the launch weekend while the rest of the team was away.
- Owns the Google Ad Grant website checklist on the monday board.
- Chose all final website images and delivered them as one Drive folder per page, with a spreadsheet tagging every visual asset.
- Built a full independent version of the site with Claude Code (github.com/linneamoritznyc/SFW-newwebsite, test site finalsite-tau.vercel.app).

### 2. Workshop pages

- Argued to Allison that past workshops build trust with students and funders, then wrote the copy for every workshop page (final 11 Oct 2026), with source links for every claim.
- Delivered 197 final workshop images in 13 Drive folders, one spreadsheet per folder.
- Removed two workshops with no record of happening (Mexico 2022, Brazil 2019) and added the documented February 2024 Ecosystem Restoration Workshop in Yucatán.
- Wrote about 150-word launch blurbs for each workshop.
- Making workshop videos in horizontal and vertical formats with subtitles: Santa Fe done, Costa Rica halfway.

### 3. Publications page

- Found Google Scholar links for Dr. Elaine Ingham's publications and updated the sfw-publications-import spreadsheet.
- Wrote "Summary" and "Useful for" lines from each paper's abstract.
- Built an interactive research map of the publications (finalsite-tau.vercel.app/publications/interactive/).

### 4. Merch store (since 6 Nov 2026)

- Evan asked for a drop-shipped store in about 4 days and gave her full ownership.
- Created the Shopify store under the SFW apps@ account (15 Nov 2026) and chose Printful for printing.
- Designed the merch herself: organic Stanley/Stella tees, study items for SFW's roughly 10,000 students, and archival micrograph posters, all in SFW's brand colours with the logo in the bottom right.
- Ran her own product photoshoot on natural backgrounds (hay, soil, grass, rocks).
- Drafted the memo "Merchandise and Unrelated Business Income" for Evan to take to SFW's lawyer.
- Next step: transfer store ownership to Evan.

### 5. Grants (since Oct 2026)

- Took over grant applications from Evan. The old spreadsheet listed 2 grants.
- Built the grant tracker. It separates grants SFW applies for from grants SFW shares with its community. She finds grants with a web scraper and checks every link, rule and fit by hand.
- Set the goal: USD 1M in grants over 12 months.
- Ruled out SAM.gov grants for 2 months after Carla flagged the paperwork (3 Nov 2026).
- Picked 3 grants and set each up as a Google Doc with an Application tab and a Workflow tab: Harry Chapin Foundation (framed around New Mexico scholarships), Regenerative Agriculture Foundation, Clif Family Foundation.
- Drafted a research doc on new courses that could win US and EU government funding (SARE, USDA, Mission Soil).

### 6. Social media

- Since mid-Oct 2026: plans all organic social copy and images a month ahead for Stephanie and Allison.
- Posting rule agreed with Evan: 3 quality posts a week plus stories, with one workshop post and one course bundle post each week. Posts are planned through January 2027.
- Built Wormhole (wormholelinnea.vercel.app), a password-protected planner where the team scrolls mock Instagram and LinkedIn feeds and Allison edits text live.
- Keeps an "SFW Content" Google Calendar as the record of planned posts.
- Made a Canva news-repost template.
- Created two series: Field Notes (graduates' field-trial results with real numbers) and Soil Regenerators in the wild (one graduate per post, from Stephanie's impact stories).
- Schedules everything through Later.com. She has no direct Instagram or Facebook access.

### 7. YouTube Shorts and video

- Runs the YouTube Shorts posting plan: 4 times a week (Tue, Thu, Sat, Sun) to YouTube, Instagram and Facebook as one Later post, starting 24 Nov 2026.
- Designed thumbnails for the whole webinar Shorts backlog (one format, 4 colours).
- Set up the webinar flow Evan loved: the full recording goes up, 4 Shorts are cut that week, and the best one opens the recording as a hook.
- Taught herself video editing after joining SFW and cut Shorts from webinars that had none.
- Building SFW Reel Studio, a Reel and clipping app with an AI chat editor, ElevenLabs voiceover and OpusClip.
- Made a monday.com board planning Reels for each workshop, plus a series of Costa Rica Reels.
- Scoping permaculture marketing videos for Stephanie.

### 8. Design and print

- Two trifold brochures: a general version and a farmer and food-conference version ("Grow your own biology") after Evan's feedback.
- Visuals for 5 India workshop decks Evan presented to Vandana Shiva's group: The Soil Food Web, Role Function & Plant Interaction, Compost, Liquid Amendments, and Transition to Biological Farming.
- Redesigned 4 year-end fundraising documents for Giving Tuesday (Case for Support, Donor Overview, Funding the Vision Ahead, campaign plan) as editable US Letter files.
- Designed the Field Guide to Soil Life (illustrated organism pages).
- Built the SFW Microscopy Photo Asset Library in the SFW Drive (4 folders), shared with the team.
- Enhancing the scholarship page and scholar profiles for Giving Tuesday, at Stephanie's request.

### 9. Strategy, writing and internal tools

- Wrote the SFW Communications Guide (brand and style rules, claims discipline, retired words), reviewed at the 23 Sep 2026 communications meeting.
- Built Content Studio, an asset library and AI content pipeline (github.com/linneamoritznyc/SFWassetlibrarycontentautomation), not yet deployed.
- Started an India research site comparing the SFW method with Indian natural farming (naturalfarmingindiaresearch).
- Built DirtKitchen and Oregon Orchard, learning games based on the Liquid Amendments deck and on permaculture orchards. Planned more games (SoilVille, Microcosm) as possible course add-ons.
- Pitched Sammie an internal local AI that makes Dr. Ingham's books searchable.
- Prepared accomplishment notes for the Year One Annual Report. The report itself moved to January 2027, and the notes now feed the Giving Tuesday slides.
- Took on engaging members of the free SFW Public Community.
- Prepared a promotion pitch on soil-data partnerships (connecting sMApp to open soil DNA data such as the BeOpen Atlas).

## Constraints she worked under

- No WordPress access, no Instagram or Facebook access, and no YouTube Studio access. All work is delivered through Drive, Later and teammates.
- No formal onboarding. Her contract was still unsigned as of October 2026.
- Paid USD 1,000 a month for what is in practice full-time work.
