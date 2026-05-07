# What Mission Control is

Mission Control is a self-hosted dashboard you share with a personal AI agent.
The agent is a Claude Code instance bound to your account — it has its own
memory, its own persona, and (depending on your role) the ability to read,
edit, and create files in a workspace assigned to you.

Three things distinguish MC from a generic chat tool:

1. **The agent persists.** It remembers what you've worked on, who you are,
   how you like to be spoken to, and the projects you've set up. You don't
   start from zero every time.

2. **It lives next to your work.** The same dashboard hosts your projects,
   to-do list, wiki, and the apps your team has built. Your agent can see
   all of it and act on it directly — no copy-pasting between tabs.

3. **It's yours.** MC runs on your own server (or your org's). Your data,
   your workspace, your conversation history — none of it is shared with
   other tenants.

## What you'll find inside

- **Home** — a Bento grid of project tiles and to-do modules.
- **Agents (`/agents`)** — text or voice chat with your agent.
- **Projects (`/projects`)** — per-project workspaces with their own context.
- **To-dos (`/todo`)** — a personal task list your agent helps you maintain.
- **Wiki (`/wiki`)** — a markdown knowledge base your agent reads and writes.
- **My Apps (`/elements`)** — one-click shortcuts for repetitive tasks. Anyone
  can build their own; admins can share apps with the whole org.
- **Notifications (`/notifications`)** — alerts your agent has flagged.
- **Settings (`/settings`)** — agent persona, account profile, branding.

## What's NOT in MC

- Calendar, email, payments — MC is the brain, not your everyday inbox.
  If your agent needs to send mail or read a calendar, it does that through
  scripts in your workspace, not through built-in pages.
- A code editor. Your agent edits files; you review the diffs through chat
  or directly on disk if you have shell access.
