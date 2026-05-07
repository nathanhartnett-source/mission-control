# FAQ & troubleshooting

### "My agent didn't reply."

Check the Stop button — if it says **Stop**, the turn is still running.
Long replies can take 30s+. If it says **Send**, the turn finished — scroll
down for the reply. If it really seems stuck, refresh the page once; the
runner will resume on its own when the next message lands.

### "My agent forgot something I told it yesterday."

The agent receives the **last 15 turns** as conversation context. Older
turns are out of the immediate window unless they were saved to memory.
Two fixes:
1. Tell the agent to "save that to memory" when you say something durable.
2. Edit `persona.md` if it's something about you specifically.

### "The wiki search returns nothing."

Search is full-text but case-sensitive on punctuation. Try a shorter
keyword. If a page you know exists isn't appearing, ask your agent — it
can grep the wiki directly and find it.

### "I clicked an app and it errored immediately."

Open the live thinking pillbox. If the worker errored before producing
output, the message is shown there. Common causes:
- A required input is empty (the form should have caught it; refresh).
- The prompt template references a tool the worker doesn't have.
- The timeout was too short for the work — the spec's owner can raise it.

### "My voice mode is suddenly silent."

Refresh the page. If still silent, check the persona file's voice block —
an invalid TTS voice ID will cause silent failures.

### "Where do I see what my agent is actually allowed to do?"

`mc-user-agent-runner.sh` defines the permission surface per role. As a
client, your agent has Read / Edit / Write / Glob / Grep / TodoWrite /
WebFetch / WebSearch — no Bash, no Agent (sub-agent spawn). If you need
shell, ask the admin.

### "Who do I ask for help if MC itself is broken?"

Your install admin. They have system-level access to logs and the update
script. The agent can't fix MC itself from inside MC.

### "I don't want to use voice. Can I disable the mic?"

Settings → Agent → Voice → toggle off. The mic icon disappears from
`/agents`.

### "Is anything I type sent outside my server?"

Your agent runs as Claude Code locally on your install's server. The
prompts go to Anthropic's API to generate replies — that's where the model
inference happens. **Your data files, persona, wiki, and to-dos are not
uploaded** beyond the chat content the agent passes as context to answer
your specific question. Talk to your admin if your org has stricter data
boundaries; MC supports air-gapped configurations.
