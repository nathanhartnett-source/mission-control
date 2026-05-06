import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import "./globals.css";
import Nav from "./components/Nav";
import ThemeApplier from "./components/ThemeApplier";
import NotificationPoller from "./components/NotificationPoller";
import OnboardingGate from "./components/OnboardingGate";
import SessionWatcher from "./components/SessionWatcher";
import ConnectionHealthOverlay from "./components/ConnectionHealthOverlay";
import AchievementOverlay from "./components/AchievementOverlay";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";
import { BRAND_NAME } from "@/lib/brand";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });

export const metadata: Metadata = {
  title: BRAND_NAME,
  description: BRAND_NAME,
};

// Page paths a non-admin user is allowed to render. Anything else gets
// redirected to /. Auth itself is checked in middleware; this is the
// role-based layer on top.
const NON_ADMIN_PAGE_ALLOW = new Set<string>([
  "/", "/agents", "/onboarding", "/todo", "/settings",
]);

const PUBLIC_PAGES = new Set<string>([
  "/login", "/register", "/auth/result",
]);

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const pathname = h.get("x-pathname") || "/";

  const isPublic = PUBLIC_PAGES.has(pathname);

  if (!isPublic && !pathname.startsWith("/api/") && !pathname.startsWith("/_next/")) {
    const cookieStore = await cookies();
    const session = verify(cookieStore.get(SESSION_COOKIE)?.value);
    if (session) {
      const user = findById(session.userId);
      if (user && user.status === "active" && !user.isAdmin) {
        if (!NON_ADMIN_PAGE_ALLOW.has(pathname)) {
          redirect("/");
        }
      }
    }
  }

  return (
    <html lang="en">
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${inter.className} min-h-screen bg-slate-900 mc-themed-body`}>
        <ThemeApplier />
        {!isPublic && <Nav />}
        <NotificationPoller />
        <OnboardingGate />
        <SessionWatcher />
        <ConnectionHealthOverlay />
        <AchievementOverlay />
        <div className={isPublic ? "mc-dashboard-shell" : "mc-dashboard-shell md:ml-52 pb-16 md:pb-0"}>
          {children}
        </div>
      </body>
    </html>
  );
}
