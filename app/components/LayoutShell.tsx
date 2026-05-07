"use client";

import { usePathname } from "next/navigation";
import Nav from "./Nav";

// Client-side equivalent of the layout's PUBLIC_PAGES set. Kept here so the
// shell can decide on each client navigation whether to mount Nav and apply
// the sidebar margin — App Router caches the root layout's server output, so
// gating these on a server-side `isPublic` causes the sidebar to disappear
// after login until a hard refresh.
const PUBLIC_PAGES = new Set<string>(["/login", "/register", "/auth/result"]);

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const isPublic =
    PUBLIC_PAGES.has(pathname) || pathname.startsWith("/auth/result");

  return (
    <>
      {!isPublic && <Nav />}
      <div
        className={
          isPublic
            ? "mc-dashboard-shell"
            : "mc-dashboard-shell md:ml-52 pb-16 md:pb-0"
        }
      >
        {children}
      </div>
    </>
  );
}
