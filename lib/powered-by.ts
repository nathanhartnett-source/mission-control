// Locked attribution (Tier 1 core).
//
// The "Powered by Allhart AIOS" attribution is intentionally hardcoded here
// and rendered by app/components/PoweredByFooter.tsx. Clients can fully
// customise their install brand via config/site.json (Tier 3) — but the
// attribution itself is core code. Any local edit to this file will conflict
// on `git pull` during Update from GitHub, breaking the update path.
//
// If you want to remove the attribution, talk to us — don't edit in place.

export const POWERED_BY = "Allhart AIOS";
export const POWERED_BY_URL = "https://allhart.com.au";

// Used by document <title> and other brand-string builders.
export function brandedTitle(installName: string): string {
  if (!installName || installName === POWERED_BY) return POWERED_BY;
  return `${installName} — ${POWERED_BY}`;
}
