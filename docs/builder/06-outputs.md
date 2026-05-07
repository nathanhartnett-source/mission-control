# Output formats: markdown vs PDF

Each app picks one output format. You can change it later, but the prompt
template often needs to change with it.

## `markdown`

Default. The worker writes markdown to stdout, which is captured into
`output.md` and rendered on the run page. Headings, lists, links, code
blocks all work. Tables work.

**Good for:**
- Drafts (emails, replies, social posts)
- Recaps and summaries the user will copy somewhere else
- Anything where the user is going to edit the output before using it

**Tips for markdown apps:**
- Tell the worker to skip preamble: "Reply with the draft only."
- Use tables when the output is structured data with columns.
- Use code fences only for actual code; the renderer styles them with a
  monospace font.

## `pdf`

The worker writes markdown that includes optional ` ```chart ` fences; an
asynchronous renderer turns the result into a PDF and adds a download
link to the run page. See [`07-pdf-and-charts.md`](./07-pdf-and-charts.md)
for the chart syntax.

**Good for:**
- Reports the user prints, emails, or shares with someone outside MC
- Anything with a letterhead expectation
- Anything with charts (because rendered chart blocks look great in PDF
  and ugly in raw markdown)

**Tips for PDF apps:**
- Always start with a `# Title` line — the renderer uses it as the
  document title.
- Add a date line just under the title: ``_Generated <date>_``.
- For long reports, split into clear `##` sections. The renderer respects
  page breaks at `---` horizontal rules.
- Use letterheads if your org has visual identity expectations.
- The renderer is best-effort. If a chart block fails to parse, that
  block is rendered as a code fence; the rest of the document is fine.

## Output size limits

The worker caps `output.md` at **2 MB**. If your app produces more than
that, you've over-asked — split into multiple apps, or scope the output
tighter.

## Empty / missing output

If the worker times out or errors before printing anything, the run page
shows the error from the worker log. The most common causes are:
- Timeout too short — bump `timeoutMin`.
- Prompt asked for a tool the worker doesn't have (Bash, Write).
- Worker failed to find a referenced file because the path wasn't
  interpolated correctly.

## Streaming feedback

While the worker is running, the run page shows a **live thinking
pillbox** — short status updates parsed from the agent's stream
(searching, reading, writing). It's not the final output, just live
feedback so users know it's not stuck. The pillbox disappears when the
worker writes its final result.
