// Uber's ecosystem as drawn on the landing page (ACC-7): eight real counterparties from promoted links, inline SVG
// (no image download). `focus` dims everything but the named companies; `path` draws the NVIDIA-Baidu-Uber connection.
type Node = { id: string; x: number; y: number; kind: string; type: "competes" | "partners" | "supplies" | "invests" };

const NODES: Node[] = [
  { id: "Lyft", x: 160, y: 58, kind: "COMPETES", type: "competes" },
  { id: "Amazon", x: 400, y: 38, kind: "COMPETES", type: "competes" },
  { id: "DoorDash", x: 640, y: 58, kind: "COMPETES", type: "competes" },
  { id: "Alphabet", x: 100, y: 170, kind: "SUPPLIES", type: "supplies" },
  { id: "Aurora", x: 700, y: 170, kind: "PARTNER · STAKE", type: "partners" },
  { id: "WeRide", x: 160, y: 284, kind: "STAKE 5.6%", type: "invests" },
  { id: "Baidu", x: 400, y: 304, kind: "PARTNER", type: "partners" },
  { id: "Lucid", x: 640, y: 284, kind: "STAKE", type: "invests" },
];

export default function EcoMap({ focus, path = false, label = "Uber's ecosystem map" }: { focus?: string[]; path?: boolean; label?: string }) {
  const on = (id: string) => !focus || focus.includes(id);
  return (
    <svg viewBox="0 0 800 340" className="eco" role="img" aria-label={label}>
      <defs>
        <pattern id="dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#1c2430" /></pattern>
      </defs>
      <rect width="800" height="340" fill="url(#dots)" />
      {NODES.map((n) => (
        <line key={`l-${n.id}`} x1={400} y1={170} x2={n.x} y2={n.y} stroke={on(n.id) ? "#38BDF8" : "#26303c"} strokeOpacity={on(n.id) ? 0.55 : 1}
          strokeWidth={on(n.id) ? 1.4 : 1} strokeDasharray={n.type === "competes" ? "5 5" : undefined} />
      ))}
      {path && (
        <g>
          <line x1={400} y1={304} x2={720} y2={318} stroke="#38BDF8" strokeWidth={1.4} strokeDasharray="2 4" />
          <rect x={672} y={302} width={96} height={30} rx={6} fill="#101419" stroke="#38BDF8" />
          <text x={720} y={321} textAnchor="middle" className="eco-t">NVIDIA</text>
        </g>
      )}
      {NODES.map((n) => {
        const w = Math.max(84, n.id.length * 9 + 28);
        return (
          <g key={n.id} opacity={on(n.id) ? 1 : 0.35}>
            <rect x={n.x - w / 2} y={n.y - 17} width={w} height={34} rx={6} fill="#101419" stroke={on(n.id) && focus ? "#38BDF8" : "#26303c"} />
            <text x={n.x} y={n.y - 1} textAnchor="middle" className="eco-t">{n.id}</text>
            <text x={n.x} y={n.y + 11} textAnchor="middle" className="eco-k">{n.kind}</text>
          </g>
        );
      })}
      <circle cx={400} cy={170} r={44} fill="#181E26" stroke="#38BDF8" strokeOpacity={0.7} />
      <circle cx={438} cy={140} r={4} fill="#38BDF8" />
      <text x={400} y={168} textAnchor="middle" className="eco-c">UBER</text>
      <text x={400} y={184} textAnchor="middle" className="eco-k">FOCAL COMPANY</text>
    </svg>
  );
}
