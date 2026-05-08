#!/usr/bin/env node
/**
 * mc-element-pptx-render.cjs <runDir> <specJsonPath>
 *
 * Reads <runDir>/output.md, extracts ```slide fenced JSON blocks
 * { title, bullets?, body?, notes? }, writes <runDir>/output.pptx.
 * If no slides present, creates a single title slide with the markdown text.
 */
const fs = require("fs");
const path = require("path");

function findModule(name) {
  const mcHome = process.env.MC_HOME || "";
  const candidates = [
    () => require(name),
    () => process.env.MC_NODE_MODULES && require(`${process.env.MC_NODE_MODULES}/${name}`),
    () => mcHome && require(`${mcHome}/node_modules/${name}`),
    () => require(`/root/mission-control/node_modules/${name}`),
    () => require(`/home/nathan/.openclaw/workspace/mission-control/node_modules/${name}`),
  ];
  let lastErr;
  for (const tryRequire of candidates) {
    try { return tryRequire(); } catch (e) { lastErr = e; }
  }
  throw new Error(`${name} not resolvable: ${(lastErr && lastErr.message) || lastErr}`);
}

async function main() {
  const runDir = process.argv[2];
  const specPath = process.argv[3];
  if (!runDir || !specPath) {
    console.error("usage: mc-element-pptx-render.cjs <runDir> <specJsonPath>");
    process.exit(2);
  }
  const mdPath = path.join(runDir, "output.md");
  const pptxPath = path.join(runDir, "output.pptx");
  if (!fs.existsSync(mdPath)) { console.error("no output.md to render"); process.exit(2); }

  const md = fs.readFileSync(mdPath, "utf8");
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  const PptxGenJS = findModule("pptxgenjs");
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE";
  if (spec?.name) pres.title = String(spec.name).slice(0, 80);

  const slideRegex = /```slide\s*\n([\s\S]*?)```/g;
  const slides = [];
  let m;
  while ((m = slideRegex.exec(md)) !== null) {
    try { slides.push(JSON.parse(m[1].trim())); }
    catch (e) { slides.push({ title: "Invalid slide JSON", body: String(e) }); }
  }

  if (slides.length === 0) {
    const slide = pres.addSlide();
    slide.addText(spec?.name || "Output", { x: 0.5, y: 0.5, w: 12, h: 1, fontSize: 32, bold: true });
    slide.addText(md.slice(0, 4000), { x: 0.5, y: 1.7, w: 12, h: 5.5, fontSize: 14 });
  } else {
    for (const s of slides) {
      const slide = pres.addSlide();
      const title = String(s.title || "").slice(0, 200);
      if (title) slide.addText(title, { x: 0.5, y: 0.4, w: 12, h: 0.9, fontSize: 28, bold: true, color: "1F2937" });
      let y = 1.5;
      if (Array.isArray(s.bullets) && s.bullets.length > 0) {
        const bulletText = s.bullets.map((b) => ({ text: String(b), options: { bullet: true } }));
        slide.addText(bulletText, { x: 0.7, y, w: 11.5, h: 4.5, fontSize: 18, color: "374151" });
        y += 0.3 * s.bullets.length + 0.5;
      }
      if (typeof s.body === "string" && s.body.trim().length > 0) {
        slide.addText(s.body, { x: 0.7, y, w: 11.5, h: 6.5 - y, fontSize: 14, color: "4B5563" });
      }
      if (typeof s.notes === "string" && s.notes.trim().length > 0) {
        slide.addNotes(s.notes);
      }
    }
  }

  await pres.writeFile({ fileName: pptxPath });
  console.log(`wrote ${pptxPath} (${slides.length} slides)`);
}

main().catch(e => { console.error(e); process.exit(3); });
