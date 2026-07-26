// Quant bot framework.
//
// A strategy is a module exporting:
//   id, name, description,
//   params: [{ key, label, type: 'number'|'string'|'select', default, min?, max?, options? }]
//   evaluate({ bars, position, params }) -> { signal: 'buy'|'sell'|'hold', reason, metrics? }
//
// Bots run on an interval, pull bars from Alpaca, ask the strategy for a
// signal, and (when live=false this is signal-only; when live=true it
// submits paper orders through Alpaca). Logs, signal history and trade history
// are PERSISTED so they survive a server restart.
const { load, persist, nextId } = require('../store');
const alpaca = require('../alpaca');

const strategies = [
  require('./strategies/sma-cross'),
  require('./strategies/rsi-reversion'),
  require('./strategies/momentum'),
];
const strategyById = new Map(strategies.map((s) => [s.id, s]));

const timers = new Map(); // botId -> interval handle

function botsFor(uid) {
  const db = load();
  return db.quantBots[uid] || [];
}

function findBot(uid, botId) {
  return botsFor(uid).find((b) => b.id === botId);
}

// ---- persisted logging -------------------------------------------------
function log(uid, botId, level, msg) {
  const bot = findBot(uid, botId);
  if (!bot) return;
  if (!Array.isArray(bot.logs)) bot.logs = [];
  bot.logs.unshift({ ts: new Date().toISOString(), level, msg });
  if (bot.logs.length > 300) bot.logs.length = 300;
  persist();
}

function listStrategies() {
  return strategies.map(({ id, name, description, params }) => ({ id, name, description, params }));
}

function createBot(uid, { strategyId, symbol, params, intervalSec, live }) {
  if (!strategyById.has(strategyId)) throw new Error('Unknown strategy');
  const db = load();
  const bot = {
    id: nextId('bot'),
    strategyId,
    symbol: String(symbol || 'SPY').toUpperCase(),
    params: params || {},
    intervalSec: Math.max(30, Number(intervalSec) || 300),
    live: Boolean(live),
    status: 'stopped',
    lastSignal: null,
    lastReason: null,
    lastMetrics: null,
    lastRun: null,
    evaluations: 0,
    signalCounts: { buy: 0, sell: 0, hold: 0 },
    trades: [], // { ts, side, qty, price, orderId, status }
    logs: [],
    createdAt: new Date().toISOString(),
  };
  db.quantBots[uid] = [...botsFor(uid), bot];
  persist();
  log(uid, bot.id, 'info', `Bot created — ${strategyId} on ${bot.symbol}, evaluating every ${bot.intervalSec}s, ${bot.live ? 'AUTO-TRADE' : 'signal-only'}`);
  return bot;
}

function updateBot(uid, botId, patch) {
  const db = load();
  const bots = botsFor(uid);
  const bot = bots.find((b) => b.id === botId);
  if (!bot) throw new Error('Bot not found');
  Object.assign(bot, patch);
  db.quantBots[uid] = bots;
  persist();
  return bot;
}

function deleteBot(uid, botId) {
  stopBot(uid, botId);
  const db = load();
  db.quantBots[uid] = botsFor(uid).filter((b) => b.id !== botId);
  persist();
}

async function tick(uid, botId) {
  const bot = findBot(uid, botId);
  if (!bot) return;
  try {
    if (!alpaca.configured(uid)) {
      log(uid, botId, 'error', 'Alpaca is not connected — cannot fetch market data. Add your keys on the Trading tab.');
      return;
    }
    const bars = await alpaca.bars(uid, bot.symbol, '1Day', 250);
    if (!bars.length) {
      log(uid, botId, 'warn', `No bars returned for ${bot.symbol} — the data feed may not cover this symbol (e.g. OTC ADRs).`);
      return;
    }

    let position = null;
    try {
      position = await alpaca.trading(uid, `/v2/positions/${encodeURIComponent(bot.symbol)}`);
    } catch (e) {
      if (e.status !== 404) throw e; // 404 simply means "no position"
    }

    const strategy = strategyById.get(bot.strategyId);
    const { signal, reason, metrics } = strategy.evaluate({ bars, position, params: bot.params });
    const lastClose = bars[bars.length - 1].c;

    const counts = { ...(bot.signalCounts || { buy: 0, sell: 0, hold: 0 }) };
    counts[signal] = (counts[signal] || 0) + 1;
    updateBot(uid, botId, {
      lastSignal: signal,
      lastReason: reason,
      lastMetrics: { ...(metrics || {}), lastClose, barsUsed: bars.length },
      lastRun: new Date().toISOString(),
      evaluations: (bot.evaluations || 0) + 1,
      signalCounts: counts,
    });
    log(uid, botId, 'info', `${signal.toUpperCase()} — ${reason} (last close $${lastClose.toFixed(2)})`);

    if (!bot.live) {
      if (signal !== 'hold') {
        log(uid, botId, 'info', `Signal-only mode: no order placed. Switch the bot to auto-trade to execute.`);
      }
      return;
    }

    const qty = Number(bot.params.qty) || 1;
    if (signal === 'buy' && !position) {
      const order = await alpaca.trading(uid, '/v2/orders', {
        method: 'POST',
        body: JSON.stringify({ symbol: bot.symbol, qty: String(qty), side: 'buy', type: 'market', time_in_force: 'day' }),
      });
      recordTrade(uid, botId, { side: 'buy', qty, price: lastClose, orderId: order.id, status: order.status });
      log(uid, botId, 'trade', `Submitted BUY ${qty} ${bot.symbol} (order ${order.id}, ${order.status})`);
    } else if (signal === 'sell' && position) {
      const sellQty = Math.abs(Number(position.qty));
      const order = await alpaca.trading(uid, '/v2/orders', {
        method: 'POST',
        body: JSON.stringify({ symbol: bot.symbol, qty: String(sellQty), side: 'sell', type: 'market', time_in_force: 'day' }),
      });
      recordTrade(uid, botId, { side: 'sell', qty: sellQty, price: lastClose, orderId: order.id, status: order.status });
      log(uid, botId, 'trade', `Submitted SELL ${sellQty} ${bot.symbol} (order ${order.id}, ${order.status})`);
    } else if (signal === 'buy' && position) {
      log(uid, botId, 'info', 'BUY signal ignored — already holding a position in this symbol.');
    } else if (signal === 'sell' && !position) {
      log(uid, botId, 'info', 'SELL signal ignored — no open position to sell.');
    }
  } catch (e) {
    log(uid, botId, 'error', e.message);
  }
}

function recordTrade(uid, botId, trade) {
  const bot = findBot(uid, botId);
  if (!bot) return;
  if (!Array.isArray(bot.trades)) bot.trades = [];
  bot.trades.unshift({ ts: new Date().toISOString(), ...trade });
  if (bot.trades.length > 200) bot.trades.length = 200;
  persist();
}

function startBot(uid, botId) {
  const bot = findBot(uid, botId);
  if (!bot) throw new Error('Bot not found');
  if (!alpaca.configured(uid)) throw new Error('Connect Alpaca on the Trading tab before starting a bot');
  stopBot(uid, botId, { silent: true });
  updateBot(uid, botId, { status: 'running' });
  log(uid, botId, 'info', `Started — evaluating every ${bot.intervalSec}s (${bot.live ? 'AUTO-TRADE' : 'signal-only'})`);
  tick(uid, botId);
  timers.set(botId, setInterval(() => tick(uid, botId), bot.intervalSec * 1000));
  return findBot(uid, botId);
}

function stopBot(uid, botId, { silent = false } = {}) {
  const t = timers.get(botId);
  if (t) {
    clearInterval(t);
    timers.delete(botId);
    if (!silent) log(uid, botId, 'info', 'Stopped');
  }
  try {
    updateBot(uid, botId, { status: 'stopped' });
  } catch { /* bot may have been deleted */ }
}

function botLogs(uid, botId) {
  const bot = findBot(uid, botId);
  return (bot && bot.logs) || [];
}

// Rich per-bot insight: live position, P&L, activity and last evaluation.
async function botInsights(uid, botId) {
  const bot = findBot(uid, botId);
  if (!bot) throw new Error('Bot not found');

  let position = null;
  let account = null;
  let priceNow = null;
  let dataError = null;

  if (alpaca.configured(uid)) {
    try {
      position = await alpaca.trading(uid, `/v2/positions/${encodeURIComponent(bot.symbol)}`);
    } catch (e) {
      if (e.status !== 404) dataError = e.message;
    }
    try {
      account = await alpaca.trading(uid, '/v2/account');
    } catch (e) {
      dataError = dataError || e.message;
    }
    try {
      const p = await alpaca.latestPrices(uid, [bot.symbol]);
      priceNow = p[bot.symbol] ?? null;
    } catch { /* leave null */ }
  } else {
    dataError = 'Alpaca is not connected — connect it on the Trading tab.';
  }

  const trades = bot.trades || [];
  const buys = trades.filter((t) => t.side === 'buy');
  const sells = trades.filter((t) => t.side === 'sell');
  // Realised P&L from matched round trips (simple FIFO on this bot's own fills).
  let realised = 0;
  const lots = [];
  [...trades].reverse().forEach((t) => {
    if (t.side === 'buy') lots.push({ qty: t.qty, price: t.price });
    else {
      let remaining = t.qty;
      while (remaining > 0 && lots.length) {
        const lot = lots[0];
        const matched = Math.min(remaining, lot.qty);
        realised += matched * (t.price - lot.price);
        lot.qty -= matched;
        remaining -= matched;
        if (lot.qty <= 0) lots.shift();
      }
    }
  });

  return {
    bot: {
      id: bot.id,
      strategyId: bot.strategyId,
      strategyName: (strategyById.get(bot.strategyId) || {}).name,
      symbol: bot.symbol,
      params: bot.params,
      intervalSec: bot.intervalSec,
      live: bot.live,
      status: bot.status,
      createdAt: bot.createdAt,
    },
    activity: {
      evaluations: bot.evaluations || 0,
      signalCounts: bot.signalCounts || { buy: 0, sell: 0, hold: 0 },
      lastRun: bot.lastRun,
      lastSignal: bot.lastSignal,
      lastReason: bot.lastReason,
      lastMetrics: bot.lastMetrics,
      tradeCount: trades.length,
      buyCount: buys.length,
      sellCount: sells.length,
    },
    position: position
      ? {
          qty: Number(position.qty),
          avgEntry: Number(position.avg_entry_price),
          currentPrice: Number(position.current_price),
          marketValue: Number(position.market_value),
          unrealisedPl: Number(position.unrealized_pl),
          unrealisedPlPct: Number(position.unrealized_plpc) * 100,
        }
      : null,
    pnl: { realised: +realised.toFixed(2) },
    priceNow,
    account: account
      ? { equity: Number(account.equity), buyingPower: Number(account.buying_power), cash: Number(account.cash) }
      : null,
    trades: trades.slice(0, 25),
    dataError,
  };
}

// Restart bots that were running before a server restart.
function resumeRunningBots() {
  const db = load();
  for (const [uid, bots] of Object.entries(db.quantBots || {})) {
    for (const bot of bots) {
      if (bot.status === 'running') {
        if (alpaca.configured(uid)) {
          try {
            startBot(uid, bot.id);
            console.log(`Resumed quant bot ${bot.id} (${bot.strategyId} on ${bot.symbol})`);
          } catch (e) {
            log(uid, bot.id, 'error', `Could not resume after restart: ${e.message}`);
            updateBot(uid, bot.id, { status: 'stopped' });
          }
        } else {
          log(uid, bot.id, 'warn', 'Server restarted but Alpaca is not connected — bot left stopped.');
          updateBot(uid, bot.id, { status: 'stopped' });
        }
      }
    }
  }
}

module.exports = {
  listStrategies, botsFor, createBot, updateBot, deleteBot,
  startBot, stopBot, botLogs, botInsights, resumeRunningBots,
};
