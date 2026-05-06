# Mission Control

Self-hosted multi-user dashboard for working alongside a personal Claude Code agent.

## Status

**Early scaffold.** Forked from the live Allhart MC and stripped of brand-specific
data, routes, and components. Generic shell + auth + agent chat + projects + wiki +
settings remain. Role system (`admin` / `staff` / `client`) is wired into the user
type but not yet enforced end-to-end.

## Roles

- `admin` — full access (settings, user management, install/update)
- `staff` — full agent privileges, no user management
- `client` — scoped to own chat + workspace, restricted runner (no Bash, scoped --add-dir)

Set via `role` field in `data/users.json`. Legacy `isAdmin: true` still maps to admin.

## Install (planned)

`mc-install.sh` (Ubuntu 24, root) and `mc-bind-agent.sh` (binds to an existing
Claude Code agent's memory + persona) are in progress.

## Runtime

- Next.js 15 (App Router), production mode (`next start`), NOT dev / hot-reload
- Cloudflare Tunnel in front (no public ingress on the box)
- Per-user agent runners spawn via `mc-user-agent-runner.sh` outside the repo
