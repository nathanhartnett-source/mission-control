# My Apps — running an app someone built

The `/elements` page (titled **My Apps**) is where every reusable shortcut
lives. An "app" here is a small, focused workflow: fill in a few fields,
hit Run, get back a markdown answer or a PDF report.

## What you'll see

A grid of tiles. Each tile shows:
- An emoji icon, a name, a one-line description
- A `shared by <name>` badge if the app was built by someone else and
  shared with the org
- A `shared` badge (green) on apps you built and shared

## Running an app

1. Click a tile. You land on the app's run page.
2. Fill in any inputs the app needs (text fields, dropdowns, file uploads).
   File inputs accept drag-and-drop.
3. Hit **Run**. A worker — a scoped Claude Code agent — executes the app's
   prompt template with your inputs interpolated.
4. Watch the live thinking pillbox. It updates with the worker's tool
   activity (reading, searching, writing).
5. When it finishes, the output shows up below: rendered markdown, or a
   PDF you can download.

## Cancelling

The Stop button kills the worker mid-run. Anything already produced is
discarded.

## Pinning

The pin icon on a tile keeps it at the top of your grid. Useful for the
two or three apps you actually use weekly.

## Why some apps need no inputs

If the app's job is "every Monday, fetch X and summarise it," there's
nothing the user can vary. It runs as configured. Apps with inputs are the
ones whose answer depends on what you give them.

## "I want an app that does X"

You can build it yourself — see [the Builder docs](../builder/) — or, if
you want your agent to design it for you, ask in chat:

> "build me an app that takes a customer name and order number and drafts
> a complaint reply in our brand voice."

Your agent uses the same `/elements/new` workflow under the hood.

## Shared apps and ownership

- Apps you build are private by default.
- Toggle "Share with org" in the app's settings to make it visible to
  everyone on the install.
- Only the creator can edit a shared app. Other users can run it and
  duplicate it (which makes a private fork).
