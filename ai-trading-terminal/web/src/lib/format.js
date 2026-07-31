export const fmtUsd = (n, d = 2) => {
  // Never render a missing price as $0.00 — show it as unavailable.
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return (n < 0 ? '-$' : '$') +
    Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
};

export const fmtUsdCompact = (n) => {
  const abs = Math.abs(n);
  if (abs >= 1e6) return (n < 0 ? '-$' : '$') + (abs / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return (n < 0 ? '-$' : '$') + (abs / 1e3).toFixed(1) + 'K';
  return fmtUsd(n, 0);
};

export const fmtBigUsd = (n) => {
  if (n == null || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return fmtUsd(n, 0);
};

export const fmtPct = (n, d = 2) => (n > 0 ? '+' : '') + n.toFixed(d) + '%';
export const fmtNum = (n) => Number(n).toLocaleString('en-US');
export const fmtDate = (d) => {
  const t = new Date(d);
  return isNaN(t.getTime())
    ? ''
    : t.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};
