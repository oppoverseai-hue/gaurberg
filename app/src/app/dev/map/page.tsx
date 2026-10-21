import { notFound } from "next/navigation";
import fs from "node:fs";
import MapView from "@/components/MapView";
import type { Rel } from "@/lib/graph";

// Local-only preview harness: renders the map from a fixture file (DEV_MAP_FIXTURE). Not available in production.
export const dynamic = "force-dynamic";
export default function DevMap() {
  const f = process.env.DEV_MAP_FIXTURE;
  if (process.env.NODE_ENV === "production" || !f) notFound();
  const { focal, rels } = JSON.parse(fs.readFileSync(f, "utf8")) as { focal: never; rels: Rel[] };
  return <main className="wide"><MapView focal={focal} rels={rels} isAdmin /></main>;
}
