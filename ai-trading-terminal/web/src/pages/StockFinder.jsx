import React, { useState } from 'react';
import { api } from '../lib/api';
import { fmtUsd, fmtBigUsd } from '../lib/format';
import { AiThinking } from '../components/ui';
import SimulatedNotice from '../components/SimulatedNotice';
import AddToPortfolio from '../components/AddToPortfolio';

const MESSAGES = ['Interpreting your query…', 'Scanning the universe…', 'Applying filters…', 'Ranking matches…'];
const MAX_LEN = 500;

const COLUMN_LABELS = {
  ticker: 'Ticker', name: 'Name', sector: 'Sector', industry: 'Industry', country: 'Country',
  exchange: 'Exchange', price: 'Price', market_cap_usd: 'Mkt Cap', dividend_yield_pct: 'Div %',
  pe_trailing: 'P/E', pe_forward: 'P/E (f)', eps_growth_y1_pct: 'EPS Gr Y1 %',
  revenue_growth_y1_pct: 'Rev Gr Y1 %', profit_margin_pct: 'Margin %', beta: 'Beta',
  analyst_rating: 'Rating', match_reason: 'Match Reason', ytd_pct: 'YTD %',
};
const TEXT_COLS = new Set(['ticker', 'name', 'sector', 'industry', 'country', 'exchange', 'analyst_rating', 'match_reason']);

const colLabel = (c) =>
  COLUMN_LABELS[c] ?? c.replace(/_usd$/i, '').replace(/_pct$/i, ' %').replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());

function cellValue(col, v) {
  if (v == null || v === '') return '-';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  const isNum = typeof n === 'number' && Number.isFinite(n) && !TEXT_COLS.has(col);
  if (!isNum) return String(v);
  if (/market_cap|_cap/i.test(col)) return fmtBigUsd(n);
  if (col === 'price' || /_low$|_high$/.test(col)) return fmtUsd(n, 2);
  if (/^pe_/.test(col)) return n.toFixed(1);
  if (col === 'beta') return n.toFixed(2);
  return String(Number(n.toFixed(2)));
}

export default function StockFinder() {
  const [q, setQ] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = () => {
    const query = q.trim();
    if (!query) return;
    setLoading(true);
    setError('');
    api(`/api/screener?query=${encodeURIComponent(query)}`)
      .then(setResult)
      .catch((e) => { setResult(null); setError(e.message || "Couldn't run Stock Finder. Please try again."); })
      .finally(() => setLoading(false));
  };

  const screen = result?.screen ?? {};
  const rows = Array.isArray(result?.results) ? result.results : [];
  const count = typeof result?.count === 'number' ? result.count : rows.length;
  const dropped = typeof result?.dropped_by_filter === 'number' ? result.dropped_by_filter : 0;
  const notes = Array.isArray(result?.notes) ? result.notes : [];
  let columns = Array.isArray(result?.columns) && result.columns.length ? result.columns.map(String) : [];
  if (!columns.length && rows.length) columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];

  const th = { padding: '9px 12px', textAlign: 'center', fontSize: 12.5, fontWeight: 700, color: '#fff', background: 'oklch(0.36 0.06 250)', borderRight: '1px solid oklch(0.5 0.05 250)', whiteSpace: 'nowrap' };
  const td = { padding: '8px 12px', fontSize: 12.5, borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)' };

  return (
    <div className="page">
      <div className="container">
        <div style={{ marginBottom: 24 }}>
          <div className="row gap-10" style={{ flexWrap: 'wrap' }}>
            <h1 className="page-h">Stock Finder</h1>
            <span className="pill pill-neg">Beta</span>
          </div>
          <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
            Describe the stocks you're looking for in plain English and let the AI Stock Finder match them.
          </div>
        </div>
        <SimulatedNotice what="fundamentals (market cap, P/E, growth, yield) and ratings" />

        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <textarea className="input" style={{ width: '100%', minHeight: 60, resize: 'vertical', fontSize: 14.5, lineHeight: 1.5 }}
            placeholder="e.g. US-listed technology companies with strong revenue growth and a market cap above $10B…"
            value={q} maxLength={MAX_LEN}
            onChange={(e) => setQ(e.target.value.slice(0, MAX_LEN))}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run(); }} />
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 6 }}>
            <span className="tiny muted">{q.length} / {MAX_LEN} characters</span>
          </div>
          <button className="btn btn-primary btn-block" style={{ marginTop: 12 }} onClick={run} disabled={!q.trim() || loading}>
            {loading ? 'Finding…' : 'Find Stocks'}
          </button>
        </div>

        {loading && (
          <div className="card card-pad" style={{ borderColor: 'var(--ai-line)', background: 'linear-gradient(180deg, var(--ai-soft) 0%, var(--surface) 40%)' }}>
            <AiThinking messages={MESSAGES} />
          </div>
        )}
        {!loading && error && <div className="card card-pad"><div className="empty">{error}</div></div>}
        {!loading && !error && result != null && rows.length > 0 && (
          <div className="col gap-16">
            <div className="card card-pad">
              <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 17 }}>
                Stock Finder
                <span className="muted" style={{ fontWeight: 600 }}>
                  {' '}· {count} of {count + dropped} match{count + dropped !== 1 ? 'es' : ''}
                  {screen.as_of ? ` · as of ${screen.as_of}` : ''}
                </span>
              </div>
              {screen.universe && (
                <div className="muted" style={{ textAlign: 'center', fontSize: 12.5, fontStyle: 'italic', marginTop: 6 }}>{screen.universe}</div>
              )}
              <div style={{ marginTop: 16, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--line)' }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, width: 96, position: 'sticky', left: 0, zIndex: 1 }}></th>
                      {columns.map((c) => <th key={c} style={{ ...th, textAlign: TEXT_COLS.has(c) ? 'left' : 'center' }}>{colLabel(c)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} style={{ background: i % 2 ? 'oklch(0.98 0.006 250)' : 'var(--surface)' }}>
                        <td style={{ ...td, textAlign: 'center', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: i % 2 ? 'oklch(0.98 0.006 250)' : 'var(--surface)' }}>
                          <AddToPortfolio ticker={r.ticker} name={r.name} />
                        </td>
                        {columns.map((c) => (
                          <td key={c} className={TEXT_COLS.has(c) ? '' : 'tnum'}
                            style={{
                              ...td, textAlign: TEXT_COLS.has(c) ? 'left' : 'center',
                              fontWeight: c === 'name' ? 600 : 500,
                              whiteSpace: c === 'match_reason' ? 'normal' : 'nowrap',
                              minWidth: c === 'match_reason' ? 240 : undefined,
                              fontFamily: c === 'ticker' ? 'var(--font-mono)' : undefined,
                            }}>
                            {cellValue(c, r[c])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {notes.length > 0 && (
              <div className="card card-pad">
                <div className="card-title" style={{ marginBottom: 10 }}>Notes</div>
                <div className="col gap-8">
                  {notes.map((n, i) => (
                    <div key={i} className="row gap-8" style={{ alignItems: 'flex-start' }}>
                      <span className="muted" style={{ flexShrink: 0 }}>•</span>
                      <span style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink-2)' }}>{n}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
