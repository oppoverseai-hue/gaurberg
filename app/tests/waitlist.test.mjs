// Waitlist form rules (ACC-5): only known answers are stored, consent is required, the source cookie is sanitised.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkForm, firstName, parseSource } from "../src/lib/waitlist-core.ts";

const fd = (pairs) => { const f = new FormData(); for (const [k, v] of pairs) f.append(k, v); return f; };

test("a complete answer is accepted and trimmed", () => {
  const c = checkForm(fd([["role", "fund"], ["tools", "terminal"], ["tools", "terminal"], ["tools", "made-up"], ["first_company", "  Rheinmetall   AG "], ["open_to_call", "on"], ["consent_updates", "on"]]));
  assert.equal(c.ok, true);
  assert.deepEqual(c.value, { role: "fund", tools: ["terminal"], first_company: "Rheinmetall AG", open_to_call: true, consent_updates: true });
});

test("an unknown role or missing consent is refused", () => {
  assert.equal(checkForm(fd([["role", "ceo"], ["consent_updates", "on"]])).ok, false);
  assert.equal(checkForm(fd([["role", "student"]])).ok, false);
});

test("optional answers can be left out", () => {
  const c = checkForm(fd([["role", "student"], ["consent_updates", "on"]]));
  assert.deepEqual(c.value, { role: "student", tools: [], first_company: null, open_to_call: false, consent_updates: true });
});

test("first name falls back to the email", () => {
  assert.equal(firstName("Abhishek Gupta", "a@b.com"), "Abhishek");
  assert.equal(firstName(null, "pat.lee@x.com"), "pat.lee");
});

test("source cookie keeps only known keys and survives bad input", () => {
  const raw = encodeURIComponent(JSON.stringify({ utm_source: "linkedin", ref: "t.co", evil: "<script>", path: "/" }));
  assert.deepEqual(parseSource(raw), { utm_source: "linkedin", ref: "t.co", path: "/" });
  assert.deepEqual(parseSource("%%%"), {});
  assert.deepEqual(parseSource(undefined), {});
});
