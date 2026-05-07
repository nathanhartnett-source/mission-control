# The home (Bento) dashboard

Your home page is a **Bento grid** — a layout of tiles, one per project or
module. Each tile shows live state for the thing it tracks: open to-dos,
recent activity, alerts, KPIs, whatever the module is wired to surface.

## Reading a tile

A typical tile shows:
- **Title and icon** of the project / module
- **A status line** (e.g. `3 open · 1 due today`)
- **A few recent items** (last to-dos, last commits, last comments)
- **A click target** that opens the full project page

Tiles update automatically — there's no manual refresh.

## Adding & removing tiles

Use the **Customise** button (top-right of the home page) to:
- Drop in pre-built modules (project, to-dos, alerts, etc.)
- Reorder the grid
- Hide tiles you don't care about
- Pin a tile so it always stays at the top

Your customisations are personal — they don't affect anyone else's home
page.

## "I want a new kind of tile"

If the built-in tile shapes don't fit, you have two options:

1. **Ask your agent.** "Can you add a tile that shows X from my workspace?"
   — admins can add module types directly.
2. **Build it as an Element.** If the thing you want is really a workflow
   (run-this-and-show-me-the-result), see `../builder/` — Elements show up
   in the **My Apps** area, not the Bento grid, but the effect is similar.

## Empty state

If your home is bare on first login, it's because your admin hasn't seeded
any modules yet. Ask them — or your agent — to add a starter set.
