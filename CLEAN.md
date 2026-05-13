# CLEAN.md — Allhart AIOS core

**Read this first. Every time. Before any commit.**

This repo is the **Allhart AIOS core platform**. It ships, unchanged, to every install: Nathan's local box, OBT (Brett), Carl, and every future client. The contract is: **clone this repo, run `mc-install.sh`, get a working AIOS dashboard**. Nothing in this repo is allowed to assume a specific organisation, brand, user, or business workflow.

## What is allowed in this repo

- Core platform: agent runtime, inbox, alerts, home bentos, FloatingChat, Nav, Settings shell
- Auth, sessions, per-user workspaces, role enforcement
- The SDK surface in `lib/sdk/` — stable contracts custom apps build against
- First-run setup wizard, Update from GitHub flow, core integrity check
- Generic UI primitives (FlipCard, ToasterMount, etc.)
- The locked attribution: `lib/powered-by.ts` + `PoweredByFooter`

## What is NOT allowed in this repo — ever

- **Brand names**: Allhart, MRO, BMO, FOB, Helix, MO, AVP, BLC, JY, OBT, Bento Frame, FairTraide
- **Per-brand workflows**: ACB, Friday scheduler, Tessa drafts, Louisa intros, MRO Ads, BMO designer, PSI dashboards, Funnelkit, GA4
- **Per-client integrations**: Discord MCP bridges, Ash subagents, Hermes/Overseer crons, MCP servers beyond what `mc-install.sh` ships
- **Nathan-specific paths**: `/home/nathan/...`, `~/.openclaw/...`, `~/legacy-workspace/...`, `~/wiki/...`
- **Hardcoded credentials or third-party API tokens** (Anthropic, Etsy, Google Ads, Funnelkit, etc.)
- **Logic borrowed from messy**: if a feature exists in `~/.openclaw/workspace/mission-control` and not here, that's deliberate. Do not "port" it across. If a client genuinely needs it, it belongs in `apps/custom/<slug>/` on their install — never in the core repo.

## Source of confusion

Nathan's local install at `~/.openclaw/workspace/mission-control` is **"messy" MC** — a private dashboard with ~15 years of Allhart business logic in it. It is NOT a development copy of this repo. It diverged years ago. **Never port code from there into here.** If you're tempted, stop and ask Nathan first.

## The lint

`scripts/check-clean-purity.mjs` greps every commit for banned tokens. The pre-push git hook (installed by `mc-install.sh` on Nathan's dev box, optional elsewhere) runs it. If any source file under this repo contains a banned brand/path token, the push fails. Run manually with: `node scripts/check-clean-purity.mjs`.

## If you genuinely think something needs to enter core

Three rules:

1. **It must apply to every install, not just Nathan's.** "Brett would also want this" / "anyone selling on WooCommerce would want this" = fine. "ACB needs this" = no.
2. **It must be configurable, not hardcoded.** Per-install branding goes in `config/site.json`; per-user data in `data/`; no brand string baked into a file.
3. **You must ask Nathan before merging.** No exceptions. Even if the feature feels obviously universal, the answer might still be "build it as a custom-app first, promote to core later."

## Two-repo model recap

- **This repo (clean)** → `github.com/nathanhartnett-source/mission-control` → installed everywhere
- **Messy MC** → Nathan's local box only → never pushed anywhere → contains the Allhart-specific stuff
- **OBT / Carl / clients** → run this repo via `Update from GitHub` panel → Nathan never edits their installs directly

See `~/wiki/concepts/mc-aios-core-spec.md` for the full tier model.
