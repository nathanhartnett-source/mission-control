# Sharing apps with the org

By default, an app you build is **private** — only you see it in
My Apps. Setting `shareWithOrg: true` makes it visible to every user on
the install.

## When to share

- The app produces a deliverable a colleague will need to run themselves
  (e.g. quote drafts, status reports, customer replies).
- The app encodes a workflow that should be consistent across the team
  (so two people running it get the same shape of output).
- You want feedback from teammates on the prompt — sharing makes it
  visible; they can run it and tell you where it falls down.

## When NOT to share

- The prompt template contains your private context (calendar, personal
  brand voice, individual customers).
- The output is sensitive (HR notes, financial drafts).
- The app references files only your workspace has access to.

## How sharing actually works

- **Visibility**: shared specs are shown in everyone's My Apps grid with a
  `shared by <you>` badge.
- **Editing**: only you (the creator) can edit the spec. Other users see
  the run form but not the prompt template.
- **Duplicating**: any user can click "Duplicate" on a shared app to make
  a private copy in their own My Apps. They can then edit the duplicate
  freely without affecting your original.
- **Letterheads**: the letterhead image is bundled with the spec, so
  shared apps render with the original letterhead even when run by
  someone else.
- **Per-user runs**: every run is private to the user who triggered it.
  The creator does NOT see other users' run histories.

## Slugs and collisions

When User A shares `weekly-stock-low` and User B then tries to save their
own app called `weekly-stock-low`, MC dedupes B's slug to
`weekly-stock-low-2` automatically. The shared one keeps the original
slug.

## Unsharing

Toggle `shareWithOrg` off on the app's settings page. The app immediately
disappears from other users' My Apps grids. Anyone who **duplicated** it
keeps their copy — duplicates are independent specs.

## "Org" = the whole install

There's no "team within an install" sharing yet. `shareWithOrg: true`
shares with **everyone** who has a login on this MC install. If you need
team-scoped sharing, ask your admin — it's a feature on the roadmap, not
in current builds.
