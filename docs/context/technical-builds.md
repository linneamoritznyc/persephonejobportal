# Technical builds: what Linnea has engineered

Use this for engineering, solutions and AI-builder roles. Every item comes from her repos at github.com/linneamoritznyc or her build docs. Repo names marked (private) need a walkthrough or screenshots instead of a link.

## The strongest five (lead with these)

### 1. SFW Content Studio (repo SFWassetlibrarycontentautomation, public)
An asset library and AI content machine for the Soil Food Web Foundation, built for 7.34 TB of raw workshop footage.

What it does:
- ingests photos, video and documents
- tags and transcribes them
- cuts good moments out of long videos
- drafts posts against brand rules, then critiques its own drafts
- asks a human when it doesn't know something
- learns from every edit

Architecture:
- **Turborepo + pnpm monorepo**, TypeScript everywhere.
- `apps/web`: Next.js 14 on Vercel, the UI and every API route.
- Four workers on Railway:
  - `light`: Claude calls, DB work, Canva, news scout, planner. Concurrency 4.
  - `media`: FFmpeg and Whisper for proxies, transcripts and clip cuts.
  - `render`: Remotion Reel renders.
  - `cron`: inserts scheduled jobs only.
- **Job queue in Postgres:** nothing calls a worker directly. Every automation is a row in `jobs`, workers claim jobs, and every job is idempotent and retried with backoff. Dead jobs show in the app.
- **Supabase:** 10 migrations, about 800 lines of SQL, 30 tables. They include:
  - assets, tags, transcripts, people, smart_folders (saved filters)
  - feeds and news_items (a soil news scout)
  - facts, rules, questions, stories
  - posts and post_versions, renders, canva_links, asset_usage
  - prompts (versioned), ai_calls, eval_runs, test_cases, planner_weights
  - worker_heartbeats
  - RLS on everything
- **AI discipline:** every Claude call returns JSON, is validated with zod, is logged to `ai_calls`, and loads its prompt from the `prompts` table by name and version. There's an eval harness with test cases.
- **Storage:** Cloudflare R2. Provenance tracking: who took each asset, where it came from, and a link back to its original Drive location.
- **Packages:** ai, brand, db, prompts, queue, remotion, shared, storage. Tests run on Vitest.

Interview line: "I designed it so every AI call is versioned, validated, logged and evaluated, and every job is idempotent. It's built to be trusted."

### 2. SFW Practitioner Directory v2 (repo SFW-consultant-directory, public)
A prototype of the matching layer for SFW's global directory of soil consultants. It finds practitioners by fit, beyond location alone.

- **Stack:** Next.js, React, MapLibre GL, Postgres with PostGIS, pg_trgm, unaccent and tsvector full-text search.
- **Structured multi-select filters:** role, crops, soil types, languages, biome, remote, accepting clients.
  - Crops are hierarchical: "Perennial fruit" matches vineyards.
  - Facet counts are computed against the applied filters, so users never hit a dead end.
- **Search:**
  - synonym expansion across languages ("viñedo" finds vineyard practitioners)
  - accent-folding
  - trigram fuzzy fallback for misspellings ("Turkiye", "Gothenburg")
- **URL as state:** every filter combination is a shareable, bookmarkable URL.
- **Map and list share one selection model:** clustered map pins are colour-coded by role. Hover a card and its pin lifts; click a pin and its card scrolls into view.
- **Empty states** name the failing constraint and link the nearest relaxations, with counts.
- **Guided intake:** 7 questions return 3 ranked practitioners, each with a plain-language reason.
- **Privacy:** a contact relay replaces exposed raw emails.
- Built to a written PRD with a live-site addendum.

### 3. Persephone (repo persephonejobportal, public)
Her own job-search agent, the app this file lives in.
- Next.js on Vercel, with a public portfolio and a private cockpit.
- Supabase `ps_` schema with RLS and an email allowlist.
- A daily cron agent hunts jobs:
  - the Platsbanken JobSearch API
  - Teamtailor, Greenhouse, Lever and Ashby adapters
  - Personalized PageRank over Arbetsförmedlingen's substitutability graph and ESCO
- Two fit scores, including TF-IDF with Wilson confidence intervals.
- A static CV library, then cover letters from Claude with prompt caching.
- Swedish checks: LanguageTool plus a KBLab BERT detector for "svengelska".
- Saves drafts by IMAP APPEND. CI fails if any email-send capability exists.

### 4. Kompetensgrafen and the 63-to-11 budget tool (repos crosstreeslaborintelligence, From63to11millionSEK (private), crosstrees-budget-vetlanda (private))
- **Kompetensgrafen:**
  - a Neo4j AuraDB graph of ESCO occupations and skills
  - AF substitutability edges
  - Personalized PageRank
  - FastAPI and Next.js
  - fit scores with Wilson 95% intervals
- **63-to-11 million SEK:**
  - a synthetic control method (Abadie, Diamond and Hainmueller) building a twin municipality from 290 Swedish municipalities
  - difference-in-differences robustness check
  - Monte Carlo uncertainty
  - linear programming for budget allocation
  - Kolada, SCB PxWeb and AF APIs
  - a natural-language interface that writes Swedish PDF reports
  - live at from63to11million-sek-65ry.vercel.app/beslut

### 5. The Financial Healer (Feb to Apr 2026)
- An AI voice agent on Retell AI, ElevenLabs and the Claude API that replaced 16 manual calls a day.
- A Square to CRM webhook chain on Railway that runs in under 60 seconds.
- An AES-256 credential vault and a Notion COO command center.
- Fixed 18+ production bugs, including a user-isolation data-integrity flaw, before a US national TV campaign.
- The client grew 5x.

## More SFW builds

- **SFW website rebuild (repo SFW-newwebsite, public; live at finalsite-tau.vercel.app):**
  - 23 pages of static HTML with one stylesheet, one script, self-hosted fonts and no build step, deployed on Vercel
  - a design-system reference page, a motion system (motion.css and motion.js), Three.js on the science pages
  - an interactive publications map, a calendar, a directory, and the bioregion toggle on the student and directory maps
  - also: editable PPTX exports, the trifold print files and an accessibility page
  - a follow-up repo, final-SFWsite-Linnea, holds polished page mockups
- **SFW Social Media repo (SFW-SocialMedia, public):**
  - INVENTORY.md catalogues 273 assets with path, dimensions, duration and searchable descriptions
  - holds the colour tokens, an SOP, templates and the trifold design
  - ASSET-MACHINE.md proposes a licence-tracking column and a carousel generator
- **Wormhole:** a password-protected post planner (wormholelinnea.vercel.app). The team scrolls mock Instagram and LinkedIn feeds and the editor changes text live.
- **SFW Reel Studio (sfw-reel-studio, private):**
  - a CapCut-style editor with an AI chat panel that makes edits live
  - Remotion motion graphics, ElevenLabs voiceover, Cloudflare R2 storage
  - an OpusClip API integration planned
  - goal: paste a YouTube webinar link and it starts clipping on its own
- **SFW Clipping (SFW-Clipping, private):** an earlier webinar clipping pipeline.
- **Merch print files (sfw-merch-print-files, public):**
  - generative "creative-code" scripts for patterns, camo, embroidery, notebook and weekender designs from source micrographs
  - print specs for Printful
- **Learning games (DirtKitchen, private):**
  - DirtKitchen, a brewing game built on the Liquid Amendments course deck
  - Oregon Orchard (permaculture)
  - Microcosm (planned): re-run Dr. Ingham's soil experiments in a jar
  - scientific sources shown in-game
- **Smaller SFW builds:**
  - org chart map (orgchartmapSFW, private, SSO-protected on Vercel)
  - sfw-site-audit (private), the staging audit behind the 68-bug list
  - multilingualsfwsite (private), a multilingual prototype
  - sfw-testimonials (private)
  - naturalfarmingindiaresearch (private), comparing the SFW method with Indian natural farming
  - India-Slides (private), the visuals for 5 India workshop decks
  - Open-licence-SFW (private), open-licence image research

## Other builds

- **Bidragsguiden (public):** an 8-step grant quiz with structured Claude results, Supabase RLS and rate limiting.
- **CBAM-Validator (private):** an EU carbon border tax checker, launched Feb 2026.
- **bigquery-lead-scoring-sem (public):**
  - propensity tiers in SQL on the GA4 BigQuery export, with server-side GTM and Google Ads offline conversion import
  - 6.9x more training events per month, 20% lower CPA
  - Jest and GitHub Actions
- **Vetlandajobb (private):** Next.js 15, the JobSearch API, a municipal-site scraper, Stripe at 250 kr/month, skill-match scoring.
- **Anti-Apathy Job Portal (public):** FastAPI, React and Tailwind. A job URL becomes a Gmail draft in under 60 seconds. 8 CV personas, IMAP, the LanguageTool API.
- **Crosstrees voice agent (crosstrees-voiceagent, private):** voice agent work.
- **Smålands Företagskarta (public):** regional business intelligence map for Jönköping County.
- **The Palace (public):** spatial project management for executive-function needs.
- **Minerva ambassador portal and CRM docs:** a portal plus CRM documentation for a 196-school Nordic outreach.
- **Digitala produktpass (public):** a digital product passport prototype.
- **Games and art tech:** tesseractgame, gallerywallvideogame, cubistrabbit (generative cubist art).
- **Client sites:**
  - landing pages: nordkom, oscar
  - portfolios: Anna Levitova, Trevor
  - VintageJewelryStorefront
  - 10krunningeurope, provencebiking

## How to describe her engineering style

- Spec first: PRDs, backend specs and decision logs live in the repo (docs/DECISIONS.md, docs/PROGRESS.md).
- AI that can be trusted: versioned prompts, zod-validated JSON, logged calls, eval runs, a human-in-the-loop question queue.
- Boring reliability: Postgres job queues, idempotent jobs, retries with backoff, heartbeats, RLS everywhere.
- Ships with AI pair programming (Claude Code) and owns the architecture and the review.
