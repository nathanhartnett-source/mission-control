"use client";

import { useEffect, useState } from "react";

type Branding = {
  logoPath: string | null;
  brandName?: string | null;
};

const PRODUCT = "Allhart AIOS";

export default function AuthHeader({ subtitle }: { subtitle?: string }) {
  const [b, setB] = useState<Branding | null>(null);

  useEffect(() => {
    fetch("/api/branding", { cache: "no-store" })
      .then(async (r) => { if (r.ok) return r.json(); return null; })
      .then((d) => { if (d?.branding) setB(d.branding); })
      .catch(() => {});
  }, []);

  const customBrand = b?.brandName && b.brandName !== PRODUCT ? b.brandName : null;
  const hasCustom = !!(b?.logoPath || customBrand);

  return (
    <div className="text-center mb-8">
      {b?.logoPath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.logoPath} alt="logo" className="mx-auto max-h-16 max-w-[220px] object-contain" />
      ) : (
        <h1 className="text-2xl font-bold text-white tracking-tight">{customBrand || PRODUCT}</h1>
      )}
      {b?.logoPath && customBrand && (
        <h2 className="text-lg font-semibold text-white tracking-tight mt-2">{customBrand}</h2>
      )}
      {hasCustom && (
        <p className="text-[10px] uppercase tracking-widest text-slate-500 mt-2">Powered by {PRODUCT}</p>
      )}
      {subtitle && <p className="text-sm text-slate-400 mt-1">{subtitle}</p>}
    </div>
  );
}
