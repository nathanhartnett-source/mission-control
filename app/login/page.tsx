"use client";

import { useState, FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { BRAND_NAME, BRAND_LOGO, BRAND_LOGO_SVG } from "@/lib/brand";

function LoginForm() {
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  const next = decodeURIComponent(searchParams.get("next") || "") || "/support";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.personaCompleted === false) {
          router.push("/onboarding");
        } else {
          router.push(next);
        }
      } else {
        setError("Invalid username or password.");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / title */}
        <div className="text-center mb-8">
          {BRAND_LOGO_SVG ? (
            <div
              className="h-16 mx-auto mb-3 flex items-center justify-center [&>svg]:h-full [&>svg]:w-auto"
              dangerouslySetInnerHTML={{ __html: BRAND_LOGO_SVG }}
              aria-label={BRAND_NAME}
            />
          ) : BRAND_LOGO ? (
            <img src={BRAND_LOGO} alt={BRAND_NAME} className="h-16 mx-auto mb-3" />
          ) : (
            <h1 className="text-2xl font-bold text-white tracking-tight">{BRAND_NAME}</h1>
          )}
          <p className="text-sm text-slate-400 mt-1">Sign in to continue</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm
                           placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1
                           focus:ring-indigo-500 transition-all"
                placeholder="nathan"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm
                           placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1
                           focus:ring-indigo-500 transition-all"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-700/40 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50
                         disabled:cursor-not-allowed text-white text-sm font-medium transition-all border
                         border-indigo-500"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>

            <div className="text-center pt-2">
              <a href="/register" className="text-xs text-slate-400 hover:text-slate-300">
                Need an account? Request access
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <p className="text-slate-400 text-sm">Loading…</p>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
