import Link from "next/link";

type Props = { searchParams: Promise<{ kind?: string; status?: string; user?: string }> };

const MESSAGES: Record<string, { title: string; body: string; tone: "ok" | "err" }> = {
  approved: { title: "Approved",         body: "The user can now sign in.",                 tone: "ok"  },
  denied:   { title: "Denied",           body: "The request has been denied.",              tone: "err" },
  not_found:{ title: "Invalid link",     body: "That approval link wasn't recognised.",     tone: "err" },
  expired:  { title: "Link expired",     body: "Approval links expire after 7 days.",       tone: "err" },
  used:     { title: "Already actioned", body: "This link has already been used.",          tone: "err" },
  user_missing:{title:"User missing",    body: "The user record is no longer present.",     tone: "err" },
  missing:  { title: "No token",         body: "The link was missing a token.",             tone: "err" },
};

export default async function AuthResultPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = sp.status || "missing";
  const user = sp.user;
  const msg = MESSAGES[status] || MESSAGES.missing;
  const tone = msg.tone === "ok" ? "text-green-400" : "text-red-400";

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white tracking-tight">Allhart AIOS</h1>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-2xl p-8">
          <h2 className={`text-lg font-semibold mb-2 ${tone}`}>{msg.title}</h2>
          <p className="text-sm text-slate-300 mb-1">{msg.body}</p>
          {user && <p className="text-xs text-slate-500 mb-4">User: <code>{user}</code></p>}
          <Link href="/login" className="text-sm text-indigo-400 hover:text-indigo-300">← Sign in</Link>
        </div>
      </div>
    </div>
  );
}
