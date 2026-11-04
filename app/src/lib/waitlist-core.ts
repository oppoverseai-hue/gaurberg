// Waitlist rules (ACC-5): the answer sets and form validation. Pure functions, no data access, so tests can run them.

export const ROLES = [
  ["independent", "Independent analyst or investor"],
  ["fund", "Fund or asset manager"],
  ["equity_research", "Equity research"],
  ["corporate", "Corporate strategy, M&A or business development"],
  ["student", "Student"],
  ["other", "Other"],
] as const;

export const TOOLS = [
  ["terminal", "Bloomberg, FactSet, Capital IQ or Refinitiv"],
  ["modern", "Koyfin, TIKR or Finchat"],
  ["retail", "TradingView or Yahoo Finance"],
  ["broker", "My broker's app"],
  ["filings", "Filings and spreadsheets"],
  ["other", "Other"],
] as const;

export type WaitlistInput = { role: string; tools: string[]; first_company: string | null; open_to_call: boolean; consent_updates: boolean };
export type Checked = { ok: true; value: WaitlistInput } | { ok: false; error: string };

const roleIds = new Set<string>(ROLES.map(([id]) => id)), toolIds = new Set<string>(TOOLS.map(([id]) => id));

/** Validate the request-access form. Only known answers are kept; free text is trimmed and capped. */
export function checkForm(f: { get(name: string): FormDataEntryValue | null; getAll(name: string): FormDataEntryValue[] }): Checked {
  const role = String(f.get("role") ?? "");
  if (!roleIds.has(role)) return { ok: false, error: "Pick the option that best describes you." };
  const tools = [...new Set(f.getAll("tools").map(String).filter((t) => toolIds.has(t)))];
  const company = String(f.get("first_company") ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (f.get("consent_updates") !== "on") return { ok: false, error: "Tick the box to get emails about your invitation, so we can reach you." };
  return { ok: true, value: { role, tools, first_company: company || null, open_to_call: f.get("open_to_call") === "on", consent_updates: true } };
}

/** First name for greetings, from the Google profile name; falls back to the part of the email before the @. */
export const firstName = (name: string | null | undefined, email: string) => (name?.trim().split(/\s+/)[0] || email.split("@")[0]);

/** Where the visitor came from, read from the gb_src cookie the site sets on the first visit. Unknown keys are dropped. */
export function parseSource(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const j = JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
    const keep = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref", "path"];
    return Object.fromEntries(keep.filter((k) => typeof j[k] === "string" && j[k]).map((k) => [k, String(j[k]).slice(0, 200)]));
  } catch { return {}; }
}
