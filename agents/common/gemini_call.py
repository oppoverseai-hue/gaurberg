"""Gemini backend for the verifier role, called through the project's Supabase edge function `gemini-proxy`
(the key lives only in Supabase secrets, never here). Same return shape as claude_cli.call: (text, info).
Env: SUPABASE_URL (default the Gaurberg project) and SUPABASE_ANON_KEY (public publishable key, required).
Cost uses the list price in PRICES (USD per million tokens, from Google's rate sheet via anotherwrapper.com, checked 2026-10-21)."""
import json, os, time, urllib.request

URL = os.environ.get("SUPABASE_URL", "https://zyxrptpbifafmstoporw.supabase.co") + "/functions/v1/gemini-proxy"
PRICES = {"gemini-3.1-flash-lite": (0.25, 1.50)}


def call(model, prompt, system=""):
    key = os.environ["SUPABASE_ANON_KEY"]
    req = urllib.request.Request(URL, data=json.dumps({"model": model, "system": system, "prompt": prompt}).encode(),
                                 headers={"Authorization": f"Bearer {key}", "apikey": key, "Content-Type": "application/json"})
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=120) as r:
        b = json.load(r)
    if b.get("error") or b.get("http") != 200:
        raise RuntimeError(f"gemini proxy error: {b.get('error')} (http {b.get('http')})")
    u = b.get("usage") or {}
    inp, out = u.get("promptTokenCount", 0), u.get("candidatesTokenCount", 0) + u.get("thoughtsTokenCount", 0)
    pi, po = PRICES[model]
    return b["text"], {"input_tokens": inp, "cache_creation_tokens": 0, "cache_read_tokens": 0, "output_tokens": out,
                       "cost_usd": inp * pi / 1e6 + out * po / 1e6, "seconds": round(time.time() - t0, 1), "is_error": False}
