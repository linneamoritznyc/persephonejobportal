# 04: ONE SITE ON VERCEL: PUBLIC PORTFOLIO + PRIVATE JOB COCKPIT

You are the Claude Code session building **persephonejobportal**. Run this after `02-update.md` and `03-gifts-engine.md`. Do not ask me questions. Ask only for a secret you cannot find in the Vercel env or `.env*` files of my other repos (vetlandajobb, antiapathyjobportal, crosstreeslaborintelligence, personalportfolio, bigquery-lead-scoring-sem). Commit after each section, deploy at the end, write `docs/DEPLOY.md`, then stop.

The idea: one Next.js app, one Vercel project, one domain.
- **The front door is public:** my new portfolio at `/`.
- **The back room is private:** a small "Sign in" link in the portfolio footer leads to `/login`. Behind it sits my job cockpit, where I find jobs, read drafts, tailor them and track every application.

All hard rules from 02 and 03 still apply:
- never send email; drafts go only to linneacv@gmail.com
- banned terms guard
- Precis and gig platforms blocked
- full-time permanent roles only
- no em dashes in generated text

---

## 1. App shell

- Next.js 15 App Router, TypeScript, Tailwind, deployed on Vercel. If the repo already has an app, keep it and restructure it into the route groups below.
- Route groups:
  - `app/(public)/` holds the portfolio. It is static, fast and indexable.
  - `app/(cockpit)/` holds everything private, under `/app/*`. Every route here is protected.
  - `app/api/` holds API routes and cron handlers. Cockpit APIs check the session on every call.
- Supabase: the existing project with the `ps_` schema from `supabase/`. Use `@supabase/ssr` for server-side auth cookies.

## 2. Public portfolio (`/`)

- Port `portfolio/index.html` into `app/(public)/page.tsx` exactly as it looks. That means:
  - Instrument Serif and Inter through `next/font`
  - the white ground (night #0e1220), pomegranate #c2364b, ultramarine #2b3fd1, ochre #d9a43c and plum #3a2142
  - the seeded cubist polygon generator as a client component
  - the **Saw / Built / Reached** rows on every card
  - the "People I've brought along" band, the path timeline, the painter section and the red contact band
- Project cards read from `ps_experiences where show_on_portfolio = true order by portfolio_order`. Each row needs columns `saw`, `built`, `reached`, `tags text[]`, `url`, `filter`, `art_seed`. Seed them with the nine projects currently in `portfolio/index.html`, using that wording exactly.
- `?lens=` parameter (from 03): `/?lens=interpretation` reorders cards by that gift's evidence. The lens never shows on the page as text. It only changes the order.
- Stats, the timeline and the people band come from `ps_facts` rows tagged `portfolio`, so I can edit them in the cockpit.
- SEO: title "Linnea Moritz", meta description "AI builder in Stockholm. I find the structure in messy problems, build the tool that fixes them, and bring people along to use it." Add an Open Graph image generated with `next/og` from the cubist generator (seed 7) with my name in Instrument Serif. Add `sitemap.ts` and `robots.ts`. Robots must disallow `/app` and `/login`.
- Footer: "Linnea Moritz, Stockholm" on the left. On the right, a quiet text link "Sign in" to `/login`, 14px, muted colour.
- Lighthouse target: 95+ on performance and accessibility. The portfolio ships no Supabase client JS.

## 3. Login (`/login`)

- One screen: my name in Instrument Serif, one email field, one button "Send magic link". It uses the portfolio palette.
- Supabase Auth magic link (email OTP). Disable sign-ups in the Supabase dashboard config.
- **Allowlist:** the env var `COCKPIT_ALLOWED_EMAILS=linneacv@gmail.com`. Middleware and every server action reject any other email, even with a valid session.
- After sign-in, redirect to `/app`.
- `middleware.ts` protects `/app/:path*` and `/api/cockpit/:path*`. No session means a redirect to `/login`.
- Turn on RLS on every `ps_` table with policy `auth.email() = any(allowed_emails)`. The service role key is used only in cron handlers on the server.

## 4. The cockpit (`/app/*`)

The design: the same app in its night clothes. Ground #0B0E1A, pomegranate #C2364B, ultramarine and ochre as accents, Cormorant Garamond for headings, Inter for text. Desktop gets a left sidebar. Phone gets a bottom tab bar with 5 tabs. It is installable as a PWA (manifest, icons, service worker), so it opens like an app on my iPhone.

The pages, with plain names in the UI:

### 4.1 Today (`/app`), Throne
- Top band: plan day X of 10 and today's task from `ps_events`.
- **Deadlines:** jobs closing within 3 days, in pomegranate, at the top.
- **Top matches:** 5 cards. Each card shows company, role, location, employment type (must say Permanent, full-time), final score, both fit scores, and the primary strength from the Gift Read in professional words (for example "Solutions and translation").
- **Drafts waiting:** count of drafts in linneacv@gmail.com that I haven't opened, with a button "Open Gmail drafts" linking to `https://mail.google.com/mail/u/?authuser=linneacv@gmail.com#drafts`.
- **Pipeline strip:** counts for Found, Drafted, Sent, Interview, Offer.

### 4.2 Jobs (`/app/jobs`), the Court
- A searchable, filterable list from `ps_next_jobs()`:
  - filters for wave, family, company, status, deadline, min score, source (Platsbanken, career page, Kompetensgrafen discovery)
  - sort by score, deadline or newest
- Row actions:
  - **Draft it**: runs the application machine for this one job now and saves to Gmail drafts
  - **Skip**: writes `ps_feedback` and hides the job forever
  - **Save for later**
- Bulk select, then "Draft all selected".
- An "Add a job" button: paste a URL from any site. The server scrapes it (Teamtailor, Greenhouse, Lever, Ashby or generic) and adds it to `ps_jobs`. This is the Anti-Apathy flow: URL in, job in the list in seconds.

### 4.3 Job detail (`/app/jobs/[id]`), the Sword
- **Left column:** the full posting, with the phrases that match my skills highlighted.
- **Right column:**
  - **Scores:** vetlandajobb score, crosstrees score with its confidence interval, the Gift Read (primary and secondary strength, the ad's own words that call for them), big-company bonus, final rank.
  - **CV:** which of the 12 branch CVs was chosen, with a dropdown to switch and a PDF preview.
  - **Cover letter:** an editable rich-text editor with the draft. Buttons: "Regenerate", "Shorter", "More confident", "Swedish / English". Swedish text shows LanguageTool errors and the KBLab svengelska flags inline, each with a one-click fix.
  - **LinkedIn message:** editable, with a live counter for the 80-word limit and a Copy button.
  - **Contact:** the hiring manager or a team member if known (name, LinkedIn URL), editable.
  - **"Save to Gmail drafts"** button: IMAP APPEND to linneacv@gmail.com with the chosen CV attached. After success, show "Draft saved. Open Gmail to send." with a link. Nothing on this page ever sends.
  - **"I sent it"** button: marks the application Sent with today's date and schedules a follow-up draft for 5 days later.
- Each save runs the banned-terms guard and the style linter. A failure shows the exact sentence in red and blocks the save.

### 4.4 Applications (`/app/applications`), the Harvest
- A kanban with columns Drafted, Sent, Follow-up due, Interview, Offer, Closed. Drag to move.
- Every card shows its dates, the next action and the primary strength.
- **Insights panel:**
  - reply rate by strength, by role family, by source and by CV version
  - median days to reply
  - after 20 sent applications, one plain sentence such as "Solutions and translation roles reply 3x more often. This week's mix shifts toward them." The daily agent reads this and adjusts.

### 4.5 Me (`/app/me`), the Mirror
- Edit my master facts (`ps_facts`, `ps_experiences`, `ps_stories`). Each experience row has a "Show on portfolio" toggle and the Saw / Built / Reached fields. Saving revalidates `/` with `revalidatePath('/')`, so the public portfolio updates in seconds.
- The 12 branch CVs: view, edit the summary line, regenerate one, download the PDF.
- The writing rules and banned terms list, viewable. Banned terms are view-only.
- The 10 strengths with their evidence (the internal gift bank), editable. This page is private, so the gift names may appear here.
- A live preview panel: pick a project and a lens and see the public card exactly as a recruiter sees it.

### 4.6 Discover (`/app/discover`), the Oracle
- The Kompetensgrafen graph: me in the centre, discovered occupations sized by PageRank, edges coloured by overlap %. Built with a force layout on canvas.
- Click an occupation to see its overlap %, gap skills, the search terms it generated and live jobs found through it.
- A toggle colours occupations by which strength they draw on.

### 4.7 Agent (`/app/agent`)
- The last 30 runs from `ps_agent_runs`: time, jobs found, drafts made, guard rejections, errors.
- A "Run now" button that triggers the daily agent on demand with a 1-minute cooldown.
- A "Dry run" toggle.
- The morning brief, rendered here too.

### 4.8 Interview prep (`/app/interviews/[id]`)
- Opens from any application in the Interview column.
- Shows the three strengths the role calls for, the matching three stories in 60-second spoken form, the salary line ("Based on the role, I'm looking at 50,000 to 55,000 per month"), the stability line ("I want one team and one product for years"), and 5 likely questions with my answer notes.
- A "Practice" button opens a chat with Claude playing the interviewer for this exact role. The transcript is saved to `ps_stories` notes.

## 5. Server pieces

- Server actions for every cockpit write, each one checking the allowlist.
- `app/api/cron/daily/route.ts` is the daily agent from 03, registered in `vercel.json` at `30 5 * * *` UTC (06:30 Stockholm in winter). Protect it with `CRON_SECRET`.
- `lib/mail/imapDraft.ts` is ported from antiapathyjobportal. It is the only mail code in the repo and exports one function, `saveDraft()`. CI fails on any send-capable code.
- `lib/hunt/*`, `lib/score/*` and `lib/gifts/*` come from 03.
- Claude API calls use prompt caching on the master resume and the gift bank. Use Haiku for Gift Reads and scraping, and Sonnet for letters.
- Rate limit cockpit APIs per session with Upstash, or with a simple Supabase counter if no Upstash key exists.

## 6. Environment variables (look these up yourself first)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `GMAIL_DRAFTS_USER=linneacv@gmail.com`, `GMAIL_DRAFTS_APP_PASSWORD`, `LANGUAGETOOL_URL`, `HUGGINGFACE_API_KEY`, `CRON_SECRET`, `COCKPIT_ALLOWED_EMAILS`.

The only one likely missing is the Gmail app password for linneacv@gmail.com. If it is missing, finish everything else, deploy, and put a single line at the top of `/app`: "Add GMAIL_DRAFTS_APP_PASSWORD in Vercel to turn on drafts". Then ask me for it in your final message.

## 7. Deploy

1. Link the repo to a new Vercel project named `persephone` (or reuse it if it exists). Production branch: the current default branch.
2. Set all env vars for Production and Preview.
3. In Supabase Auth, set the Site URL to the Vercel production URL and add the redirect `https://<prod>/auth/callback`.
4. Deploy. Check `/` loads without auth, `/app` redirects to `/login`, the magic link works for linneacv@gmail.com, and any other email is refused.
5. Run the daily agent once with `DRY_RUN=1` and confirm drafts land under the label `Persephone/Test`.
6. Write `docs/DEPLOY.md` with the production URL, how to add a custom domain later (for example linneamoritz.dev), the env var list and the test results. Then stop.
