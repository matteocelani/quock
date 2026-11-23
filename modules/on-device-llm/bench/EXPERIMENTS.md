# On-device engine experiments

Every optimization of the on-device engine is measured here before it ships, negative results included, so the
same idea is not tried twice. Host: Apple M4 Max (48 GB) running the engine's own sources (`quock-llm-bench`), unless
a row says iPhone. Quality is teacher-forced on 30 Italian/English prompts × 128 greedy tokens (3,840 positions),
compared at T = 0.7 against Ollama's full-precision build of the same model.

Acceptance bar (math council, 2026-11-23): mean KL ≤ 0.005 versus the build it replaces, top-1 agreement ≥ 98%,
p99 KL ≤ 0.1; speed is the median of repeated runs. `bench suite` re-checks shipped builds against
`baselines.json` on every run and appends to `results.jsonl`.

## Shipped

| Change | Model | tok/s | Peak MB | KL vs BF16 | Top-1 |
|---|---|---|---|---|---|
| Ollama mxfp8 build as downloaded | 0.8b | 297 | 1186 | — | — |
| + tied head → affine 8-bit g128 at install | 0.8b | 351 | 951 | 0.018 | 95.2% |
| Ollama mxfp8 build as downloaded | 2b | 157 | 2533 | — | — |
| + tied head → affine 8-bit g128 at install | 2b | 188 | 2063 | 0.011 | 96.1% |
| BF16 build → body affine 6-bit g64 + head 8-bit at install | 0.8b | 380 | 817 | 0.020 | 95.1% |
| BF16 build → body affine 6-bit g64 + head 8-bit at install | 2b | 221 | 1758 | 0.0088 | 96.6% |

The 6-bit-from-BF16 install is faster and smaller than the mxfp8 build on both sizes, and more accurate on 2b; it
costs a larger one-time download (0.8b 1.45 vs 0.98 GB, 2b 3.6 vs 2.3 GB).

## Head (tied embedding / LM head), 0.8b, vs the shipped mxfp8 build

| Head | tok/s | Peak MB | Mean KL | p99 | Top-1 | Verdict |
|---|---|---|---|---|---|---|
| affine 8-bit g128 | 351 | 951 | 0.0018 | 0.013 | 98.6% | shipped |
| affine 8-bit g64 | 348 | 959 | 0.0017 | 0.012 | 98.6% | pass |
| affine 6-bit g64 | 361 | 898 | 0.0031 | 0.024 | 97.6% | fail (top-1) |
| affine 6-bit g32 | 363 | 913 | 0.0033 | 0.018 | 97.7% | fail (top-1) |
| affine 5-bit g32 | 371 | 877 | 0.0075 | 0.051 | 96.8% | fail |
| affine 4-bit g64 | 356 | 837 | 0.032 | 0.236 | 93.0% | fail |

Head GEMV alone (248320 × 1024): BF16 1.198 ms, q8 0.718, q6 0.548, q4 0.430; it is ~36% of a 0.8b decode step.

## Body width, from the BF16 build (+ 8-bit head), vs BF16

| Body | 0.8b tok/s / KL / top-1 | 2b tok/s / KL / top-1 |
|---|---|---|
| 8-bit g64 | 330 / 0.0035 / 97.8% | 192 / 0.0019 / 98.2% |
| 6-bit g64 | 380 / 0.020 / 95.1% | 221 / 0.0088 / 96.6% |
| 5-bit g64 | 395 / 0.058 / 90.9% | 238 / 0.031 / 93.6% |
| 4-bit g64 | 414 / 0.227 / 83.7% | 269 / 0.140 / 88.0% |
| 4-bit g32 | 421 / 0.158 / 86.4% | — |

## Rejected

- **Ollama nvfp4 builds** (0.8b): 396 tok/s but KL 0.27, top-1 81%, factual errors in Italian.
- **6-bit from the mxfp8 build** instead of BF16 (0.8b): KL 0.030 / 93.5% vs 0.020 / 95.1% — re-quantizing a
  quantized body compounds the error.
- **4-bit with sensitive layers kept at 8-bit** (0.8b; first/last layers, attention, or down_proj): KL 0.10–0.19.
- **Signed block-Hadamard rotation before quantization** (`prism_hadamard_qwen35`, online input rotation):
  quality only 5–10% better (0.8b 4-bit 0.227 → 0.207; 2b 4-bit 0.140 → 0.125; 2b 5-bit 0.031 → 0.030) while decode
  fell 30–45% (0.8b 4-bit 414 → 226 tok/s; 2b 5-bit 238 → 162). These small models' low-bit error is not
  outlier-driven, and the per-layer float32 transform costs more than it saves.
