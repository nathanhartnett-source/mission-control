#!/usr/bin/env bash
# mc-bind-agent.sh — provision MC users + bind to an existing Claude Code agent.
#
# Usage: mc-bind-agent.sh <admin-username> <client-username> <client-workspace-dir>
#
# Example (OBT):
#   mc-bind-agent.sh nathan brett /root/obt-workspace
#
# What it does:
#   1. Creates admin user (full-access) in users.json
#   2. Creates client user (restricted role) in users.json
#   3. Symlinks client's MC memory dir → existing workspace memory dir
#      (so MC chat and Discord/tmux agent share the same brain)
#   4. Copies CLAUDE.md → client's persona.md (if not already there)
#   5. Leaves any existing tmux/systemd agent running untouched

set -euo pipefail

ADMIN="${1:?usage: $0 <admin> <client> <client-workspace-dir>}"
CLIENT="${2:?usage: $0 <admin> <client> <client-workspace-dir>}"
WORKSPACE="${3:?usage: $0 <admin> <client> <client-workspace-dir>}"

MC_HOME="${MC_HOME:-/root/mission-control}"
USERS_JSON="$MC_HOME/data/users.json"

[[ ! -d "$WORKSPACE" ]] && { echo "workspace not found: $WORKSPACE" >&2; exit 1; }

# Encode workspace path the way claude -p does (slashes → dashes, leading dash).
ENCODED="$(echo "$WORKSPACE" | sed 's|/|-|g')"
EXISTING_MEM="$HOME/.claude/projects/${ENCODED}/memory"

if [[ ! -d "$EXISTING_MEM" ]]; then
    echo "WARNING: no existing memory dir at $EXISTING_MEM"
    echo "         creating fresh one — agent will start with empty memory"
    mkdir -p "$EXISTING_MEM"
fi

# Provision MC memory dirs for both users; client's points at the shared dir.
ADMIN_MEM="$HOME/.claude/projects/-home-${ADMIN}/memory"
CLIENT_MEM="$HOME/.claude/projects/-home-${CLIENT}/memory"

mkdir -p "$ADMIN_MEM"
[[ ! -f "$ADMIN_MEM/MEMORY.md" ]] && echo "# Memory Index" > "$ADMIN_MEM/MEMORY.md"

# Symlink client's MC-side memory dir → existing agent memory dir.
if [[ -L "$CLIENT_MEM" || -e "$CLIENT_MEM" ]]; then
    if [[ "$(readlink -f "$CLIENT_MEM" 2>/dev/null)" != "$(readlink -f "$EXISTING_MEM")" ]]; then
        echo "NOTE: $CLIENT_MEM exists and points elsewhere — moving aside"
        mv "$CLIENT_MEM" "${CLIENT_MEM}.bak.$(date +%s)"
    fi
fi
mkdir -p "$(dirname "$CLIENT_MEM")"
[[ ! -e "$CLIENT_MEM" ]] && ln -s "$EXISTING_MEM" "$CLIENT_MEM"

# Copy CLAUDE.md → persona.md if persona doesn't already exist.
if [[ -f "$WORKSPACE/CLAUDE.md" && ! -f "$EXISTING_MEM/persona.md" ]]; then
    echo "==> seeding persona.md from $WORKSPACE/CLAUDE.md"
    cp "$WORKSPACE/CLAUDE.md" "$EXISTING_MEM/persona.md"
fi

# Update users.json (idempotent upsert).
mkdir -p "$(dirname "$USERS_JSON")"
[[ ! -f "$USERS_JSON" ]] && echo '[]' > "$USERS_JSON"

python3 - "$USERS_JSON" "$ADMIN" "$CLIENT" "$WORKSPACE" <<'PY'
import json, sys, time
path, admin, client, workspace = sys.argv[1:5]
users = json.load(open(path))
if isinstance(users, dict): users = users.get("users", [])
by_name = {u.get("username","").lower(): u for u in users}

now = int(time.time())
admin_user = by_name.get(admin.lower(), {"username": admin, "createdAt": now})
admin_user.update({"username": admin, "role": "admin", "isAdmin": True})

client_user = by_name.get(client.lower(), {"username": client, "createdAt": now})
client_user.update({
    "username": client, "role": "client", "isAdmin": False,
    "boundWorkspace": workspace,
})

result = []
seen = set()
for u in [admin_user, client_user]:
    seen.add(u["username"].lower())
    result.append(u)
for u in users:
    if u.get("username","").lower() not in seen:
        result.append(u)
json.dump(result, open(path, "w"), indent=2)
print(f"users.json: {len(result)} users — {admin}=admin, {client}=client")
PY

echo
echo "==> bound."
echo "    $ADMIN  → admin (full access)"
echo "    $CLIENT → client (restricted runner mode)"
echo "    $CLIENT memory: $CLIENT_MEM → $EXISTING_MEM (shared with existing agent)"
echo
echo "Restart MC to pick up users: systemctl restart mission-control"
