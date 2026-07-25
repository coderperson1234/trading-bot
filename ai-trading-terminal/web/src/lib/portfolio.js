// Portfolio math + local catalog helpers shared across pages.
export const SECTOR_BUCKET = {
  Technology: 'Equity', 'Consumer Disc.': 'Equity', Financials: 'Equity',
  Healthcare: 'Equity', Energy: 'Equity', 'Cons. Staples': 'Equity',
  'US Equity': 'Equity', 'Intl Equity': 'Equity',
  'Fixed Income': 'Fixed Income', Commodities: 'Alternatives', 'Real Estate': 'Alternatives',
};

export const RISK_TARGETS = {
  Conservative: { Equity: 35, 'Fixed Income': 55, Alternatives: 10 },
  Moderate: { Equity: 60, 'Fixed Income': 32, Alternatives: 8 },
  Aggressive: { Equity: 85, 'Fixed Income': 8, Alternatives: 7 },
};

export const TYPE_LABEL = { equity: 'Equity', bond: 'Bond', etf: 'ETF' };
export const TYPE_COLOR = {
  Equity: 'oklch(0.45 0.08 258)',
  Bond: 'oklch(0.62 0.10 190)',
  ETF: 'oklch(0.58 0.13 292)',
  Other: 'oklch(0.7 0.02 258)',
};
export const PI_CATEGORY_COLOR = {
  Instruments: 'oklch(0.62 0.13 152)',
  Unlisted: 'oklch(0.64 0.15 40)',
  Other: 'oklch(0.7 0.02 258)',
};

let masterList = [];
export function setMasterList(list) {
  masterList = list;
}
export function lookupStock(ticker) {
  return (
    masterList.find((s) => s.ticker === ticker) || { ticker, name: ticker, type: 'equity' }
  );
}

export function holdingRows(portfolio) {
  return portfolio.holdings.map((h) => {
    const info = lookupStock(h.ticker);
    const price = h.currentPrice ?? 0;
    const value = h.qty * price;
    const cost = h.qty * h.avgCost;
    const gain = value - cost;
    return {
      ...h,
      name: h.orgName ?? info.name,
      assetType: h.assetType ?? info.type,
      price,
      value,
      cost,
      gain,
      gainPct: price > 0 && cost > 0 ? (gain / cost) * 100 : h.returnPct ?? 0,
    };
  });
}

export function portfolioStats(portfolio) {
  const rows = holdingRows(portfolio);
  const value = rows.reduce((s, r) => s + r.value, 0);
  const cost = rows.reduce((s, r) => s + r.cost, 0);
  const gain = value - cost;
  return {
    rows: rows.map((r) => ({ ...r, weight: value > 0 ? (r.value / value) * 100 : 0 })),
    value,
    cost,
    gain,
    gainPct: cost > 0 ? (gain / cost) * 100 : 0,
    count: portfolio.holdings.length,
  };
}

export function allocationByType(rows) {
  const out = {};
  rows.forEach((r) => {
    const label = r.assetType ? TYPE_LABEL[r.assetType] ?? r.assetType : 'Other';
    out[label] = (out[label] || 0) + r.value;
  });
  return out;
}
