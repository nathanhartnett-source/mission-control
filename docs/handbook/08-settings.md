# Settings, persona, and notifications

## Settings page

`/settings` is broken into a few sections depending on your role:

- **Profile** — display name, email, password.
- **Agent** — your agent's name, persona file, voice mode toggle, voice
  identity (TTS voice).
- **Branding** (admin only) — install-wide colours, logo, login screen.
- **Users** (admin only) — invite, edit, remove users; assign roles.
- **System** (admin only) — install version, update button, integration
  tokens.

## The persona file

Your agent reads `~/.claude/projects/-home-<you>/memory/persona.md`
**every turn.** This file is what makes your agent yours. A good persona
file covers:

- **Name.** "**Agent name:** Ava" — the agent uses this when introducing
  itself.
- **Voice.** Plain-English / formal / dry-humour / etc.
- **What it should know about you.** Role, expertise, things you don't
  need explained.
- **What it should default to.** Concise replies / always show your work /
  always summarise after edits.
- **What it should avoid.** Filler phrases, false-cheerful preambles,
  unsolicited disclaimers.

You can edit persona.md directly through Settings → Agent → Edit persona.
The agent picks up changes on its next reply.

## Memory beyond persona

Your agent also accumulates **auto-memory** in
`~/.claude/projects/-home-<you>/memory/MEMORY.md` and individual notes in
the same directory. These are written by the agent itself when it learns
something durable about you, your preferences, or your projects. You can
inspect them; you can ask your agent to forget specific entries.

## Notifications

`/notifications` lists alerts your agent has flagged for your attention —
e.g. a long-running app finished, a wiki page was updated, a scheduled
report failed. Each row links to the source. Mark items read with the
checkbox.

## Voice and tone

If your agent's voice doesn't match your taste:
- **Too verbose?** Add "Reply in 1–3 sentences unless asked otherwise" to
  persona.md.
- **Too formal?** Add a sample line of how you'd want it to talk.
- **Wrong TTS voice?** Settings → Agent → Voice identity, pick another.
