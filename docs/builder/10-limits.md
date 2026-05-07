# Limits, gotchas, and what the worker CAN'T do

Read this before designing an app that needs to write somewhere or talk
to a service. The worker's permission surface is intentionally narrow.

## Hard limits (worker permissions)

The worker is launched by `mc-element-worker.sh` with:

```
--allowedTools "WebSearch WebFetch Read Glob Grep TodoWrite"
--permission-mode bypassPermissions
```

That means it can:
- Search the web (`WebSearch`)
- Fetch a specific URL (`WebFetch`)
- Read files on disk (`Read`)
- Find files (`Glob`)
- Search file contents (`Grep`)
- Manage its own internal todo list (`TodoWrite`)

It **cannot**:
- Run `Bash`, `curl`, or any shell command
- `Write` or `Edit` files (its only output is whatever it prints to stdout)
- Spawn sub-`Agent`s
- Access any tool not on the allow-list, even if you ask nicely in the
  prompt

If your app needs anything outside this surface, it isn't an MC app — it's
a workspace script. Have your agent author one in your workspace and
trigger it from chat instead.

## Soft limits (resource ceilings)

- **`timeoutMin`**: 1–30 minutes. Hard SIGKILL when exceeded — the worker
  won't finish "just one more step" past the cap.
- **Output size**: 2 MB on `output.md`. Anything past that is truncated
  with a `_(output truncated at 2MB)_` marker.
- **Inputs**: 12 fields max per spec. File uploads default 20 MB max
  (override with `maxMB`).
- **Prompt template**: 8000 characters max.
- **Builder description**: 90-second timeout on the builder agent, so
  keep your description tight on the AI flow.

## Common gotchas

### "My app says 'tool not available'"

Your prompt told the worker to use Bash / Write / Edit / Agent. Either
remove that instruction or accept the work has to happen elsewhere.

### "My output is empty"

Three usual causes:
1. The worker didn't print anything before the timeout. Bump `timeoutMin`.
2. The worker errored before producing output. Check the worker.log —
   accessible to your admin from the run dir.
3. The prompt asked for non-text output (an image, an audio file).
   Markdown-only — use a chart fence for visuals; audio isn't supported.

### "PDF rendered without my chart"

The chart fence wasn't valid Chart.js JSON. The renderer falls back to
showing the fence as a code block when it can't parse. Check the JSON
syntax in the rendered markdown.

### "Letterhead didn't apply"

You uploaded the letterhead but didn't save the spec — uploads are staged
to a temp path; the API copies them on save. Re-open the spec, re-upload,
hit Save again.

### "File upload timed out / failed"

File uploads above ~20 MB hit Next.js's default body size cap. Increase
`maxMB` *and* check your install's reverse-proxy / Cloudflare Tunnel
limits.

### "Worker died mid-run when MC restarted"

Pre-2026-05-07 builds spawned workers as systemd scopes tied to MC's
cgroup, so they got nuked when MC restarted. Current builds use
`systemd-run --user --collect ... --unit` to detach the worker into its
own transient unit. If you see this on an older install, update.

### "Shared app shows on other users' grids but errors when they run it"

Most likely the prompt references a path only your workspace has (e.g.
`~/wiki/private-notes/...`). Move shared context into a path every
install user can read, or include the data inline in the prompt template.

## Things you might wish for that don't exist (yet)

- **Scheduled runs**: apps run on demand only. For "every Monday at 8am"
  workflows, your admin can schedule a `claude -p` cron in the install.
- **Team-scoped sharing**: today it's private or org-wide.
- **Multi-step apps with approvals**: each app is one-shot. For approval
  workflows, ship the draft as one app's output and the send as a
  separate manual step.
- **Webhook-triggered apps**: there's no inbound API for triggering a
  run from outside MC.

If you want any of these, raise it with your admin — most are tractable;
they just haven't been built yet.
