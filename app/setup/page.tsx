"use client";

import { useCallback, useEffect, useState } from "react";

type Probe = {
  ok: boolean;
  home: string;
  user: string;
  claude: { found: boolean; path: string | null; version: string | null; authed: boolean; authError: string | null };
  wiki: { path: string; exists: boolean; fileCount: number };
  wikiCandidates: { path: string; fileCount: number }[];
  memoryDirs: { dir: string; fileCount: number; hasPersona: boolean }[];
  hasAdmin: boolean;
};

export default function SetupPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Step 1 — admin
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  // Step 2 — brand
  const [brandName, setBrandName] = useState("Mission Control");
  const [brandDescription, setBrandDescription] = useState("");
  const [brandUrl, setBrandUrl] = useState("");
  const [logoUploaded, setLogoUploaded] = useState(false);
  const [themeDetected, setThemeDetected] = useState(false);
  const [brandingBusy, setBrandingBusy] = useState<null | "logo" | "theme">(null);
  // Agent name is configured later (Settings → Agents); not asked in wizard.
  const agentName = "Assistant";

  // Step 3 — probe
  const [probe, setProbe] = useState<Probe | null>(null);
  const [seedWiki, setSeedWiki] = useState(true);
  const [useExistingCC, setUseExistingCC] = useState(true);
  const [wikiPath, setWikiPath] = useState<string>("");

  const goStep1 = useCallback(async () => {
    setErr(null);
    if (pw !== pw2) { setErr("Passwords don't match"); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/setup/admin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, email, password: pw }),
      });
      // Tolerate empty-body success: server may have committed the user but
      // the response body got dropped (Next 15 + Set-Cookie quirk we've seen).
      // Trust r.ok; only try to read JSON for error details.
      if (!r.ok) {
        let msg = `HTTP ${r.status}`;
        try { const d = await r.json(); if (d?.error) msg = d.error; } catch {}
        throw new Error(msg);
      }
      setStep(2);
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusy(false); }
  }, [username, email, pw, pw2]);

  const goStep2 = useCallback(() => { setErr(null); setStep(3); }, []);

  useEffect(() => {
    if (step !== 3) return;
    fetch("/api/setup/probe").then(async (r) => {
      if (!r.ok) return;
      const p = await r.json();
      setProbe(p);
      setWikiPath(p?.wiki?.path || "");
    }).catch(() => {});
  }, [step]);

  const goStep3 = useCallback(async () => {
    setErr(null);
    setBusy(true);
    try {
      const r = await fetch("/api/setup/scaffold", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brandName, brandDescription, agentName, seedWiki, useExistingCC, wikiPath }),
      });
      if (!r.ok) {
        let msg = `HTTP ${r.status}`;
        try { const d = await r.json(); if (d?.error) msg = d.error; } catch {}
        throw new Error(msg);
      }
      setStep(4);
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusy(false); }
  }, [brandName, brandDescription, agentName, seedWiki]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <header className="mb-5">
          <h1 className="text-xl font-semibold">Set up Mission Control</h1>
          <p className="text-xs text-slate-400 mt-1">Step {step} of 4</p>
          <div className="mt-3 flex gap-1">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className={`h-1 flex-1 rounded ${n <= step ? "bg-indigo-500" : "bg-slate-800"}`} />
            ))}
          </div>
        </header>

        {step === 1 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Create the admin account</h2>
            <p className="text-xs text-slate-400">This is the operator account you&apos;ll use to log in.</p>
            <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))} placeholder="username" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" type="email" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            <input value={pw} onChange={(e) => setPw(e.target.value)} placeholder="password (8+ chars)" type="password" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            <input value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="confirm password" type="password" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
            {err && <div className="text-xs text-rose-400">{err}</div>}
            <button onClick={goStep1} disabled={busy || !username || !email || pw.length < 8 || pw !== pw2} className="w-full px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm">{busy ? "Creating…" : "Create admin & continue"}</button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Brand basics</h2>
            <p className="text-xs text-slate-400">Tells your agent who it works for. You can change this later.</p>
            <label className="text-xs text-slate-300">Brand name<input value={brandName} onChange={(e) => setBrandName(e.target.value)} className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" /></label>
            <label className="text-xs text-slate-300">What does the team do? (1-2 sentences)<textarea value={brandDescription} onChange={(e) => setBrandDescription(e.target.value)} rows={3} placeholder="Accounting firm in Sydney, mostly small-business clients, helps them with bookkeeping and BAS" className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm" /></label>
            <div className="pt-2 border-t border-slate-800">
              <div className="text-xs uppercase tracking-wide text-slate-400 mb-1.5">Logo (optional)</div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  setBrandingBusy("logo"); setErr(null);
                  try {
                    const fd = new FormData(); fd.append("file", f);
                    const r = await fetch("/api/admin/branding/logo", { method: "POST", body: fd });
                    if (!r.ok) throw new Error(`HTTP ${r.status}`);
                    setLogoUploaded(true);
                  } catch (er) { setErr(`logo: ${(er as Error).message}`); }
                  finally { setBrandingBusy(null); }
                }}
                disabled={!!brandingBusy}
                className="text-xs text-slate-300"
              />
              {logoUploaded && <span className="ml-2 text-[11px] text-emerald-400">✓ uploaded</span>}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-400 mb-1.5">Theme from website (optional)</div>
              <div className="flex gap-2">
                <input
                  value={brandUrl} onChange={(e) => setBrandUrl(e.target.value)}
                  placeholder="https://yourbrand.com"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  onClick={async () => {
                    if (!/^https?:\/\//i.test(brandUrl)) { setErr("Enter a full https:// URL"); return; }
                    setBrandingBusy("theme"); setErr(null);
                    try {
                      const r = await fetch("/api/admin/branding/detect-theme", {
                        method: "POST", headers: { "content-type": "application/json" },
                        body: JSON.stringify({ url: brandUrl }),
                      });
                      if (!r.ok) { let m = `HTTP ${r.status}`; try { const d = await r.json(); if (d?.error) m = d.error; } catch {} throw new Error(m); }
                      setThemeDetected(true);
                    } catch (er) { setErr(`theme: ${(er as Error).message}`); }
                    finally { setBrandingBusy(null); }
                  }}
                  disabled={brandingBusy === "theme" || !brandUrl}
                  className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs whitespace-nowrap"
                >{brandingBusy === "theme" ? "Detecting…" : "Detect"}</button>
              </div>
              {themeDetected && <p className="text-[11px] text-emerald-400 mt-1">✓ theme applied</p>}
              <p className="text-[11px] text-slate-500 mt-1">Skip both and Slate theme will be applied. Detection takes ~30-90s.</p>
            </div>
            <button onClick={goStep2} disabled={!brandName || !!brandingBusy} className="w-full px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm">Continue</button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Detected environment</h2>
            {!probe ? (
              <p className="text-xs text-slate-400">Probing…</p>
            ) : (
              <>
                <ul className="text-xs space-y-1.5">
                  <li className="flex items-center gap-2">
                    <span className={probe.claude.found ? "text-emerald-400" : "text-rose-400"}>{probe.claude.found ? "✓" : "✗"}</span>
                    <span>Claude Code: {probe.claude.found ? <code className="text-slate-300">{probe.claude.path}</code> : <span className="text-slate-300">not found — install before continuing (<code>npm i -g @anthropic-ai/claude-code</code>)</span>}</span>
                  </li>
                  {probe.claude.found && (
                    <li className="flex items-center gap-2">
                      <span className={probe.claude.authed ? "text-emerald-400" : "text-rose-400"}>{probe.claude.authed ? "✓" : "✗"}</span>
                      <span>Claude Code authenticated: {probe.claude.authed ? "yes" : <span className="text-slate-300">no — run <code>claude login</code> in a terminal as this user, then refresh this page</span>}</span>
                    </li>
                  )}
                  <li className="flex items-start gap-2">
                    <span className={probe.wiki.exists ? "text-emerald-400" : "text-amber-400"}>{probe.wiki.exists ? "✓" : "+"}</span>
                    <span>
                      Wiki path:
                      <select
                        value={probe.wikiCandidates.some((c) => c.path === wikiPath) ? wikiPath : "__custom"}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v !== "__custom") setWikiPath(v);
                          else setWikiPath("");
                        }}
                        className="ml-2 bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-100"
                      >
                        {probe.wikiCandidates.map((c) => (
                          <option key={c.path} value={c.path}>{c.path.replace(probe.home, "~")} ({c.fileCount} md)</option>
                        ))}
                        {probe.wikiCandidates.length === 0 && (
                          <option value={probe.wiki.path}>{probe.wiki.path.replace(probe.home, "~")} (will create)</option>
                        )}
                        <option value="__custom">Custom path…</option>
                      </select>
                      {(!probe.wikiCandidates.some((c) => c.path === wikiPath)) && (
                        <input
                          value={wikiPath}
                          onChange={(e) => setWikiPath(e.target.value)}
                          placeholder="/absolute/path/to/wiki"
                          className="ml-2 mt-1 w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100"
                        />
                      )}
                      <span className="block text-[11px] text-slate-500 mt-0.5">Existing markdown will be preserved. Choice persists to <code>data/install.json</code>.</span>
                    </span>
                  </li>
                  {probe.memoryDirs.length === 0 ? (
                    <li className="flex items-center gap-2"><span className="text-amber-400">+</span><span>No CC memory dir — will be created</span></li>
                  ) : (
                    probe.memoryDirs.map((m) => (
                      <li key={m.dir} className="flex items-center gap-2">
                        <span className="text-emerald-400">✓</span>
                        <span>Memory dir <code className="text-slate-300">{m.dir.replace(probe.home, "~")}</code> — {m.fileCount} files{m.hasPersona ? ", persona.md exists (untouched)" : ""}</span>
                      </li>
                    ))
                  )}
                </ul>
                {probe.memoryDirs.length > 0 && (
                  <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] space-y-2">
                    <div className="font-semibold text-amber-300">Existing Claude Code detected</div>
                    <p className="text-slate-300">Use this Claude Code install as the base agent for Mission Control?</p>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input type="checkbox" checked={useExistingCC} onChange={(e) => setUseExistingCC(e.target.checked)} className="mt-0.5" />
                      <span className="text-slate-200">Yes, use the existing Claude Code as the base</span>
                    </label>
                    <ul className="list-disc list-inside text-slate-400 ml-1 space-y-0.5">
                      <li>MC will use the same Claude binary to power chats.</li>
                      <li>Your existing conversation history and short-term memory <strong>won&apos;t carry over</strong> into MC chats — MC creates a fresh per-user memory dir for each MC user (you, plus anyone you invite later) so each person&apos;s chats are isolated.</li>
                      <li>Existing <code>persona.md</code> is preserved untouched. Uncheck the box if you want MC to write a brand-new persona based on the brand info you entered.</li>
                      <li>This becomes the <em>base agent</em> — every MC user spawns their own per-user agent from it.</li>
                    </ul>
                  </div>
                )}
                <label className="flex items-center gap-2 text-xs text-slate-300 mt-3">
                  <input type="checkbox" checked={seedWiki} onChange={(e) => setSeedWiki(e.target.checked)} />
                  Add welcome.md and using-mission-control.md to the wiki (only if missing)
                </label>
                {err && <div className="text-xs text-rose-400">{err}</div>}
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setStep(2)} className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm">Back</button>
                  <button onClick={goStep3} disabled={busy || !probe.claude.found || !probe.claude.authed || !wikiPath} className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm">{busy ? "Setting up…" : "Set up agent & finish"}</button>
                </div>
              </>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4 text-center">
            <div className="text-3xl">🎉</div>
            <h2 className="text-lg font-semibold">Setup complete</h2>
            <p className="text-sm text-slate-300">Your agent <strong>{agentName}</strong> is ready.</p>
            <div className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2.5 text-left">
              <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-0.5">Your dashboard</div>
              <code className="text-xs text-indigo-300 break-all">{typeof window !== "undefined" ? window.location.origin : ""}</code>
              <div className="text-[11px] text-slate-500 mt-1">Bookmark this URL. Share it with anyone you invite — they&apos;ll log in here.</div>
            </div>
            <p className="text-xs text-slate-400">Send a message in the Agents tab to verify everything works end-to-end.</p>
            <a href="/agents" className="inline-block px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm">Open Agents →</a>
          </div>
        )}
      </div>
    </main>
  );
}
