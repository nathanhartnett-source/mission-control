# Examples

Five working app specs you can paste into the AI builder description box
(or hand-author) as starting points. Each one shows the **shape** of a
useful app — a tight set of inputs, an explicit prompt, a clear output.

---

## Example 1 — Customer complaint reply (markdown)

**Description to paste:**
> "Customer complaint reply. Inputs: customer name, order number, issue
> summary (textarea). Output: a draft email reply in our brand voice —
> empathetic but solution-focused, signs off as the support team. 3
> paragraphs max."

**Resulting spec (shape):**

```jsonc
{
  "name": "Complaint Reply Draft",
  "icon": "✉️",
  "inputs": [
    { "name": "customer_name", "label": "Customer name", "type": "text", "required": true },
    { "name": "order_number", "label": "Order #", "type": "text", "required": true },
    { "name": "issue_summary", "label": "Issue", "type": "textarea", "required": true }
  ],
  "promptTemplate": "You are drafting a customer support reply for our brand. Voice: warm, plain-English, solution-focused — never defensive, never overly formal.\n\nCustomer: {{customer_name}}\nOrder: {{order_number}}\nIssue: {{issue_summary}}\n\nDraft a 3-paragraph reply: (1) acknowledge the issue specifically, (2) explain what we'll do, (3) sign off warmly. Sign off as 'The Support Team'.\n\nReply with the draft only — no preamble.",
  "outputFormat": "markdown",
  "timeoutMin": 5
}
```

---

## Example 2 — New product PDP draft (markdown)

> "Product page draft for a new SKU. Inputs: product name, material
> (select: gold / silver / titanium / wood), price (number), one-line
> hero positioning (text). Output: a headline (under 8 words), 2 short
> paragraphs of body copy in our brand voice, 3 feature bullets, and a
> 1-sentence image brief."

Use a `select` for material so the worker doesn't have to interpret
freeform input. Keep `timeoutMin: 5` — this is a fast generation.

---

## Example 3 — Weekly stock-low report (PDF, no inputs)

> "Weekly stock-low report. No inputs. Outputs a PDF: one section per
> brand, listing SKUs with stock < 10 units, with a Chart.js bar chart of
> low SKU counts per brand at the top. Sourced from our wiki page
> `concepts/stock-data.md`."

This app has zero inputs — it always does the same thing. Bake the data
source into the prompt:

```
Read the file ~/wiki/concepts/stock-data.md to get current stock levels.
[...] Embed a Chart.js bar chart at the top of the report showing low SKU
counts per brand using a fenced ```chart block.
```

`timeoutMin: 15` — gives time for reading + drafting + chart embedding.

---

## Example 4 — Letterhead applied: monthly client recap (PDF)

> "Monthly client recap PDF. Inputs: client name (text), month (select:
> Jan-Dec), key wins (textarea, optional). Output: a 2-page PDF with our
> letterhead, sections for: traffic summary, top campaigns, screenshots
> referenced (the user attaches up to 3), key wins. Each section has a
> Chart.js chart where data exists."

Add an `acceptMime: "image/*"` file input for screenshots. Tell the
worker to Read each uploaded file's path and reference them in the recap.
Upload your letterhead PNG when saving.

---

## Example 5 — Brief analyser (markdown, with file input)

> "Brief analyser. Input: a brief PDF (file upload, application/pdf).
> Output: a markdown bulleted summary of (1) what the client is asking
> for, (2) explicit constraints, (3) implicit constraints, (4) open
> questions to send back."

The prompt should include:
```
The user uploaded a brief at {{brief_pdf}}. Use the Read tool to read it.
Then produce the 4-section summary.
```

`timeoutMin: 10`.

---

## Lifting from existing apps

Open any shared app's run page — the URL is `/elements/<slug>`. The spec
isn't visible to non-owners, but the inputs and the description give you
plenty to copy. Or ask your agent: "look at the My Apps directory and
write me a spec like the X app but for Y" — the agent can read the JSON
under `data/user-elements/<them>/<slug>.json` if it has filesystem scope
there.
