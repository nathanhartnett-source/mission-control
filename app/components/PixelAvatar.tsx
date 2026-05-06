"use client";

import { avatarDataUri } from "@/lib/avatar";

export default function PixelAvatar({
  seed,
  size = 32,
  className = "",
  title,
}: {
  seed: string | number;
  size?: number;
  className?: string;
  title?: string;
}) {
  const src = avatarDataUri(String(seed) || "default", Math.max(24, size * 2));
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={title || "avatar"}
      title={title}
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, imageRendering: "pixelated", borderRadius: 6, flexShrink: 0 }}
    />
  );
}
