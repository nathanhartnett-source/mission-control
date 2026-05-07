# Talking to your agent

The `/agents` page is the main way you'll interact with Mission Control.

## Two modes

- **Text chat.** Type, hit send, your agent replies. Markdown is rendered.
  You can attach files (drag-and-drop or the paperclip icon) and your agent
  will read them. You can stop a turn mid-flight with the Stop button.
- **Voice mode.** Tap the mic. Your agent listens, then replies out loud
  (using a TTS voice; the persona file controls which one). Voice replies
  drop markdown — they're written for the ear.

## How to get good answers

- **Be specific about scope.** "Look at the marketing wiki" beats "look at
  the wiki." MC has lots of dirs your agent could search.
- **Tell it what you've already tried.** Saves it from suggesting the same
  thing.
- **Push back.** If it's wrong, say so. Agents course-correct on direct
  feedback far better than on hints.
- **Ask it to plan first** for anything bigger than a one-step task. "Plan
  this, then we'll do step one."

## What your agent can see

Your agent has read access to:
- Your **personal workspace** (`~/user-workspaces/<you>/`)
- Your **memory dir** (persona, accumulated facts)
- The **MC documentation** in this directory
- The **wiki** if you (or an admin) gave it that scope

It does **not** see other users' workspaces or memory. Privacy is enforced
at the runner level — staff and admin agents may have broader access.

## Stopping & history

- **Stop** — interrupts the current turn (kills the underlying process).
- **History** — every conversation is logged. Scrolling up loads earlier
  turns. The agent receives the last 15 turns as context every new message,
  so don't worry about repeating yourself within a session.

## When voice is misbehaving

- If the agent goes silent in voice mode, it's probably caught between turns
  — wait two seconds, then try the mic again.
- If TTS sounds wrong (cuts off, wrong voice), check `Settings → Agent → Voice`.
- Voice is one-or-two sentences by design; if you want long answers, use
  text.
