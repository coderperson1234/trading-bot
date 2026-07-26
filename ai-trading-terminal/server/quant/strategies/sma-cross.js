// Simple moving-average crossover strategy.
function sma(values, n) {
  if (values.length < n) return null;
  const slice = values.slice(-n);
  return slice.reduce((s, v) => s + v, 0) / n;
}

module.exports = {
  id: 'sma-cross',
  name: 'SMA Crossover',
  description: 'Buys when the fast simple moving average crosses above the slow one, sells when it crosses below. Classic trend-following baseline.',
  params: [
    { key: 'fast', label: 'Fast SMA period', type: 'number', default: 20, min: 2, max: 200 },
    { key: 'slow', label: 'Slow SMA period', type: 'number', default: 50, min: 5, max: 400 },
    { key: 'qty', label: 'Order quantity (shares)', type: 'number', default: 1, min: 1, max: 10000 },
  ],
  evaluate({ bars, position, params }) {
    const closes = bars.map((b) => b.c);
    const fastN = Number(params.fast) || 20;
    const slowN = Number(params.slow) || 50;
    const fast = sma(closes, fastN);
    const slow = sma(closes, slowN);
    const prevFast = sma(closes.slice(0, -1), fastN);
    const prevSlow = sma(closes.slice(0, -1), slowN);
    if (fast == null || slow == null || prevFast == null || prevSlow == null) {
      return { signal: 'hold', reason: `Not enough history (${closes.length} bars) for SMA(${slowN})` };
    }
    const metrics = { [`sma_${fastN}`]: +fast.toFixed(2), [`sma_${slowN}`]: +slow.toFixed(2), spread: +(fast - slow).toFixed(2) };
    const crossedUp = prevFast <= prevSlow && fast > slow;
    const crossedDown = prevFast >= prevSlow && fast < slow;
    if (crossedUp && !position) return { signal: 'buy', metrics, reason: `SMA(${fastN}) ${fast.toFixed(2)} crossed above SMA(${slowN}) ${slow.toFixed(2)}` };
    if (crossedDown && position) return { signal: 'sell', metrics, reason: `SMA(${fastN}) ${fast.toFixed(2)} crossed below SMA(${slowN}) ${slow.toFixed(2)}` };
    return { signal: 'hold', metrics, reason: `SMA(${fastN}) ${fast.toFixed(2)} vs SMA(${slowN}) ${slow.toFixed(2)} — no fresh cross` };
  },
};
