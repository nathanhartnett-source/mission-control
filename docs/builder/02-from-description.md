# Building from a description

The fastest way to ship an app is to describe it once and let the agent
draft the spec.

## The flow

1. Go to `/elements/new`.
2. In the big textarea, write **one paragraph** describing:
   - What the app does
   - What changes each time you run it (the inputs)
   - What you want back (markdown? PDF?)
3. Click **Draft spec.**
4. Review the generated spec. Tweak fields, prompt template, timeouts.
5. Click **Save.** The app appears in your My Apps grid.

## What a good description looks like

Bad:
> "An app that helps with marketing."

Good:
> "A weekly Instagram caption generator. Input: a single product name (text)
> and a target audience (select: gen-z / millennials / boomers). Output:
> three caption variants in our brand voice, with hashtags. Markdown is
> fine."

The difference: the second one specifies the **repetitive shape** (product
name + audience → 3 captions), names the **inputs** explicitly, and says
what the output should look like. Your agent's draft will be much closer
to ready-to-save.

## What the builder fills in

The builder agent decides:

- **Slug** (URL-safe version of the name)
- **Icon** (a single emoji that fits)
- **Inputs** — name, label, type, required-ness, placeholder text
- **Prompt template** — the instructions the worker agent gets at run time
- **Timeout** — how long the worker can run (1–30 minutes)
- **Output format** — markdown or PDF

You can change all of it on the review screen. Read [`03-spec-fields.md`](./03-spec-fields.md)
for what each field means.

## When the builder asks for more info

If your description is too vague, the builder returns a single specific
question instead of a spec — e.g. "Need more info: is this a one-button
app, or does the user pick a date range each run?" Answer the question and
re-submit.

## When to skip the AI flow

If you already know exactly what fields and prompt you want, the AI flow
just adds a step. Click **Draft spec** with a one-line description, then
overwrite everything in the review screen. Or hand-edit the JSON file
directly under `data/user-elements/<you>/<slug>.json` if you have shell
access.
