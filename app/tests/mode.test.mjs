// Local-only switches (item 25): every DEV_* fixture and screenshot switch is ignored in a production build and on Vercel, even
// when the variable is set, and works in local development. The offline demo keeps its own rule (refused on Vercel only).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { devSwitch, isLocalDev, isOffline, DEV_SWITCHES } from "../src/lib/mode.ts";

const KEYS = ["NODE_ENV", "VERCEL", "DEMO_OFFLINE", ...DEV_SWITCHES];
function withEnv(env, fn) {
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, env);
  try { return fn(); } finally { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } }
}
const allSet = Object.fromEntries(DEV_SWITCHES.map((k) => [k, k === "DEV_CALENDAR_ROLE" ? "reviewer" : `/tmp/${k}.json`]));

test("each DEV_* switch works in local development", () => {
  withEnv({ NODE_ENV: "development", ...allSet }, () => {
    assert.equal(isLocalDev(), true);
    for (const k of DEV_SWITCHES) assert.equal(devSwitch(k), allSet[k], k);
  });
  withEnv({ ...allSet }, () => { for (const k of DEV_SWITCHES) assert.equal(devSwitch(k), allSet[k], `${k} with NODE_ENV unset`); });
});

test("each DEV_* switch has no effect in a production build, even when set", () => {
  withEnv({ NODE_ENV: "production", ...allSet }, () => {
    assert.equal(isLocalDev(), false);
    for (const k of DEV_SWITCHES) assert.equal(devSwitch(k), undefined, k);
  });
});

test("each DEV_* switch has no effect on Vercel, even in development and when set", () => {
  withEnv({ NODE_ENV: "development", VERCEL: "1", ...allSet }, () => {
    assert.equal(isLocalDev(), false);
    for (const k of DEV_SWITCHES) assert.equal(devSwitch(k), undefined, k);
  });
});

test("the offline demo is refused on Vercel and still runs locally with npm start (docs/offline-demo.md)", () => {
  withEnv({ DEMO_OFFLINE: "1", VERCEL: "1", NODE_ENV: "production" }, () => assert.equal(isOffline(), false));
  withEnv({ DEMO_OFFLINE: "1", NODE_ENV: "production" }, () => assert.equal(isOffline(), true));
  withEnv({ DEMO_OFFLINE: "1", NODE_ENV: "production", ...allSet }, () => {
    // Offline under npm start, but the DEV_* fixtures stay off: they need a development run.
    for (const k of DEV_SWITCHES) assert.equal(devSwitch(k), undefined, k);
  });
});

test("no source file reads a DEV_* variable directly: every read goes through devSwitch", () => {
  const root = new URL("../src", import.meta.url).pathname;
  const files = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(e.name)) files.push(p); } };
  walk(root);
  const direct = files.filter((f) => /process\.env(\.DEV_|\[\s*["']DEV_)/.test(fs.readFileSync(f, "utf8")));
  assert.deepEqual(direct.map((f) => path.relative(root, f)), []);
  // And every switch the source uses is in the guarded list.
  const used = new Set(files.flatMap((f) => [...fs.readFileSync(f, "utf8").matchAll(/devSwitch\("(DEV_[A-Z_]+)"\)/g)].map((m) => m[1])));
  assert.deepEqual([...used].sort(), [...DEV_SWITCHES].sort());
});
