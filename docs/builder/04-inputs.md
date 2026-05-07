# Inputs

Inputs are the fields users fill in before hitting Run. They model
**everything that varies between runs** — and nothing that doesn't.

Each input has the shape:

```jsonc
{
  "name": "snake_case_field",   // referenced in the prompt as {{snake_case_field}}
  "label": "Human label",        // shown next to the field in the form
  "type": "text",                // text | textarea | select | number | file
  "required": true,
  "placeholder": "Optional hint",
  "options": ["only", "for", "select"],
  "acceptMime": "image/*,application/pdf",  // file-only
  "maxMB": 20                                // file-only, default 20
}
```

## Field types

### `text`
Single-line input. Use for short strings: names, IDs, slugs, short
prompts.

### `textarea`
Multi-line input. Use when the user might paste a paragraph: an email,
notes, raw content to rewrite.

### `select`
Dropdown. Provide `options`. Use whenever the answer is a fixed enum —
brand, audience, region, severity. Keeps prompts deterministic.

### `number`
Numeric input. The form coerces to a number. Use for quantities, days,
ranges. Keep in mind the worker still receives it as a string when
interpolating into the prompt.

### `file`
File upload. The user drag-drops or picks a file; at run time the
`{{field}}` placeholder is replaced with the **absolute path** to the
uploaded file on the worker's filesystem. The worker then `Read`s it.

Use `acceptMime` to constrain MIME types (e.g.
`"image/*,application/pdf"`). Use `maxMB` to cap upload size (default 20).

> **Important**: file inputs interpolate to a path, not the file's contents.
> Your prompt must tell the worker to Read the path explicitly.

## How many inputs to use

Aim for 0–5 fields. More than that and users get fatigued; the app stops
saving them time.

If you find yourself wanting 8 inputs, you've probably described two
different apps glued together — split them.

## What inputs should NOT be

- **Things that never change.** Brand voice, output structure, data
  sources — bake those into the prompt template, not the form.
- **Auth tokens, credentials.** Apps run as the install's worker user with
  whatever filesystem access that user has. Don't ask users to paste keys
  into a form field.
- **Free-form configuration.** If you find yourself adding a "options"
  text field and parsing it in the prompt, you're rebuilding a form inside
  the form. Add typed fields instead.

## Required vs optional

Make a field required only if the prompt genuinely doesn't work without
it. Optional fields are nice for "advanced" parameters (date overrides,
voice variations) — and your prompt template should include a fallback
when they're empty.
