export default function PriceChart({ points }: { points: { t: number; c: number }[] }) {
  const w = 760, h = 300, padL = 8, padR = 52, padY = 16;
  const min = Math.min(...points.map((p) => p.c));
  const max = Math.max(...points.map((p) => p.c));
  const x = (i: number) => padL + (i / Math.max(points.length - 1, 1)) * (w - padL - padR);
  const y = (v: number) => h - padY - ((v - min) / Math.max(max - min, 1e-9)) * (h - 2 * padY);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.c).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${h - padY} L${x(0).toFixed(1)},${h - padY} Z`;
  const up = points[points.length - 1].c >= points[0].c;
  const col = up ? "var(--up)" : "var(--down)";
  const hi = points.reduce((a, p, i) => (p.c > points[a].c ? i : a), 0);
  const lo = points.reduce((a, p, i) => (p.c < points[a].c ? i : a), 0);
  const ticks = [0, 1, 2, 3, 4].map((k) => min + ((max - min) * k) / 4);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Daily closing price, last 12 months" className="chart">
      <defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={col} stopOpacity=".22" /><stop offset="100%" stopColor={col} stopOpacity="0" /></linearGradient></defs>
      {ticks.map((t) => <g key={t}><line x1={padL} x2={w - padR} y1={y(t)} y2={y(t)} stroke="var(--line-subtle)" strokeDasharray="3 3" /><text x={w - padR + 6} y={y(t) + 3} className="axis">{t.toFixed(1)}</text></g>)}
      <path d={area} fill="url(#fill)" />
      <path d={line} fill="none" stroke={col} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(hi)} cy={y(max)} r="3.5" fill="var(--surface-mid)" stroke={col} strokeWidth="2" /><text x={Math.min(x(hi) + 6, w - padR - 40)} y={y(max) - 6} className="axis">{max.toFixed(2)}</text>
      <circle cx={x(lo)} cy={y(min)} r="3.5" fill="var(--surface-mid)" stroke={col} strokeWidth="2" /><text x={Math.min(x(lo) + 6, w - padR - 40)} y={y(min) - 8} className="axis">{min.toFixed(2)}</text>
    </svg>
  );
}
