#!/usr/bin/env bash
# mc-tunnel-setup.sh — create a Cloudflare named tunnel + DNS CNAME for MC.
#
# Usage: mc-tunnel-setup.sh <hostname> <local-port>
# Required env: CF_API_TOKEN, CF_ACCOUNT_ID, CF_ZONE_ID
#
# Idempotent. Safe to re-run; will reuse an existing tunnel of the same name.

set -euo pipefail

HOSTNAME="${1:?usage: $0 <hostname> <port>}"
PORT="${2:?usage: $0 <hostname> <port>}"
: "${CF_API_TOKEN:?CF_API_TOKEN required}"
: "${CF_ACCOUNT_ID:?CF_ACCOUNT_ID required}"
: "${CF_ZONE_ID:?CF_ZONE_ID required}"

TUNNEL_NAME="mc-${HOSTNAME//./-}"
CFG_DIR=/etc/cloudflared
mkdir -p "$CFG_DIR"

echo "==> creating tunnel $TUNNEL_NAME"
TUNNEL_ID="$(curl -fsS -H "Authorization: Bearer $CF_API_TOKEN" \
    "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/cfd_tunnel?name=$TUNNEL_NAME" \
    | python3 -c 'import json,sys; r=json.load(sys.stdin)["result"]; print(r[0]["id"] if r else "")')"

if [[ -z "$TUNNEL_ID" ]]; then
    SECRET="$(openssl rand -base64 32)"
    RESP="$(curl -fsS -X POST -H "Authorization: Bearer $CF_API_TOKEN" \
        -H "Content-Type: application/json" \
        "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT_ID/cfd_tunnel" \
        -d "{\"name\":\"$TUNNEL_NAME\",\"tunnel_secret\":\"$SECRET\",\"config_src\":\"local\"}")"
    TUNNEL_ID="$(echo "$RESP" | python3 -c 'import json,sys; print(json.load(sys.stdin)["result"]["id"])')"
    echo "    created tunnel $TUNNEL_ID"

    # Credentials file for cloudflared
    cat > "$CFG_DIR/$TUNNEL_ID.json" <<JSON
{"AccountTag":"$CF_ACCOUNT_ID","TunnelID":"$TUNNEL_ID","TunnelName":"$TUNNEL_NAME","TunnelSecret":"$SECRET"}
JSON
    chmod 600 "$CFG_DIR/$TUNNEL_ID.json"
else
    echo "    reusing existing tunnel $TUNNEL_ID"
    if [[ ! -f "$CFG_DIR/$TUNNEL_ID.json" ]]; then
        echo "    WARNING: tunnel exists but credentials file missing at $CFG_DIR/$TUNNEL_ID.json"
        echo "             You'll need to re-create or fetch the credentials manually."
    fi
fi

cat > "$CFG_DIR/config.yml" <<YML
tunnel: $TUNNEL_ID
credentials-file: $CFG_DIR/$TUNNEL_ID.json
ingress:
  - hostname: $HOSTNAME
    service: http://localhost:$PORT
  - service: http_status:404
YML

# DNS CNAME → <tunnel-id>.cfargotunnel.com
echo "==> creating DNS CNAME for $HOSTNAME"
SUBDOMAIN="${HOSTNAME%%.*}"
EXISTING="$(curl -fsS -H "Authorization: Bearer $CF_API_TOKEN" \
    "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records?name=$HOSTNAME" \
    | python3 -c 'import json,sys; r=json.load(sys.stdin)["result"]; print(r[0]["id"] if r else "")')"

CNAME_TARGET="$TUNNEL_ID.cfargotunnel.com"
if [[ -z "$EXISTING" ]]; then
    curl -fsS -X POST -H "Authorization: Bearer $CF_API_TOKEN" \
        -H "Content-Type: application/json" \
        "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records" \
        -d "{\"type\":\"CNAME\",\"name\":\"$HOSTNAME\",\"content\":\"$CNAME_TARGET\",\"proxied\":true}" >/dev/null
    echo "    created CNAME $HOSTNAME → $CNAME_TARGET"
else
    curl -fsS -X PUT -H "Authorization: Bearer $CF_API_TOKEN" \
        -H "Content-Type: application/json" \
        "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records/$EXISTING" \
        -d "{\"type\":\"CNAME\",\"name\":\"$HOSTNAME\",\"content\":\"$CNAME_TARGET\",\"proxied\":true}" >/dev/null
    echo "    updated CNAME $HOSTNAME → $CNAME_TARGET"
fi

# Install cloudflared as a service
cloudflared service install 2>/dev/null || true
systemctl enable cloudflared 2>/dev/null || true
systemctl restart cloudflared

echo
echo "==> tunnel up: https://$HOSTNAME → http://localhost:$PORT"
