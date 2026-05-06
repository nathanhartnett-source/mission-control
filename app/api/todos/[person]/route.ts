import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getPersonTodoModules } from '@/lib/openclaw-reader';

const HOME = process.env.HOME || '/home/nathan';
const BASE = path.join(HOME, '.openclaw', 'workspace', 'memory');

function classifyQuadrant(text: string, deadline?: string | null) {
  const t = text.toLowerCase();
  const now = Date.now();

  // Keywords indicating direct or indirect impact on profit/revenue
  const profitRegex = /(profit|revenue|sale|sales|conversion|aov|average order value|cart abandonment|checkout|payment|pricing|margin|upsell|cross-?sell|ads|roas|roi|campaign|traffic|orders|retention|repeat purchase|lifetime value|ltv|optimi[sz]e|optimize|increase sales|increase revenue|listing|product page|add to cart)/i;

  // Urgent signal words
  const urgentRegex = /(urgent|asap|immediately|now|critical|outage|site down|payment failed|sev(erity)?|blocker)/i;

  // Support/routine work
  const supportRegex = /(email|reply|call|schedule|book|confirm|meet|ticket|support|triage|follow up|admin|format|docs|schedule)/i;

  // Deadline check
  if (deadline) {
    try {
      const d = new Date(deadline).getTime();
      const ms = d - now;
      const hours = ms / (1000 * 60 * 60);
      if (hours <= 48) return 'Q1';
      // If deadline within a week and profit-related, treat as urgent-important
      if (hours <= 24 * 7 && profitRegex.test(t)) return 'Q1';
    } catch {}
  }

  // Urgent overrides
  if (urgentRegex.test(t)) return 'Q1';

  // Profit-related tasks are important (Q2)
  if (profitRegex.test(t)) return 'Q2';

  // Support / routine -> delegate (Q3)
  if (supportRegex.test(t)) return 'Q3';

  // Default -> low value / schedule (Q4)
  return 'Q4';
}

function estimateTokens(text: string) {
  // rough estimate: 4 chars per token
  const chars = text.length || 0;
  const tokens = Math.max(1, Math.ceil(chars / 4));
  return tokens;
}

// Pricing reference for gpt-5-mini (approx): input $0.25 / 1M, output $2.00 / 1M
const GPT5_MINI_INPUT_RATE = 0.25 / 1_000_000;
const GPT5_MINI_OUTPUT_RATE = 2.0 / 1_000_000;

function extractPerson(req: Request, context: any, body?: any) {
  let person = (context?.params?.person || '').toString().toLowerCase();
  if (!body) body = {};
  if (!person && body.person) person = (body.person || '').toString().toLowerCase();
  if (!person) {
    try {
      const u = new URL(req.url, 'http://localhost');
      const q = new URLSearchParams(u.search);
      if (q.get('person')) person = q.get('person')!.toLowerCase();
      else {
        const parts = u.pathname.split('/').filter(Boolean);
        // last part should be the person param
        person = parts[parts.length - 1]?.toLowerCase() || '';
      }
    } catch (e) {
      person = '';
    }
  }
  return person;
}

export async function POST(req: Request, context: any) {
  // parse body early to allow body.person fallback
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const person = extractPerson(req, context, body);
  if (!person || (person !== 'nathan' && person !== 'tessa')) {
    // return debugging info to help identify why extraction failed
    try {
      const info = { person, params: context?.params || null, url: req.url } as any;
      return NextResponse.json({ error: 'invalid person', info }, { status: 400 });
    } catch (e) {
      return NextResponse.json({ error: 'invalid person' }, { status: 400 });
    }
  }

  const text = (body.text || '').toString().trim();
  const deadline = body.deadline || null;
  const extraContext = body.context || null;

  if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });

  // classify (heuristic). In future we can switch to model-based classification.
  const quadrant = classifyQuadrant(text, deadline);

  const filePath = path.join(BASE, `todo-${person}.md`);

  // backup file
  try {
    if (fs.existsSync(filePath)) {
      const bak = `${filePath}.bak.${Date.now()}`;
      fs.copyFileSync(filePath, bak);
    }
  } catch (e) {
    // ignore backup failures but log in response
  }

  const line = `- [ ] [${quadrant}] ${text}`;
  try {
    fs.appendFileSync(filePath, (fs.existsSync(filePath) ? '\n' : '') + line + '\n', 'utf-8');
  } catch (e: any) {
    return NextResponse.json({ error: 'failed to append', detail: e?.message }, { status: 500 });
  }

  // token estimate for a model-based classification (optional)
  const tokens = estimateTokens(text + (context || '')) + 50; // +50 prompt overhead
  const estInputCost = +(tokens * GPT5_MINI_INPUT_RATE).toFixed(8);
  const estOutputCost = +(10 * GPT5_MINI_OUTPUT_RATE).toFixed(8); // small reply

  const people = getPersonTodoModules();
  const updated = people.find((p) => p.id === person);

  return NextResponse.json({
    success: true,
    appended: line,
    quadrant,
    tokenEstimate: {
      tokens,
      estInputCost,
      estOutputCost,
      estTotalCost: +(estInputCost + estOutputCost).toFixed(8),
      model: 'gpt-5-mini',
      note: 'Estimate assumes model-based classification; current run used heuristic and cost is $0.'
    },
    person: updated || null,
  });
}

export async function GET(req: Request, context: any) {
  const person = extractPerson(req, context);
  if (!person || (person !== 'nathan' && person !== 'tessa')) {
    return NextResponse.json({ error: 'invalid person' }, { status: 400 });
  }

  const people = getPersonTodoModules();
  const found = people.find((p) => p.id === person);
  return NextResponse.json({ person: found || null });
}

export async function PATCH(req: Request, context: any) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const person = extractPerson(req, context, body);
  if (!person || (person !== 'nathan' && person !== 'tessa')) {
    return NextResponse.json({ error: 'invalid person' }, { status: 400 });
  }

  const index = Number.isFinite(body.index) ? Number(body.index) : null;
  const newQuadrant = typeof body.newQuadrant === 'string' ? body.newQuadrant.toUpperCase() : null;
  const reason = body.reason || null;
  const actor = body.actor || 'unknown';

  if (index === null || index < 0 || !/^Q[1-4]$/.test(newQuadrant)) {
    return NextResponse.json({ error: 'invalid params' }, { status: 400 });
  }

  const filePath = path.join(BASE, `todo-${person}.md`);
  if (!fs.existsSync(filePath)) return NextResponse.json({ error: 'todo file not found' }, { status: 404 });

  // backup
  try {
    const bak = `${filePath}.bak.${Date.now()}`;
    fs.copyFileSync(filePath, bak);
  } catch (e) {}

  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  let todoCount = -1;
  let targetLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trimLeft();
    if (!l.startsWith('- ')) continue;
    todoCount += 1;
    if (todoCount === index) {
      targetLineIdx = i;
      break;
    }
  }

  if (targetLineIdx === -1) return NextResponse.json({ error: 'todo index not found' }, { status: 404 });

  const oldLine = lines[targetLineIdx];
  const oldMatch = oldLine.match(/\[\s*Q([1-4])\s*\]/i);
  const oldQuadrant = oldMatch ? `Q${oldMatch[1]}` : null;

  // remove any existing [Qx]
  let newLine = oldLine.replace(/\[\s*Q[1-4]\s*\]/i, '').trimRight();
  // insert after checkbox if present
  const checkboxMatch = newLine.match(/^(\s*-\s*\[.*?\]\s*)(.*)$/);
  if (checkboxMatch) {
    const pref = checkboxMatch[1];
    const rest = checkboxMatch[2].trim();
    newLine = `${pref}[${newQuadrant}] ${rest}`;
  } else {
    const simpleMatch = newLine.match(/^(\s*-\s*)(.*)$/);
    if (simpleMatch) {
      const rest = simpleMatch[2].trim();
      newLine = `- [${newQuadrant}] ${rest}`;
    } else {
      // fallback: just replace
      newLine = `[${newQuadrant}] ${newLine}`;
    }
  }

  lines[targetLineIdx] = newLine;

  try {
    fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
  } catch (e: any) {
    return NextResponse.json({ error: 'failed write', detail: e?.message }, { status: 500 });
  }

  // append feedback log
  try {
    const fbDir = path.join(BASE);
    const fbPath = path.join(fbDir, 'todo-feedback.log');
    const entry = {
      ts: new Date().toISOString(),
      person,
      index,
      actor,
      oldQuadrant,
      newQuadrant,
      reason,
      oldLine
    };
    fs.appendFileSync(fbPath, JSON.stringify(entry) + '\n', 'utf-8');
  } catch (e) {}

  const people = getPersonTodoModules();
  const updated = people.find((p) => p.id === person);
  return NextResponse.json({ success: true, person: updated || null });
}

export async function DELETE(req: Request, context: any) {
  // Archive (soft-delete) a todo by index
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const person = extractPerson(req, context, body);
  if (!person || (person !== 'nathan' && person !== 'tessa')) {
    return NextResponse.json({ error: 'invalid person' }, { status: 400 });
  }

  const index = Number.isFinite(body.index) ? Number(body.index) : null;
  const actor = body.actor || 'unknown';
  const reason = body.reason || null;

  if (index === null || index < 0) {
    return NextResponse.json({ error: 'invalid params' }, { status: 400 });
  }

  const filePath = path.join(BASE, `todo-${person}.md`);
  if (!fs.existsSync(filePath)) return NextResponse.json({ error: 'todo file not found' }, { status: 404 });

  // backup
  try {
    const bak = `${filePath}.bak.${Date.now()}`;
    fs.copyFileSync(filePath, bak);
  } catch (e) {}

  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  let todoCount = -1;
  let targetLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trimLeft();
    if (!l.startsWith('- ')) continue;
    todoCount += 1;
    if (todoCount === index) {
      targetLineIdx = i;
      break;
    }
  }

  if (targetLineIdx === -1) return NextResponse.json({ error: 'todo index not found' }, { status: 404 });

  const oldLine = lines[targetLineIdx];

  // remove the line
  lines.splice(targetLineIdx, 1);

  try {
    fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');
  } catch (e: any) {
    return NextResponse.json({ error: 'failed write', detail: e?.message }, { status: 500 });
  }

  // append to archive file
  try {
    const archivePath = path.join(BASE, `todo-archive-${person}.md`);
    const archivedLine = `- [ARCHIVED ${new Date().toISOString()}] ${oldLine}`;
    fs.appendFileSync(archivePath, (fs.existsSync(archivePath) ? '\n' : '') + archivedLine + '\n', 'utf-8');
  } catch (e) {}

  // append feedback log
  try {
    const fbDir = path.join(BASE);
    const fbPath = path.join(fbDir, 'todo-feedback.log');
    const entry = {
      ts: new Date().toISOString(),
      action: 'archive',
      person,
      index,
      actor,
      reason,
      oldLine
    };
    fs.appendFileSync(fbPath, JSON.stringify(entry) + '\n', 'utf-8');
  } catch (e) {}

  const people = getPersonTodoModules();
  const updated = people.find((p) => p.id === person);
  return NextResponse.json({ success: true, person: updated || null });
}
