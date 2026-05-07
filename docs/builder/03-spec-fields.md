# Spec fields, in detail

Every app is described by a single JSON object — the **spec**. Below is
every field, what it does, and what the legal values are.

```jsonc
{
  "slug": "weekly-stock-low",          // URL slug (auto-derived from name)
  "name": "Weekly Stock-Low Report",   // shown on tile and run page
  "description": "PDF of low SKUs across all 5 sites, with per-site charts",
  "icon": "📉",                         // single emoji
  "inputs": [],                        // see below
  "promptTemplate": "...",             // worker instructions, see 05-prompts
  "outputFormat": "pdf",               // "markdown" | "pdf"
  "letterhead": { "mode": "none" },    // PDF-only, see 07-pdf-and-charts
  "timeoutMin": 15,                    // 1–30
  "shareWithOrg": false,               // true → visible in My Apps for everyone
  "createdAt": "...",                  // ISO timestamp, set on save
  "createdBy": "nathan"                // username, set on save
}
```

## `slug`

Lower-case, dash-separated, max 60 characters. Auto-derived from `name` if
you don't set it. Determines the URL: `/elements/<slug>`. If a slug you
chose collides with another user's shared app, MC appends `-2`, `-3`, etc.
to dedupe.

## `name`

What users see on the tile. Keep it short — under 60 characters reads best.

## `description`

One sentence. Shown under the name on the tile and at the top of the run
page. Describe the *outcome* ("PDF of low SKUs by site") rather than the
*mechanism* ("queries WP REST API and uses Chart.js").

## `icon`

A single emoji. Defaults to ✨. Pick something distinctive — your users
will scan by icon faster than by name.

## `inputs`

Array of input fields, max 12. Each input has its own shape — see
[`04-inputs.md`](./04-inputs.md).

## `promptTemplate`

The instructions handed to the worker at run time. Inputs are interpolated
with `{{snake_case_field}}` placeholders. Max 8000 characters. The worker
runs Claude Opus 4.7 with WebSearch / WebFetch / Read / Glob / Grep /
TodoWrite (no Bash, no Write, no Edit). See [`05-prompts.md`](./05-prompts.md).

## `outputFormat`

- `"markdown"` — worker writes markdown, user sees it rendered on the run
  page. Great for drafts, replies, recaps a human will copy.
- `"pdf"` — worker writes markdown that includes fenced ` ```chart ` blocks;
  the renderer turns it into a printable PDF. Use for shareable reports.

## `letterhead`

PDF-only. `{ "mode": "none" }` for plain reports; `{ "mode": "upload",
"imagePath": "/abs/path/to/letterhead.png" }` to overlay an image on every
page. The upload happens at save time — the form stages a file, the API
copies it to the spec's letterhead dir on save.

## `timeoutMin`

Hard ceiling on the worker's runtime, 1–30 minutes. Rule of thumb:

- **3–5** — quick lookup or single-step generation
- **10** — typical drafting / summarisation
- **20–30** — deep research, multi-step retrieval, large data analysis

The systemd-run wrapper enforces it; if the worker is still running, it's
SIGKILL'd. (See [limits](./10-limits.md) for why.)

## `shareWithOrg`

`false` — only you see this app in My Apps.
`true` — every user on the install sees it (with a "shared by <you>" badge).

You can flip this at any time on the app's settings page. Other users can
duplicate a shared app to make their own private fork.
