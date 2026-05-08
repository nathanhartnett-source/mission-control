# Mission Control — Install

Multi-tenant Mission Control with `admin` / `staff` / `client` role system.
Designed for fresh Ubuntu 22/24 servers; idempotent (safe to re-run).

## Prereqs

- Fresh Ubuntu 22 or 24, root (or sudo) access
- A GitHub Personal Access Token with `repo:read` for the private repo
- (Optional) Cloudflare API token + zone ID if you want HTTPS via tunnel

## Quick install

```bash
# On the target server:
curl -fsSL "https://raw.githubusercontent.com/<org>/mission-control/main/install/mc-install.sh?token=…" -o /tmp/mc-install.sh
chmod +x /tmp/mc-install.sh

GITHUB_REPO=nathanhartnett-source/mission-control \
GITHUB_TOKEN=ghp_xxx \
PUBLIC_HOSTNAME=obt.allhart.com.au \
CF_API_TOKEN=… \
CF_ACCOUNT_ID=… \
CF_ZONE_ID=… \
/tmp/mc-install.sh
```

The script:
1. Installs Node 20, cloudflared, Claude Code CLI
2. Clones MC to `/root/mission-control`
3. `npm ci && npm run build`
4. Writes `/etc/systemd/system/mission-control.service` (runs as `root` by default)
5. Creates Cloudflare tunnel + DNS CNAME (if CF creds given)

After install, MC is at `https://$PUBLIC_HOSTNAME`.

## Bind to an existing Claude Code agent

If the box already has a Claude Code agent running (e.g. in tmux, talking to
Discord), bind it to MC so the agent's brain is shared between Discord and the
MC `/agents` chat:

```bash
/root/mission-control/install/mc-bind-agent.sh nathan brett /root/obt-workspace
#                                                ^admin   ^client  ^existing workspace dir
```

This:
- Creates `nathan` as `admin` and `brett` as `client` in `users.json`
- Symlinks `brett`'s MC memory dir → the existing agent's memory dir
- Copies `CLAUDE.md` → `persona.md` (if not already present)
- Leaves any existing tmux/systemd Discord agent untouched

`brett` will see MC's chat tab share state with whatever the Discord agent says.

## Roles

| Role     | Permission mode    | --add-dir                                | Bash | Purpose                       |
|----------|--------------------|------------------------------------------|------|-------------------------------|
| `admin`  | `bypassPermissions`| workspace, memory, ~/wiki, ~/bin, /tmp   | yes  | Sysadmin / owner              |
| `staff`  | `bypassPermissions`| same as admin                            | yes  | Trusted internal users        |
| `client` | `default` (asks)   | own workspace + memory only              | NO   | External / restricted clients |

Default role for new users: `client` (most restrictive).

Set role per-user in `data/users.json`:
```json
[
  { "username": "nathan", "role": "admin", "isAdmin": true },
  { "username": "brett",  "role": "client", "isAdmin": false }
]
```

## Updating

```bash
cd /root/mission-control && git pull && npm ci && npm run build
systemctl restart mission-control
```

## Uninstall

```bash
systemctl disable --now mission-control cloudflared
rm /etc/systemd/system/mission-control.service
rm -rf /root/mission-control /etc/cloudflared
```
