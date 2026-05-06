type Props = { seed?: string | number; size?: number; title?: string };

export default function PixelAvatar({ seed = "", size = 48 }: Props) {
  const hash = String(seed).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue = hash % 360;
  return (
    <div
      style={{
        width: size,
        height: size,
        background: `hsl(${hue}, 50%, 45%)`,
        borderRadius: 6,
      }}
      aria-hidden
    />
  );
}
