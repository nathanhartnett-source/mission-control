# Prompt templates: writing for the worker

The **prompt template** is the most important field of a spec. It's the
instructions the worker agent gets at run time, with form inputs
interpolated in.

## How interpolation works

Anywhere you write `{{field_name}}` (where `field_name` matches an
input's `name`), the rendered prompt has the user's value substituted in.

```
Draft a product description for {{product_name}} in {{material}}.
Target price: ${{price}}.
```

For `file` inputs, the placeholder becomes the **absolute path** to the
uploaded file. Tell the worker to Read it:

```
The user uploaded a brief at {{brief_pdf}}. Read it. Then draft a reply
in our brand voice.
```

## What the worker can do

- **WebSearch** — search the public web
- **WebFetch** — fetch a specific URL
- **Read** — read files on disk (uploaded files, anything in /tmp)
- **Glob / Grep** — find files by pattern, search file contents
- **TodoWrite** — track its own internal todo list during the run

It runs in a **fresh `/tmp` working directory** with no project context.
So if you want it to know about your brand voice or your data sources,
**say so in the prompt**.

## What the worker CANNOT do

- No `Bash` — no shell, no `curl` outside of WebFetch, no scripts.
- No `Write` / `Edit` — output is whatever the worker prints to stdout, and
  that lands in `output.md`. It cannot persist files anywhere else.
- No `Agent` — it can't spawn sub-agents.
- No live API access except WebSearch / WebFetch.

If your app needs to write to a database or post to a service, it's not
an MC app — it's a script. Have your agent write a script in your
workspace and run it from chat, or build a proper integration.

## Writing a good prompt

Open with the **role and goal**:

```
You are a copywriter for <brand>. Your job is to draft a product
description for the brand's website.
```

Give the **inputs** clearly:

```
Product name: {{product_name}}
Material: {{material}}
Target price (AUD): {{price}}
```

State the **brand voice and constraints**. Be specific:

```
Voice: warm, plain-English, never "elevated" or "curated". Avoid the words
"painterly" and "quietly". Maximum 6 short paragraphs.
```

State the **output structure** explicitly:

```
Output:
- A headline (under 8 words)
- 2 paragraphs of body copy
- 3 bullet points highlighting key features
- A 1-sentence image brief for the photographer
```

End with a directive to **just produce the output**:

```
Reply with the draft only. No preamble, no commentary.
```

## When to embed reference material

If your app always needs the same context (brand guidelines, previous
examples, a glossary), paste it directly into the prompt template. Token
budget is generous; embedded context keeps results consistent without
making the user do anything.

```
Here is the brand voice guide. Follow it strictly:
---
[paste voice guide]
---

Here are 3 examples of past descriptions to match in tone:
---
Example 1: ...
Example 2: ...
Example 3: ...
---

Now: draft a description for {{product_name}}.
```

## Iterating

Prompts get better with feedback. If runs are coming out wrong:

1. Open one of the failed runs.
2. Read what the worker actually produced.
3. Edit the prompt template to address the failure (a new constraint, a
   removed instruction, a clearer output template).
4. Re-run. Repeat until it's reliable.

You can edit a saved app's prompt at any time from its settings page.
