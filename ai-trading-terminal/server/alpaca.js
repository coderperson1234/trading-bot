// Thin Alpaca REST client. Uses env vars by default, with optional
// per-manager credential overrides stored via /api/alpaca/credentials.
const { load } = require('./store');

function credsFor(uid) {
  const db = load();
  const override = db.alpacaCreds[uid];
  const keyId = (override && override.keyId) || process.env.ALPACA_API_KEY_ID || process.env.APCA_API_KEY_ID || '';
  const secret = (override && override.secret) || process.env.ALPACA_API_SECRET_KEY || process.env.APCA_API_SECRET_KEY || '';
  const paper = override ? override.paper !== false : (process.env.ALPACA_PAPER || 'true') !== 'false';
  return { keyId, secret, paper };
}

function configured(uid) {
  const { keyId, secret } = credsFor(uid);
  return Boolean(keyId && secret);
}

function tradingBase(uid) {
  const { paper } = credsFor(uid);
  return paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
}

const DATA_BASE = 'https://data.alpaca.markets';

async function alpacaFetch(uid, base, pathName, options = {}) {
  const { keyId, secret } = credsFor(uid);
  if (!keyId || !secret) {
    const err = new Error('Alpaca is not configured. Set ALPACA_API_KEY_ID / ALPACA_API_SECRET_KEY or save keys in Settings.');
    err.status = 428;
    throw err;
  }
  const res = await fetch(base + pathName, {
    ...options,
    headers: {
      'APCA-API-KEY-ID': keyId,
      'APCA-API-SECRET-KEY': secret,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.message || `Alpaca error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return body;
}

const trading = (uid, p, o) => alpacaFetch(uid, tradingBase(uid), p, o);
const data = (uid, p, o) => alpacaFetch(uid, DATA_BASE, p, o);

async function latestPrice(uid, symbol) {
  const body = await data(uid, `/v2/stocks/${encodeURIComponent(symbol)}/trades/latest`);
  return body && body.trade ? body.trade.p : null;
}

// Bulk latest prices for many symbols in one request. Returns { SYM: price }.
// Symbols Alpaca doesn't cover (e.g. OTC ADRs) are simply omitted.
async function latestPrices(uid, symbols) {
  const uniq = [...new Set(symbols.filter(Boolean))];
  if (!uniq.length) return {};
  const out = {};
  // Alpaca caps symbols per request; chunk to be safe.
  for (let i = 0; i < uniq.length; i += 100) {
    const chunk = uniq.slice(i, i + 100);
    const q = new URLSearchParams({ symbols: chunk.join(','), feed: 'iex' });
    const body = await data(uid, `/v2/stocks/trades/latest?${q}`);
    for (const [sym, trade] of Object.entries((body && body.trades) || {})) {
      if (trade && Number.isFinite(trade.p)) out[sym] = trade.p;
    }
  }
  return out;
}

async function news(uid, symbols, limit = 30) {
  const q = new URLSearchParams({ symbols: symbols.join(','), limit: String(limit), sort: 'desc' });
  const body = await data(uid, `/v1beta1/news?${q}`);
  return (body.news || []).map((n) => ({
    tckr: (n.symbols && n.symbols[0]) || symbols[0],
    date: n.created_at,
    title: n.headline,
    publisher: n.source,
    link: n.url,
  }));
}

// Rough calendar-day span needed to collect `limit` bars of a given timeframe,
// so we always send an explicit `start` (Alpaca returns nothing without one).
function lookbackDays(timeframe, limit) {
  const unit = /min/i.test(timeframe) ? 'min' : /hour/i.test(timeframe) ? 'hour' : 'day';
  if (unit === 'day') return Math.ceil(limit * 1.5) + 5; // ~5 trading days per 7 calendar days
  if (unit === 'hour') return Math.ceil(limit / 6) + 3; // ~6.5 trading hours per day
  const perDay = Math.max(1, 390 / (parseInt(timeframe, 10) || 1)); // minutes in a session
  return Math.ceil(limit / perDay) + 3;
}

async function bars(uid, symbol, timeframe = '1Day', limit = 200) {
  const startMs = Date.now() - lookbackDays(timeframe, limit) * 86400000;
  const start = new Date(startMs).toISOString().slice(0, 10);
  const q = new URLSearchParams({ timeframe, limit: String(limit), adjustment: 'split', feed: 'iex', start });
  const body = await data(uid, `/v2/stocks/${encodeURIComponent(symbol)}/bars?${q}`);
  return (body.bars || []).map((b) => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v }));
}

module.exports = { credsFor, configured, trading, data, latestPrice, latestPrices, news, bars };
