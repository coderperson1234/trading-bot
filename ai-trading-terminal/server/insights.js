// Deterministic "AI" insight generators so the app is fully functional
// offline. When ANTHROPIC_API_KEY is set, text endpoints upgrade to real
// model-written commentary via generateWithClaude().
const { lookup, stocks, sectorFor } = require('./market');

const EURO_TICKERS = new Set(['RACE','ASML','SAP','STM','NOK','ERIC','SPOT','NVO','NVS','AZN','SNY','GSK','UL','DEO','BUD','BTI','SHEL','TTE','BP','E','EQNR','HSBC','BCS','DB','UBS','ING','STLA']);

const SECTOR_BUCKET = {
  Technology: 'Equity', 'Consumer Disc.': 'Equity', Financials: 'Equity',
  Healthcare: 'Equity', Energy: 'Equity', 'Cons. Staples': 'Equity',
  'US Equity': 'Equity', 'Intl Equity': 'Equity',
  'Fixed Income': 'Fixed Income', Commodities: 'Alternatives', 'Real Estate': 'Alternatives',
};

const RISK_TARGETS = {
  Conservative: { Equity: 35, 'Fixed Income': 55, Alternatives: 10 },
  Moderate: { Equity: 60, 'Fixed Income': 32, Alternatives: 8 },
  Aggressive: { Equity: 85, 'Fixed Income': 8, Alternatives: 7 },
};

function portfolioRows(client) {
  const rows = client.portfolio.holdings.map((h) => {
    const info = lookup(h.ticker);
    const price = h.currentPrice ?? 0; // caller refreshes with live prices
    const value = h.qty * price;
    const cost = h.qty * h.avgCost;
    return {
      ...h,
      name: h.orgName || info.name,
      sector: info.sector,
      type: h.assetType || info.type,
      price, value, cost,
      gain: value - cost,
      gainPct: cost > 0 ? ((value - cost) / cost) * 100 : 0,
    };
  });
  const total = rows.reduce((s, r) => s + r.value, 0);
  rows.forEach((r) => (r.weight = total > 0 ? (r.value / total) * 100 : 0));
  return { rows, total };
}

function rebalanceSummary(client) {
  const { rows, total } = portfolioRows(client);
  if (!rows.length) return null;
  const buckets = {};
  rows.forEach((r) => {
    const b = SECTOR_BUCKET[r.sector] || 'Other';
    buckets[b] = (buckets[b] || 0) + r.value;
  });
  const target = RISK_TARGETS[client.risk] || RISK_TARGETS.Moderate;
  const eqPct = ((buckets.Equity || 0) / total) * 100;
  const fiPct = ((buckets['Fixed Income'] || 0) / total) * 100;
  const top = [...rows].sort((a, b) => b.weight - a.weight)[0];
  const winners = rows.filter((r) => r.gainPct >= 25).map((r) => r.ticker);
  const losers = rows.filter((r) => r.gainPct < 0).map((r) => r.ticker);

  return [
    `Latest News Impact: Markets remain focused on **AI infrastructure demand, rate policy and earnings breadth**. The book's largest exposure, **${top.name}** (${top.weight.toFixed(0)}% of assets), is most sensitive to this tape; headline risk there translates directly into portfolio-level swings.`,
    `Bullish AI: ${winners.length ? `Momentum is strongest in **${winners.slice(0, 3).join(', ')}**, which continue${winners.length === 1 ? 's' : ''} to compound above cost. ` : ''}Current equity exposure of **${eqPct.toFixed(0)}%** keeps the portfolio participating in upside, consistent with a ${client.portfolio.strategy.toLowerCase()} strategy.`,
    `Bearish AI: ${losers.length ? `**${losers.slice(0, 3).join(', ')}** sit${losers.length === 1 ? 's' : ''} below cost and deserve${losers.length === 1 ? 's' : ''} a fresh thesis check. ` : ''}Concentration risk is the main watch item — the top position alone is **${top.weight.toFixed(0)}%** of the book.`,
    `Balanced AI: Versus a ${client.risk.toLowerCase()} mandate of ${target.Equity}% equity / ${target['Fixed Income']}% fixed income, the book runs **${eqPct.toFixed(0)}% / ${fiPct.toFixed(0)}%**. ${eqPct > target.Equity + 10 ? 'Trimming equity toward target would de-risk without abandoning the strategy.' : eqPct < target.Equity - 10 ? 'There is room to add equity toward target.' : 'Allocation sits close to mandate.'}`,
    `Moderator AI: Net-net, execute gradually — **rebalance in tranches**, prioritise trimming oversized winners, and redeploy into underweight sleeves. Revisit after the next earnings cycle for ${client.name.split(' ')[0]}'s ${client.portfolio.name}.`,
  ].join('\n\n');
}

function stockSummary(ticker, price) {
  const info = lookup(ticker);
  if (price == null) return null; // never fabricate a price
  const target = Math.round(price * 1.18);
  return {
    tckr: ticker,
    summary: [
      `Bullish AI: **${info.name}** benefits from durable demand in the ${info.sector} space; consensus positioning skews constructive with a median target near **$${target}** versus the current ~$${price.toFixed(0)} level, implying meaningful upside if execution holds.`,
      `Bearish AI: Valuation leaves little room for missteps — a slowdown in ${info.sector.toLowerCase()} spending, margin pressure, or macro tightening could compress multiples quickly. Position sizing matters more than timing here.`,
      `Balanced AI: Over the last week the shares have traded in a normal range with no thesis-changing news. For diversified portfolios, ${ticker} is best treated as a core ${info.type === 'etf' ? 'index sleeve' : 'holding'} accumulated on weakness rather than chased on strength.`,
    ].join('\n\n'),
    assetType: info.type,
    currentPrice: price,
    analystValuation: target,
    analystRating: 'buy',
    generatedAt: new Date().toISOString(),
  };
}

function predictions(ticker, price) {
  const info = lookup(ticker);
  if (price == null) return null; // never fabricate a price
  const avgTarget = Math.round(price * 1.16);
  const seed = [...ticker].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0);
  const bull = 45 + (seed % 30);
  const bear = Math.max(5, 30 - (seed % 20));
  const neutral = Math.max(0, 100 - bull - bear);
  return {
    _meta: {
      sources: { analyst: 'seeded', markets: 'simulated', reasoning: 'deterministic' },
      citations: [],
      generated_at: new Date().toISOString(),
      markets_found: 3,
      source: 'local',
    },
    ticker,
    company_name: info.name,
    sector: info.sector,
    industry: info.sector,
    asset_type: info.type,
    is_fund: info.type !== 'equity',
    overall: {
      stance: bull > 55 ? 'bullish' : bear > 35 ? 'bearish' : 'balanced',
      read: `${info.name} screens ${bull > 55 ? 'constructively' : 'mixed'} across sentiment, valuation and macro dimensions. Analyst consensus implies ~${(((avgTarget - price) / price) * 100).toFixed(0)}% upside to the average target, while simulated prediction-market odds lean ${bull}% bullish. Treat the read as directional, not a trade signal.`,
    },
    analyst_forecast: {
      current_price: price,
      average_price_target: avgTarget,
      median_price_target: Math.round(avgTarget * 0.98),
      low_price_target: Math.round(price * 0.85),
      high_price_target: Math.round(price * 1.45),
      consensus_rating: bull > 55 ? 'Buy' : 'Hold',
      recommendation_mean: +(2.6 - bull / 100).toFixed(2),
      num_analysts: 20 + (seed % 25),
      bullish_pct: bull,
      neutral_pct: neutral,
      bearish_pct: bear,
      counts: {
        strong_buy: 4 + (seed % 8),
        buy: 8 + (seed % 10),
        hold: 5 + (seed % 8),
        sell: seed % 3,
        strong_sell: seed % 2,
      },
      recent_ratings: [],
    },
    dimensions: {
      stock_sentiment: {
        read: `Positioning in ${ticker} is ${bull > 55 ? 'net-long with improving breadth' : 'two-sided'}; options skew and simulated market odds imply a ${bull}% probability the constructive case plays out over the next two quarters.`,
        markets: [{
          question: `Will ${ticker} close the quarter above $${Math.round(price * 1.05)}?`,
          level: 'ticker',
          outcomes: [
            { name: 'Yes', probability_pct: bull },
            { name: 'No', probability_pct: 100 - bull },
          ],
        }],
      },
      valuation: {
        read: `At ~$${price.toFixed(0)}, the shares trade ${avgTarget > price ? 'below' : 'above'} the $${avgTarget} average target. Multiples are ${bull > 55 ? 'rich but supported by growth' : 'undemanding relative to peers'}.`,
        markets: [],
      },
      macro: {
        read: 'Rate path and liquidity remain the dominant macro inputs; a benign inflation print keeps the soft-landing scenario as the base case.',
        markets: [{
          question: 'Fed cuts rates at the next meeting?',
          level: 'macro',
          outcomes: [
            { name: 'Yes', probability_pct: 62 },
            { name: 'No', probability_pct: 38 },
          ],
        }],
      },
      industry: {
        read: `${info.sector} fundamentals remain ${bull > 50 ? 'healthy, with capex and demand indicators pointing up' : 'mixed, with dispersion between leaders and laggards'}.`,
        markets: [],
      },
      competitor: {
        read: `Competitive intensity is the swing factor — share shifts among ${info.sector} leaders would move the medium-term estimate more than macro.`,
        markets: [],
      },
    },
  };
}

function valuation(tickers, priceMap = {}) {
  const unavailable = tickers.filter((t) => priceMap[t] == null);
  tickers = tickers.filter((t) => priceMap[t] != null);
  const universe = tickers.map((t) => {
    const info = lookup(t);
    return { ticker: t, name: info.name, sector: info.sector, industry: info.sector, is_index_ticker: true };
  });
  const football_fields = {};
  const scorecard = [];
  for (const t of tickers) {
    const price = priceMap[t];
    const seed = [...t].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0);
    const spread = 0.12 + (seed % 10) / 100;
    football_fields[t] = {
      methods: {
        '52_week_range': { label: '52-Week Range', low: r2(price * (1 - spread * 1.6)), high: r2(price * (1 + spread * 0.9)), mark: r2(price * 0.97) },
        dcf_5y: { label: '5-Yr DCF (Model)', low: r2(price * (1 - spread)), high: r2(price * (1 + spread * 1.8)), mark: r2(price * 1.08) },
        forward_pe: { label: 'Forward P/E Comps', low: r2(price * (1 - spread * 0.8)), high: r2(price * (1 + spread * 1.3)), mark: r2(price * 1.02) },
        ev_ebitda: { label: 'EV/EBITDA Comps', low: r2(price * (1 - spread * 1.1)), high: r2(price * (1 + spread)), mark: r2(price * 0.99) },
        analyst_targets: { label: 'Analyst Targets', low: r2(price * 0.88), high: r2(price * 1.42), mark: r2(price * 1.16) },
      },
    };
    scorecard.push({
      ticker: t,
      name: lookup(t).name,
      current_price: price,
      dcf_implied_price: r2(price * 1.08),
      dcf_upside_pct: 8,
      analyst_rating: seed % 3 === 0 ? 'Hold' : 'Buy',
      avg_analyst_target: r2(price * 1.16),
      avg_target_upside_pct: 16,
      target_range_low: r2(price * 0.88),
      target_range_high: r2(price * 1.42),
      forward_pe: 14 + (seed % 30),
      peg_ratio: +(0.9 + (seed % 20) / 10).toFixed(2),
      ev_ebitda_ttm: 9 + (seed % 22),
      beta: +(0.7 + (seed % 12) / 10).toFixed(2),
      revenue_growth_y1_pct: 4 + (seed % 40),
      market_cap_usd: (5 + (seed % 2900)) * 1e9,
      key_moat: 'Scale, distribution and switching costs',
      key_risk: 'Multiple compression if growth slows',
    });
  }
  return {
    universe,
    football_fields,
    scorecard,
    unavailable,
    takeaways: [
      `${tickers[0]} anchors the comparison — its blended midpoint sits ${Math.random() > 0.5 ? 'above' : 'near'} the current price, with analyst targets the most generous method.`,
      'DCF ranges are the widest across the set; treat the midpoints as scenario centre-points rather than point estimates.',
      'Cross-check the scorecard multiples against sector medians before acting on any single method.',
    ],
    sources: [],
  };
}

// Candidate symbols for a query — used to fetch real prices before building rows.
function screenerShortlist(query) {
  return screenCandidates(query).slice(0, 15).map((s) => s.ticker);
}

function screenCandidates(query) {
  const q = query.toLowerCase();
  const wantsEtf = /\betf|index|fund\b/.test(q);
  const wantsDiv = /dividend|income|yield/.test(q);
  const wantsTech = /tech|software|semi|ai\b|chip/.test(q);
  const wantsHealth = /health|pharma|biotech/.test(q);
  const wantsFin = /bank|financ/.test(q);
  const wantsEnergy = /energy|oil|gas|petrol/.test(q);
  const wantsStaples = /staple|consumer goods|food|beverage|drink|tobacco/.test(q);
  const wantsLuxury = /luxury|fashion|apparel|clothing|retail|consumer disc|brand|footwear|shoe|handbag/.test(q);
  const wantsGrowth = /growth|momentum/.test(q);
  const wantsValue = /value|cheap|low p\/?e/.test(q);
  // Region hint — many international names carry country cues in their name.
  const wantsEurope = /europe|european|eu\b|swiss|french|german|italian|british|uk\b|dutch|nordic|spanish/.test(q);
  const EURO_HINT = /\((ADR)\)|N\.V\.|S\.A\.|S\.p\.A\.|PLC|plc|AG$|AG \(|SE$|SE \(|A\/S|ASA|Holding AG|Group AG|Corp\.$/;
  const isEuropean = (s) => EURO_TICKERS.has(s.ticker) || /\(ADR\)/.test(s.name) || EURO_HINT.test(s.name);

  let list = stocks.filter((s) => s.type === (wantsEtf ? 'etf' : s.type));
  if (!wantsEtf) list = list.filter((s) => s.type === 'equity');
  list = list.filter((s) => {
    const sector = sectorFor(s.ticker);
    if (wantsLuxury) return sector === 'Consumer Disc.';
    if (wantsTech) return sector === 'Technology';
    if (wantsHealth) return sector === 'Healthcare';
    if (wantsFin) return sector === 'Financials';
    if (wantsEnergy) return sector === 'Energy';
    if (wantsStaples) return sector === 'Cons. Staples';
    if (wantsDiv) return ['Cons. Staples', 'Financials', 'Energy', 'Healthcare', 'US Equity'].includes(sector);
    return true;
  });
  // If Europe is requested, prioritise (and, when we have enough, restrict to)
  // international names so the results reflect the region.
  if (wantsEurope) {
    const euro = list.filter(isEuropean);
    if (euro.length >= 5) list = euro;
    else list = [...euro, ...list.filter((s) => !isEuropean(s))];
  }
  return list;
}

function screener(query, priceMap = {}) {
  const list = screenCandidates(query);
  const isEuropean = (s) => /\(ADR\)/.test(s.name) || EURO_TICKERS.has(s.ticker);
  const results = list.slice(0, 15).map((s) => {
    const price = priceMap[s.ticker] ?? null;
    const seed = [...s.ticker].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0);
    const euro = isEuropean(s);
    const isAdr = /\(ADR\)/.test(s.name);
    return {
      ticker: s.ticker,
      name: s.name,
      sector: sectorFor(s.ticker),
      industry: sectorFor(s.ticker),
      country: euro ? 'Intl' : 'US',
      exchange: euro ? (isAdr ? 'US ADR (OTC)' : 'NYSE/NASDAQ ADR') : 'NYSE/NASDAQ',
      price,
      market_cap_usd: (10 + (seed % 2500)) * 1e9,
      revenue_growth_y1_pct: wantsGrowth ? 15 + (seed % 30) : 3 + (seed % 15),
      pe_trailing: wantsValue ? 8 + (seed % 12) : 18 + (seed % 25),
      dividend_yield_pct: wantsDiv ? +(2 + (seed % 30) / 10).toFixed(1) : +((seed % 15) / 10).toFixed(1),
      ytd_pct: +((seed % 400) / 10 - 10).toFixed(1),
      beta: +(0.7 + (seed % 12) / 10).toFixed(2),
      analyst_rating: seed % 3 === 0 ? 'Hold' : 'Buy',
      match_reason: `Matches "${query.slice(0, 60)}" on sector, size and style filters.`,
    };
  });
  return {
    screen: { query, filters: {}, universe: 'US-listed common stocks and ETFs (local demo universe)', sort_by: 'market_cap', as_of: new Date().toISOString().slice(0, 10) },
    columns: ['ticker', 'name', 'sector', 'country', 'exchange', 'price', 'market_cap_usd', 'revenue_growth_y1_pct', 'pe_trailing', 'dividend_yield_pct', 'ytd_pct', 'beta', 'analyst_rating', 'match_reason'],
    results,
    count: results.length,
    dropped_by_filter: Math.max(0, list.length - results.length),
    notes: ['Demo screener: results are generated from the local universe with deterministic metrics. Connect a data provider for live fundamentals.'],
    sources: [],
  };
}

function aiWatchlist(client) {
  const strategy = client.portfolio.strategy;
  const held = new Set(client.portfolio.holdings.map((h) => h.ticker));
  const philosophyFor = { Growth: 'G', Income: 'I', Value: 'V', Index: 'X', Custom: 'G, V' };
  const pool = {
    Growth: ['NVDA', 'MSFT', 'AMZN', 'GOOGL', 'AMD', 'CRM', 'NOW', 'AVGO'],
    Income: ['SCHD', 'VYM', 'JNJ', 'KO', 'PG', 'O', 'MO', 'VZ'],
    Value: ['BRK.B', 'JPM', 'CVX', 'PFE', 'CSCO', 'INTC', 'BAC', 'WFC'],
    Index: ['VTI', 'VOO', 'QQQ', 'VXUS', 'IWM', 'DIA', 'VEA', 'BND'],
    Custom: ['AAPL', 'MSFT', 'VTI', 'SCHD', 'BRK.B', 'QQQ'],
  }[strategy] || [];
  return pool
    .filter((t) => !held.has(t))
    .slice(0, 6)
    .map((t, i) => {
      const info = lookup(t);
      return {
        id: `ai_${client.id}_${i}`,
        ticker: t,
        orgName: info.name,
        philosophy: philosophyFor[strategy] || 'G',
        commentary: `${info.name} complements the ${strategy.toLowerCase()} mandate — ${client.risk.toLowerCase()} risk fit, ${client.horizon.toLowerCase()} horizon, and no overlap with current holdings.`,
        generatedAt: new Date().toISOString(),
      };
    });
}

function newsFallback(tickers) {
  const now = Date.now();
  const templates = [
    ['%N beats consensus as %S demand holds up', 'Market Wire'],
    ['Analysts lift %T price targets after upbeat guidance', 'Street Digest'],
    ['What %N results mean for the broader %S trade', 'Daily Finance'],
    ['%T volatility picks up ahead of earnings', 'Ticker Tape'],
  ];
  const out = [];
  tickers.slice(0, 8).forEach((t, i) => {
    const info = lookup(t);
    templates.slice(0, 2 + (i % 2)).forEach(([tpl, pub], j) => {
      out.push({
        tckr: t,
        date: new Date(now - (i * 3 + j) * 36e5).toISOString(),
        title: tpl.replaceAll('%N', info.name).replaceAll('%T', t).replaceAll('%S', info.sector.toLowerCase()),
        publisher: pub,
        link: `https://www.google.com/search?q=${encodeURIComponent(info.name + ' stock news')}`,
      });
    });
  });
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

// Optional Claude upgrade for text endpoints.
async function generateWithClaude(prompt, maxTokens = 900) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.content && body.content[0] ? body.content[0].text : null;
  } catch {
    return null;
  }
}

function r2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = {
  screenerShortlist,
  portfolioRows,
  rebalanceSummary,
  stockSummary,
  predictions,
  valuation,
  screener,
  aiWatchlist,
  newsFallback,
  generateWithClaude,
  RISK_TARGETS,
  SECTOR_BUCKET,
};
