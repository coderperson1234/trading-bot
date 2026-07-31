const express = require('express');
const bcrypt = require('bcryptjs');
const { load, persist, nextId } = require('../store');
const { sign, requireAuth } = require('../auth');
const { stocks } = require('../market');
const insights = require('../insights');
const alpaca = require('../alpaca');
const quant = require('../quant/engine');

const router = express.Router();

// Resolve real market prices. Returns { SYM: price } containing ONLY symbols
// the data provider actually covers. Never invents a price.
async function livePrices(uid, tickers) {
  if (!alpaca.configured(uid)) return {};
  try {
    return await alpaca.latestPrices(uid, tickers);
  } catch {
    return {};
  }
}

// ---------- auth ----------
router.post('/auth/login', (req, res) => {
  const { emailOrUsername, password } = req.body || {};
  if (!emailOrUsername || !password) {
    return res.status(400).json({ error: 'emailOrUsername and password are required' });
  }
  const db = load();
  const m = db.managers.find(
    (u) => u.username === emailOrUsername || u.email === emailOrUsername,
  );
  if (!m || !bcrypt.compareSync(password, m.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  res.json({ token: sign(m.uid), uid: m.uid, email: m.email, fullName: m.fullName, username: m.username });
});

router.post('/auth/signup', (req, res) => {
  const { email, password, fullName, username } = req.body || {};
  if (!email || !password || !fullName || !username) {
    return res.status(400).json({ error: 'email, password, fullName and username are required' });
  }
  const db = load();
  if (db.managers.some((u) => u.email === email || u.username === username)) {
    return res.status(409).json({ error: 'An account with that email or username already exists' });
  }
  const uid = String(Date.now());
  db.managers.push({ uid, email, username, fullName, passwordHash: bcrypt.hashSync(password, 10) });
  db.clients[uid] = [];
  db.privateInvestments[uid] = [];
  persist();
  res.json({ token: sign(uid), uid, email, fullName, username });
});

router.get('/managers/me', requireAuth, (req, res) => {
  const m = load().managers.find((u) => u.uid === req.uid);
  if (!m) return res.status(404).json({ error: 'Not found' });
  res.json({ fullName: m.fullName, username: m.username, email: m.email });
});

router.patch('/managers/me', requireAuth, (req, res) => {
  const db = load();
  const m = db.managers.find((u) => u.uid === req.uid);
  if (!m) return res.status(404).json({ error: 'Not found' });
  const { fullName, username } = req.body || {};
  if (fullName) m.fullName = fullName;
  if (username) m.username = username;
  persist();
  res.json({ fullName: m.fullName, username: m.username, email: m.email });
});

// ---------- clients & portfolios ----------
function myClients(uid) {
  const db = load();
  if (!db.clients[uid]) db.clients[uid] = [];
  return db.clients[uid];
}

router.get('/clients', requireAuth, async (req, res) => {
  const clients = myClients(req.uid);

  // When Alpaca is connected, refresh every holding's price with the live
  // market price so AUM and total return are accurate (not a stale snapshot).
  let live = {};
  if (alpaca.configured(req.uid)) {
    const tickers = clients.flatMap((c) => c.portfolio.holdings.map((h) => h.ticker));
    try {
      live = await alpaca.latestPrices(req.uid, tickers);
    } catch {
      live = {}; // best-effort — fall back to stored / local prices
    }
  }

  const priceFor = (h) => live[h.ticker] ?? h.currentPrice ?? null;
  const rows = clients.map((c) => ({
    ...c,
    portfolio: {
      ...c.portfolio,
      holdings: c.portfolio.holdings.map((h) => {
        const price = priceFor(h);
        return {
          ...h,
          currentPrice: price,
          returnPct: h.avgCost > 0 ? ((price - h.avgCost) / h.avgCost) * 100 : 0,
        };
      }),
    },
  }));
  res.json(rows);
});

router.post('/clients', requireAuth, (req, res) => {
  const c = req.body || {};
  const id = nextId('client');
  const client = {
    id,
    name: c.name || 'Unnamed client',
    email: c.email || '',
    risk: c.risk || 'Moderate',
    horizon: c.horizon || 'Long-term',
    since: c.since || String(new Date().getFullYear()),
    portfolio: {
      name: (c.portfolio && c.portfolio.name) || `${c.strategy || 'Growth'} Portfolio`,
      strategy: (c.portfolio && c.portfolio.strategy) || c.strategy || 'Growth',
      holdings: ((c.portfolio && c.portfolio.holdings) || c.holdings || []).map((h) => ({
        id: nextId('holding'),
        ticker: h.ticker,
        qty: Number(h.qty) || 0,
        avgCost: Number(h.avgCost) || 0,
        assetType: h.assetType,
        orgName: h.orgName,
        currentPrice: h.currentPrice ?? null,
      })),
      watchlist: ((c.portfolio && c.portfolio.watchlist) || c.watchlist || []).map((w) => ({
        id: nextId('watch'),
        ticker: typeof w === 'string' ? w : w.ticker,
        source: (typeof w === 'object' && w.source) || 'manual',
        orgName: typeof w === 'object' ? w.orgName : undefined,
      })),
    },
  };
  myClients(req.uid).push(client);
  persist();
  res.json(client);
});

router.patch('/clients/:id', requireAuth, (req, res) => {
  const clients = myClients(req.uid);
  const client = clients.find((c) => c.id === req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  const { portfolio, name, email, risk, horizon } = req.body || {};
  if (name) client.name = name;
  if (email) client.email = email;
  if (risk) client.risk = risk;
  if (horizon) client.horizon = horizon;
  if (portfolio) {
    client.portfolio = {
      ...client.portfolio,
      ...portfolio,
      holdings: (portfolio.holdings || client.portfolio.holdings).map((h) => ({
        ...h,
        id: h.id || nextId('holding'),
      })),
      watchlist: (portfolio.watchlist || client.portfolio.watchlist).map((w) => ({
        ...w,
        id: w.id || nextId('watch'),
      })),
    };
  }
  persist();
  res.json(client);
});

router.delete('/clients/:id', requireAuth, (req, res) => {
  const db = load();
  db.clients[req.uid] = myClients(req.uid).filter((c) => c.id !== req.params.id);
  persist();
  res.json({ ok: true });
});

// ---------- private investments ----------
function myPis(uid) {
  const db = load();
  if (!db.privateInvestments[uid]) db.privateInvestments[uid] = [];
  return db.privateInvestments[uid];
}

router.get('/private-investments', requireAuth, (req, res) => {
  const { clientId } = req.query;
  res.json(myPis(req.uid).filter((p) => p.clientId === clientId).map(({ clientId: _c, ...rest }) => rest));
});

router.post('/private-investments', requireAuth, (req, res) => {
  const { clientId, investments } = req.body || {};
  if (!clientId || !Array.isArray(investments)) return res.status(400).json({ error: 'clientId and investments are required' });
  const list = myPis(req.uid);
  const created = investments.map((inv) => {
    const row = {
      id: `pi_${nextId('pi')}`,
      clientId,
      assetCategory: inv.assetCategory || 'Instruments',
      assetType: inv.assetType || '',
      avgPrice: Number(inv.avgPrice) || 0,
      currentPrice: Number(inv.currentPrice) || 0,
    };
    list.push(row);
    return row;
  });
  persist();
  res.json(created);
});

router.patch('/private-investments/:id', requireAuth, (req, res) => {
  const row = myPis(req.uid).find((p) => p.id === req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const { assetCategory, assetType, avgPrice, currentPrice } = req.body || {};
  if (assetCategory != null) row.assetCategory = assetCategory;
  if (assetType != null) row.assetType = assetType;
  if (avgPrice != null) row.avgPrice = Number(avgPrice);
  if (currentPrice != null) row.currentPrice = Number(currentPrice);
  persist();
  res.json(row);
});

router.delete('/private-investments/:id', requireAuth, (req, res) => {
  const db = load();
  db.privateInvestments[req.uid] = myPis(req.uid).filter((p) => p.id !== req.params.id);
  persist();
  res.json({ ok: true });
});

// ---------- market data ----------
router.get('/stocks', requireAuth, (_req, res) => res.json(stocks));

router.get('/prices/:ticker', requireAuth, async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  if (alpaca.configured(req.uid)) {
    try {
      const price = await alpaca.latestPrice(req.uid, ticker);
      if (price) return res.json({ ticker, price, source: 'alpaca' });
    } catch { /* fall through to local price */ }
  }
  res.json({ ticker, price: null, source: 'unavailable' });
});

router.get('/news', requireAuth, async (req, res) => {
  const tickers = String(req.query.tickers || '').split(',').map((t) => t.trim().toUpperCase()).filter(Boolean);
  if (!tickers.length) return res.json([]);
  if (alpaca.configured(req.uid)) {
    try {
      return res.json(await alpaca.news(req.uid, tickers));
    } catch { /* fall through to generated headlines */ }
  }
  res.json(insights.newsFallback(tickers));
});

// ---------- AI endpoints ----------
router.get('/rebalance/:clientId', requireAuth, async (req, res) => {
  const client = myClients(req.uid).find((c) => c.id === req.params.clientId);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  const local = insights.rebalanceSummary(client);
  const upgraded = await insights.generateWithClaude(
    `You are a portfolio strategist. Write a rebalancing commentary for this portfolio in exactly five paragraphs, each starting with one of these labels followed by a colon: "Latest News Impact", "Bullish AI", "Bearish AI", "Balanced AI", "Moderator AI". Use **bold** for emphasis. Client: ${client.name}, risk ${client.risk}, horizon ${client.horizon}, strategy ${client.portfolio.strategy}. Holdings: ${client.portfolio.holdings.map((h) => `${h.ticker} x${h.qty} @ $${h.avgCost}`).join('; ')}.`,
  );
  res.json({ summary: upgraded || local });
});

router.get('/stock-summary', requireAuth, async (req, res) => {
  const tckr = String(req.query.tckr || '').toUpperCase();
  if (!tckr) return res.status(400).json({ error: 'tckr is required' });
  const prices = await livePrices(req.uid, [tckr]);
  const price = prices[tckr] ?? null;
  if (price == null) {
    return res.status(422).json({
      error: alpaca.configured(req.uid)
        ? `No market price available for ${tckr} from your data provider (Alpaca's feed does not cover this symbol, e.g. OTC ADRs). Analysis needs a real price.`
        : 'Connect Alpaca on the Trading tab to load real market prices for analysis.',
    });
  }
  const result = insights.stockSummary(tckr, price);
  const upgraded = await insights.generateWithClaude(
    `Write a three-paragraph investment read on ${tckr}, whose current market price is $${price}. Paragraphs must start with "Bullish AI:", "Bearish AI:", "Balanced AI:" respectively. Use **bold** sparingly. Keep it under 250 words total.`,
  );
  if (upgraded) result.summary = upgraded;
  res.json(result);
});

router.get('/predictions', requireAuth, async (req, res) => {
  const tckr = String(req.query.tckr || '').toUpperCase();
  if (!tckr) return res.status(400).json({ error: 'tckr is required' });
  const prices = await livePrices(req.uid, [tckr]);
  const price = prices[tckr] ?? null;
  if (price == null) {
    return res.status(422).json({
      error: alpaca.configured(req.uid)
        ? `No market price available for ${tckr} from your data provider (Alpaca's feed does not cover this symbol, e.g. OTC ADRs).`
        : 'Connect Alpaca on the Trading tab to load real market prices.',
    });
  }
  res.json(insights.predictions(tckr, price));
});

router.get('/valuation', requireAuth, async (req, res) => {
  const tickers = String(req.query.tickers || '').split(',').map((t) => t.trim().toUpperCase()).filter(Boolean);
  if (!tickers.length) return res.status(400).json({ error: 'tickers is required' });
  const prices = await livePrices(req.uid, tickers);
  if (!Object.keys(prices).length) {
    return res.status(422).json({
      error: alpaca.configured(req.uid)
        ? 'No market prices available for these symbols from your data provider.'
        : 'Connect Alpaca on the Trading tab to load real market prices.',
    });
  }
  res.json(insights.valuation(tickers, prices));
});

router.get('/screener', requireAuth, async (req, res) => {
  const query = String(req.query.query || '').trim();
  if (!query) return res.status(400).json({ error: 'query is required' });
  const shortlist = insights.screenerShortlist(query);
  const prices = await livePrices(req.uid, shortlist);
  res.json(insights.screener(query, prices));
});

router.get('/ai-watchlist', requireAuth, (req, res) => {
  const clientId = String(req.query.client_id || req.query.clientId || '');
  const client = myClients(req.uid).find((c) => c.id === clientId);
  if (!client) return res.json([]);
  res.json(insights.aiWatchlist(client));
});

router.post('/ocr', requireAuth, async (req, res) => {
  const { imageBase64, mimeType } = req.body || {};
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(501).json({ error: 'OCR import requires ANTHROPIC_API_KEY to be set on the server' });
  }
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
        max_tokens: 1500,
        messages: [{
          role: 'user',
          content: [
            (mimeType || '').includes('pdf')
              ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: imageBase64 } }
              : { type: 'image', source: { type: 'base64', media_type: mimeType || 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: 'Extract stock holdings from this portfolio statement. Reply ONLY with JSON: {"holdings":[{"ticker":"AAPL","name":"Apple Inc.","qty":10,"avgCost":150.5,"assetType":"equity"}]}. Use 0 for unknown qty/avgCost.' },
          ],
        }],
      }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ? body.error.message : 'OCR failed');
    const text = body.content[0].text;
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : { holdings: [] };
    res.json({ holdings: parsed.holdings || [] });
  } catch (e) {
    res.status(500).json({ error: e.message || 'OCR failed' });
  }
});

// ---------- Alpaca ----------
router.get('/alpaca/status', requireAuth, async (req, res) => {
  const { paper } = alpaca.credsFor(req.uid);
  if (!alpaca.configured(req.uid)) return res.json({ configured: false, paper });
  try {
    const account = await alpaca.trading(req.uid, '/v2/account');
    res.json({ configured: true, paper, account });
  } catch (e) {
    res.json({ configured: true, paper, error: e.message });
  }
});

router.post('/alpaca/credentials', requireAuth, (req, res) => {
  const { keyId, secret, paper } = req.body || {};
  const db = load();
  if (!keyId && !secret) {
    delete db.alpacaCreds[req.uid];
  } else {
    db.alpacaCreds[req.uid] = { keyId, secret, paper: paper !== false };
  }
  persist();
  res.json({ ok: true });
});

router.get('/alpaca/account', requireAuth, async (req, res, next) => {
  try { res.json(await alpaca.trading(req.uid, '/v2/account')); } catch (e) { next(e); }
});

router.get('/alpaca/positions', requireAuth, async (req, res, next) => {
  try { res.json(await alpaca.trading(req.uid, '/v2/positions')); } catch (e) { next(e); }
});

router.get('/alpaca/orders', requireAuth, async (req, res, next) => {
  try {
    const status = req.query.status || 'all';
    res.json(await alpaca.trading(req.uid, `/v2/orders?status=${status}&limit=50&direction=desc`));
  } catch (e) { next(e); }
});

router.post('/alpaca/orders', requireAuth, async (req, res, next) => {
  try {
    const { symbol, qty, notional, side, type, limit_price, time_in_force } = req.body || {};
    if (!symbol || !side) return res.status(400).json({ error: 'symbol and side are required' });
    const payload = {
      symbol: String(symbol).toUpperCase(),
      side,
      type: type || 'market',
      time_in_force: time_in_force || 'day',
    };
    if (qty) payload.qty = String(qty);
    else if (notional) payload.notional = String(notional);
    else return res.status(400).json({ error: 'qty or notional is required' });
    if (payload.type === 'limit') payload.limit_price = String(limit_price);
    res.json(await alpaca.trading(req.uid, '/v2/orders', { method: 'POST', body: JSON.stringify(payload) }));
  } catch (e) { next(e); }
});

router.delete('/alpaca/orders/:id', requireAuth, async (req, res, next) => {
  try {
    await alpaca.trading(req.uid, `/v2/orders/${req.params.id}`, { method: 'DELETE' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/alpaca/bars/:symbol', requireAuth, async (req, res, next) => {
  try {
    res.json(await alpaca.bars(req.uid, req.params.symbol.toUpperCase(), req.query.timeframe || '1Day', Number(req.query.limit) || 200));
  } catch (e) { next(e); }
});

// ---------- quant bots ----------
router.get('/quant/strategies', requireAuth, (_req, res) => res.json(quant.listStrategies()));

router.get('/quant/bots', requireAuth, (req, res) => res.json(quant.botsFor(req.uid)));

router.post('/quant/bots', requireAuth, (req, res) => {
  try { res.json(quant.createBot(req.uid, req.body || {})); } catch (e) { res.status(400).json({ error: e.message }); }
});

router.patch('/quant/bots/:id', requireAuth, (req, res) => {
  try { res.json(quant.updateBot(req.uid, req.params.id, req.body || {})); } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/quant/bots/:id', requireAuth, (req, res) => {
  quant.deleteBot(req.uid, req.params.id);
  res.json({ ok: true });
});

router.post('/quant/bots/:id/start', requireAuth, (req, res) => {
  try { res.json(quant.startBot(req.uid, req.params.id)); } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/quant/bots/:id/stop', requireAuth, (req, res) => {
  quant.stopBot(req.uid, req.params.id);
  res.json({ ok: true });
});

router.get('/quant/bots/:id/logs', requireAuth, (req, res) => res.json(quant.botLogs(req.uid, req.params.id)));

router.get('/quant/bots/:id/insights', requireAuth, async (req, res) => {
  try { res.json(await quant.botInsights(req.uid, req.params.id)); }
  catch (e) { res.status(404).json({ error: e.message }); }
});

module.exports = router;
