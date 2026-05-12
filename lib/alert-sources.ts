// Registry of built-in data sources users can build threshold alerts against.
// Clean repo ships with NO sources registered — alerts are research-only out
// of the box. Each install can register its own sources (PSI, sales,
// custom metrics) by extending this array.

import { listMessages } from "./inbox";

export type AlertSourceId = string;

export type AlertSourceMeta = {
  id: AlertSourceId;
  label: string;
  description: string;
  dimensions: { key: string; label: string; choices: { value: string; label: string }[] }[];
  ops: ("<" | ">" | "<=" | ">=")[];
  unit: "score" | "AUD" | "count" | string;
};

export const ALERT_SOURCES: AlertSourceMeta[] = [];

export async function evaluateValue(
  _sourceId: AlertSourceId,
  _dims: Record<string, string>,
  owner: string,
): Promise<{ value: number | null; label: string }> {
  // Built-in self-test path for the empty registry.
  if (_sourceId === "inbox-test") {
    return { value: listMessages(owner, { unreadOnly: true }).length, label: "unread inbox count" };
  }
  return { value: null, label: "unknown source" };
}

// Returns per-brand values for sources scoped to brand="all". Empty registry
// → empty list; the AI judge sees no data and replies that it can't watch
// what the user asked for.
export async function evaluatePerBrand(
  _sourceId: AlertSourceId,
  _owner: string,
): Promise<{ brandId: string; brandLabel: string; value: number | null; label: string }[]> {
  return [];
}

// Stubbed PSI rows reader — clean repo has no PSI ingest. Returns []
// so the evaluate route can still compile while clients add their own.
export function readLatestPsiRows(
  _strategy: "mobile" | "desktop",
  _brandFilter: string | null,
): { brand: string; page: string; url: string; score: number }[] {
  return [];
}

export function compareValue(value: number, op: string, threshold: number): boolean {
  switch (op) {
    case "<":  return value < threshold;
    case "<=": return value <= threshold;
    case ">":  return value > threshold;
    case ">=": return value >= threshold;
    default:   return false;
  }
}
