// btc-cent-forecast-01: forecast BTC's US-dollar price 240 minutes ahead.
//
// Model: mean-reversion-shrunk persistence. Start from the last close and
// move 40% of the way toward the mean of the last 360 closes (6 hours):
//
//   guess = last + 0.40 * (mean360 - last)
//
// Why: on a 384-point rolling backtest over the kit's four days of
// 1-minute closes, this beats pure persistence by 3.8% in mean absolute
// error (39,767.56 vs 41,336.23 cents), winning on each of the three
// days (+1,946 / +1,427 / +1,415 cents), and it also beats persistence
// on the five officially scorable practice cases (46,450.67 vs
// 47,054.66 cents; p05's target is not in the kit). Momentum
// extrapolations lose badly in the same backtest, so the guess carries
// no drift term: for a mean-absolute-error score the honest middle
// estimate is the best play, and the 6-hour mean is a steadier read of
// the level than one noisy pool close. Verified end to end: this file's
// outputs reproduce the backtest guesses exactly, two runs are
// byte-identical, and a case runs in ~0.03 s (cap is 8 s). Full numbers:
// RESULTS.md in this directory.
//
// Contract: read every <id>.in in $MAKEFUN_INPUT_DIR (default /input) and
// write <id>.out to $MAKEFUN_OUTPUT_DIR (default /output) as exactly
// {"forecasts":[{"case":"<id>","price":<number>}]}, the price rounded to
// the 5-decimal grid and kept inside (0, 10,000,000). Deterministic: the
// same input always yields the same bytes. A case that cannot be parsed
// still gets a valid output file with a fallback guess, because a single
// invalid case would take the whole entry out of the prizes.

import * as fs from "node:fs";
import * as path from "node:path";

const INPUT_FOLDER = process.env.MAKEFUN_INPUT_DIR ?? "/input";
const OUTPUT_FOLDER = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

// Model parameters, chosen on the rolling backtest (see RESULTS.md).
const MEAN_WINDOW = 360; // trailing closes averaged for the level
const SHRINK = 0.4; // weight pulled from the last close toward that mean

// Price grid and scorer bounds.
const GRID = 100000; // 5 decimals of a dollar
const MIN_PRICE = 0.00001;
const MAX_PRICE = 9999999.99999;
// Fallback guess if a case carries no usable price at all; only used to
// keep the output valid, never expected on real cases.
const FALLBACK_PRICE = 100000;

interface MarketSeries {
  id: string;
  prices: number[];
}

interface CasePayload {
  markets: MarketSeries[];
}

// Mean of the last `count` values (or all of them if fewer).
function tailMean(values: number[], count: number): number {
  const n = Math.min(count, values.length);
  let sum = 0;
  for (let k = values.length - n; k < values.length; k++) sum += values[k];
  return sum / n;
}

// Newest finite close, scanning back past any bad entries.
function newestClose(values: number[]): number | undefined {
  for (let k = values.length - 1; k >= 0; k--) {
    const v = values[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return undefined;
}

// The forecast for one series of 1-minute closes.
function forecastPrice(prices: number[]): number {
  const last = newestClose(prices);
  if (last === undefined) return FALLBACK_PRICE;
  const clean = prices.filter(
    (v) => typeof v === "number" && Number.isFinite(v),
  );
  const level = tailMean(clean, MEAN_WINDOW);
  const raw = last + SHRINK * (level - last);
  const clamped = Math.min(MAX_PRICE, Math.max(MIN_PRICE, raw));
  return Math.round(clamped * GRID) / GRID;
}

// One case's guess, defensive: any malformed input yields the fallback
// instead of crashing, so the output file is always valid.
function guessForCase(payload: unknown): number {
  try {
    const data = payload as CasePayload;
    const markets = data?.markets;
    if (!Array.isArray(markets) || markets.length === 0) return FALLBACK_PRICE;
    const first = markets[0];
    if (!first || !Array.isArray(first.prices) || first.prices.length === 0) {
      return FALLBACK_PRICE;
    }
    return forecastPrice(first.prices);
  } catch {
    return FALLBACK_PRICE;
  }
}

// Determinism: input files are processed in sorted name order, the
// forecast is pure arithmetic over the case's closes (no clock, no
// randomness, no network), and the output is one fixed-shape JSON line,
// so two runs on the same input write byte-identical files. Cost is one
// linear pass over at most 4,320 closes per case, ~0.03 s measured.
function main(): void {
  fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });
  const files = fs
    .readdirSync(INPUT_FOLDER)
    .filter((f) => f.endsWith(".in"))
    .sort();
  for (const file of files) {
    const id = file.slice(0, -".in".length);
    let price = FALLBACK_PRICE;
    try {
      const text = fs.readFileSync(path.join(INPUT_FOLDER, file), "utf8");
      price = guessForCase(JSON.parse(text));
    } catch {
      price = FALLBACK_PRICE;
    }
    const body = { forecasts: [{ case: id, price }] };
    fs.writeFileSync(
      path.join(OUTPUT_FOLDER, `${id}.out`),
      `${JSON.stringify(body)}\n`,
    );
  }
}

main();
