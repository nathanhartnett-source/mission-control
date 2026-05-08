#!/usr/bin/env bash
# auto-update.sh — pull origin/main and rebuild MC if it's changed.
#
# Wired into root cron by mc-install.sh:
#   */5 * * * * /root/mission-control/install/auto-update.sh >> /var/log/mc-auto-update.log 2>&1
#
# Idempotent: no-op when local HEAD already matches origin. Only spends time
# (npm install + next build + systemctl restart) when there's actually a new
# commit to pick up. Designed to run as root on a single-tenant client install.
#
# Override paths via env vars MC_HOME / MC_USER if you want to reuse the script
# on a non-default install layout.
set -euo pipefail

MC_HOME="${MC_HOME:-/root/mission-control}"
MC_USER="${MC_USER:-root}"
SERVICE="${MC_SERVICE:-mission-control.service}"
BRANCH="${MC_BRANCH:-main}"

cd "$MC_HOME"

ts() { date -u +%FT%TZ; }
log() { echo "[$(ts)] $*"; }

# Bail if a git operation is in progress (prevents stomping on a hand-edit).
if [[ -e .git/index.lock || -e .git/MERGE_HEAD || -e .git/REBASE_HEAD ]]; then
    log "git busy (lock/merge/rebase in progress) — skipping this tick"
    exit 0
fi

# Fetch quietly; bail on error rather than failing-loud (we run every 5 min).
if ! git fetch --quiet origin "$BRANCH" 2>/dev/null; then
    log "git fetch failed — skipping (will retry next tick)"
    exit 0
fi

LOCAL="$(git rev-parse "$BRANCH")"
REMOTE="$(git rev-parse "origin/$BRANCH")"

if [[ "$LOCAL" == "$REMOTE" ]]; then
    # No-op path — keep silent so /var/log/mc-auto-update.log doesn't grow on every tick.
    exit 0
fi

log "update available: $LOCAL → $REMOTE"

# Hard-reset to origin/$BRANCH. Local edits are NOT a thing on a client install
# (this isn't a dev box), so reset is the safe move — anything dangling gets
# clobbered and replaced with the upstream state.
git reset --hard "origin/$BRANCH"
log "reset to $REMOTE"

# Refresh dependencies + build. Run as MC_USER to keep file ownership clean.
if [[ "$(id -un)" == "$MC_USER" ]]; then
    npm ci --silent && npm run build
else
    sudo -u "$MC_USER" -H bash -c "cd '$MC_HOME' && npm ci --silent && npm run build"
fi
log "build complete"

# Re-install scripts in case install/scripts/ changed (worker, renderer).
[[ -f "$MC_HOME/install/scripts/mc-element-worker.sh" ]] && \
    install -m 0755 "$MC_HOME/install/scripts/mc-element-worker.sh" /usr/local/bin/mc-element-worker.sh
[[ -f "$MC_HOME/install/scripts/mc-element-pdf-render.cjs" ]] && \
    install -m 0644 "$MC_HOME/install/scripts/mc-element-pdf-render.cjs" /usr/local/bin/mc-element-pdf-render.cjs
[[ -f "$MC_HOME/install/scripts/mc-element-xlsx-render.cjs" ]] && \
    install -m 0644 "$MC_HOME/install/scripts/mc-element-xlsx-render.cjs" /usr/local/bin/mc-element-xlsx-render.cjs
[[ -f "$MC_HOME/install/scripts/mc-element-pptx-render.cjs" ]] && \
    install -m 0644 "$MC_HOME/install/scripts/mc-element-pptx-render.cjs" /usr/local/bin/mc-element-pptx-render.cjs
[[ -f "$MC_HOME/install/mc-user-agent-runner.sh" ]] && \
    install -m 0755 "$MC_HOME/install/mc-user-agent-runner.sh" /usr/local/bin/mc-user-agent-runner.sh

# Restart the service. systemd will recreate the unit's cgroup; the worker
# transient services we spawn for in-flight element runs are in their own
# cgroups (via systemd-run --unit), so they survive this restart.
systemctl restart "$SERVICE"
log "restarted $SERVICE — done"
