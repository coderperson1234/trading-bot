// RSI mean-reversion strategy.
function rsi(closes, n) {
  if (closes.length < n + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - n; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d;
    else losses -= d;
  }
  if (gains + losses === 0) return 50;
  const rs = losses === 0 ? Infinity : gains / losses;
  return 100 - 100 / (1 + rs);
}

module.exports = {
  id: 'rsi-reversion',
  name: 'RSI Mean Reversion',
  description: 'Buys when RSI drops below the oversold threshold and exits when it recovers above the overbought threshold.',
  params: [
    { key: 'period', label: 'RSI period', type: 'number', default: 14, min: 2, max: 100 },
    { key: 'oversold', label: 'Oversold threshold', type: 'number', default: 30, min: 5, max: 50 },
    { key: 'overbought', label: 'Overbought threshold', type: 'number', default: 70, min: 50, max: 95 },
    { key: 'qty', label: 'Order quantity (shares)', type: 'number', default: 1, min: 1, max: 10000 },
  ],
  evaluate({ bars, position, params }) {
    const closes = bars.map((b) => b.c);
    const period = Number(params.period) || 14;
    const value = rsi(closes, period);
    if (value == null) return { signal: 'hold', reason: `Not enough history for RSI(${period})` };
    const metrics = { [`rsi_${period}`]: +value.toFixed(2) };
    const oversold = Number(params.oversold) || 30;
    const overbought = Number(params.overbought) || 70;
    if (value <= oversold && !position) return { signal: 'buy', metrics, reason: `RSI(${period}) ${value.toFixed(1)} ≤ ${oversold} (oversold)` };
    if (value >= overbought && position) return { signal: 'sell', metrics, reason: `RSI(${period}) ${value.toFixed(1)} ≥ ${overbought} (overbought)` };
    return { signal: 'hold', metrics, reason: `RSI(${period}) at ${value.toFixed(1)} — inside neutral band` };
  },
};
