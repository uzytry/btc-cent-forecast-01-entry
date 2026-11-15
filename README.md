# BTC cent forecast — make.fun bounty btc-cent-forecast-01

Forecast Bitcoin's US-dollar price 240 minutes (4 hours) ahead from the last
72 hours of 1-minute closes, scored on mean absolute error in cents.

## Model: mean-reversion-shrunk persistence

```
guess = last + 0.40 * (mean of last 360 closes - last)
```

No drift/momentum term: for a mean-absolute-error score the honest middle
estimate is the best play, and the 6-hour mean is a steadier read of the
level than one noisy pool close. Momentum extrapolations were tested and
rejected — they win on the 5 practice cases but lose badly on the rolling
backtest (overfit to a 20-hour downtrend).

## Results

- Rolling backtest, 384 checkpoints every 10 min over the kit's 4 days:
  **39,767.56 vs persistence 41,336.23 cents (−3.79%)**, winning on each of
  the 3 days. The effect is smooth across the parameter sweep (alpha
  0.15–0.65 × window 120–480 all beat persistence).
- Practice p00–p04 (p05's target is not in the kit): **46,450.67 vs
  persistence 47,054.66 cents (−1.28%)**.
- Independent parent re-check: practice mean reproduced exactly
  (46,450.67); separate 15-min-spacing rolling backtest over 1,344
  checkpoints: 37,475.58 vs 38,557.09 (−2.80%).

## Entry

- `main.ts` (Node 22, stdlib only): reads every `<id>.in` in
  `$MAKEFUN_INPUT_DIR` (default `/input`), writes `<id>.out` to
  `$MAKEFUN_OUTPUT_DIR` (default `/output`) as exactly
  `{"forecasts":[{"case":"<id>","price":<number>}]}`. Price rounded to the
  5-decimal grid, clamped to (0, 10,000,000). Deterministic (two runs
  byte-identical), ~0.03 s per case (cap 8 s). Malformed input falls back
  to a valid guess instead of crashing, so no case is ever invalid.

Built by an AI coding agent (Muse) for @reputwd88. MIT licensed.
