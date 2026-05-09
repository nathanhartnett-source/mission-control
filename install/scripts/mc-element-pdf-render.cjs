#!/usr/bin/env node
/**
 * mc-element-pdf-render.cjs <runDir> <specJsonPath>
 *
 * Reads <runDir>/output.md and renders <runDir>/output.pdf.
 * - Letterhead image (if spec.letterhead.imagePath) is placed at the top.
 * - ```chart fenced blocks containing Chart.js JSON are rendered as canvases.
 *
 * Requires `puppeteer` (bundled Chromium). Marked + DOMPurify loaded from CDN
 * in the rendered HTML, so this script only needs puppeteer in node_modules.
 */
const fs = require("fs");
const path = require("path");

async function main() {
  const runDir = process.argv[2];
  const specPath = process.argv[3];
  if (!runDir || !specPath) {
    console.error("usage: mc-element-pdf-render.cjs <runDir> <specJsonPath>");
    process.exit(2);
  }
  const mdPath = path.join(runDir, "output.md");
  const pdfPath = path.join(runDir, "output.pdf");
  if (!fs.existsSync(mdPath)) { console.error("no output.md to render"); process.exit(2); }

  const md = fs.readFileSync(mdPath, "utf8");
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));

  // Load letterhead as data URI so puppeteer doesn't need network/file access.
  let letterheadDataUri = "";
  const lhPath = spec?.letterhead?.imagePath;
  if (spec?.letterhead?.mode === "upload" && lhPath && fs.existsSync(lhPath)) {
    const ext = (path.extname(lhPath).slice(1) || "png").toLowerCase();
    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "svg" ? "image/svg+xml" : `image/${ext}`;
    letterheadDataUri = `data:${mime};base64,${fs.readFileSync(lhPath).toString("base64")}`;
  }

  // Pull out chart blocks before markdown rendering — replace with placeholders.
  const charts = [];
  const mdProcessed = md.replace(/```chart\s*\n([\s\S]*?)```/g, (_m, body) => {
    try {
      const cfg = JSON.parse(body.trim());
      const id = `chart_${charts.length}`;
      charts.push({ id, cfg });
      return `<div class="chart-host"><canvas id="${id}"></canvas></div>`;
    } catch (e) {
      return `<pre class="chart-error">Invalid chart JSON: ${String(e).replace(/</g, "&lt;")}</pre>`;
    }
  });

  const html = buildHtml({ markdown: mdProcessed, letterheadDataUri, charts, title: spec?.name || "Report" });

  // The worker runs us from a fresh /tmp cwd, so a bare `require("puppeteer")`
  // resolves against /tmp/node_modules (which doesn't exist) instead of MC's
  // own node_modules. Try bare resolution first; fall back to absolute path
  // into the MC install. MC_NODE_MODULES env var lets the renderer ship
  // alongside any future MC install (e.g. OBT) without a hard-coded path.
  let puppeteer;
  // Try (1) bare require — works when invoked from MC's cwd. Then (2) MC_NODE_MODULES env
  // override. Then (3) MC_HOME/node_modules — the standard MC install layout. Then (4)
  // common per-install paths. Last resort, search a few well-known locations.
  const mcHome = process.env.MC_HOME || "";
  const candidates = [
    () => require("puppeteer"),
    () => process.env.MC_NODE_MODULES && require(`${process.env.MC_NODE_MODULES}/puppeteer`),
    () => mcHome && require(`${mcHome}/node_modules/puppeteer`),
    () => require("/root/mission-control/node_modules/puppeteer"),
    () => require("/home/nathan/.openclaw/workspace/mission-control/node_modules/puppeteer"),
  ];
  let lastErr;
  for (const tryRequire of candidates) {
    try { puppeteer = tryRequire(); break; }
    catch (e) { lastErr = e; }
  }
  if (!puppeteer) {
    console.error("puppeteer not resolvable — last error:", (lastErr && lastErr.message) || lastErr);
    process.exit(3);
  }

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 60_000 });
    // Give Chart.js a tick to render.
    await page.evaluate(() => new Promise(r => setTimeout(r, 800)));
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
    });
  } finally {
    await browser.close();
  }
  console.log("PDF written:", pdfPath);
}

// Resolve a JS file from a vendored npm package and return its contents.
// We try a list of node_modules locations (same shape as require search),
// because the worker runs from a fresh /tmp cwd and bare resolution misses
// MC's own node_modules. Falls back to bare require() if the file form
// doesn't exist for some reason. Output: a string of JS to inline into
// the HTML scriptlet, replacing the previous CDN <script src=...>.
function loadVendoredJs(pkgRelPath) {
  const fs = require("fs");
  const mcHome = process.env.MC_HOME || "";
  const roots = [
    process.env.MC_NODE_MODULES,
    mcHome ? `${mcHome}/node_modules` : null,
    "/root/mission-control/node_modules",
    "/home/nathan/.openclaw/workspace/mission-control/node_modules",
    "./node_modules",
  ].filter(Boolean);
  for (const r of roots) {
    const p = `${r}/${pkgRelPath}`;
    try { if (fs.existsSync(p)) return fs.readFileSync(p, "utf8"); } catch {}
  }
  throw new Error(`vendored JS not found: ${pkgRelPath} (checked ${roots.join(", ")})`);
}

function buildHtml({ markdown, letterheadDataUri, charts, title }) {
  const safeTitle = title.replace(/</g, "&lt;");
  const mdEscaped = JSON.stringify(markdown);
  const chartsJson = JSON.stringify(charts);

  // Inline the libs from local node_modules — kills the jsdelivr supply-chain
  // dependency, the offline-install break, and the networkidle0 60s hang.
  const markedJs = loadVendoredJs("marked/marked.min.js");
  const domPurifyJs = loadVendoredJs("dompurify/dist/purify.min.js");
  const chartJs = loadVendoredJs("chart.js/dist/chart.umd.js");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${safeTitle}</title>
<script>${markedJs}</script>
<script>${domPurifyJs}</script>
<script>${chartJs}</script>
<style>
  body { font: 11pt/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #1f2937; margin: 0; padding: 0; }
  .letterhead { text-align: center; padding-bottom: 12mm; border-bottom: 1px solid #e5e7eb; margin-bottom: 8mm; }
  .letterhead img { max-height: 28mm; max-width: 100%; }
  h1 { font-size: 22pt; margin: 0 0 6mm; color: #111827; }
  h2 { font-size: 15pt; margin: 8mm 0 3mm; color: #111827; }
  h3 { font-size: 12pt; margin: 6mm 0 2mm; color: #374151; }
  p, li { margin: 0 0 3mm; }
  ul, ol { padding-left: 7mm; }
  table { border-collapse: collapse; width: 100%; margin: 4mm 0; font-size: 10pt; }
  th, td { border: 1px solid #d1d5db; padding: 2mm 3mm; text-align: left; }
  th { background: #f3f4f6; font-weight: 600; }
  code { background: #f3f4f6; padding: 0.5mm 1.5mm; border-radius: 1mm; font-size: 9.5pt; }
  pre { background: #f3f4f6; padding: 3mm; border-radius: 2mm; overflow-x: auto; font-size: 9pt; }
  .chart-host { width: 100%; max-width: 170mm; height: 90mm; margin: 5mm auto; page-break-inside: avoid; }
  .chart-error { color: #b91c1c; }
  .footer { font-size: 8pt; color: #9ca3af; text-align: center; margin-top: 10mm; padding-top: 4mm; border-top: 1px solid #e5e7eb; }
</style>
</head><body>
${letterheadDataUri ? `<div class="letterhead"><img src="${letterheadDataUri}" alt="letterhead"></div>` : ""}
<div id="content"></div>
<div class="footer">Generated ${new Date().toLocaleString()} · ${safeTitle}</div>
<script>
  const md = ${mdEscaped};
  const html = DOMPurify.sanitize(marked.parse(md), { ADD_TAGS: ['canvas'], ADD_ATTR: ['id'] });
  document.getElementById('content').innerHTML = html;
  const charts = ${chartsJson};
  for (const c of charts) {
    const el = document.getElementById(c.id);
    if (el) {
      try { new Chart(el.getContext('2d'), c.cfg); }
      catch (e) { el.outerHTML = '<pre class="chart-error">Chart render failed: ' + String(e) + '</pre>'; }
    }
  }
</script>
</body></html>`;
}

main().catch(e => { console.error(e); process.exit(1); });
