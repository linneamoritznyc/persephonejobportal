# PERSEPHONE: THE GIFTS ENGINE

You are the Claude Code session building **persephonejobportal**. This prompt adds two things to Persephone:

1. **The Hunt:** real job-finding machinery, ported from code I already wrote (antiapathyjobportal, platsbanken-ai, vetlandajobb, crosstreeslaborintelligence / Kompetensgrafen).
2. **The Gifts:** a strategy layer that turns my ten gifts into positioning, role discovery, outreach and interview stories. Its goal is one well-paid **full-time permanent job (tillsvidareanställning)** at 45,000 to 60,000 SEK/month, in-office in Stockholm, on a real team with coworkers. Full-time employment is the only target. Contract, freelance, consulting-agency and gig listings are filtered out.

Work through every section in order and commit after each one. Ask me only for a secret you cannot find. Look for secrets first in the Vercel env and `.env*` files of vetlandajobb, antiapathyjobportal, crosstreeslaborintelligence, personalportfolio and bigquery-lead-scoring-sem. When you finish, write `docs/GIFTS_ENGINE.md` and stop.

---

## 0. Hard rules (unchanged, still absolute)

1. **Never send an email.** The only email action is IMAP APPEND to `[Gmail]/Drafts` in **linneajobs@gmail.com**. CI must fail on any send capability.
2. **Banned terms:** `Black Lotus`, `Black Lotus Ventures`, `BlackLotus`, `CareerGenius`, `PitchGenius`, `VCGenius`. My Feb to Apr 2026 work appears only as **The Financial Healer** and **PrePartum**. Every generator runs `assertNoBannedTerms()` before saving. Never write a reason for this rule anywhere.
3. **Blocked:** Precis and Precis Digital, plus all gig and rater platforms (Outlier, Lionbridge, Remotasks, DataAnnotation, Appen, TELUS AI, Scale AI rater work).
4. **Languages:** Swedish and English, both native. Mandarin HSK 3. Lead with my English.
5. **Style:** plain direct English, subject-verb-object, no em dashes, no "not X but Y" framing, no defining by contrast. Confident, factual, high energy. Only facts from `ps_facts`.
6. **Spiritual language stays internal.** The gifts drive strategy, ranking and story choice inside Persephone. Outgoing text (CVs, letters, LinkedIn messages) translates each gift into plain professional language (section 7 has the mapping). Words like "spiritual", "gift", "calling", "anointed" or "Bezalel" never appear in anything an employer reads.

---

## PART ONE: THE HUNT (port my real code)

### 1. Platsbanken ingestion, rebuilt fast

Source: `antiapathyjobportal/v2/api/index.py` (scraper lines ~728-947, `/api/jobs` lines ~2528-2664) and my Drive doc "Information Retrieval Platsbanken-ai".

Port it to TypeScript in `lib/hunt/platsbanken.ts` and apply every fix that doc names:

- **Filter in SQL.** The old `/api/jobs` pulls 500 rows and filters in Python. Write a Postgres function `ps_next_jobs(user_id, regions text[], limit int default 50)` that excludes jobs already in `ps_applications` (sent, draft, interview) and in `ps_feedback` (applied, rejected, skipped), filters regions with `municipality ILIKE ANY(...)`, orders by `fit desc, deadline asc`, and returns 50.
- **Parallel detail fetches.** The old scraper fetches ads one at a time (an N+1 problem). Use `Promise.all` in batches of 10 with an 8-second timeout each.
- **Lazy descriptions.** List endpoints return summaries. Fetch `full_description` only on `/api/jobs/[id]/full`, or when the agent drafts.
- **Cache the taxonomy.** Cache AF municipality and occupation labels in a module-level map plus a `ps_taxonomy_cache` table refreshed weekly.
- **Cache searches.** Cache JobSearch API responses for 30 minutes keyed by query hash.
- **Cursor pagination** with an `(published_at, id)` cursor.
- Default regions: Stockholm, Solna, Sundbyberg, Nacka, plus `remote`.

### 2. Career-page scrapers (the Vetlandajobb pattern)

Vetlandajobb pulls Platsbanken AND scrapes jobb.vetlanda.se, which catches ads Platsbanken misses. Apply the same pattern to target companies. Many of them post on Teamtailor, Greenhouse, Lever or Ashby and never reach Platsbanken.

Build `lib/hunt/careers/` with one adapter per ATS:
- `teamtailor.ts`: `{company}.teamtailor.com/jobs` (Aarke, Nextory and many Swedish scaleups)
- `greenhouse.ts`: `boards-api.greenhouse.io/v1/boards/{slug}/jobs`
- `lever.ts`: `api.lever.co/v0/postings/{slug}`
- `ashby.ts`: `api.ashbyhq.com/posting-api/job-board/{slug}`
- `generic.ts`: fetch HTML and extract with Claude Haiku when no ATS is detected

Seed `ps_companies.careers_url` and `ats` for: Lovable, ElevenLabs, Nextory, Aarke, H&M, SEB, Fortnox, Sana, Legora, Klarna, Epidemic Sound, Google, Swedbank, KPMG, Deloitte, Spotify. Detect the ATS automatically from the URL. Run all adapters daily and dedupe against Platsbanken on `(company, normalized_title)`.

Employment filter: keep only listings where the employment type is permanent full-time (AF `employment_type` = Tillsvidare / Vanlig anställning, `worktime_extent` = Heltid, or ATS fields like `Full-time`, `Permanent`). Drop contract, freelance, interim, consultant-staffing (bemanning) and project listings. Store `ps_jobs.employment_type` and show it on every card.

### 3. The Kompetensgrafen discovery engine (roles I would never search for)

This is the most valuable piece. JobbaJobba and Kompetensgrafen use Arbetsförmedlingen's substitutability graph and the ESCO skills taxonomy to show which other occupations a person's experience opens up, each with an overlap percentage, ranked with Personalized PageRank.

Port it from `crosstreeslaborintelligence` (Neo4j seed: 22 occupations, 51 skills, 38 edges) into Supabase:

- Tables `ps_occupations`, `ps_skills_esco`, `ps_occupation_skills`, `ps_occupation_edges(from, to, substitutability, source)`.
- Load the AF substitutability data and the ESCO occupation-skill links for the occupations near my profile. Expand from my seed occupations two hops out.
- My seed occupations: web developer, digital marketing specialist, content moderator, product manager, video editor, data analyst, recruiter / admissions officer, visual artist.
- Implement **Personalized PageRank** in SQL or TypeScript with the restart vector on my seed occupations and teleport alpha 0.15. Run 30 iterations.
- For each discovered occupation, compute **overlap % = my skills ∩ required skills / required skills**, plus the **gap skills**.
- Turn the top 25 discovered occupations into search terms (Swedish and English titles from the AF taxonomy plus ESCO alt labels) and feed them to sections 1 and 2.
- Expected discoveries to sanity-check against: Solutions Engineer, Deployment Strategist, Forward Deployed Engineer, Marketing Technologist, Ad Tech Specialist, Creative Technologist, Customer Success Engineer, Policy Analyst, Learning Experience Designer, Program Manager (impact). If the graph surfaces none of these, log it in `ps_agent_runs` as a data problem.
- Show it on the **Oracle** page as a graph: me in the centre, occupations sized by PageRank, edges coloured by overlap.

### 4. Two fit scores, side by side

- `vetlandajobb/lib/match.ts` `scoreJob`: set overlap of skills. Above 85 is a direct match, 60 to 85 is a bridge.
- `crosstrees fit_score.py`: TF-IDF weighted 0.6 required / 0.3 preferred / 0.1 bonus, with a Wilson 95% confidence interval. Port it to TypeScript.
- Store both in `ps_matches(method, score, ci_low, ci_high)`. Rank by `0.5 * vetlanda + 0.5 * crosstrees_ci_low + gift_bonus + big_company_bonus` (gift_bonus is in section 8, big_company_bonus is 10).
- Known results to keep as regression tests: ElevenLabs FDE 100, Aarke Content 100, Fortnox PM 100, Sana 100, Klarna Ad Tech 100, Google ASA 100, Lovable PES 88.

### 5. The application machine (static library, cheap and instant)

Source: my Drive PDF `platsbanken_ai_summary.pdf`. Rewriting the CV for every job caused $60 Vercel bills. Move to a static library:

- One **master resume** in `ps_profile` + `ps_experiences`.
- **12 prewritten branch CVs** in `ps_cv_versions`, generated ONCE and then frozen until I edit them. The 12 come from 6 role families x 2 registers (startup, corporate). Their lead lines and proof points come from the gifts in section 7.
- The match picks one branch CV per job. Persona selection is the same idea as the Anti-Apathy portal: an LLM reads the ad and picks the persona, then the CV.
- The cover letter is the only per-job generation. Use Claude Sonnet with prompt caching on the master resume and the gift bank, so each letter costs cents.
- **Gmail IMAP drafts:** reuse the antiapathyjobportal IMAP code. It is proven (29 drafts landed in linneamoritzcv@gmail.com). Target linneajobs@gmail.com, attach the branch CV PDF, put the subject as `{Role} - Linnea Moritz`.
- **LanguageTool API** check on every Swedish letter.
- **KBLab/bert-base-swedish-cased:** finish what I started. The HuggingFace key exists and the code never used it. Use it through the HF Inference API to score each Swedish sentence's pseudo-log-likelihood. Flag sentences in the bottom 10% as "svengelska" and show them on the Sword page with a one-click rewrite.
- **Feedback loop (from v2/FEATURES.md):** when I edit a draft or press thumbs down, Claude reads the diff and writes a new row in `ps_writing_rules`. Future letters follow it.
- **PWA:** add `manifest.json`, icons and a service worker so I can install Persephone on my iPhone and approve drafts from the phone.

---

## PART TWO: THE GIFTS (the strategy layer)

### 6. The gift bank

Create `ps_gifts(id, name, essence, evidence jsonb, professional_language text[], role_families int[], story_ids uuid[])` and seed exactly these ten. Evidence uses only these facts.

| # | Gift | Essence | Evidence |
|---|---|---|---|
| 1 | Discernment | Senses harm and risk before anyone names it | Sole Trust & Safety owner for Scandinavia at Clubhouse, all 16 harm categories, productivity up 98%; TikTok and YouTube quality review; Google Ads gTech policy review, 100+ ads a day, 100% of SLA targets; fixed a user-isolation data-integrity flaw before a US national TV campaign |
| 2 | Giving and mobilizing | Gets other people to give | Founded The Right Solution Project at 15, raised 120,000 kr, 400+ care packages for women's education in Ethiopia; drafting SFW grants toward USD 1M in 12 months; SFW Giving Tuesday fundraising documents; grew the Swedish-American Chamber of Commerce community 20% |
| 3 | Encouragement | Names the gift in someone and builds it | Built websites and portfolios for friends; mentored 45 Minerva students through capstones; guided 2,000+ applicants in 40+ countries |
| 4 | Apostleship (the one who is sent) | Opens new ground and plants things | UWC, studied in 5 countries, carried Minerva across the Nordics (196-school CRM), first merch store for SFW in 2 weeks, won Global Startup Weekend Stockholm |
| 5 | Vision | Perceives the structure behind the visible | Contemporary cubist painter, 39 exhibitions in 21 cities, 3 first prizes incl. Stockholms Konstsalong 2024; Keeping Tabs on a 70 x 30 m LED display at Art Basel Hong Kong; Kompetensgrafen saw 1,340 machine operators with 68% overlap to wind turbine technicians |
| 6 | Craftsmanship | Wisdom carried in the hands; understanding becomes an object | Cubist oil paintings, Under Rose's Garden cut-paper book, Field Guide to Soil Life, Remotion Reels, national TV ad rebuilt frame by frame, 11 production web apps in 2 months |
| 7 | Interpretation | Carries meaning across worlds | Explained synthetic control as a "twin municipality" for a kommunstyrelse; turns Dr. Elaine Ingham's research into social posts; Swedish content analyst at Google; native in Swedish and English |
| 8 | Teaching | People leave understanding their own path | 2,000+ applicants in 40+ countries, 45 capstone mentees, Nordic school tour, children's book about soil life, SFW Field Guide |
| 9 | Mercy built into systems | Turns care into infrastructure | Anti-Apathy portal: job URL to Gmail draft in 60 seconds, neuro-inclusive design with confetti rewards; JobbaJobba for people who just lost their job; AI voice agent that replaced 16 manual calls a day |
| 10 | Stewardship | Sees waste and redirects resources | 63-to-11 million SEK budget tool (290-municipality synthetic control, linear programming); lead scoring found 28,224 missed high-intent users, 6.9x more Smart Bidding signal per month, 20% lower CPA; 12-CV static library that cut my own hosting bills |

The thread through all ten goes in `ps_profile.thread`: **"I perceive hidden structure, and then I give it a form other people can walk into."** This is the internal north star. Its professional version for outgoing text: **"I find the structure in messy problems and turn it into tools people actually use."**

### 7. Gift to professional language

Seed `professional_language` and `role_families` like this. This mapping is the only way gifts reach outgoing text.

| Gift | Professional language | Role families |
|---|---|---|
| Discernment | risk judgment, policy enforcement, QA, spotting failure modes early, trust & safety | 5, 1, 6 |
| Giving and mobilizing | fundraising, partnerships, community growth, stakeholder buy-in | 3, 4 |
| Encouragement | customer success, onboarding, enablement, mentoring | 3 |
| Apostleship | 0-to-1 builder, launches, market entry, new programs | 1, 3 |
| Vision | product sense, systems thinking, creative direction | 1, 4 |
| Craftsmanship | shipping, prototyping, design and build quality, motion and video | 1, 4 |
| Interpretation | translating technical work for business and public audiences, bilingual delivery, solutions engineering | 3, 6, 2 |
| Teaching | demos, documentation, training, workshops | 3, 6 |
| Mercy built into systems | user-centered automation, accessibility, human-in-the-loop AI | 1, 3 |
| Stewardship | measurement, ROI, budget optimization, martech and attribution | 2, 6 |

Role families: 1 AI automation and internal AI builder · 2 Martech and media solutions · 3 Customer-facing roles at AI startups (product experience, deployment, solutions) · 4 Creative technologist and AI video · 5 Trust & Safety · 6 AI consulting at the Big Four and banks.

### 8. Gift matching (the agentic part)

For every job, run a **Gift Read**: Claude Haiku reads the posting and returns JSON:

```json
{ "gifts_called_for": [{"gift": "interpretation", "evidence_in_ad": "translate customer needs into technical solutions", "weight": 0.9}],
  "primary_gift": "interpretation",
  "secondary_gift": "craftsmanship",
  "gift_fit": 0.0-1.0 }
```

- Store it in `ps_matches.gift_read`.
- `gift_bonus = round(gift_fit * 15)`, added to the rank in section 4.
- Jobs whose primary gift is Interpretation, Vision, Craftsmanship or Stewardship get a further +5. These are my rarest combination and the strongest salary lever.
- **Gift-led discovery:** each gift's professional language becomes extra search terms in sections 1 to 3. Example: Interpretation adds "solutions engineer", "technical account manager", "customer engineer". Stewardship adds "marketing measurement", "attribution", "budget optimization". Log which gift found each job (`ps_jobs.found_by_gift`) so we learn which gifts pull the best-paying roles.

### 9. Gift-shaped application material

For every draft, the generator receives the primary and secondary gift and builds the letter around them:

1. **Opening line:** the primary gift in professional language, tied to the company's own words from the ad.
2. **Proof paragraph:** the two strongest evidence items for the primary gift, with numbers.
3. **Bridge paragraph:** the secondary gift, one evidence item.
4. **Close:** one specific thing I would build or fix for them in the first 30 days (Stewardship and Vision make this concrete).

The branch CV is chosen by family. The summary line on top of the CV is rewritten per gift, because that is cheap. Everything else stays frozen.

**LinkedIn message (under 80 words):** one sentence of primary gift evidence, one link (the portfolio for creative and product roles, linneamoritzdev.vercel.app for engineering), and one question about their team.

**Portfolio routing:** the new portfolio (https://claude.ai/artifact/SnNTvJAniCa4jQQ7LRdXyB, ported to `/portfolio`) gets a `?lens={gift}` parameter that reorders project cards by that gift's evidence. Every draft links the lens that matches its primary gift.

### 10. The story bank (interviews)

Generate one `ps_stories` row per gift in situation, action, number form, using only the evidence above. Each story gets:
- `gift_id`
- a 60-second spoken version
- the professional-language title an interviewer hears, e.g. "Spotting a data-integrity flaw before national TV" for Discernment, or "Turning a synthetic control model into a decision a kommunstyrelse could use" for Interpretation.

Before each interview, the agent puts a prep doc in Drafts: the role's top three gifts from its Gift Read, the matching three stories, the salary line ("Based on the role, I'm looking at 50,000 to 55,000 per month"), and the stability answer ("I want one team and one product for years").

### 11. Attraction, the proactive track

Applications pull. This track makes the right people come to me. The agent drafts everything, and I post or send it myself.

- **Weekly LinkedIn post draft (Mondays):** one gift, one real piece of work, one image from my art or a screenshot. Rotate through the ten gifts. Each post is written in professional language and ends with what I am looking for ("a full-time role on an AI, martech or solutions team in Stockholm"). Saved as a Gmail draft titled `LinkedIn post: {gift}`.
- **Proof drops:** every second week, one small demo built for a top target (Stewardship: a Google Ads Script pulling BigQuery scores for Klarna's ad tech team. Craftsmanship: a Shopify + Make flow for Aarke. Interpretation: a 2-minute Loom explaining a company's own product to a new customer). The agent proposes it, writes the build plan to `ps_events`, and drafts the cover email.
- **Warm network:** Minerva and UWC alumni in Stockholm. Draft 15 messages asking for a 15-minute call, each naming a gift I see in *their* work (Encouragement used outward). No job asks in the first message.

### 12. UI additions

- **Throne `/`:** add a "Gifts in play" strip: the ten gifts as cubist facets (seeded polygons in the portfolio palette), sized by how many live opportunities each one pulled this week. Click one to filter everything by that gift.
- **Sword `/job/[id]`:** show the Gift Read (primary and secondary gift, the ad's own words that call for them) next to both fit scores, with the svengelska flags on Swedish drafts.
- **Oracle `/oracle`:** the Kompetensgrafen PageRank graph, plus a toggle that colours occupations by which gift they draw on.
- **Mirror `/mirror`:** the gift bank, editable. Editing an evidence line regenerates the affected stories and the frozen CV summary lines only.
- **Harvest `/harvest`:** applications grouped by primary gift, with response rate per gift. After 20 applications, show which gift gets the most replies and the highest salary band. The agent then shifts the weekly mix toward that gift.

### 13. The daily agent (06:30 Europe/Stockholm, Vercel Cron), full order

1. Refresh the taxonomy cache if it is older than 7 days.
2. Hunt: Platsbanken (section 1) and career pages (section 2), with Kompetensgrafen and gift search terms. Keep permanent full-time listings only.
3. Drop blocked companies, gig titles and banned terms.
4. Score: both fit methods, then the Gift Read, then the final rank.
5. Draft the top 5 above 70: branch CV, gift-shaped letter, LinkedIn message, LanguageTool and svengelska checks, banned-terms guard, style linter, then IMAP APPEND to linneajobs@gmail.com Drafts.
6. Mondays: the LinkedIn post draft. Every second Monday: the proof-drop plan.
7. Deadlines within 3 days go to the top of Throne.
8. Read Drafts to detect what I sent and update `ps_applications`.
9. Write the morning brief as a draft titled `Persephone, {date}`: plan day, top 5 with primary gift, deadlines, and the gift of the week.
10. Log everything to `ps_agent_runs`.

---

## 14. Tests, deploy, stop

- Migrations for every new table and column.
- Tests:
  - no send capability
  - zero banned terms in repo, seeds, DB and output
  - blocked companies never surface
  - every surfaced job is permanent full-time; contract and staffing listings never surface
  - no em dashes or spiritual vocabulary in outgoing text
  - fit-score regression values from section 4
  - `ps_next_jobs` returns at most 50 rows and excludes applied jobs
  - PageRank converges and surfaces at least 3 of the expected discoveries
- Dry run with `DRY_RUN=1`: drafts go to label `Persephone/Test` only.
- Deploy to Vercel, confirm the cron, write `docs/GIFTS_ENGINE.md` (what was ported from which repo, what is new, test results, live URL), then stop.
