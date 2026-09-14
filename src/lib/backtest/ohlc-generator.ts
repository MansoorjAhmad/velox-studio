/**
 * Velox Studio — Synthetic OHLC Generator for the Backtesting Replay Engine.
 *
 * Generates deterministic, reproducible candle data using a seeded PRNG so the
 * same symbol+seed always produces the same series. No external data feed
 * required — the replay engine works fully offline.
 *
 * The generator produces a random-walk with regime shifts (trending up/down,
 * ranging) and realistic volatility, so the replayed price action feels like
 * a real market.
 */

export interface Candle {
  time: number; // epoch ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface InstrumentSpec {
  symbol: string;
  basePrice: number;
  /** Per-candle volatility as a fraction of price (e.g. 0.002 = 0.2%). */
  volatility: number;
  /** Pip/point size for display. */
  pipSize: number;
  digits: number;
}

export const INSTRUMENTS: Record<string, InstrumentSpec> = {
  XAUUSD: { symbol: "XAUUSD", basePrice: 2350, volatility: 0.0015, pipSize: 0.1, digits: 2 },
  EURUSD: { symbol: "EURUSD", basePrice: 1.085, volatility: 0.0006, pipSize: 0.0001, digits: 5 },
  GBPUSD: { symbol: "GBPUSD", basePrice: 1.27, volatility: 0.0007, pipSize: 0.0001, digits: 5 },
  USDJPY: { symbol: "USDJPY", basePrice: 152.5, volatility: 0.0008, pipSize: 0.01, digits: 3 },
  NAS100: { symbol: "NAS100", basePrice: 18500, volatility: 0.002, pipSize: 1, digits: 1 },
  US30:   { symbol: "US30",   basePrice: 39000, volatility: 0.0018, pipSize: 1, digits: 1 },
  BTCUSD: { symbol: "BTCUSD", basePrice: 67000, volatility: 0.004, pipSize: 1, digits: 1 },
};

export type InstrumentKey = keyof typeof INSTRUMENTS;

// ────────────────────────────────────────────────────────────────
//  Seeded PRNG (mulberry32) — deterministic, fast, good enough distribution.
// ────────────────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string into a 32-bit seed. */
function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ────────────────────────────────────────────────────────────────
//  Regime model — the market cycles between trending & ranging states.
// ────────────────────────────────────────────────────────────────

type Regime = "trend-up" | "trend-down" | "range";

interface RegimeState {
  type: Regime;
  /** How many candles remain in this regime. */
  remaining: number;
  /** Drift applied per candle (trend strength). */
  drift: number;
}

function nextRegime(rng: () => number, prev: Regime): RegimeState {
  const r = rng();
  let type: Regime;
  // Avoid repeating the exact opposite trend immediately for realism.
  if (r < 0.35) type = "trend-up";
  else if (r < 0.7) type = "trend-down";
  else type = "range";

  // Don't instantly flip trend direction — favor ranging as a bridge.
  if (prev === "trend-up" && type === "trend-down") type = "range";
  if (prev === "trend-down" && type === "trend-up") type = "range";

  const length = 15 + Math.floor(rng() * 35); // 15–50 candles per regime
  const drift =
    type === "trend-up"
      ? 0.0004 + rng() * 0.0008
      : type === "trend-down"
      ? -(0.0004 + rng() * 0.0008)
      : 0;

  return { type, remaining: length, drift };
}

// ────────────────────────────────────────────────────────────────
//  Main generator
// ────────────────────────────────────────────────────────────────

export interface GenerateOptions {
  instrument: InstrumentKey;
  seed?: string;
  /** Number of candles to generate. */
  count?: number;
  /** Candle interval in minutes (default 60 = H1). */
  intervalMinutes?: number;
  /** Epoch ms for the first candle (default: now - count*interval). */
  startTime?: number;
}

export function generateCandles(opts: GenerateOptions): Candle[] {
  const spec = INSTRUMENTS[opts.instrument];
  const count = opts.count ?? 300;
  const interval = (opts.intervalMinutes ?? 60) * 60 * 1000;
  const seedStr = opts.seed ?? `${opts.instrument}-${count}-${interval}`;
  const rng = mulberry32(hashSeed(seedStr));

  const candles: Candle[] = [];
  let price = spec.basePrice;
  let regime = nextRegime(rng, "range");
  const startTime = opts.startTime ?? Date.now() - count * interval;

  for (let i = 0; i < count; i++) {
    // Cycle regimes.
    if (regime.remaining <= 0) {
      regime = nextRegime(rng, regime.type);
    }
    regime.remaining--;

    // Volatility scales slightly with regime (trends are smoother, ranges choppier).
    const volMult = regime.type === "range" ? 1.3 : regime.type === "trend-up" ? 0.9 : 0.9;
    const vol = spec.volatility * volMult;

    // Box-Muller transform for a normal-distributed step.
    const u1 = Math.max(rng(), 1e-9);
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

    const open = price;
    const step = (regime.drift + z * vol) * price;
    const close = open + step;

    // Wick generation — high/low extend beyond the body.
    const wickRange = Math.abs(step) + vol * price * (0.5 + rng());
    const high = Math.max(open, close) + rng() * wickRange;
    const low = Math.min(open, close) - rng() * wickRange;

    const volume = Math.floor(500 + rng() * 4500);

    candles.push({
      time: startTime + i * interval,
      open: round(open, spec.digits),
      high: round(high, spec.digits),
      low: round(low, spec.digits),
      close: round(close, spec.digits),
      volume,
    });

    price = close;
  }

  return candles;
}

function round(n: number, digits: number): number {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}
