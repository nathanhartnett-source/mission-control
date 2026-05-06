#!/usr/bin/env bash
# mc-install.sh — install Mission Control on a fresh Ubuntu 22/24 server.
#
# Idempotent. Run as root (or with sudo). Uses systemd --user under the
# target system user (default: root).
#
# Required env vars:
#   GITHUB_REPO     — e.g. nathanhartnett-source/mission-control
#   GITHUB_TOKEN    — PAT with repo:read for the private repo
#   PUBLIC_HOSTNAME — e.g. obt.allhart.com.au (for the cloudflared tunnel)
# Optional:
#   CF_API_TOKEN, CF_ACCOUNT_ID, CF_ZONE_ID — to auto-create tunnel + DNS
#   MC_USER         — system user MC runs under (default: root)
#   MC_HOME         — install dir (default: /root/mission-control)
#   MC_PORT         — local port (default: 3030)

set -euo pipefail

: "${GITHUB_REPO:?GITHUB_REPO required (e.g. nathanhartnett-source/mission-control)}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN required}"
: "${PUBLIC_HOSTNAME:?PUBLIC_HOSTNAME required (e.g. obt.allhart.com.au)}"

MC_USER="${MC_USER:-root}"
MC_HOME="${MC_HOME:-/$([[ $MC_USER == root ]] && echo root || echo home/$MC_USER)/mission-control}"
MC_PORT="${MC_PORT:-3030}"

echo "==> mc-install.sh"
echo "    repo=$GITHUB_REPO  user=$MC_USER  home=$MC_HOME  port=$MC_PORT  host=$PUBLIC_HOSTNAME"

# 1. Node 20
if ! command -v node >/dev/null || [[ "$(node -v | sed 's/v//;s/\..*//')" -lt 20 ]]; then
    echo "==> installing Node 20"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# 2. cloudflared
if ! command -v cloudflared >/dev/null; then
    echo "==> installing cloudflared"
    curl -fsSL https://pkg.cloudflare.com/install.sh | bash
    apt-get install -y cloudflared
fi

# 3. Claude Code CLI (for the agent runner)
if ! command -v claude >/dev/null && [[ ! -x "/$([[ $MC_USER == root ]] && echo root || echo home/$MC_USER)/.npm-global/bin/claude" ]]; then
    echo "==> installing Claude Code CLI"
    sudo -u "$MC_USER" -H bash -c 'npm config set prefix ~/.npm-global && npm install -g @anthropic-ai/claude-code'
    sudo -u "$MC_USER" -H bash -c 'npm install -g --include=optional @anthropic-ai/claude-code-linux-x64' || true
fi

# 4. Clone / update MC
if [[ ! -d "$MC_HOME/.git" ]]; then
    echo "==> cloning $GITHUB_REPO → $MC_HOME"
    git clone "https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git" "$MC_HOME"
    chown -R "$MC_USER:$MC_USER" "$MC_HOME"
else
    echo "==> updating $MC_HOME"
    sudo -u "$MC_USER" -H bash -c "cd $MC_HOME && git pull"
fi

# 5. Install role-aware runner
USER_BIN="/$([[ $MC_USER == root ]] && echo root || echo home/$MC_USER)/bin"
sudo -u "$MC_USER" -H mkdir -p "$USER_BIN"
install -m 0755 "$MC_HOME/install/mc-user-agent-runner.sh" "$USER_BIN/mc-user-agent-runner.sh"
chown "$MC_USER:$MC_USER" "$USER_BIN/mc-user-agent-runner.sh"

# 6. Build
echo "==> npm install + build"
sudo -u "$MC_USER" -H bash -c "cd $MC_HOME && npm ci && npm run build"

# 7. Seed data dir
sudo -u "$MC_USER" -H mkdir -p "$MC_HOME/data" "$MC_HOME/data/agent-chat"
[[ ! -f "$MC_HOME/data/users.json" ]] && echo '[]' | sudo -u "$MC_USER" tee "$MC_HOME/data/users.json" >/dev/null

# 8. systemd service (system unit, runs as MC_USER)
SVC=/etc/systemd/system/mission-control.service
echo "==> writing $SVC"
cat > "$SVC" <<UNIT
[Unit]
Description=Mission Control
After=network.target

[Service]
Type=simple
User=$MC_USER
WorkingDirectory=$MC_HOME
Environment=PORT=$MC_PORT
Environment=NODE_ENV=production
Environment=MC_HOME=$MC_HOME
Environment=MC_DATA_DIR=$MC_HOME/data
ExecStart=/usr/bin/npm start -- -p $MC_PORT
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable mission-control.service
systemctl restart mission-control.service

# 9. Cloudflare tunnel (if creds provided)
if [[ -n "${CF_API_TOKEN:-}" && -n "${CF_ACCOUNT_ID:-}" && -n "${CF_ZONE_ID:-}" ]]; then
    echo "==> setting up cloudflared tunnel"
    "$MC_HOME/install/mc-tunnel-setup.sh" "$PUBLIC_HOSTNAME" "$MC_PORT"
else
    echo "==> skipping cloudflared (CF_API_TOKEN/CF_ACCOUNT_ID/CF_ZONE_ID not set)"
    echo "    Run install/mc-tunnel-setup.sh later to expose at https://$PUBLIC_HOSTNAME"
fi

echo
echo "==> done"
echo "    MC running at http://localhost:$MC_PORT"
echo "    systemctl status mission-control"
echo "    journalctl -u mission-control -f"
echo
echo "Next: bind your existing Claude Code agent (if any):"
echo "    $MC_HOME/install/mc-bind-agent.sh <admin-username> <client-username> <client-workspace-dir>"
