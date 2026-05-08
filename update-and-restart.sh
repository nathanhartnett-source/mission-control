#!/usr/bin/env bash
set -euo pipefail
cd /home/nathan/.openclaw/workspace/mission-control

# Update code if this is a git repo
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git pull --ff-only || true
fi

npm install
npm run build
systemctl --user restart mission-control
systemctl --user status mission-control --no-pager -l | sed -n '1,20p'
