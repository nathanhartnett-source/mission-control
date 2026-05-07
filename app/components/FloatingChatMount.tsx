"use client";

import dynamic from "next/dynamic";

const FloatingChat = dynamic(() => import("./FloatingChat"), { ssr: false });

export default function FloatingChatMount() {
  return <FloatingChat />;
}
