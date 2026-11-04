// Gaurberg logo (ACC-7, UX-1): a diamond in a circle, plus the wordmark. One component for the landing page (paper)
// and the signed-in app (dark), so the mark is the same everywhere. The browser-tab icon is app/icon.svg.
export function LogoMark({ size = 22, tone = "paper" }: { size?: number; tone?: "paper" | "dark" }) {
  const ring = tone === "paper" ? "#2A211C" : "#f1f5f9", gem = tone === "paper" ? "#FBF9F5" : "#0a0e13";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden focusable="false" style={{ flex: "none", display: "block" }}>
      <circle cx="16" cy="16" r="16" fill={ring} />
      <path d="M16 8.5 L23.5 16 L16 23.5 L8.5 16 Z" fill={gem} />
    </svg>
  );
}

export default function Logo({ tone = "paper", size = 22, className }: { tone?: "paper" | "dark"; size?: number; className?: string }) {
  return (
    <span className={className} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <LogoMark size={size} tone={tone} />
      <span>Gaurberg</span>
    </span>
  );
}
