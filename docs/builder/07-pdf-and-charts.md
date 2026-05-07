# PDF reports with charts and letterheads

Apps with `outputFormat: "pdf"` can do two things plain markdown apps
can't: render **charts** and stamp a **letterhead** on every page.

## Charts

The worker can embed Chart.js charts using a fenced code block with the
language identifier `chart`:

````markdown
```chart
{
  "type": "bar",
  "data": {
    "labels": ["Site 1", "Site 2", "Site 3", "Site 4", "Site 5"],
    "datasets": [{
      "label": "Low SKUs",
      "data": [12, 19, 7, 24, 5],
      "backgroundColor": "#c8842e"
    }]
  },
  "options": {
    "plugins": { "legend": { "display": false } },
    "scales": { "y": { "beginAtZero": true } }
  }
}
```
````

The block content is a Chart.js v4 config object (JSON). The renderer
parses it, runs Chart.js in a headless browser, and inserts the resulting
image into the PDF.

### Chart types supported

Anything Chart.js supports: `bar`, `line`, `pie`, `doughnut`, `radar`,
`polarArea`, `scatter`, `bubble`. Stacked bars work, mixed-type charts
work, secondary axes work.

### Tell the worker to use them

Most agents won't reach for Chart.js fences on their own. Add explicit
instructions to the prompt template:

```
For any numeric comparison in the report, embed a Chart.js v4 config
inside a ```chart fenced block. Pick the chart type that fits the data:
- bar for category comparisons
- line for trends over time
- doughnut for share-of-total (max 6 slices)
The renderer will turn each block into a chart image in the final PDF.
```

### Caveats

- Charts are rendered without internet access. Don't reference external
  fonts or remote images in chart configs.
- Pie / doughnut readability falls off above ~6 slices. The agent can
  group small categories into "Other" — instruct it to do so explicitly.

## Letterheads

A letterhead is an image overlaid on every page of the PDF (typically a
header band with logo + brand colours; can also be a watermark).

### Setting one up

When you save an app with `outputFormat: "pdf"`:
1. In the **Letterhead** section of the form, click **Upload**.
2. Pick a PNG or JPG. Recommended dimensions: A4 width (~2480px), height
   matching whatever banner area you want covered.
3. Save the spec. The image is copied into the spec's letterhead dir
   (`data/user-elements/<you>/letterheads/<slug>/letterhead.<ext>`).

### How it's applied

The renderer places the letterhead **behind** the markdown content, full
width, anchored to the top of every page. If you want a footer, build it
into the same image at the bottom and rely on consistent margins.

### Brand colours

Letterheads are baked images, not templated. Make a different letterhead
per brand for apps that span brands. Or set the `shareWithOrg: false` flag
and have each org build their own version of the app with their own
letterhead.

## Page layout

The renderer uses a sensible default layout — A4 portrait, ~1in margins,
serif body font. There's no per-app override yet; if you need a custom
template, build one in the renderer instead and point your app's prompt
at it.
