# Projects and to-dos

## Projects

A **project** in Mission Control is a named bucket of work with:
- its own short description and goal
- its own to-do list
- its own slot in the Bento grid
- (optionally) its own scoped wiki section

Open `/projects` to see the full list, or click a tile from home.

### Creating a project
Use the **+ New project** button. You'll be asked for a name and a one-line
description. Your agent gets told the project exists immediately and can
help you scope it from there.

### Talking to your agent about a specific project
Mention the project by name in chat. The agent will pull project context
(open to-dos, recent notes) before replying. There's no special syntax — it
reads project context from the same workspace it already has access to.

## To-dos

The **`/todo`** page is your personal task list. Items have:
- **Title** (short — a verb + object works best)
- **Status** — open, in-progress, done
- **Optional project** — links the to-do to a Bento project tile
- **Optional due date**

### Adding a to-do

Three ways:
1. Type it on `/todo` and hit Enter.
2. Ask your agent: "add a to-do to draft Q2 report by Friday."
3. From inside any chat: "remind me to follow up on this" — the agent will
   create one for you.

### Status changes

Tap the checkbox to mark done. Tap-and-hold (or right-click) for more
states. Your agent can also flip statuses on request: "mark the Q2 report
to-do as in progress."

### Where to-dos live

Under the hood, to-dos are stored in your workspace as JSON. Your agent can
read and rewrite them directly, which is why "tidy up my to-do list" works
as a chat command.
