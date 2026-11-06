// Shown at once on a tap on the Earnings calendar (NFR-1), and prefetched with the link, while the page renders on the server.
export default function Loading() {
  return (
    <main className="narrow cal" aria-busy="true" aria-label="Loading">
      <div className="sk-line sk-crumb" />
      <h1 style={{ marginTop: 12 }}>Earnings calendar</h1>
      <p className="muted">Upcoming reports for companies in the graph, by week.</p>
      <div className="card sk-card" style={{ height: 64 }} />
      <div className="card sk-card sk-wide" />
      <p className="muted mono sk-note" role="status">Loading…</p>
    </main>
  );
}
