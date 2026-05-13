import { POWERED_BY, POWERED_BY_URL } from "@/lib/powered-by";

// Locked attribution rendered on every authenticated page. Tier 1.
// Removing this component is a breaking change against the AIOS contract;
// any local edit will conflict on the next `git pull`.
export default function PoweredByFooter() {
  return (
    <div className="text-[10px] text-slate-500/70 text-center py-3 pointer-events-auto">
      Powered by{" "}
      <a
        href={POWERED_BY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-slate-300 underline-offset-2 hover:underline"
      >
        {POWERED_BY}
      </a>
    </div>
  );
}
