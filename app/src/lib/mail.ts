// Waitlist and invitation emails (ACC-6), sent from the Gmail account in GMAIL_USER with a Google app password
// (GMAIL_APP_PASSWORD, server env only; never logged). Gmail allows about 500 messages a day from one account.
// When either variable is missing the send is skipped and the caller records that nothing was sent.
import nodemailer from "nodemailer";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gaurberg.vercel.app";

function transport() {
  const user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return { from: `Gaurberg <${user}>`, t: nodemailer.createTransport({ service: "gmail", auth: { user, pass } }) };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// One simple layout for both emails: paper background, wordmark, short text, one button. Inline styles only (email clients).
function layout(body: string, button: { label: string; href: string }) {
  return `<!doctype html><html><body style="margin:0;background:#F4F1EC;font-family:Inter,Arial,sans-serif;color:#1C1916">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FBFAF7;border:1px solid #E4DED5;border-radius:12px">
<tr><td style="padding:32px 32px 8px;font:700 14px/20px Inter,Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase">Gaurberg</td></tr>
<tr><td style="padding:8px 32px 8px;font:16px/26px Inter,Arial,sans-serif">${body}</td></tr>
<tr><td style="padding:16px 32px 32px"><a href="${button.href}" style="display:inline-block;background:#2A211C;color:#FBFAF7;text-decoration:none;padding:12px 22px;border-radius:999px;font:600 15px Inter,Arial,sans-serif">${esc(button.label)}</a></td></tr>
</table>
<p style="font:12px/18px Inter,Arial,sans-serif;color:#6B645C;max-width:600px">Gaurberg provides research information only. It is not investment advice. You get this email because you asked for early access; reply "remove" and we delete your details.</p>
</td></tr></table></body></html>`;
}

export type Sent = { sent: boolean; reason?: string };

async function send(to: string, subject: string, html: string, text: string): Promise<Sent> {
  const m = transport();
  if (!m) return { sent: false, reason: "mail not configured (GMAIL_USER, GMAIL_APP_PASSWORD)" };
  try { await m.t.sendMail({ from: m.from, to, replyTo: m.from, subject, html, text }); return { sent: true }; }
  catch (e) { return { sent: false, reason: e instanceof Error ? e.message.slice(0, 120) : "send failed" }; }
}

export function sendWaitlistConfirmation(to: string, first: string): Promise<Sent> {
  const body = `<p>Hi ${esc(first)},</p>
<p>Thanks for asking for early access to Gaurberg. It maps the businesses around a stock (suppliers, customers, partners, rivals and investors) and shows the sentence from the filing behind every link.</p>
<p><b>Your place is saved.</b> Invitations go out in small batches.</p>
<p>Reply with the company you'd most like mapped; we read every reply.</p>
<p>Abhishek, Gaurberg</p>`;
  const text = `Hi ${first},\n\nThanks for asking for early access to Gaurberg. It maps the businesses around a stock and shows the filing sentence behind every link.\n\nYour place is saved. Invitations go out in small batches.\n\nReply with the company you'd most like mapped; we read every reply.\n\nAbhishek, Gaurberg\n${SITE}`;
  return send(to, "You're on the Gaurberg list", layout(body, { label: "Visit Gaurberg", href: SITE }), text);
}

export function sendInvite(to: string, first: string): Promise<Sent> {
  const body = `<p>Hi ${esc(first)},</p>
<p>Your Gaurberg invitation is ready. Sign in with this Google account (${esc(to)}) to open the maps, company pages and the Connection finder.</p>
<p>It is free during early access. Tell us what's missing; reply to this email.</p>
<p>Abhishek, Gaurberg</p>`;
  const text = `Hi ${first},\n\nYour Gaurberg invitation is ready. Sign in with this Google account (${to}) at ${SITE}\n\nIt is free during early access. Reply to tell us what's missing.\n\nAbhishek, Gaurberg`;
  return send(to, "Your Gaurberg invitation", layout(body, { label: "Open Gaurberg", href: SITE }), text);
}
