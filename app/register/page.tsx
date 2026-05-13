"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import PixelAvatar from "@/app/components/PixelAvatar";
import AuthHeader from "@/app/components/AuthHeader";
import { rollAvatarSeed } from "@/lib/avatar";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatarSeed, setAvatarSeed] = useState<string>(() => rollAvatarSeed());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, confirmPassword, avatarSeed }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setSubmitted(true);
      } else {
        setError(data.error || "Something went wrong. Try again.");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <Shell>
        <h1 className="text-2xl font-bold text-white tracking-tight mb-2">Request received</h1>
        <p className="text-sm text-slate-400 mb-6">
          If your details are valid, your request has been submitted for approval. You'll be able to
          sign in once an admin approves your account.
        </p>
        <Link href="/login" className="text-sm text-indigo-400 hover:text-indigo-300">← Back to sign in</Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Request access</h1>
      <p className="text-sm text-slate-400 mb-6">
        New accounts require admin approval. You'll be notified once you can sign in.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
          <PixelAvatar seed={avatarSeed} size={64} />
          <div className="flex-1">
            <div className="text-xs font-medium text-slate-300 mb-0.5">Your avatar</div>
            <div className="text-[11px] text-slate-500 mb-2">Roll until you find one you like — you can change it later in settings.</div>
            <button
              type="button"
              onClick={() => setAvatarSeed(rollAvatarSeed())}
              className="px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium border border-slate-600"
            >
              🎲 Roll
            </button>
          </div>
        </div>
        <Field label="Username" hint="3–20 chars, lowercase letters/numbers/underscore">
          <input
            type="text"
            autoComplete="username"
            required
            value={username}
            onChange={e => setUsername(e.target.value.toLowerCase())}
            className={inputCls}
            placeholder="username"
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className={inputCls}
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Password" hint="At least 8 characters">
          <input
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className={inputCls}
            placeholder="••••••••••••"
          />
        </Field>
        <Field label="Confirm password">
          <input
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className={inputCls}
            placeholder="••••••••••••"
          />
        </Field>

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
          {loading ? "Submitting…" : "Request access"}
        </button>

        <div className="text-center pt-2">
          <Link href="/login" className="text-xs text-slate-400 hover:text-slate-300">
            Already have an account? Sign in
          </Link>
        </div>
      </form>
    </Shell>
  );
}

const inputCls =
  "w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm " +
  "placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 " +
  "focus:ring-indigo-500 transition-all";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <AuthHeader />
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
