"use client";
import { useState } from "react";
import PriceChart from "@/components/PriceChart";

type Pt = { t: number; c: number };
const PERIODS = [{ k: "1M", n: 22 }, { k: "6M", n: 126 }, { k: "1Y", n: 260 }, { k: "5Y", n: 0 }] as const;

// Price chart with four periods (TRM-3). 1M, 6M and 1Y come from daily closes; 5Y from weekly closes.
export default function PeriodChart({ daily, weekly }: { daily: Pt[] | null; weekly: Pt[] | null }) {
  const [k, setK] = useState<(typeof PERIODS)[number]["k"]>("1Y");
  const pts = k === "5Y" ? weekly : daily ? daily.slice(-PERIODS.find((p) => p.k === k)!.n) : null;
  return (
    <div>
      <div className="seg" role="group" aria-label="Chart period">
        {PERIODS.map((p) => <button key={p.k} className={k === p.k ? "on" : ""} onClick={() => setK(p.k)}>{p.k}</button>)}
      </div>
      {pts && pts.length > 1 ? <PriceChart points={pts} /> : <p className="muted mono" style={{ fontSize: 12 }}>⚠ Data unavailable: no {k} history is available right now.</p>}
    </div>
  );
}
