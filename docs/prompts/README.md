# Persephone prompts

Run these in order. Each later prompt overrides earlier ones where they conflict.

1. `01-persephone-build.md`: the original build (Supabase `ps_` schema, daily agent, UI pages).
2. `02-update.md`: corrected facts, banned terms, blocked companies, target list, full-time only, CV versions, portfolio route.
3. `03-gifts-engine.md`: The Hunt (Platsbanken, career pages, Kompetensgrafen PageRank, fit scores, static CV library, IMAP drafts) and The Gifts strategy layer.
4. `04-portfolio-and-cockpit.md`: one Next.js app on Vercel, public portfolio at `/` and a private job cockpit behind `/login`.

Context files:
- `docs/context/linnea-sfw-work-record.md`: full Soil Food Web Foundation record.
- `portfolio/index.html`: the live portfolio artifact (https://claude.ai/artifact/SnNTvJAniCa4jQQ7LRdXyB), the exact design to port to `/`.

Hard rules: never send email (drafts only, IMAP APPEND to linneajobs@gmail.com); full-time permanent roles only.
