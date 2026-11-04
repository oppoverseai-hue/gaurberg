// Landing-page illustrations (ACC-7). Abstract on purpose: generic roles and grey "text" bars, no company names,
// figures or quotes from the product, so the page explains the idea without giving the data away. Inline SVG only.

const ROLES = [
  { label: "SUPPLIER", x: 90, y: 70 }, { label: "CUSTOMER", x: 470, y: 70 },
  { label: "RIVAL", x: 60, y: 200 }, { label: "PARTNER", x: 500, y: 200 },
  { label: "INVESTOR", x: 110, y: 320 }, { label: "ACQUIRED", x: 450, y: 320 },
  { label: "RIVAL", x: 280, y: 30 }, { label: "SUPPLIER", x: 280, y: 360 },
];

/** Hero and "map" feature: a company in the middle, the businesses around it on labelled lines. */
export function Constellation({ dark = true }: { dark?: boolean }) {
  const line = dark ? "#38BDF8" : "#2A211C", node = dark ? "#101419" : "#FBFAF7", stroke = dark ? "#26303c" : "#E4DED5", ink = dark ? "#f1f5f9" : "#1C1916", sub = dark ? "#64748b" : "#6B645C";
  return (
    <svg viewBox="0 0 560 390" className="pp-ill" role="img" aria-label="Illustration: a company in the middle, linked to its suppliers, customers, rivals, partners and investors">
      {dark && <rect width="560" height="390" fill="#0A0E13" />}
      {ROLES.map((r, i) => (
        <line key={`l${i}`} x1={280} y1={195} x2={r.x} y2={r.y} stroke={line} strokeOpacity={dark ? 0.45 : 0.35} strokeWidth={1.2} strokeDasharray={r.label === "RIVAL" ? "4 5" : undefined} />
      ))}
      {ROLES.map((r, i) => (
        <g key={`n${i}`}>
          <rect x={r.x - 46} y={r.y - 15} width={92} height={30} rx={15} fill={node} stroke={stroke} />
          <text x={r.x} y={r.y + 4} textAnchor="middle" className="pp-ill-k" fill={sub}>{r.label}</text>
        </g>
      ))}
      <circle cx={280} cy={195} r={48} fill={dark ? "#181E26" : "#2A211C"} stroke={line} strokeOpacity={0.6} />
      <circle cx={318} cy={164} r={4} fill="#38BDF8" />
      <text x={280} y={192} textAnchor="middle" className="pp-ill-c" fill={dark ? ink : "#FBF9F5"}>YOUR</text>
      <text x={280} y={208} textAnchor="middle" className="pp-ill-c" fill={dark ? ink : "#FBF9F5"}>STOCK</text>
    </svg>
  );
}

const Bars = ({ x, y, w }: { x: number; y: number; w: number[] }) => <>{w.map((ww, i) => <rect key={i} x={x} y={y + i * 14} width={ww} height={6} rx={3} fill="#2b3441" />)}</>;

/** "Receipt" feature: a link card with the source sentence shown as grey lines and the check underneath. */
export function Receipt() {
  return (
    <svg viewBox="0 0 560 390" className="pp-ill" role="img" aria-label="Illustration: a link card showing the sentence from the filing and where it came from">
      <rect width="560" height="390" fill="#0A0E13" />
      <rect x="70" y="50" width="420" height="290" rx="10" fill="#101419" stroke="#222A35" />
      <text x="96" y="86" className="pp-ill-k" fill="#64748b">DISCLOSED RELATIONSHIP</text>
      <text x="96" y="112" className="pp-ill-t" fill="#f1f5f9">Supplier → Your stock</text>
      <rect x="96" y="134" width="368" height="104" rx="6" fill="#0A0E13" stroke="#222A35" />
      <rect x="96" y="134" width="3" height="104" fill="#38BDF8" />
      <Bars x={114} y={154} w={[320, 300, 330, 210, 260]} />
      <circle cx="104" cy="268" r="7" fill="none" stroke="#38BDF8" /><path d="M100 268 l3 3 l5 -6" stroke="#38BDF8" fill="none" strokeWidth="1.5" />
      <text x="120" y="272" className="pp-ill-k" fill="#94a3b8">QUOTE FOUND WORD FOR WORD</text>
      <text x="96" y="304" className="pp-ill-k" fill="#64748b">ANNUAL REPORT · FILING DATE · VIEW SOURCE ↗</text>
    </svg>
  );
}

/** "Exposure" feature: linked companies ranked, a bar where the filing states a share, a plain tag where it does not. */
export function Exposure() {
  const rows = [
    { role: "CUSTOMER", w: 160, tag: "STATED SHARE" }, { role: "SUPPLIER", w: 110, tag: "STATED SHARE" },
    { role: "STAKE HELD", w: 70, tag: "STATED SHARE" }, { role: "PARTNER", w: 0, tag: "SIZE NOT DISCLOSED" }, { role: "RIVAL", w: 0, tag: "NOT EXPOSURE" },
  ];
  return (
    <svg viewBox="0 0 560 390" className="pp-ill" role="img" aria-label="Illustration: linked companies ranked by how much the filings say they depend on the company">
      <rect width="560" height="390" fill="#0A0E13" />
      <text x="70" y="62" className="pp-ill-k" fill="#64748b">IF YOUR STOCK IS HIT, WHO FEELS IT?</text>
      {rows.map((r, i) => (
        <g key={i} transform={`translate(70 ${88 + i * 56})`}>
          <rect width="420" height="42" rx="8" fill="#101419" stroke="#222A35" />
          <text x="16" y="26" className="pp-ill-k" fill="#94a3b8">{r.role}</text>
          {r.w > 0 ? <rect x="140" y="16" width={r.w} height="10" rx="5" fill="#38BDF8" fillOpacity={0.75} /> : <rect x="140" y="16" width="160" height="10" rx="5" fill="none" stroke="#2b3441" strokeDasharray="3 4" />}
          <text x="404" y="26" textAnchor="end" className="pp-ill-k" fill="#64748b">{r.tag}</text>
        </g>
      ))}
    </svg>
  );
}

/** "Around" feature: what the linked companies are doing this week, as events and moves without figures. */
export function Around() {
  const rows = [
    { when: "TODAY", what: "Rival reports after the close", dot: "#38BDF8" },
    { when: "THU", what: "Supplier reports before the open", dot: "#64748b" },
    { when: "LAST CLOSE", what: "Partner moved sharply", dot: "#34d399", up: true },
    { when: "LAST CLOSE", what: "Customer fell sharply", dot: "#f87171", up: false },
  ];
  return (
    <svg viewBox="0 0 560 390" className="pp-ill" role="img" aria-label="Illustration: this week's report dates and big moves among the companies linked to your stock">
      <rect width="560" height="390" fill="#0A0E13" />
      <text x="70" y="62" className="pp-ill-k" fill="#64748b">AROUND YOUR STOCK THIS WEEK</text>
      {rows.map((r, i) => (
        <g key={i} transform={`translate(70 ${88 + i * 66})`}>
          <rect width="420" height="50" rx="8" fill="#101419" stroke="#222A35" />
          <circle cx="22" cy="25" r="5" fill={r.dot} />
          <text x="40" y="29" className="pp-ill-k" fill="#94a3b8">{r.when}</text>
          <text x="150" y="30" className="pp-ill-t2" fill="#e2e8f0">{r.what}</text>
          {r.up !== undefined && <text x="398" y="30" textAnchor="end" className="pp-ill-t2" fill={r.dot}>{r.up ? "▲" : "▼"}</text>}
        </g>
      ))}
    </svg>
  );
}
