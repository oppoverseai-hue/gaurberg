"use client";
// The request-access form (ACC-5). Client side only for the pending state and inline errors; saving happens in actions.ts.
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { join, type JoinState } from "./actions";
import { ROLES, TOOLS } from "@/lib/waitlist-core";

function Submit() {
  const { pending } = useFormStatus();
  return <button className="rq-btn" disabled={pending} aria-busy={pending}>{pending ? "Saving your request…" : "Request my invitation"}</button>;
}

export default function RequestForm() {
  const [state, action] = useActionState<JoinState, FormData>(join, { error: null });
  return (
    <form action={action} className="rq-form">
      <fieldset>
        <legend>Which best describes you?</legend>
        <div className="rq-chips">
          {ROLES.map(([id, label]) => <label key={id} className="rq-chip"><input type="radio" name="role" value={id} required /><span>{label}</span></label>)}
        </div>
      </fieldset>
      <fieldset>
        <legend>What do you use today for company research? <span className="rq-hint">Pick any</span></legend>
        <div className="rq-chips">
          {TOOLS.map(([id, label]) => <label key={id} className="rq-chip"><input type="checkbox" name="tools" value={id} /><span>{label}</span></label>)}
        </div>
      </fieldset>
      <label className="rq-field">
        <span className="rq-q">Which company should we map for you first?</span>
        <input type="text" name="first_company" maxLength={120} placeholder="e.g. Apple or Rheinmetall" />
      </label>
      <div className="rq-checks">
        <label className="rq-check"><input type="checkbox" name="open_to_call" /><span>I&apos;m open to a 15-minute call about what I&apos;d use this for</span></label>
        <label className="rq-check"><input type="checkbox" name="consent_updates" required /><span>Email me about my invitation and product updates</span></label>
      </div>
      {state.error && <p className="rq-error" role="alert">{state.error}</p>}
      <Submit />
      <p className="rq-fine">We keep your name, email and answers to manage early access. Reply to any of our emails to be removed. <a href="/privacy">Privacy</a></p>
    </form>
  );
}
