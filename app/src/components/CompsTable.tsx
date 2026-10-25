// Peer comps table (TRM-12). Server component: every link is a plain URL, so sorting and pinning work without scripts.
import Link from "next/link";
import { dayLabel, pctCell, recs, type MetricRow } from "@/lib/metrics-core";
import { MAX_PINS, type CompRow, type SortKey } from "@/lib/comps-core";

const NL = "Not loaded";
type Col = { k: SortKey; l: string; cell: (r: CompRow) => { text: string | null; tip?: string } };
const x = (v: number | null | undefined) => ({ text: v == null ? null : `${v.toFixed(1)}x` });
const n2 = (v: number | null | undefined) => ({ text: v == null ? null : v.toFixed(2) });
const COLS: Col[] = [
  { k: "pe", l: "P/E (TTM)", cell: (r) => x(r.m?.pe_ttm) },
  { k: "ev", l: "EV/EBITDA", cell: (r) => x(r.m?.ev_ebitda) },
  { k: "opm", l: "Op. margin", cell: (r) => pctCell(r.m?.operating_margin ?? null) },
  { k: "npm", l: "Net margin", cell: (r) => pctCell(r.m?.net_margin ?? null) },
  { k: "growth", l: "Rev. growth YoY", cell: (r) => pctCell(r.m?.revenue_growth_yoy ?? null) },
  { k: "de", l: "Debt/equity", cell: (r) => n2(r.m?.debt_to_equity) },
];
const asOfTip = (m: MetricRow | null) => (m ? `Finnhub, as of ${dayLabel(m.as_of)}${m.status === "staged" ? " · staged, not reviewed" : ""}` : "Not loaded");

function RecBar({ r }: { r: CompRow }) {
  const x = recs(r.m);
  if (!x) return <span className="muted" title={asOfTip(r.m)}>{NL}</span>;
  const n = x.buy + x.hold + x.sell || 1, W = 60;
  return (
    <span title={`${x.detail} (${dayLabel(x.period)}) · ${asOfTip(r.m)}`} className="comps-rec">
      <svg width={W} height={6} aria-hidden="true"><rect width={(x.buy / n) * W} height={6} fill="var(--up)" /><rect x={(x.buy / n) * W} width={(x.hold / n) * W} height={6} fill="var(--fg2)" /><rect x={((x.buy + x.hold) / n) * W} width={(x.sell / n) * W} height={6} fill="var(--down)" /></svg>
      <span>{x.buy} buy / {x.hold} hold / {x.sell} sell</span>
    </span>
  );
}

function Row({ r, pinned, pinHref, canPin }: { r: CompRow; pinned: boolean; pinHref: string; canPin: boolean }) {
  const nx = r.next[0];
  return (
    <tr className={pinned ? "comps-pinned" : ""}>
      <td>
        <Link href={`/company/${r.c.ticker}`} className="scr-name"><strong>{r.c.name}</strong></Link>
        <span className="muted mono scr-sub">{r.c.ticker} · {(r.c.markets ?? []).join("/") || "n/a"} · {r.c.segment ?? "Unclassified"}{r.m?.status === "staged" ? " · staged" : ""}</span>
      </td>
      {COLS.map((c) => { const v = c.cell(r); return <td key={c.k} className={`num mono ${v.text == null || v.tip ? "muted" : ""}`} title={[v.tip, asOfTip(r.m)].filter(Boolean).join(" · ")}>{v.text ?? NL}</td>; })}
      <td className="mono"><RecBar r={r} /></td>
      <td className="mono" title={nx ? `Finnhub, fetched ${dayLabel(nx.fetched_at)}${nx.status === "staged" ? " · staged, not reviewed" : ""}` : "Not loaded"}>
        {nx ? <>{dayLabel(nx.date)}{nx.conflict && <span className="warn scr-sub">dates conflict, unverified</span>}</> : <span className="muted">{NL}</span>}
      </td>
      <td className="num">{(pinned || canPin) && <Link href={pinHref} className="mono scr-map">{pinned ? "Unpin" : "Pin"}</Link>}</td>
    </tr>
  );
}

export default function CompsTable({ pinned, rest, pins, sort, order, href }: {
  pinned: CompRow[]; rest: CompRow[]; pins: string[]; sort: SortKey; order: "asc" | "desc";
  href: (o: { sort?: string; order?: string; pin?: string }) => string;
}) {
  const sortHref = (k: SortKey) => href({ sort: k, order: sort === k ? (order === "asc" ? "desc" : "asc") : k === "name" || k === "next" ? "asc" : "desc" });
  const arrow = (k: SortKey) => (sort === k ? (order === "asc" ? " ↑" : " ↓") : "");
  const pinHref = (t: string) => href({ pin: (pins.includes(t) ? pins.filter((p) => p !== t) : [...pins, t]).join(",") });
  const canPin = pins.length < MAX_PINS;
  return (
    <table className="scr-table comps">
      <thead>
        <tr>
          <th><Link href={sortHref("name")}>Company{arrow("name")}</Link></th>
          {COLS.map((c) => <th key={c.k} className="num"><Link href={sortHref(c.k)}>{c.l}{arrow(c.k)}</Link></th>)}
          <th><Link href={sortHref("rec")}>Analysts{arrow("rec")}</Link></th>
          <th><Link href={sortHref("next")}>Next earnings{arrow("next")}</Link></th>
          <th aria-label="Pin" />
        </tr>
      </thead>
      <tbody>
        {pinned.map((r) => <Row key={r.c.id} r={r} pinned pinHref={pinHref(r.c.ticker)} canPin />)}
        {pinned.length > 0 && rest.length > 0 && <tr className="comps-gap"><td colSpan={COLS.length + 4} /></tr>}
        {rest.map((r) => <Row key={r.c.id} r={r} pinned={false} pinHref={pinHref(r.c.ticker)} canPin={canPin} />)}
      </tbody>
    </table>
  );
}
