import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Source repo for desktop installers. Public; no token required for read.
const REPO = process.env.MC_DESKTOP_REPO || "nathanhartnett-source/mc-desktop";

type Asset = {
  name: string;
  size: number;
  browser_download_url: string;
};

type ReleasePayload = {
  tag: string;
  publishedAt: string;
  htmlUrl: string;
  windowsMsi?: { name: string; url: string; size: number };
  windowsExe?: { name: string; url: string; size: number };
  macDmg?: { name: string; url: string; size: number };
  macAppTar?: { name: string; url: string; size: number };
  linuxAppImage?: { name: string; url: string; size: number };
  linuxDeb?: { name: string; url: string; size: number };
  linuxRpm?: { name: string; url: string; size: number };
};

// Cache the result for 5 minutes so refreshing the download page doesn't
// hammer the GitHub API (60 req/hour for unauthenticated callers).
let cached: { at: number; payload: ReleasePayload } | null = null;
const CACHE_MS = 5 * 60 * 1000;

function pick(assets: Asset[], rx: RegExp) {
  const a = assets.find(x => rx.test(x.name));
  return a ? { name: a.name, url: a.browser_download_url, size: a.size } : undefined;
}

export async function GET() {
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return NextResponse.json({ ok: true, cached: true, ...cached.payload });
  }
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { "user-agent": "mc-dashboard", accept: "application/vnd.github+json" },
      // Cache control on the GitHub side (10s) to give a tiny buffer before our own cache.
      next: { revalidate: 10 },
    });
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: `GitHub API ${r.status}` }, { status: 502 });
    }
    const data = await r.json();
    const assets: Asset[] = data?.assets || [];
    const payload: ReleasePayload = {
      tag: data.tag_name || "unknown",
      publishedAt: data.published_at || "",
      htmlUrl: data.html_url || `https://github.com/${REPO}/releases/latest`,
      windowsMsi: pick(assets, /\.msi$/i),
      windowsExe: pick(assets, /-setup\.exe$/i),
      macDmg: pick(assets, /\.dmg$/i),
      macAppTar: pick(assets, /\.app\.tar\.gz$/i),
      linuxAppImage: pick(assets, /\.AppImage$/i),
      linuxDeb: pick(assets, /\.deb$/i),
      linuxRpm: pick(assets, /\.rpm$/i),
    };
    cached = { at: Date.now(), payload };
    return NextResponse.json({ ok: true, cached: false, ...payload });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
