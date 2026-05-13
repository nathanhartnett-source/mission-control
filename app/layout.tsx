import type { Metadata, Viewport } from "next";
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
import FloatingChatMount from "./components/FloatingChatMount";
import ToasterMount from "./components/ToasterMount";
import { MeProvider, type Me } from "./components/MeProvider";
import { verify, SESSION_COOKIE } from "@/lib/auth-session";
import { findById } from "@/lib/users";
import { getSiteConfig } from "@/lib/site-config";
import { readUserCssOverrides } from "@/lib/css-overrides";

const site = getSiteConfig();

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });

export const metadata: Metadata = {
  title: site.name,
  description: site.loginTagline,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: site.shortName,
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

// Page paths a non-admin user is allowed to render. Anything else gets
// redirected to /. Auth itself is checked in middleware; this is the
// role-based layer on top.
const NON_ADMIN_PAGE_ALLOW = new Set<string>([
  "/", "/agents", "/onboarding", "/todo", "/settings", "/download",
]);

const PUBLIC_PAGES = new Set<string>([
  "/login", "/register", "/auth/result", "/setup",
]);

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const pathname = h.get("x-pathname") || "/";
  const isPublic = PUBLIC_PAGES.has(pathname);

  // First-run setup gate: if no active admin exists, force the wizard.
  // /setup is in PUBLIC_PAGES so this redirect is safe (won't loop).
  if (pathname !== "/setup" && !pathname.startsWith("/api/") && !pathname.startsWith("/_next/")) {
    const { listUsers } = await import("@/lib/users");
    const hasAdmin = listUsers().some((u) => u.isAdmin && u.status === "active");
    if (!hasAdmin) redirect("/setup");
  }

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
          agentNames: (user as { agentNames?: Record<string, string> }).agentNames || {},
          personaCompleted: !!user.personaCompleted,
        };
        if (!user.isAdmin && !NON_ADMIN_PAGE_ALLOW.has(pathname)) {
          redirect("/");
        }
      }
    }
  }

  const userCss = readUserCssOverrides();

  return (
    <html lang="en">
      <head>
        {userCss && <style dangerouslySetInnerHTML={{ __html: userCss }} />}
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${inter.className} min-h-screen bg-slate-900 mc-themed-body`}>
        <MeProvider initial={initialMe}>
          <ThemeApplier />
          {!isPublic && <Nav />}
          {!isPublic && <NotificationPoller />}
          {!isPublic && <OnboardingGate />}
          {!isPublic && <SessionWatcher />}
          {!isPublic && <ConnectionHealthOverlay />}
          {!isPublic && <AchievementOverlay />}
          {!isPublic && <FloatingChatMount />}
          <ToasterMount />
          <div className={isPublic ? "mc-dashboard-shell" : "mc-dashboard-shell md:ml-52 pb-16 md:pb-0"}>
            {children}
          </div>
        </MeProvider>
      </body>
    </html>
  );
}
