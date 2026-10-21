# Agent: verification (M3)
`verify.py` checks each edge against its own quote: quote_present (free, exact), then supports_claim, direction and type in one model call per batch. Model by role in `config/models.yaml`.
Test with `evals/seeded_errors/build_seeded.py` (156 items: each Keep edge once correct, once with a planted error) and `evals/harness/score_verification.py` (VER-1 to VER-4).
Status: baseline only. The Haiku baseline is the same vendor as the extractor, so VER-3 (different vendor) is NOT met. A Gemini or other non-Anthropic key is needed for the real verifier; set it as `verifier_cheap` in the config and rerun.
