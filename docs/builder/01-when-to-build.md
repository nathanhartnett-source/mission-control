# What an app is, and when to build one

A **Mission Control app** (internally: *Element*) is a saved shortcut for a
**repetitive workflow**. Think:

- "**Weekly stock-low report**" — no inputs, one button, outputs a PDF of
  low SKUs across our sites with charts.
- "**Draft a new product PDP**" — inputs: product name, material, price.
  Outputs a draft of brand-voice copy plus a suggested image brief.
- "**Customer complaint reply**" — inputs: customer name, order number,
  issue summary. Outputs a draft response in the right brand voice.
- "**Monthly ad-spend recap**" — no inputs; pulls Google Ads + Meta data;
  outputs PDF with charts per campaign.

## When to build an app vs just chat

| Situation                                              | Better fit |
|--------------------------------------------------------|------------|
| You'll do this *exact* shape of task again next week   | App        |
| You want a colleague to run it without you             | App        |
| You want consistent brand voice / structure each time  | App        |
| It's a one-off question or research task              | Chat       |
| The structure isn't stable yet — you're still figuring out the shape | Chat |

**Rule of thumb:** if you've done it twice and you'll do it again, it's an
app. The first build pays back fast.

## What's *not* a good app

- **Things that change every time.** If each instance needs you to write a
  different prompt, you don't have a workflow — you have a chat.
- **Anything requiring write access to live systems.** App workers can
  Read, Search, and WebFetch — they cannot run shell commands, edit your
  files, or post to APIs. (See [limits](./10-limits.md).)
- **Multi-step approvals.** Apps are one-shot: form → run → output. If you
  need a "review then send" step, the app's job is to draft, and a human
  hits Send.

## The two ways to build

1. **From a description.** Type one paragraph, your agent drafts the spec,
   you tweak. Covered in [`02-from-description.md`](./02-from-description.md).
2. **From scratch.** Fill the form fields directly. Covered across
   [`03-spec-fields.md`](./03-spec-fields.md) and onward.

Most people use option 1. It's faster and the agent picks sensible
defaults.
