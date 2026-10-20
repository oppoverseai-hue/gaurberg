export default function PriceChart({ points }: { points: { t: number; c: number }[] }) {
  const w = 720, h = 220, pad = 8;
  const min = Math.min(...points.map((p) => p.c));
  const max = Math.max(...points.map((p) => p.c));
  const x = (i: number) => pad + (i / Math.max(points.length - 1, 1)) * (w - 2 * pad);
  const y = (v: number) => h - pad - ((v - min) / Math.max(max - min, 1e-9)) * (h - 2 * pad);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.c).toFixed(1)}`).join(" ");
  const up = points[points.length - 1].c >= points[0].c;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Daily closing price, last 12 months" className="chart">
      <path d={d} fill="none" stroke={up ? "var(--up)" : "var(--down)"} strokeWidth="2" />
      <text x={pad} y={14} className="axis">{max.toFixed(2)}</text>
      <text x={pad} y={h - 14} className="axis">{min.toFixed(2)}</text>
    </svg>
  );
}
