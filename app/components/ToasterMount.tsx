"use client";
import { Toaster } from "sonner";

export default function ToasterMount() {
  // Bright high-contrast toasts that work on both light and dark themes —
  // richColors picks per-type accents, but we force white text so dark-on-dark
  // (Allhart cream + slate-950 toast) doesn't become unreadable.
  return (
    <Toaster
      position="top-right"
      theme="dark"
      closeButton
      toastOptions={{
        style: { background: "#0f172a", color: "#f8fafc", border: "1px solid rgba(148,163,184,0.25)" },
        classNames: { title: "!text-slate-50", description: "!text-slate-300" },
      }}
    />
  );
}
