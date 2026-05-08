#!/usr/bin/env node
/**
 * mc-element-xlsx-render.cjs <runDir> <specJsonPath>
 *
 * Reads <runDir>/output.md, extracts ```sheet:TabName fenced CSV blocks,
 * writes <runDir>/output.xlsx with one worksheet per fenced block.
 *
 * If no fenced sheet blocks are present, falls back to a single "Sheet1"
 * with the markdown rendered as text rows (one row per non-empty line).
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

function parseCSV(text) {
  // Minimal RFC4180-ish CSV: handles quoted fields with commas + escaped quotes.
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v.length > 0));
}

function main() {
  const runDir = process.argv[2];
  const specPath = process.argv[3];
  if (!runDir || !specPath) {
    console.error("usage: mc-element-xlsx-render.cjs <runDir> <specJsonPath>");
    process.exit(2);
  }
  const mdPath = path.join(runDir, "output.md");
  const xlsxPath = path.join(runDir, "output.xlsx");
  if (!fs.existsSync(mdPath)) { console.error("no output.md to render"); process.exit(2); }

  const md = fs.readFileSync(mdPath, "utf8");
  const XLSX = findModule("xlsx");
  const wb = XLSX.utils.book_new();

  // Extract ```sheet:TabName fenced blocks (CSV body).
  const sheetRegex = /```sheet:([^\n`]+)\n([\s\S]*?)```/g;
  const sheets = [];
  let m;
  while ((m = sheetRegex.exec(md)) !== null) {
    const tab = m[1].trim().slice(0, 31).replace(/[\\/?*\[\]:]/g, "_") || `Sheet${sheets.length + 1}`;
    const rows = parseCSV(m[2].trim());
    if (rows.length > 0) sheets.push({ tab, rows });
  }

  if (sheets.length === 0) {
    // Fallback: dump markdown text as a single column.
    const lines = md.split("\n").filter(l => l.trim().length > 0).map(l => [l]);
    const ws = XLSX.utils.aoa_to_sheet(lines.length ? lines : [["(empty)"]]);
    XLSX.utils.book_append_sheet(wb, ws, "Output");
  } else {
    // Dedupe sheet names (Excel requires unique).
    const seen = new Set();
    for (const s of sheets) {
      let name = s.tab;
      let n = 2;
      while (seen.has(name.toLowerCase())) name = `${s.tab.slice(0, 28)} (${n++})`;
      seen.add(name.toLowerCase());
      const ws = XLSX.utils.aoa_to_sheet(s.rows);
      XLSX.utils.book_append_sheet(wb, ws, name);
    }
  }

  XLSX.writeFile(wb, xlsxPath, { bookType: "xlsx" });
  console.log(`wrote ${xlsxPath} (${sheets.length} sheets)`);
}

try { main(); } catch (e) { console.error(e); process.exit(3); }
