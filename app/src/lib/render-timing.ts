// One timing line per render (NFR-1). Started first thing in a page, so the line covers the sign-in check and the company lookup too:
//   [timing] exposure UBER 412 ms (access 61, company 88, links 140, data 395)
// Each step is the time since the start of the render. Only timings and the ticker go to the log, never user data.
export function renderTimer(page: string) {
  const t0 = Date.now();
  const steps: string[] = [];
  return {
    /** Records the time since the start; returns its argument so it can wrap an awaited value. */
    step<T>(name: string, value?: T): T {
      steps.push(`${name} ${Date.now() - t0}`);
      return value as T;
    },
    done(what = "") {
      console.info(`[timing] ${page}${what ? ` ${what}` : ""} ${Date.now() - t0} ms (${steps.join(", ")})`);
    },
  };
}
