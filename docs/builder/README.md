# Mission Control — Builder Guide

This is the manual for building your own apps inside Mission Control. An
"app" here is a small, focused workflow — fill in a few fields, hit Run,
get back a markdown answer or a PDF report. They live in **My Apps**
(`/elements`) and run via a sandboxed worker agent.

If you're an MC user looking at how to run apps that already exist, you
want [`../handbook/07-running-apps.md`](../handbook/07-running-apps.md)
instead.

## Pages

1. [What an app is, and when to build one](./01-when-to-build.md)
2. [Building from a description (the AI-assisted flow)](./02-from-description.md)
3. [Spec fields, in detail](./03-spec-fields.md)
4. [Inputs: text, textarea, select, number, file](./04-inputs.md)
5. [Prompt templates: writing instructions for the worker](./05-prompts.md)
6. [Output formats: markdown vs PDF](./06-outputs.md)
7. [PDF reports with charts and letterheads](./07-pdf-and-charts.md)
8. [Sharing apps with the org](./08-sharing.md)
9. [Examples — copy these as starting points](./09-examples.md)
10. [Limits, gotchas, and what the worker CAN'T do](./10-limits.md)
