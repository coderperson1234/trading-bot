// Instrument reference data: master list + sector/type metadata.
//
// IMPORTANT: this module deliberately contains NO prices. Prices must always
// come from the market data provider (Alpaca). If a price is unavailable for a
// symbol, the app shows it as unavailable rather than inventing a number.
const fs = require('fs');
const path = require('path');

const stocks = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'stocks.json'), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'catalog.json'), 'utf8'));

const catalogByTicker = new Map(catalog.map((s) => [s.ticker, s]));
const stockByTicker = new Map(stocks.map((s) => [s.ticker, s]));

// Coarse sector classification, used for allocation buckets and screening.
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
  const cat = catalogByTicker.get(ticker);
  if (cat && cat.sector && cat.sector !== '—') return cat.sector;
  for (const [re, sector] of SECTOR_HINTS) if (re.test(ticker)) return sector;
  const s = stockByTicker.get(ticker);
  if (s && s.type === 'etf') return 'US Equity';
  if (s && s.type === 'bond') return 'Fixed Income';
  return 'Other';
}

// Metadata only — never a price.
function lookup(ticker) {
  const cat = catalogByTicker.get(ticker);
  const base = stockByTicker.get(ticker);
  return {
    ticker,
    name: (cat && cat.name) || (base && base.name) || ticker,
    type: (cat && cat.type) || (base && base.type) || 'equity',
    sector: sectorFor(ticker),
  };
}

module.exports = { stocks, catalog, lookup, sectorFor };
