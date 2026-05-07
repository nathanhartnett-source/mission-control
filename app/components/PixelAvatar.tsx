"use client";

import { avatarDataUri } from "@/lib/avatar";

type Activity = "thinking" | "doing" | null | undefined;

export default function PixelAvatar({
  seed,
  size = 32,
  className = "",
  title,
  activity,
}: {
  seed: string;
  size?: number;
  className?: string;
  title?: string;
  activity?: Activity;
}) {
  const src = avatarDataUri(seed || "default", Math.max(24, size * 2));
  const animated = activity === "thinking" || activity === "doing";
  const overlaySize = Math.max(14, Math.round(size * 0.55));
  // eslint-disable-next-line @next/next/no-img-element
  const img = (
    <img
      src={src}
      alt={title || "avatar"}
      title={title}
      width={size}
      height={size}
      className={`${className} ${animated ? "mc-avatar-bob" : ""}`}
      style={{ width: size, height: size, imageRendering: "pixelated", borderRadius: 6, flexShrink: 0 }}
    />
  );
  if (!animated) return img;
  return (
    <span style={{ position: "relative", display: "inline-block", width: size, height: size, flexShrink: 0 }}>
      {img}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: -Math.round(overlaySize * 0.55),
          right: -Math.round(overlaySize * 0.35),
          width: overlaySize,
          height: overlaySize,
          pointerEvents: "none",
          fontSize: Math.round(overlaySize * 0.7),
          lineHeight: `${overlaySize}px`,
          textAlign: "center",
        }}
        className={activity === "thinking" ? "mc-avatar-thought" : "mc-avatar-tool"}
      >
        {activity === "thinking" ? "💭" : "🛠️"}
      </span>
    </span>
  );
}
