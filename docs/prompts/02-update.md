# PERSEPHONE UPDATE: read all of this, apply all of it, then keep building

You are the Claude Code session building **persephonejobportal**. This is a full update for you. It changes facts, rules, data and scope. Work through every section in order. Do not ask me questions. The only thing you may ask me for is a secret you cannot find yourself. Look for secrets first in the Vercel env of my other projects (vetlandajobb, antiapathyjobportal, crosstreeslaborintelligence, personalportfolio, bigquery-lead-scoring-sem) and in their local `.env*` files. Commit after each numbered section with a clear message. When you finish, write a short changelog to `docs/CHANGELOG.md` and stop.

---

## 0. Hard rules (these override everything, including the original prompt)

1. **Never send an email.** Never call any send endpoint, SMTP send, Gmail `messages.send`, Resend, Postmark, SendGrid or anything like them. The only email action you ever take is IMAP APPEND to `[Gmail]/Drafts` in **linneamoritzcv@gmail.com**. Add a test that fails if any send function or send-capable dependency appears in the codebase. Add a grep check to CI for `sendMail`, `messages.send`, `smtp`, `resend`, `postmark`, `sendgrid`.
2. **Never name the company that contracted my Feb to Apr 2026 work.** Banned strings: `Black Lotus`, `Black Lotus Ventures`, `BlackLotus`, `blacklotus`, `CareerGenius`, `PitchGenius`, `VCGenius`. That work appears ONLY as two projects: **The Financial Healer** and **PrePartum**. No company name above them, no "venture studio", no "Silicon Valley studio". Never write a reason for this rule in code, comments, docs, seeds, prompts or commit messages. Implement it like this:
   - Add the banned strings to `ps_writing_rules` with `kind = 'banned_term'`.
   - Add a guard function `assertNoBannedTerms(text)` that every generator (CV, cover letter, LinkedIn message, email draft, portfolio copy, interview story) runs before saving. If it finds a banned term, it throws and logs to `ps_agent_runs`. It never saves anything.
   - Scrub the whole repo, the seed data, the Supabase tables and every prompt template now. Run `grep -rni "lotus\|careergenius\|pitchgenius\|vcgenius" .` and get zero hits outside the banned-terms list itself.
   - Scrub Supabase: `update` every row in `ps_experiences`, `ps_facts`, `ps_stories`, `ps_cv_versions` and `ps_drafts` that contains a banned term. Rewrite it with the Financial Healer and PrePartum wording in section 2. Delete any draft that can't be rewritten cleanly.
3. **Precis is blocked.** Never suggest, score, draft for or list Precis or Precis Digital. Keep `blocked = true` on it in `ps_companies`, and filter blocked companies out of every query, view and agent step.
4. **No gig work.** Block Outlier, Lionbridge, Remotasks, DataAnnotation, Appen, TELUS AI, Scale AI rater roles, and any "AI trainer / rater / annotation" listing. Add them to `ps_companies` with `blocked = true`, and add a title filter for `rater|annotator|ai trainer|data labeling`.
5. **Languages:** Swedish and English, both native. Mandarin HSK 3. I do NOT speak Norwegian or Danish. Never claim them. Clubhouse covered the Swedish, Norwegian and Danish *markets*. That is market ownership, not language skill. Every application leads with my English.
6. **Writing style for all generated text:** plain, direct English, subject-verb-object. No em dashes, anywhere. No "not X, but Y" framing and no defining by contrast. Say what things are. Confident, high-energy, factual. Never invent a number, title, date or employer. If a fact is not in `ps_facts`, the generator may not use it. Add these to `ps_writing_rules` and run a linter on every output that rejects em dashes and the patterns `not just`, `rather than`, `isn't`, `instead of`.

---

## 1. Corrected facts (overwrite anything older)

Update `ps_profile`, `ps_experiences` and `ps_facts` to match exactly:

- **Current job:** Soil Food Web Foundation, **contractor** for digital, content and grants, Sep 2026 to present. This is my ONLY current role and the only one that says "present". Never call me "Digital & Content Lead" or any other made-up title.
- **The Financial Healer and PrePartum**, Product and Technical Lead, **Feb to Apr 2026**. Ended.
- **Human Bridge**, Warehouse Associate (lagermedarbetare), ended **31 Oct 2026**. Use it on the Swedish and corporate CV versions in one line. Leave it off the startup version.
- **Minerva University Alumni Ambassador:** **Sep 2024 to 2026**. Ended.
- **Lead scoring numbers are per month:** 959 to 6,603 Smart Bidding training events **per month** (6.9x), 20% lower CPA, 28,224 high-intent users with 0% conversion found. Never "daily".
- **Location:** moving to Stockholm. Header says Stockholm.
- **LinkedIn:** linkedin.com/in/linneamoritz
- **GitHub:** github.com/linneamoritznyc
- **Dev portfolio:** linneamoritzdev.vercel.app
- **New portfolio (second site):** https://claude.ai/artifact/SnNTvJAniCa4jQQ7LRdXyB (see section 6)
- **Art:** linneamoritz.com. 39 exhibitions in 21 cities, 3 first prizes including Stockholms Konstsalong 2024, Keeping Tabs collection on a 70 x 30 m LED display at Art Basel Hong Kong.
- **Education:** Minerva University, economics and business, GPA 3.6, 1.8% admission rate, studied in 5 countries, mentored 45 students through capstones. UWC Red Cross Nordic, full scholarship, chosen from 120 Swedish applicants, IB bilingual diploma (GPA 3.85).
- **Email:** linneamoritzcv@gmail.com is the only email address, for drafts, login and everything recruiters see. Never use any other address of mine.

---

## 2. The Financial Healer and PrePartum (the only allowed wording)

Replace the old Feb to Apr 2026 experience row with two project rows that share one header line:

**The Financial Healer and PrePartum, Product and Technical Lead (Feb to Apr 2026, remote, US founders)**

The Financial Healer (credit repair, Cleveland):
- Built an AI voice agent (Retell AI, ElevenLabs, Claude API) that replaced 16 manual calls a day.
- Built a Square to CRM webhook chain on Railway that runs payment to CRM in under 60 seconds.
- Built an AES-256 credential vault and a Notion COO command center.
- Fixed 18+ production bugs, including a user-isolation data-integrity flaw, before a US national TV campaign.
- The client grew 5x.

PrePartum (Mother of Many):
- iOS app for a mother's emotional preparation for motherhood, launched on the App Store in April 2026 (prepartum.mom).
- 5 mother personas, a 24-question intake, 95 reflection questions, AI practice conversations, $9/month subscription.

Interview story replacement: anywhere a story used CareerGenius as proof that I fix code under a builder, use The Financial Healer voice agent and the 18+ production bug fixes instead.

---

## 3. Target list (seed `ps_jobs` and `ps_companies`)

Aarke's Automation & AI Specialist role is **closed** (published 2026-06-23, "Ansökningsperioden har avslutats"). Mark it `status = 'closed'`. Aarke's open roles are Content Lead/Manager and Ad Creator. Add those with `status = 'check'`. Contact: Anna Korling, anna@aarke.com. Delete any existing Aarke Automation draft and regenerate it for Content Lead.

Seed these 21 roles. Wave, company, role, family, status:

| Wave | Company | Role | Family | Status |
|---|---|---|---|---|
| 1 | Lovable | Creative Technologist | 4 | open |
| 1 | Lovable | Product Experience Specialist | 3 | open |
| 1 | Lovable | Member of Technical Staff, Applied AI (Marketing) | 1 | open |
| 1 | ElevenLabs | Deployment Strategist, Sweden | 3 | check |
| 1 | ElevenLabs | Forward Deployed Engineer, Sweden | 3 | check |
| 1 | Nextory | Social Media Manager | 4 | open |
| 1 | Aarke | Content Lead / Ad Creator | 4 | check |
| 2 | H&M | Product Owner, Store Digital Visual Experience | 4 | deadline 2026-11-27 |
| 2 | SEB | Senior Full Stack Developer / AI Engineer | 1 | deadline 2026-11-27 |
| 2 | Fortnox | Product Manager, AI Assistant | 1 | rolling |
| 2 | Fortnox | Senior Developer, internal AI team | 1 | rolling |
| 2 | Sana | Engagement Associate | 3 | check |
| 2 | Legora | Solutions Engineer | 3 | check |
| 3 | Klarna | Ad Tech Specialist | 2 | check |
| 3 | Epidemic Sound | MarTech Engineer | 2 | check |
| 3 | Google | Advertising Solutions Architect, Measurement | 2 | check |
| 3 | Swedbank | AI Automation Analyst | 1 | check |
| 3 | KPMG | AI Solutions Engineer, Tax & Legal Technology | 6 | check |
| 3 | Deloitte | AI & Data consultants | 6 | check |
| 3 | Spotify | Backend Engineer II, Trust & Safety | 5 | check |
| later | SEB | Tech Trainee Programme 2027-28, AI Engineer | 1 | deadline 2027-01-10 |

Role families (`ps_role_families`):
1. AI automation and internal AI builder
2. Martech and media solutions engineer
3. Customer-facing roles at AI startups (product experience, engagement, deployment)
4. Creative technologist and AI video
5. Trust & Safety
6. AI consulting at the Big Four and the banks

Known fit scores from vetlandajobb `scoreJob`. Store them in `ps_matches` with `method = 'vetlandajobb_v1'`: ElevenLabs FDE 100, Aarke Content 100, Fortnox PM 100, Sana 100, Klarna Ad Tech 100, Google ASA 100, Lovable PES 88. Rescore all of them with the crosstrees `fit_score.py` method (TF-IDF, 0.6/0.3/0.1, Wilson 95% interval) and store those too, with `method = 'crosstrees_v1'`. Show both on the Sword page.

Salary target: 45,000 to 60,000 SEK per month. The spoken answer is "Based on the role, I'm looking at 50,000 to 55,000 per month."

Preference: in-office roles at big companies get the most care (H&M, SEB, Klarna, Spotify, Google, Fortnox, Swedbank, KPMG, Deloitte). Add `ps_profile.prefers_big_company = true` and boost big companies by 10 points in ranking.

---

## 4. Full-time only (new rule)

I want a **full-time permanent job** in Stockholm, in-office, with coworkers and stability. Remove the US remote contract track completely: drop `track = 'us_remote'`, the Huzzle and UMATR sources, and the agency list. Filter every source to permanent full-time listings (AF Tillsvidare + Heltid, ATS `Full-time` / `Permanent`). Drop contract, freelance, interim and bemanning listings. Store `ps_jobs.employment_type` and show it on every card.

---

## 5. Material from my Google Drive (ingest as facts and stories)

I built a lot of job-portal and labor-market work before. Add each as a `ps_experiences` row with `kind = 'project'`, plus facts and stories. Use only what is written here.

**Anti-Apathy Job Portal** (Drive folder "Anti Apathy Job Portal"; repo antiapathyjobportal)
- Paste a job URL and get a tailored Gmail draft with the right CV PDF attached, in under 60 seconds.
- Four steps: scrape, LLM analysis (Claude 3.5 Sonnet / Gemini 1.5 Pro), pick one of 8 CV personas, draft into Gmail by IMAP with an app password.
- FastAPI backend, React + Tailwind frontend, confetti rewards, a human-in-the-loop editor.
- It proved IMAP drafts work: 29 drafts landed in linneamoritzcv@gmail.com.
- Reuse its IMAP draft code for Persephone. Retire its 8 Swedish 2024 CVs as sources of truth.

**JobbaJobba** (Drive folder "JobbaJobba")
- An app that shows which other occupations your experience opens up, using Arbetsförmedlingen open data and the ESCO taxonomy, with the share of skill requirements you already meet.

**Kompetensgrafen** (Crosstrees)
- A graph dashboard on Neo4j and ESCO that shows skill shortages per occupation in a county and counts nearby workers with high overlap. Example in the doc: 1,340 machine operators with 68% overlap with wind turbine technicians.
- Two action tracks: education matching (which YH course closes the gap and where it runs) and regional matching with relocation packages.
- Personalized PageRank, AF substitutability data, SCB education statistics.
- Slides: kompetensgrafen_kompetensradet_30s. Also a 7-page letter to Emil Eifrem.

**From 63 to 11 million SEK** (municipal budget tool, live at from63to11million-sek-65ry.vercel.app/beslut)
- A synthetic-control "twin municipality" built from 290 Swedish municipalities, difference-in-differences check, linear programming for budget priorities, Monte Carlo uncertainty, plain-language Swedish PDF reports. Data: Kolada, SCB PxWeb, AF APIs.

**Vetlandajobb** (Drive: Strategidokument 13 June 2026, startprompt, Byggprompt, VETLANDAJOBB_EXPORT.md)
- Local job app for Vetlanda: Platsbanken + jobb.vetlanda.se, free CV career analysis, premium AI cover letters and CV rewrite at 250 kr/month on Stripe, trial code sökajobbgratis. Next.js 15 on Vercel, Anthropic API.
- Its `lib/match.ts` `scoreJob` is Persephone's first fit-score method.

**Platsbanken-ai** (Drive: Information Retrieval Platsbanken-ai, platsbanken_ai_summary.pdf)

**NordiqFlow** (Drive folder: founders manual v1/v3, Vinnova application, Science Park application, MVP roadmap, finansieringsplan). Govtech labor-market platform for Swedish municipalities.

Write one `ps_stories` row per project in situation, action, number form, and tag each with the role families it supports. Kompetensgrafen and 63-to-11 support family 1 and the consulting family 6. Anti-Apathy and Vetlandajobb support families 1 and 3.

---

## 6. Soil Food Web Foundation record (replace the old SFW content)

Use these six CV bullets everywhere. They are the approved wording:

1. Led images, copy and redirects for the new soilfoodweb.com, which launched 16 Oct 2026: chose 197 final workshop images across 13 folders, wrote the copy for every workshop page, planned the URL changes and redirects, and logged 68 staging bugs on monday.com.
2. Set up SFW's first merch store (Shopify and Printful) within 2 weeks: designed the products, chose print-on-demand with worldwide shipping, and wrote a memo on unrelated business income for the lawyer.
3. Took over grant research from the Executive Director, built the grant tracker, and is drafting 3 applications (Harry Chapin, Regenerative Agriculture Foundation, Clif Family Foundation) toward a goal of USD 1M in 12 months.
4. Plans organic social media a month ahead (3 posts a week plus stories) and runs YouTube Shorts posting 4 times a week across YouTube, Instagram and Facebook (about 50,000 Instagram followers).
5. Taught myself video editing: webinar Shorts, workshop videos and Reels with Remotion and ElevenLabs voiceover.
6. Built internal tools with Claude Code: an asset library with an AI content pipeline, the Wormhole post planner and an interactive map of Dr. Elaine Ingham's publications.

Also done (facts, one line each): two trifold brochures, visuals for 5 India workshop decks, 4 Giving Tuesday fundraising documents, the Field Guide to Soil Life, the SFW Communications Guide, the Microscopy Photo Asset Library.

The full record lives in `linnea-sfw-work-record.md` (Appendix B of the original prompt). Replace Appendix B with it if yours differs.

---

## 7. CV versions (regenerate all three)

The master CV is the English Technical CV from 6 May 2026, with every correction above applied. Store three versions in `ps_cv_versions`:

| Version | Families | Lead line | Top three proof points |
|---|---|---|---|
| A: AI Builder | 1, 3 | I build AI tools that businesses run on every day | Financial Healer voice agent, 11 production web apps in 2 months, Bidragsguiden |
| B: Martech | 2 | Google Ads background, now building the data and automation side | gTech 2018-19, BigQuery lead scoring (6.9x per month, 20% lower CPA, 28,224 users), Shopify GA4 high-intent signal to Smart Bidding |
| C: Creative & Trust | 4, 5 | Content judgment from both sides: making it and moderating it | Apex TV ad rescue in Remotion, Clubhouse sole T&S owner for Scandinavia (16 harm categories), SFW Shorts and Reels |

Skills grid additions: Python, Claude Code, MCP, Lovable, Replit, Remotion, Jest, GitHub Actions, BigQuery, GTM, Smart Bidding. Add the repo link github.com/linneamoritznyc/bigquery-lead-scoring-sem.

Render each version to PDF and store it in Supabase Storage bucket `cv`. Attach the right PDF to every IMAP draft.

---

## 8. New portfolio integration

I have a second portfolio at https://claude.ai/artifact/SnNTvJAniCa4jQQ7LRdXyB. Its look: a cubist canvas, white ground (night: #0e1220), pomegranate #c2364b, ultramarine #2b3fd1, ochre #d9a43c, plum #3a2142, Instrument Serif + Inter, generated faceted polygons per project.

- Add `ps_profile.portfolio_urls` with both portfolios. The generator picks linneamoritzdev.vercel.app for engineering roles and the new portfolio for creative, martech and product roles.
- Port the portfolio into this repo as a route `/portfolio` (static, public, no auth), so it lives on my own domain. Its project cards come from `ps_experiences where show_on_portfolio = true`. The cubist art is a seeded generator: one seed per project, stored in `ps_experiences.art_seed`.
- Add a Mirror page panel that previews how each project card reads, and runs `assertNoBannedTerms` on it live.
- Persephone's own UI keeps its tokens (bg #0B0E1A, pomegranate #C2364B, Cormorant Garamond + Inter). The shared pomegranate ties the two together.

---

## 9. Outreach templates (replace `ps_writing_rules` templates)

Every message is under 80 words, with one link and one ask. All of them go to drafts only.

LinkedIn, to someone on the hiring team:
> Hi {name}, I just applied for {role}. I build AI tools for real businesses. Right now I run digital, content and grants for the Soil Food Web Foundation, and before that I built a voice agent on ElevenLabs that replaced 16 manual calls a day for a US client. Before that I worked in Google Ads gTech and Trust & Safety at Clubhouse. Here's a 2-minute demo: {loom}. Could I ask you two questions about the team?

Aarke, to Anna Korling (rewrite for Content Lead / Ad Creator):
> Subject: Content Lead: short-form video, social and automation
> Hi Anna, I make short-form video and social for a global nonprofit: YouTube Shorts 4 times a week to about 50,000 Instagram followers, Reels in Remotion with ElevenLabs voice, and a full website photo launch. I also build Shopify and AI automations, which would speed up Aarke's content production. Portfolio: {portfolio}. CV attached. Could we talk this week?

Follow-up, 5 days after applying:
> Hi {name}, following up on my application for {role}. Since applying I built {demo} for your team: {link}. Happy to walk you through it.

Warm network (Minerva and UWC alumni in Stockholm): ask for a 15-minute call and keep the message free of job requests.

---

## 10. The 10-day plan (seed `ps_events` as the calendar)

| Day | Date | Do | Done when |
|---|---|---|---|
| 1 | Sat 21 Nov | Update the master CV with every fix. LinkedIn headline "AI builder: automation, voice agents, martech", Open to Work for recruiters only | Master CV exists |
| 2 | Sun 22 Nov | Make CV versions A, B, C. Record a 2-minute Loom: voice agent, Bidragsguiden, lead scoring, SFW Wormhole + one Short | 3 PDFs, 1 Loom |
| 3 | Mon 23 Nov | Wave 1 (7 roles) + one LinkedIn message per role | 7 sent, 7 messages |
| 4 | Tue 24 Nov | Wave 2 (6 roles), H&M and SEB first (close 27 Nov). Aarke email draft | 13 sent |
| 5 | Wed 25 Nov | Wave 3 (7 roles) | 20 sent |
| 6 | Thu 26 Nov | 15 warm messages to Minerva and UWC alumni in Stockholm | 15 messages |
| 7 | Fri 27 Nov | Follow up Wave 1. Write 5 interview stories | 5 stories |
| 8 | Sat 28 Nov | One small demo for the top target | 1 demo live |
| 9 | Sun 29 Nov | Salary answer out loud 3 times, mock interview for top 2 roles | Done |
| 10 | Mon 30 Nov | Second follow-up, book Stockholm interview days, send the demo | Interviews booked |

"Sent" in Persephone means **I** sent it from Gmail. Persephone only marks it sent when I click "I sent this" on the Harvest page, or when its daily IMAP read sees the draft has left the Drafts folder. Persephone itself never sends.

---

## 11. Daily agent changes (06:30 Europe/Stockholm, Vercel Cron)

1. Pull new jobs (JobSearch API for Stockholm + career pages). Drop blocked companies, gig titles and non-permanent listings.
2. Keep permanent full-time listings only. Score every new job with both fit methods. Boost big companies by 10.
3. For the top 5 above 70: pick the CV version by family, generate a cover letter and a LinkedIn message, run the banned-terms guard and the style linter, then IMAP APPEND to linneamoritzcv@gmail.com Drafts with the PDF attached.
4. Check deadlines. Anything within 3 days goes to the top of Throne in pomegranate.
5. Read the Drafts folder and update application status.
6. Write a run summary to `ps_agent_runs` (counts, errors, guard rejections).
7. Write one morning brief as a draft titled "Persephone, {date}" to linneamoritzcv@gmail.com. It lists today's plan day, new top matches and deadlines. Keep it as a draft and never send it.

---

## 12. Deployment and checks

- Run the Supabase migrations for every new column: `track`, `blocked`, `prefers_big_company`, `portfolio_urls`, `show_on_portfolio`, `art_seed`, `method`, `timezone_overlap_hours`, plus `kind` on writing rules.
- Redeploy to Vercel. Confirm the cron is registered.
- Add these tests, then run them and make them pass:
  - banned terms: zero hits in the repo, seeds, DB rows and generated output
  - no send capability
  - Precis and gig companies never appear in any view
  - no em dashes in any generated text
  - Financial Healer and PrePartum appear with dates Feb to Apr 2026 and no company header
- Do one dry run of the daily agent with `DRY_RUN=1`. It writes drafts to a test label `Persephone/Test` in linneamoritzcv@gmail.com, never to the Inbox, and never sends.
- Write `docs/CHANGELOG.md` with what changed, the test results and the live URL. Then stop.
