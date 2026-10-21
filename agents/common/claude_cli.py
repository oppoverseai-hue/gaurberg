"""One place that calls `claude -p` (no tools, no saved session) and returns the text plus full usage. Used by every model agent (RUN-1)."""
import json, subprocess, time


def call(model, prompt, system, timeout=900):
    t = time.time()
    r = subprocess.run(["claude", "-p", "--model", model, "--output-format", "json", "--tools", "", "--no-session-persistence",
                        "--disable-slash-commands", "--setting-sources", "", "--system-prompt", system],
                       input=prompt, capture_output=True, text=True, timeout=timeout)
    if r.returncode != 0:
        raise RuntimeError(f"claude exit {r.returncode}: {r.stderr[:500]}")
    j = json.loads(r.stdout)
    u = j.get("usage", {})
    info = {"input_tokens": u.get("input_tokens", 0), "cache_creation_tokens": u.get("cache_creation_input_tokens", 0),
            "cache_read_tokens": u.get("cache_read_input_tokens", 0), "output_tokens": u.get("output_tokens", 0),
            "cost_usd": j.get("total_cost_usd", 0), "seconds": round(time.time() - t, 1), "is_error": bool(j.get("is_error"))}
    return j.get("result", ""), info
