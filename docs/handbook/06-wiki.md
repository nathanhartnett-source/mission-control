# The wiki

The wiki is a markdown knowledge base that lives at `/wiki`. It's:

- **Browsable** — folders on the left, current page in the centre, an
  outline (and graph) on the right.
- **Editable** — by admins and staff in-place. Click a page, click Edit,
  save. It's just markdown.
- **Agent-readable** — your agent treats the wiki as long-term memory for
  the org. When you ask it something domain-specific ("what's our brand
  voice for the homepage?", "which sites use HPOS?"), it'll consult the
  wiki before answering — and tell you which page it pulled from.
- **Agent-writable** — when you teach your agent something it didn't know,
  ask it to "save that to the wiki under <topic>". A page gets created or
  updated, with a heading and a clear hook so future-agent can find it.

## Folder layout

The wiki uses simple folders for organisation. There's no rigid taxonomy —
admins decide. Common top-level groups you'll see:

- `concepts/` — long-form how-it-works pages
- `decisions/` — durable decisions, with reversal rules
- `playbooks/` — step-by-step procedures
- `sessions/` — dated session logs (output of `/wrap-up`)

## Search

Top-of-page search is full-text across the wiki. The graph view (top-right
icon) shows links between pages — useful when you want to discover related
material.

## Linking

Standard markdown links work. If you link to another wiki page using a
relative path, the renderer makes it clickable.

## Don't worry about formatting

Your agent will normalise headings, fix typos, and re-flow paragraphs when
it edits. The important thing is the content.

## Source of truth precedence

When the agent has a conflict between training data and the wiki, **the
wiki wins.** When the wiki conflicts with the live system (the actual code
or data), the agent will verify against the live system and update the wiki
if it's stale.
