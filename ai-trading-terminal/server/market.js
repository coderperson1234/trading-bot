// Market data helpers: master stock list, catalog with sectors, price lookup.
const fs = require('fs');
const path = require('path');

const stocks = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'stocks.json'), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'catalog.json'), 'utf8'));

const catalogByTicker = new Map(catalog.map((s) => [s.ticker, s]));
const stockByTicker = new Map(stocks.map((s) => [s.ticker, s]));

// Deterministic pseudo-price for tickers we have no data for, so the demo
// works fully offline. Seeded by ticker so it is stable across restarts.
function syntheticPrice(ticker) {
  let h = 0;
  for (const ch of ticker) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return Math.round((20 + (h % 480) + (h % 97) / 100) * 100) / 100;
}

function basePrice(ticker) {
  const cat = catalogByTicker.get(ticker);
  if (cat && cat.price > 0) return cat.price;
  return syntheticPrice(ticker);
}

function lookup(ticker) {
  return (
    catalogByTicker.get(ticker) ||
    (stockByTicker.get(ticker)
      ? { ...stockByTicker.get(ticker), sector: sectorFor(ticker), price: basePrice(ticker), chg: 0 }
      : { ticker, name: ticker, sector: '—', type: 'equity', price: syntheticPrice(ticker), chg: 0 })
  );
}

// Coarse sector guess for master-list tickers missing from the rich catalog.
const SECTOR_HINTS = [
  [/^(AAPL|MSFT|NVDA|AMD|GOOG|GOOGL|META|ORCL|CRM|ADBE|INTC|CSCO|IBM|QCOM|TXN|AVGO|NOW|PLTR|SNOW|MU|TSM|ACN)$/, 'Technology'],
  [/^(JPM|BAC|WFC|GS|MS|C|BLK|SCHW|AXP|COF|BK|USB|PNC|TFC|AIG|MET|PRU|V|MA|PYPL)$/, 'Financials'],
  [/^(JNJ|PFE|MRK|ABBV|ABT|LLY|UNH|BMY|AMGN|GILD|CVS|MDT|TMO|DHR|ISRG|VRTX|REGN)$/, 'Healthcare'],
  [/^(XOM|CVX|COP|SLB|EOG|PSX|VLO|OXY|HAL|KMI|WMB)$/, 'Energy'],
  [/^(PG|KO|PEP|WMT|COST|MO|PM|CL|KMB|GIS|KHC|MDLZ|STZ|TGT)$/, 'Cons. Staples'],
  [/^(AMZN|TSLA|HD|MCD|NKE|SBUX|LOW|BKNG|DIS|F|GM|LULU|TJX|CMG)$/, 'Consumer Disc.'],
  [/^(AMT|PLD|SPG|O|EQIX|CCI|PSA|VNQ)$/, 'Real Estate'],
  [/^(GLD|SLV|USO|DBC|PDBC)$/, 'Commodities'],
  [/^(BND|AGG|TLT|VTEB|LQD|HYG|MUB|SHY|IEF)$/, 'Fixed Income'],
  [/^(VTI|VOO|SPY|QQQ|IWM|DIA|SCHD|VYM|VIG|VTV|VUG)$/, 'US Equity'],
  [/^(VXUS|VWO|VEA|EFA|EEM|IEMG|IXUS)$/, 'Intl Equity'],
];

function sectorFor(ticker) {
  for (const [re, sector] of SECTOR_HINTS) if (re.test(ticker)) return sector;
  const s = stockByTicker.get(ticker);
  if (s && s.type === 'etf') return 'US Equity';
  if (s && s.type === 'bond') return 'Fixed Income';
  return 'Technology';
}

module.exports = { stocks, catalog, lookup, basePrice, sectorFor };
