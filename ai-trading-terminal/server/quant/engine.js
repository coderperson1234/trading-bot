// Quant bot framework.
//
// A strategy is a module exporting:
//   id, name, description,
//   params: [{ key, label, type: 'number'|'string'|'select', default, min?, max?, options? }]
//   evaluate({ bars, position, params }) -> { signal: 'buy'|'sell'|'hold', reason }
//
// Bots run on an interval, pull bars from Alpaca, ask the strategy for a
// signal, and (when live=false this is signal-only; when live=true it
// submits paper orders through Alpaca). Strategy parameters are supplied by
// the user via the Quant Bot page — the framework is intentionally generic
// so new parameter sets can be dropped in later.
const { load, persist, nextId } = require('../store');
const alpaca = require('../alpaca');

const strategies = [
  require('./strategies/sma-cross'),
  require('./strategies/rsi-reversion'),
];
const strategyById = new Map(strategies.map((s) => [s.id, s]));

const timers = new Map(); // botId -> interval handle
const logs = new Map(); // botId -> [{ts, level, msg}]

function log(botId, level, msg) {
  const arr = logs.get(botId) || [];
  arr.unshift({ ts: new Date().toISOString(), level, msg });
  if (arr.length > 200) arr.length = 200;
  logs.set(botId, arr);
}

function listStrategies() {
  return strategies.map(({ id, name, description, params }) => ({ id, name, description, params }));
}

function botsFor(uid) {
  const db = load();
  return db.quantBots[uid] || [];
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
    lastRun: null,
    createdAt: new Date().toISOString(),
  };
  db.quantBots[uid] = [...botsFor(uid), bot];
  persist();
  log(bot.id, 'info', `Bot created (${strategyId} on ${bot.symbol})`);
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
  logs.delete(botId);
}

async function tick(uid, bot) {
  try {
    const bars = await alpaca.bars(uid, bot.symbol, '1Day', 250);
    if (!bars.length) {
      log(bot.id, 'warn', 'No bars returned — market data unavailable');
      return;
    }
    let position = null;
    try {
      position = await alpaca.trading(uid, `/v2/positions/${encodeURIComponent(bot.symbol)}`);
    } catch (e) {
      if (e.status !== 404) throw e;
    }
    const strategy = strategyById.get(bot.strategyId);
    const { signal, reason } = strategy.evaluate({ bars, position, params: bot.params });
    updateBot(uid, bot.id, { lastSignal: signal, lastRun: new Date().toISOString() });
    log(bot.id, 'info', `Signal: ${signal.toUpperCase()} — ${reason}`);

    if (bot.live && signal !== 'hold') {
      const qty = Number(bot.params.qty) || 1;
      if (signal === 'buy' && !position) {
        const order = await alpaca.trading(uid, '/v2/orders', {
          method: 'POST',
          body: JSON.stringify({ symbol: bot.symbol, qty: String(qty), side: 'buy', type: 'market', time_in_force: 'day' }),
        });
        log(bot.id, 'trade', `Submitted BUY ${qty} ${bot.symbol} (order ${order.id})`);
      } else if (signal === 'sell' && position) {
        const order = await alpaca.trading(uid, '/v2/orders', {
          method: 'POST',
          body: JSON.stringify({ symbol: bot.symbol, qty: String(Math.abs(Number(position.qty))), side: 'sell', type: 'market', time_in_force: 'day' }),
        });
        log(bot.id, 'trade', `Submitted SELL ${position.qty} ${bot.symbol} (order ${order.id})`);
      }
    }
  } catch (e) {
    log(bot.id, 'error', e.message);
  }
}

function startBot(uid, botId) {
  const bot = botsFor(uid).find((b) => b.id === botId);
  if (!bot) throw new Error('Bot not found');
  if (!alpaca.configured(uid)) throw new Error('Connect Alpaca before starting a bot');
  stopBot(uid, botId);
  updateBot(uid, botId, { status: 'running' });
  log(botId, 'info', `Bot started — evaluating every ${bot.intervalSec}s (${bot.live ? 'LIVE orders' : 'signal-only'})`);
  tick(uid, bot);
  timers.set(botId, setInterval(() => {
    const fresh = botsFor(uid).find((b) => b.id === botId);
    if (fresh) tick(uid, fresh);
  }, bot.intervalSec * 1000));
  return botsFor(uid).find((b) => b.id === botId);
}

function stopBot(uid, botId) {
  const t = timers.get(botId);
  if (t) {
    clearInterval(t);
    timers.delete(botId);
    log(botId, 'info', 'Bot stopped');
  }
  try {
    updateBot(uid, botId, { status: 'stopped' });
  } catch { /* bot may be deleted */ }
}

function botLogs(botId) {
  return logs.get(botId) || [];
}

module.exports = { listStrategies, botsFor, createBot, updateBot, deleteBot, startBot, stopBot, botLogs };
