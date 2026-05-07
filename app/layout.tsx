import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import "./globals.css";
import LayoutShell from "./components/LayoutShell";
import ThemeApplier from "./components/ThemeApplier";
import NotificationPoller from "./components/NotificationPoller";
import OnboardingGate from "./components/OnboardingGate";
import SessionWatcher from "./components/SessionWatcher";
import ConnectionHealthOverlay from "./components/ConnectionHealthOverlay";
import AchievementOverlay from "./components/AchievementOverlay";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";
import { MeProvider, type Me } from "./components/MeProvider";
import { BRAND_NAME } from "@/lib/brand";
import { resolveBranding } from "@/lib/branding-server";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });

export async function generateMetadata(): Promise<Metadata> {
  const b = resolveBranding();
  return { title: b.name || BRAND_NAME, description: b.name || BRAND_NAME };
}

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

  let initialMe: Me = null;
  if (!isPublic && !pathname.startsWith("/api/") && !pathname.startsWith("/_next/")) {
    const cookieStore = await cookies();
    const session = verify(cookieStore.get(SESSION_COOKIE)?.value);
    if (session) {
      const user = findById(session.userId);
      if (user && user.status === "active") {
        initialMe = {
          id: user.id,
          username: user.username,
          email: user.email,
          isAdmin: !!user.isAdmin,
          avatarSeed: user.avatarSeed || `user:${user.username}`,
          agentAvatarSeeds: user.agentAvatarSeeds || {},
          agentNames: user.agentNames || {},
          personaCompleted: !!user.personaCompleted,
        };
        if (!user.isAdmin && !NON_ADMIN_PAGE_ALLOW.has(pathname)) {
          redirect("/");
        }
      }
    }
  }

  const branding = resolveBranding();

  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__MC_BRANDING__ = ${JSON.stringify(branding)};`,
          }}
        />
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${inter.className} min-h-screen bg-slate-900 mc-themed-body`}>
        <MeProvider initial={initialMe}>
          <ThemeApplier />
          <NotificationPoller />
          <OnboardingGate />
          <SessionWatcher />
          <ConnectionHealthOverlay />
          <AchievementOverlay />
          <LayoutShell>{children}</LayoutShell>
        </MeProvider>
      </body>
    </html>
  );
}
