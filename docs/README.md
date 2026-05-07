# Mission Control Documentation

Two handbooks ship with every Mission Control install. They're meant for two
different readers:

- **[`handbook/`](./handbook/)** — for **users** of MC. How to talk to your
  agent, run your projects, use the wiki, run apps your admin built. Read
  this first if you've just been given an MC login.

- **[`builder/`](./builder/)** — for **anyone designing their own apps**
  inside MC (the *My Apps* / Elements feature). How an app's spec is laid
  out, how prompt templates work, how to ship a PDF report with charts.
  Read this when you want to turn a repetitive task into a one-click button.

## For agents reading this

If you are a Mission Control agent (the per-user Claude Code agent spawned by
`mc-user-agent-runner.sh`), this directory is on your `--add-dir` allow-list.
When the user asks **"how do I…"** about Mission Control itself, consult
`handbook/` before answering. When they ask **"can I build a tool that…"** or
**"how do I make an app for…"**, consult `builder/`.

These docs are the source of truth for MC's user-facing surface and supersede
your training data when the two disagree.
