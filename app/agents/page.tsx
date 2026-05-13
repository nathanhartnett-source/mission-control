import { cookies } from "next/headers";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";
import { readMessages, type MessageRow } from "@/lib/agents";
import AgentsClient from "./AgentsClient";
import { getSiteConfig } from "@/lib/site-config";
import { brandedTitle } from "@/lib/powered-by";

export const metadata = { title: `Agents — ${brandedTitle(getSiteConfig().name)}` };
export const dynamic = "force-dynamic";

// Server-render the first page of messages so chat is visible the instant
// React hydrates — no client fetch waterfall on mount. Reduces TTI from
// ~1-2s to ~50ms on cold load.
async function getInitialRows(): Promise<MessageRow[]> {
  try {
    const c = await cookies();
    const session = verify(c.get(SESSION_COOKIE)?.value);
    if (!session) return [];
    const user = findById(session.userId);
    if (!user || user.status !== "active") return [];
    const userFilter = user.isAdmin ? undefined : user.username;
    return await readMessages({ limit: 50, user: userFilter });
  } catch {
    return [];
  }
}

export default async function AgentsPage() {
  const initialRows = await getInitialRows();
  return <AgentsClient initialRows={initialRows} />;
}
