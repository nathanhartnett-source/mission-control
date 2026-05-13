"use client";

import { useEffect, useState } from "react";
import { useSiteName } from "../components/SiteProvider";

type Platform = "windows" | "mac" | "android" | "iphone";

type ReleaseAsset = { name: string; url: string; size: number };
type Release = {
  ok: boolean;
  tag?: string;
  publishedAt?: string;
  htmlUrl?: string;
  windowsMsi?: ReleaseAsset;
  windowsExe?: ReleaseAsset;
  macDmg?: ReleaseAsset;
  macAppTar?: ReleaseAsset;
  linuxAppImage?: ReleaseAsset;
  linuxDeb?: ReleaseAsset;
  linuxRpm?: ReleaseAsset;
  error?: string;
};

const PLATFORMS: { id: Platform; label: string; icon: string }[] = [
  { id: "windows", label: "Windows", icon: "M3 5.5L10.5 4.5V11.5H3V5.5ZM11.5 4.35L21 3V11.5H11.5V4.35ZM3 12.5H10.5V19.5L3 18.5V12.5ZM11.5 12.5H21V21L11.5 19.65V12.5Z" },
  { id: "mac",     label: "Mac",     icon: "M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12-.99.379-2.07 1.07-2.87.789-.91 2.107-1.59 3.094-1.78.001.01.001.01 0 .002zM20.94 17.65c-.561 1.31-1.04 2.55-2.039 3.66-1.439 1.57-3.49 1.91-5.16.92-1.55-.91-2.83-.93-4.46-.01-2.13 1.18-4.42.59-5.91-1.47C.4 16.95-.78 12.18 1.39 9.05c1.07-1.5 2.91-2.43 4.84-2.45 1.39-.02 2.69.94 3.55.94.85 0 2.39-1.16 4.05-1 .68.02 2.65.27 3.91 2.06-3.34 1.94-2.79 6.69.59 7.05.18.18-.04 1.07-.49 2z" },
  { id: "android", label: "Android", icon: "M17.523 15.34a1 1 0 11-1-1.73 1 1 0 011 1.73zm-11.04 0a1 1 0 11-1-1.73 1 1 0 011 1.73zm11.4-6.05l1.99-3.45a.42.42 0 00-.72-.42l-2.01 3.49C15.61 8.04 13.86 7.6 12 7.6s-3.61.44-5.14 1.31L4.85 5.42a.42.42 0 00-.72.42l1.99 3.45C2.7 11.07.5 14.05.5 17.5h23c0-3.45-2.2-6.43-5.62-8.21z" },
  { id: "iphone",  label: "iPhone",  icon: "M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12-.99.379-2.07 1.07-2.87.789-.91 2.107-1.59 3.094-1.78.001.01.001.01 0 .002zM20.94 17.65c-.561 1.31-1.04 2.55-2.039 3.66-1.439 1.57-3.49 1.91-5.16.92-1.55-.91-2.83-.93-4.46-.01-2.13 1.18-4.42.59-5.91-1.47C.4 16.95-.78 12.18 1.39 9.05c1.07-1.5 2.91-2.43 4.84-2.45 1.39-.02 2.69.94 3.55.94.85 0 2.39-1.16 4.05-1 .68.02 2.65.27 3.91 2.06-3.34 1.94-2.79 6.69.59 7.05.18.18-.04 1.07-.49 2z" },
];

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "windows";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "iphone";
  if (/Android/i.test(ua)) return "android";
  if (/Mac/i.test(ua)) return "mac";
  return "windows";
}

function fmtSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.round(bytes / 1000)} KB`;
}

function DownloadButton({ asset, label }: { asset?: ReleaseAsset; label: string }) {
  if (!asset) return null;
  return (
    <a
      href={asset.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition"
    >
      ⬇ {label}
      <span className="text-xs text-indigo-200 font-normal">{fmtSize(asset.size)}</span>
    </a>
  );
}

export default function DownloadPage() {
  const siteName = useSiteName();
  const [active, setActive] = useState<Platform>("windows");
  const [release, setRelease] = useState<Release | null>(null);

  useEffect(() => { setActive(detectPlatform()); }, []);
  useEffect(() => {
    fetch("/api/releases/latest", { cache: "no-store" })
      .then(r => r.json())
      .then((d: Release) => setRelease(d))
      .catch(() => setRelease({ ok: false, error: "could not load release info" }));
  }, []);

  const tagLine = release?.ok && release.tag
    ? `${release.tag}${release.publishedAt ? ` · released ${new Date(release.publishedAt).toLocaleDateString()}` : ""}`
    : "loading…";

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 text-slate-200">
      <h1 className="text-2xl font-semibold mb-2">Get the {siteName} app</h1>
      <p className="text-slate-400 mb-2">{siteName} runs in any browser, but installing it as an app gives you a dock/home-screen icon, fullscreen window, and faster startup.</p>
      <p className="text-xs text-slate-500 mb-8">
        Latest desktop build: <span className="font-mono text-slate-300">{tagLine}</span>
        {release?.htmlUrl && <> · <a className="text-indigo-300 underline" target="_blank" rel="noopener noreferrer" href={release.htmlUrl}>release notes</a></>}
      </p>

      <div className="flex flex-wrap gap-2 mb-8">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            onClick={() => setActive(p.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition ${
              active === p.id
                ? "bg-indigo-600/20 text-indigo-200 border-indigo-700/40"
                : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d={p.icon}/></svg>
            {p.label}
          </button>
        ))}
      </div>

      <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-4">
        {active === "windows" && (
          <>
            <h2 className="text-lg font-semibold">Windows desktop app</h2>
            <div className="flex flex-wrap gap-3">
              <DownloadButton asset={release?.windowsMsi} label="Download .msi (recommended)" />
              <DownloadButton asset={release?.windowsExe} label="Download .exe (NSIS)" />
            </div>
            <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-300 pt-2">
              <li>Click a button above to download the installer.</li>
              <li>The installer is unsigned for now — Windows SmartScreen will warn. Click <em>More info</em> → <em>Run anyway</em>.</li>
              <li>Launch <strong>{siteName}</strong> from the Start menu. First run asks for the dashboard URL.</li>
            </ol>
          </>
        )}
        {active === "mac" && (
          <>
            <h2 className="text-lg font-semibold">Mac desktop app</h2>
            <div className="flex flex-wrap gap-3">
              <DownloadButton asset={release?.macDmg} label="Download .dmg" />
              <DownloadButton asset={release?.macAppTar} label=".app.tar.gz" />
            </div>
            <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-300 pt-2">
              <li>Open the <code className="bg-slate-800 px-1 rounded">.dmg</code> (universal — works on Intel + Apple Silicon).</li>
              <li>Drag <strong>{siteName}</strong> into Applications.</li>
              <li>Unsigned for now: first launch right-click → Open → Open to bypass Gatekeeper.</li>
            </ol>
          </>
        )}
        {active === "android" && (
          <>
            <h2 className="text-lg font-semibold">Android (install as PWA)</h2>
            <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-300">
              <li>Open this dashboard in <strong>Chrome</strong>.</li>
              <li>Tap the <strong>⋮</strong> menu (top right).</li>
              <li>Tap <strong>Install app</strong> (or <em>Add to Home screen</em>).</li>
              <li>Confirm. {siteName} appears on your home screen as a standalone app.</li>
            </ol>
          </>
        )}
        {active === "iphone" && (
          <>
            <h2 className="text-lg font-semibold">iPhone / iPad (install as PWA)</h2>
            <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-300">
              <li>Open this dashboard in <strong>Safari</strong> (Apple blocks third-party browsers from installing apps).</li>
              <li>Tap the <strong>Share</strong> button (square with up-arrow).</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
              <li>Tap <strong>Add</strong>. {siteName} launches fullscreen from your home screen.</li>
            </ol>
          </>
        )}
        {(release?.linuxDeb || release?.linuxAppImage || release?.linuxRpm) && active !== "android" && active !== "iphone" && (
          <details className="text-xs text-slate-500 pt-3 border-t border-slate-800">
            <summary className="cursor-pointer hover:text-slate-300">Linux builds</summary>
            <div className="flex flex-wrap gap-3 mt-3">
              <DownloadButton asset={release?.linuxAppImage} label=".AppImage" />
              <DownloadButton asset={release?.linuxDeb} label=".deb" />
              <DownloadButton asset={release?.linuxRpm} label=".rpm" />
            </div>
          </details>
        )}
        {release && !release.ok && (
          <p className="text-xs text-rose-400">Could not load release info: {release.error}. <a href="https://github.com/nathanhartnett-source/mc-desktop/releases/latest" target="_blank" rel="noopener noreferrer" className="underline">Open releases page</a>.</p>
        )}
      </section>
    </main>
  );
}
