import AgentsClient from "./AgentsClient";

export const metadata = { title: "Agents — Allhart AIOS" };
export const dynamic = "force-dynamic";

export default function AgentsPage() {
  return <AgentsClient />;
}
