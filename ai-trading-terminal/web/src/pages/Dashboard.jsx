import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, useActiveClient } from '../lib/store';
import { api } from '../lib/api';
import { portfolioStats, allocationByType, TYPE_COLOR, PI_CATEGORY_COLOR, RISK_TARGETS, SECTOR_BUCKET } from '../lib/portfolio';
import { fmtUsd, fmtPct, fmtNum, fmtDate } from '../lib/format';
import { Icon, RiskPill, ActionPill, NaTip, SectionedSummary, AiThinking, EmptyState } from '../components/ui';

const REBAL_MESSAGES = [
  'Analysing portfolio allocations…',
  'Calculating risk-adjusted weights…',
  'Scanning sector exposures…',
  'Mapping holdings to target bands…',
  'Generating buy / hold / sell plan…',
];

function parseRec(rec) {
  return rec
    .split(',')
    .map((p) => {
      const m = p.trim().match(/^(.+?)\s*\((\d+)%\)$/);
      return m ? { label: m[1].trim(), pct: parseInt(m[2]) } : null;
    })
    .filter(Boolean);
}

const REC_TONES = {
  'strong buy': { bg: 'oklch(0.93 0.08 152)', color: 'oklch(0.38 0.14 152)', dot: 'oklch(0.50 0.18 152)' },
  buy: { bg: 'oklch(0.94 0.07 152)', color: 'oklch(0.42 0.13 152)', dot: 'oklch(0.55 0.16 152)' },
  hold: { bg: 'oklch(0.95 0.07 75)', color: 'oklch(0.50 0.13 75)', dot: 'oklch(0.62 0.16 75)' },
  sell: { bg: 'oklch(0.95 0.07 27)', color: 'oklch(0.50 0.14 27)', dot: 'oklch(0.58 0.18 27)' },
};

function AnalystRec({ rec, assetType }) {
  if (assetType === 'etf') return <NaTip tip="ETFs track an index — no individual analyst rating" />;
  if (assetType === 'bond') return <NaTip tip="Bonds are rated by credit agencies, not equity analysts" />;
  if (!rec) return <span className="muted tiny">—</span>;
  const parts = parseRec(rec);
  if (!parts.length) return <span className="muted tiny">{rec}</span>;
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      {parts.map((p) => {
        const tone = REC_TONES[p.label.toLowerCase()] ?? { bg: 'var(--surface-2)', color: 'var(--ink-2)', dot: 'var(--ink-4)' };
        return (
          <span key={p.label} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, background: tone.bg, color: tone.color,
            padding: '2px 9px 2px 6px', borderRadius: 20, fontSize: 11.5, fontWeight: 700,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: tone.dot, flexShrink: 0 }} />
            {p.label} {p.pct}%
          </span>
        );
      })}
    </span>
  );
}

function NewsFeed({ tickers }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const boxRef = useRef(null);
  const key = tickers.join(',');
  const ROW = 36, VISIBLE = 5;

  useEffect(() => {
    if (!key) { setItems([]); setLoading(false); return; }
    setLoading(true);
    api(`/api/news?tickers=${encodeURIComponent(key)}`)
      .then((r) => setItems(Array.isArray(r) ? r : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [key]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || items.length <= VISIBLE) return;
    let dir = 1;
    const t = setInterval(() => {
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 0) return;
      let next = el.scrollTop + dir * ROW;
      if (next >= max - 1) { next = max; dir = -1; }
      else if (next <= 0) { next = 0; dir = 1; }
      el.scrollTo({ top: next, behavior: 'smooth' });
    }, 5000);
    return () => clearInterval(t);
  }, [items.length]);

  return (
    <div className="card card-pad" style={{ marginTop: 16 }}>
      <div className="card-head" style={{ marginBottom: 12 }}>
        <div>
          <div className="card-title">News Feed</div>
          <div className="card-sub">Latest headlines for this portfolio's holdings</div>
        </div>
      </div>
      {loading ? (
        <div className="empty tiny">Loading news…</div>
      ) : items.length === 0 ? (
        <div className="empty tiny">No recent news for these holdings.</div>
      ) : (
        <>
          <div className="row gap-10" style={{
            padding: '2px 0 8px', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: 'var(--ink-4)', borderBottom: '1px solid var(--line)',
          }}>
            <span style={{ minWidth: 56, flexShrink: 0 }}>TCKR</span>
            <span style={{ width: 112, flexShrink: 0 }}>Date</span>
            <span className="grow" style={{ minWidth: 0 }}>Title</span>
            <span style={{ width: 132, flexShrink: 0, textAlign: 'right' }}>Publisher</span>
          </div>
          <div ref={boxRef} style={{ maxHeight: ROW * VISIBLE, overflowY: 'auto' }}>
            {items.map((n, i) => (
              <div key={i} className="row gap-10" style={{ height: ROW, borderBottom: '1px solid var(--line)' }}>
                <span className="ticker" style={{ minWidth: 56, flexShrink: 0 }}>{n.tckr}</span>
                <span className="tnum muted" style={{ width: 112, flexShrink: 0, fontSize: 12 }}>{fmtDate(n.date)}</span>
                <a className="news-link grow" href={n.link} target="_blank" rel="noopener noreferrer" title={n.title}
                  style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 500 }}>
                  {n.title}
                </a>
                <span className="muted" title={n.publisher}
                  style={{ width: 132, flexShrink: 0, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                  {n.publisher}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Deterministic buy/hold/sell plan mirroring the advisor heuristics.
function fitCodes(row) {
  if (row.assetType === 'bond') return 'I, X';
  if (row.assetType === 'etf') return ['VYM', 'SCHD'].includes(row.ticker) ? 'V, I, X' : 'V, I, X, C';
  if (['AAPL', 'MSFT', 'GOOGL', 'JNJ', 'PG', 'V', 'UNH', 'HD', 'BRK.B'].includes(row.ticker)) return 'G, V, I, X, C';
  return 'G, C';
}

function buildPlan(client, stats) {
  if (!stats.value || !stats.rows.length) return null;
  const target = RISK_TARGETS[client.risk] || RISK_TARGETS.Moderate;
  const cell = (action, note) => ({ action, note });
  return {
    rows: stats.rows.map((row) => {
      let horizons, commentary;
      if (row.qty === 0) {
        horizons = [cell('Buy', 'Establish position'), cell('Buy', 'Scale in on dips'), cell('Hold', 'Build to target'), cell('Hold', 'Core')];
        commentary = `Unfunded placeholder — establish ${row.ticker} to put capital to work in line with the ${client.risk.toLowerCase()} mandate.`;
      } else if (row.weight >= 20 && row.assetType === 'equity') {
        horizons = [cell('Sell', `Trim from ${row.weight.toFixed(0)}%`), cell('Sell', 'Reduce into strength'), cell('Hold', 'Core if sized well'), cell('Hold', 'Core position')];
        commentary = `${row.name} is ${row.weight.toFixed(0)}% of the book — above single-name comfort. Trim toward 10–15% and redeploy into broad exposure.`;
      } else if (row.gainPct >= 30 && row.assetType === 'equity') {
        horizons = [cell('Sell', 'Trim into strength'), cell('Hold', 'Add only on pullbacks'), cell('Hold', 'Core grower if sized'), cell('Hold', 'Core position')];
        commentary = `Up ${row.gainPct.toFixed(0)}% vs cost — harvest some gains and let the remainder compound; avoid chasing at highs.`;
      } else if (row.gainPct < 0 && row.assetType === 'equity') {
        horizons = [cell('Hold', 'Avoid averaging blindly'), cell('Buy', 'Add on conviction'), cell('Hold', 'Steady grower'), cell('Hold', 'Core position')];
        commentary = `${row.name} sits below cost — review the thesis; add only on conviction, and consider tax-loss harvesting if it stays weak.`;
      } else if (row.assetType === 'bond') {
        horizons = [cell('Hold', 'Hold'), cell('Hold', 'Maintain'), cell('Buy', 'Top up ballast'), cell('Hold', 'Core ballast')];
        commentary = `Portfolio ballast with steady income — maintain near the ${target['Fixed Income']}% mandate weight.`;
      } else if (row.assetType === 'etf') {
        horizons = [cell('Hold', 'Hold / buy dips'), cell('Buy', 'Accumulate'), cell('Hold', 'Core'), cell('Hold', 'Core')];
        commentary = 'Broad, low-cost market exposure — an ideal core building block and a buy-the-dip vehicle.';
      } else {
        horizons = [cell('Hold', 'Hold'), cell('Hold', 'Add on weakness'), cell('Hold', 'Steady grower'), cell('Hold', 'Core position')];
        commentary = 'Quality single-name; hold as a core position and diversify single-stock risk over time.';
      }
      return { ticker: row.ticker, org: row.name, fit: fitCodes(row), weight: row.weight, horizons, commentary };
    }),
  };
}

function PlanTable({ rows }) {
  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--ai-line)' }}>
      <div className="row gap-8" style={{ marginBottom: 10 }}>
        <Icon name="grid" size={14} color="var(--ai)" />
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>Buy / Hold / Sell plan by horizon</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 66 }}>TCKR</th>
              <th style={{ width: 138 }}>Org Name</th>
              <th style={{ width: 78 }}>Fit</th>
              {['0–3m', '3–6m', '6–12m', '12+ mo'].map((h) => (
                <th key={h} style={{ textAlign: 'center', width: 116 }}>{h}</th>
              ))}
              <th>Commentary</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ticker} style={{ cursor: 'default' }}>
                <td style={{ verticalAlign: 'top' }}><span className="ticker">{r.ticker}</span></td>
                <td style={{ verticalAlign: 'top' }}>
                  <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>{r.org}</div>
                  <div className="tiny muted" style={{ marginTop: 2 }}>{r.weight.toFixed(1)}% of book</div>
                </td>
                <td style={{ verticalAlign: 'top' }}>
                  <span className="mono tiny" style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{r.fit}</span>
                </td>
                {r.horizons.map((h, i) => (
                  <td key={i} style={{ verticalAlign: 'top', textAlign: 'center' }}>
                    <ActionPill action={h.action} />
                    <div className="tiny muted" style={{ marginTop: 5, lineHeight: 1.35 }}>{h.note}</div>
                  </td>
                ))}
                <td style={{ verticalAlign: 'top' }}>
                  <div className="tiny" style={{ color: 'var(--ink-2)', lineHeight: 1.45 }}>{r.commentary}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row gap-12 wrap tiny muted" style={{ marginTop: 14 }}>
        <span className="pill pill-pos" style={{ minWidth: 40, justifyContent: 'center' }}>Buy</span>
        <span className="pill pill-hold" style={{ minWidth: 40, justifyContent: 'center' }}>Hold</span>
        <span className="pill pill-neg" style={{ minWidth: 40, justifyContent: 'center' }}>Sell</span>
        <span style={{ marginLeft: 8 }}>Fit: G growth · V value · I income · X index · C contrarian</span>
      </div>
    </div>
  );
}

const rebalCache = new Map();

export default function Dashboard() {
  const client = useActiveClient();
  const loading = useStore((s) => s.loadingClients);
  const nav = useNavigate();
  const [showPlan, setShowPlan] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [tab, setTab] = useState('stocks');
  const [pis, setPis] = useState([]);
  const [pisLoading, setPisLoading] = useState(false);

  useEffect(() => {
    const id = client?.id;
    if (!id) { setPis([]); return; }
    setPisLoading(true);
    api(`/api/private-investments?clientId=${encodeURIComponent(id)}`)
      .then((r) => setPis(Array.isArray(r) ? r : []))
      .catch(() => setPis([]))
      .finally(() => setPisLoading(false));
  }, [client?.id]);

  useEffect(() => {
    const id = client?.id;
    if (!id) { setShowPlan(false); setSummary(null); return; }
    const cached = rebalCache.get(id) ?? localStorage.getItem(`rebal_${id}`);
    if (cached) { rebalCache.set(id, cached); setSummary(cached); setShowPlan(true); }
    else { setShowPlan(false); setSummary(null); }
  }, [client?.id]);

  const runRebalance = async () => {
    if (!client) return;
    setAnalysing(true);
    const minWait = new Promise((r) => setTimeout(r, 8000));
    try {
      const { summary: s } = await api(`/api/rebalance/${client.id}`);
      await minWait;
      setSummary(s ?? null);
      if (s) { rebalCache.set(client.id, s); localStorage.setItem(`rebal_${client.id}`, s); }
    } catch {
      await minWait;
      setSummary(null);
    } finally {
      setAnalysing(false);
      setShowPlan(true);
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ display: 'grid', placeItems: 'center', minHeight: 'calc(100vh - 160px)' }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <div className="serif" style={{ fontSize: 22, fontWeight: 500, marginBottom: 8 }}>Loading your portfolio</div>
          <p className="muted" style={{ fontSize: 14, margin: '0 0 28px' }}>Fetching clients and portfolio data…</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
            <div className="load-dot" /><div className="load-dot" /><div className="load-dot" />
          </div>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <EmptyState
        title="No clients yet"
        body="Onboard your first client to start building portfolios, tracking performance, and surfacing AI-powered insights."
        action={<button className="btn btn-primary btn-lg" onClick={() => nav('/manage')}><Icon name="sparkle" size={15} color="#fff" /> Onboard first client</button>}
        footnote="Takes less than a minute to set up"
      />
    );
  }

  const pf = client.portfolio;
  const stats = portfolioStats(pf);
  const alloc = Object.entries(allocationByType(stats.rows)).map(([label, value]) => ({
    label, value, color: TYPE_COLOR[label] ?? TYPE_COLOR.Other,
  }));
  const piByCat = {};
  pis.forEach((p) => { const c = p.assetCategory || 'Other'; piByCat[c] = (piByCat[c] || 0) + (p.currentPrice || 0); });
  Object.entries(piByCat).forEach(([label, value]) =>
    alloc.push({ label, value, color: PI_CATEGORY_COLOR[label] ?? PI_CATEGORY_COLOR.Other }));
  alloc.sort((a, b) => b.value - a.value);
  const allocTotal = alloc.reduce((s, a) => s + a.value, 0);

  const piValue = pis.reduce((s, p) => s + (p.currentPrice || 0), 0);
  const piCost = pis.reduce((s, p) => s + (p.avgPrice || 0), 0);
  const hasPis = pis.length > 0;
  const totalAum = stats.value + piValue;
  const totalGain = stats.gain + (piValue - piCost);
  const totalCost = stats.cost + piCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
  const piGainPct = piCost > 0 ? ((piValue - piCost) / piCost) * 100 : 0;
  const activeTab = hasPis ? tab : 'stocks';
  const plan = buildPlan(client, stats);

  return (
    <div className="page">
      <div className="container">
        <div className="row wrap gap-16" style={{ justifyContent: 'space-between', marginBottom: 26 }}>
          <div className="row gap-10 wrap">
            <h1 className="page-h serif">{client.name}</h1>
            <RiskPill risk={client.risk} />
            <span className="pill pill-gray">{pf.strategy} strategy</span>
          </div>
        </div>

        <div className={'stats-grid' + (hasPis ? '' : ' even')}>
          <div className="stat">
            <div style={{ position: 'absolute', inset: 0, opacity: 0.06, background: 'radial-gradient(ellipse at 80% 20%, var(--brand) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div className="stat-label">Total AUM</div>
            <div className="stat-body">
              <div className="row gap-10" style={{ marginTop: 6 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: 'var(--brand-soft)', display: 'grid', placeItems: 'center' }}>
                  <Icon name="bank" size={16} color="var(--brand)" sw={1.8} />
                </div>
                <div className="stat-value" style={{ lineHeight: 1.1 }}>{fmtUsd(totalAum, 0)}</div>
              </div>
              {hasPis && (
                <div className="col gap-6" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                  <div className="row gap-8" style={{ fontSize: 12.5 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--brand-soft)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Icon name="trend" size={12} color="var(--brand)" />
                    </span>
                    <span className="muted grow">Stocks</span>
                    <span className="tnum" style={{ fontWeight: 600 }}>{fmtUsd(stats.value, 0)}</span>
                  </div>
                  <div className="row gap-8" style={{ fontSize: 12.5 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--ai-soft)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Icon name="bank" size={12} color="var(--ai)" />
                    </span>
                    <span className="muted grow">Other investments</span>
                    <span className="tnum" style={{ fontWeight: 600 }}>{fmtUsd(piValue, 0)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="stat">
            <div style={{ position: 'absolute', inset: 0, opacity: 0.06, background: `radial-gradient(ellipse at 80% 20%, var(--${totalGain >= 0 ? 'pos' : 'neg'}) 0%, transparent 70%)`, pointerEvents: 'none' }} />
            <div className="stat-label">Total Return</div>
            <div className="stat-body">
              <div className="row gap-10" style={{ marginTop: 6 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: totalGain >= 0 ? 'var(--pos-soft)' : 'var(--neg-soft)', display: 'grid', placeItems: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke={totalGain >= 0 ? 'var(--pos)' : 'var(--neg)'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points={totalGain >= 0 ? '4,13 10,6 16,13' : '4,7 10,14 16,7'} />
                  </svg>
                </div>
                <div>
                  <div className={'stat-value ' + (totalGain >= 0 ? 'pos' : 'neg')} style={{ lineHeight: 1.1 }}>
                    {totalGain >= 0 ? '+' : '−'}{fmtUsd(Math.abs(totalGain), 0)}
                  </div>
                  <div className="row gap-4" style={{ marginTop: 3 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.02em',
                      color: totalGain >= 0 ? 'var(--pos)' : 'var(--neg)',
                      background: totalGain >= 0 ? 'var(--pos-soft)' : 'var(--neg-soft)',
                      padding: '1px 7px', borderRadius: 20,
                    }}>
                      {totalGain >= 0 ? '▲' : '▼'} {Math.abs(totalGainPct).toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
              {hasPis && (
                <div className="col gap-6" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                  <div className="row gap-8" style={{ fontSize: 12.5 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--brand-soft)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Icon name="trend" size={12} color="var(--brand)" />
                    </span>
                    <span className="muted grow">Stocks</span>
                    <span className={'tnum ' + (stats.gain >= 0 ? 'pos' : 'neg')} style={{ fontWeight: 600 }}>{fmtPct(stats.gainPct)}</span>
                  </div>
                  <div className="row gap-8" style={{ fontSize: 12.5 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--ai-soft)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Icon name="bank" size={12} color="var(--ai)" />
                    </span>
                    <span className="muted grow">Other investments</span>
                    <span className={'tnum ' + (piValue - piCost >= 0 ? 'pos' : 'neg')} style={{ fontWeight: 600 }}>{fmtPct(piGainPct)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="stat">
            <div className="stat-label" style={{ marginBottom: 12 }}>Asset Allocation</div>
            <div className="stat-body">
              {alloc.length === 0 ? (
                <div className="empty tiny">No allocation data yet.</div>
              ) : (
                <div className="col gap-10">
                  {alloc.map((a) => {
                    const pct = allocTotal ? (a.value / allocTotal) * 100 : 0;
                    return (
                      <div key={a.label} className="col gap-4">
                        <div className="row gap-8" style={{ fontSize: 12.5 }}>
                          <span className="dot" style={{ background: a.color }} />
                          <span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.label}</span>
                          <span className="tnum muted" style={{ fontWeight: 600 }}>{pct.toFixed(0)}%</span>
                        </div>
                        <div className="tip" data-tip={`${a.label} · ${fmtUsd(a.value, 0)}`}
                          style={{ height: 8, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: a.color, borderRadius: 999, transition: 'width .4s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card card-pad">
          <div className="card-head">
            <div>
              <div className="card-title">Holdings</div>
              <div className="card-sub">
                {activeTab === 'stocks'
                  ? `${stats.count} position${stats.count !== 1 ? 's' : ''} · edit in Manage Portfolios`
                  : `${pis.length} other investment${pis.length !== 1 ? 's' : ''} · edit in Manage Portfolios`}
              </div>
            </div>
            {hasPis && (
              <div className="seg" style={{ display: 'flex' }}>
                <button className={activeTab === 'stocks' ? 'on' : ''} onClick={() => setTab('stocks')}>Stocks</button>
                <button className={activeTab === 'private' ? 'on' : ''} onClick={() => setTab('private')}>Other investments</button>
              </div>
            )}
          </div>

          {activeTab === 'private' ? (
            pisLoading ? <div className="empty">Loading other investments…</div>
            : pis.length === 0 ? <div className="empty">No other investments yet. Add one from the Manage tab.</div>
            : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Asset Type</th><th>Category</th><th>Avg Price</th>
                    <th>Current Price</th><th>Return %</th><th>Weight %</th>
                  </tr>
                </thead>
                <tbody>
                  {pis.map((p) => {
                    const ret = p.avgPrice > 0 ? ((p.currentPrice - p.avgPrice) / p.avgPrice) * 100 : 0;
                    const w = piValue > 0 ? (p.currentPrice / piValue) * 100 : 0;
                    return (
                      <tr key={p.id} style={{ cursor: 'default' }}>
                        <td style={{ fontWeight: 600 }}>{p.assetType || '—'}</td>
                        <td>{p.assetCategory ? <span className="pill pill-gray" style={{ fontSize: 11.5, padding: '2px 8px' }}>{p.assetCategory}</span> : <span className="muted tiny">—</span>}</td>
                        <td className="tnum muted">{p.avgPrice > 0 ? fmtUsd(p.avgPrice) : '—'}</td>
                        <td className="tnum" style={{ fontWeight: 600 }}>{fmtUsd(p.currentPrice)}</td>
                        <td className={'tnum ' + (ret >= 0 ? 'pos' : 'neg')} style={{ fontWeight: 600 }}>{fmtPct(ret, 1)}</td>
                        <td className="tnum muted">{w.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : stats.rows.length === 0 ? (
            <div className="empty">No holdings yet. Add a holding from the Manage tab.</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Symbol</th><th>Type</th><th>Qty</th><th>Avg Price</th><th>Current Price</th>
                  <th>Return %</th><th>Weight %</th><th>Analyst Rec.</th><th>Median Target</th>
                </tr>
              </thead>
              <tbody>
                {stats.rows.map((r) => (
                  <tr key={r.id} style={{ cursor: 'default' }}>
                    <td>
                      <div className="row gap-10">
                        <span className="ticker">{r.ticker}</span>
                        <span className="tkr-name" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                      </div>
                    </td>
                    <td>{r.assetType ? <span className="pill pill-gray" style={{ fontSize: 11.5, padding: '2px 8px' }}>{r.assetType}</span> : <span className="muted tiny">—</span>}</td>
                    <td className="tnum">{fmtNum(r.qty)}</td>
                    <td className="tnum muted">{r.avgCost > 0 ? fmtUsd(r.avgCost) : '—'}</td>
                    <td className="tnum" style={{ fontWeight: 600 }}>{fmtUsd(r.price)}</td>
                    <td className={'tnum ' + (r.gain >= 0 ? 'pos' : 'neg')} style={{ fontWeight: 600 }}>{fmtPct(r.gainPct, 1)}</td>
                    <td className="tnum muted">{r.weight.toFixed(1)}%</td>
                    <td><AnalystRec rec={r.analystRec} assetType={r.assetType} /></td>
                    <td className="tnum">
                      {r.assetType === 'etf' ? <NaTip tip="ETF price follows the underlying index — no price target" />
                        : r.assetType === 'bond' ? <NaTip tip="Bond return is based on coupon & par value — no price target" />
                        : r.medianTarget != null ? fmtUsd(r.medianTarget) : <span className="muted tiny">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <NewsFeed tickers={stats.rows.map((r) => r.ticker)} />

        <div className="card card-pad" style={{ marginTop: 16, borderColor: 'var(--ai-line)', background: 'linear-gradient(180deg, var(--ai-soft) 0%, var(--surface) 38%)' }}>
          <div className="card-head" style={{ marginBottom: showPlan || analysing ? 4 : 0 }}>
            <div className="row gap-10">
              <div className="insight-icon" style={{ background: 'var(--ai)', boxShadow: 'var(--shadow-sm)' }}>
                <Icon name="sparkle" size={16} color="#fff" />
              </div>
              <div>
                <div className="card-title">AI Portfolio Rebalancing</div>
                <div className="card-sub">Risk-aware analysis for {client.name}'s {pf.name}</div>
              </div>
            </div>
            {plan && (
              <button className="btn btn-sm btn-ai-solid" onClick={runRebalance} disabled={analysing}>
                {analysing
                  ? (<><span className="spin spin-ai" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> Analysing…</>)
                  : (<><Icon name="grid" size={13} color="#fff" /> {showPlan ? 'Refresh plan' : 'Rebalance plan'}</>)}
              </button>
            )}
          </div>
          {analysing && <AiThinking messages={REBAL_MESSAGES} cadence={1800} />}
          {showPlan && summary && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--ai-line)' }}>
              <div className="row gap-8" style={{ marginBottom: 12 }}>
                <Icon name="sparkle" size={14} color="var(--ai)" />
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>AI Portfolio Commentary</span>
              </div>
              <SectionedSummary summary={summary} />
            </div>
          )}
          {showPlan && plan && <PlanTable rows={plan.rows} />}
        </div>
      </div>
    </div>
  );
}
