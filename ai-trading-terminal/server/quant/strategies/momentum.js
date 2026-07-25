// Time-series momentum strategy.
//
// Enters when the lookback return is strongly positive (price also above its
// moving average as a trend filter), and exits when momentum fades below the
// exit threshold or price falls back under the moving average.
function sma(values, n) {
  if (values.length < n) return null;
  return values.slice(-n).reduce((s, v) => s + v, 0) / n;
}

module.exports = {
  id: 'momentum',
  name: 'Momentum',
  description: 'Buys strength: enters when the lookback return clears the entry threshold and price is above its moving average, exits when momentum fades or price drops back below the average.',
  params: [
    { key: 'lookback', label: 'Lookback period (bars)', type: 'number', default: 90, min: 5, max: 400 },
    { key: 'entryPct', label: 'Entry threshold (% return)', type: 'number', default: 10, min: 0, max: 200 },
    { key: 'exitPct', label: 'Exit threshold (% return)', type: 'number', default: 0, min: -100, max: 200 },
    { key: 'trendMa', label: 'Trend filter MA (bars)', type: 'number', default: 50, min: 1, max: 400 },
    { key: 'qty', label: 'Order quantity (shares)', type: 'number', default: 1, min: 1, max: 10000 },
  ],
  evaluate({ bars, position, params }) {
    const closes = bars.map((b) => b.c);
    const lookback = Number(params.lookback) || 90;
    const entryPct = Number(params.entryPct) || 0;
    const exitPct = Number(params.exitPct) || 0;
    const trendMa = Number(params.trendMa) || 50;

    if (closes.length <= lookback) {
      return { signal: 'hold', reason: `Not enough history (${closes.length} bars) for a ${lookback}-bar lookback` };
    }
    const now = closes[closes.length - 1];
    const past = closes[closes.length - 1 - lookback];
    const ret = past > 0 ? ((now - past) / past) * 100 : 0;
    const ma = sma(closes, trendMa);
    const aboveTrend = ma == null || now >= ma;

    if (!position) {
      if (ret >= entryPct && aboveTrend) {
        return { signal: 'buy', reason: `${lookback}-bar momentum +${ret.toFixed(1)}% ≥ ${entryPct}% and price above MA(${trendMa})` };
      }
      return { signal: 'hold', reason: `Momentum ${ret >= 0 ? '+' : ''}${ret.toFixed(1)}% below entry ${entryPct}%${aboveTrend ? '' : ' / under MA'}` };
    }
    if (ret < exitPct || !aboveTrend) {
      return { signal: 'sell', reason: `Momentum faded to ${ret >= 0 ? '+' : ''}${ret.toFixed(1)}%${aboveTrend ? '' : ' and price under MA(' + trendMa + ')'} — exiting` };
    }
    return { signal: 'hold', reason: `Riding momentum ${ret >= 0 ? '+' : ''}${ret.toFixed(1)}% — above exit ${exitPct}%` };
  },
};
