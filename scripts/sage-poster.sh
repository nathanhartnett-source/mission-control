#!/bin/bash
# sage-poster.sh — watches for pending Sage messages and posts them to the MC API
# Sage writes to /tmp/sage-pending.json, this script picks them up and POSTs
PENDING="/tmp/sage-pending.json"
API="http://localhost:3001/api/personal/sage-messages"

if [ -f "$PENDING" ]; then
    # Post each entry
    while IFS= read -r line; do
        curl -s -X POST "$API" \
            -H "Content-Type: application/json" \
            -d "$line" > /dev/null
    done < <(cat "$PENDING" | tr '\n' ' ' | grep -o '{[^}]*}')
    rm "$PENDING"
fi
