import Breadcrumbs from "@/components/Breadcrumbs";
import { redirect } from "next/navigation";
import { getAccess } from "@/lib/supabase/server";
import { isUSListed } from "@/lib/marketdb";
import { isOffline } from "@/lib/mode";
import { nyToday, prepare, RANGES, type Range } from "@/lib/calendar-core";
import { loadCalendar } from "@/lib/calendar";
import CalendarView from "./CalendarView";

export const dynamic = "force-dynamic";

// Earnings calendar (TRM-13, UX-4, GRF-20): upcoming reports for every seed company from reviewed Finnhub dates, grouped by week.
export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ w?: string }> }) {
  const access = await getAccess();
  if (access.state !== "ok") redirect("/");
  const sp = await searchParams;
  const range = (RANGES.find((r) => String(r) === sp.w) ?? 30) as Range;
  const today = nyToday(new Date().toISOString()); // the New York day, as for report dates
  // The offline demo is always the admin; DEV_CALENDAR_ROLE=reviewer shows the reviewer view in local screenshots only.
  const role = isOffline() && process.env.DEV_CALENDAR_ROLE === "reviewer" ? "reviewer" : access.role;
  const data = await loadCalendar(today, role);
  const prepared = prepare({ ...data, isCovered: (c) => isUSListed(c.markets), today });
  const notice = data.offline ? "Offline: earnings dates are not saved for the offline demo."
    : data.error ? "Some earnings data could not be loaded. Try again."
    : !data.loadedIds.length ? "Earnings dates are not loaded yet: nothing has been reviewed and published."
    : null;
  return (
    <main className="narrow cal">
      <Breadcrumbs items={[{ label: "Earnings calendar" }]} />
      <h1 style={{ marginTop: 12 }}>Earnings calendar</h1>
      <p className="muted">Upcoming reports for companies in the graph, by week.</p>
      <CalendarView data={prepared} today={today} review={data.review} initialRange={range} notice={notice} />
      <p className="muted mono cal-foot">
        Dates come from Finnhub&apos;s earnings calendar and are not company-confirmed until the SEC 8-K appears; Finnhub has listed wrong dates before. Prices delayed. Not investment advice.
      </p>
    </main>
  );
}
