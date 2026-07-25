import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { fmtUsd, fmtPct, fmtBigUsd } from '../lib/format';
import { Icon, AiThinking } from '../components/ui';

const MESSAGES = [
  'Pulling comparable multiples…',
  'Running DCF scenarios…',
  'Assembling valuation ranges…',
  'Plotting the football field…',
];

const METHOD_COLORS = [
  { test: /52|week|range/i, color: 'oklch(0.66 0.12 250)' },
  { test: /dcf/i, color: 'oklch(0.66 0.15 150)' },
  { test: /p\/e|pe\b|forward/i, color: 'oklch(0.72 0.15 55)' },
  { test: /ebitda|ev/i, color: 'oklch(0.52 0.16 300)' },
  { test: /analyst|target/i, color: 'oklch(0.63 0.20 25)' },
];
const FALLBACK_COLORS = ['oklch(0.66 0.12 250)', 'oklch(0.66 0.15 150)', 'oklch(0.72 0.15 55)', 'oklch(0.52 0.16 300)', 'oklch(0.63 0.20 25)', 'oklch(0.62 0.1 190)'];
const methodColor = (name, i) => METHOD_COLORS.find((m) => m.test.test(name))?.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length];

const money = (v) => (v == null ? '—' : fmtUsd(v, 0));

function ticks(min, max, count = 7) {
  const raw = (max - min || 1) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

function normalise(result) {
  if (!result?.football_fields) return { panels: [], takeaways: [], sources: [] };
  const uni = new Map((result.universe ?? []).map((u) => [String(u.ticker), u]));
  const score = new Map((result.scorecard ?? []).map((s) => [String(s.ticker), s]));
  const panels = Object.entries(result.football_fields).map(([ticker, ff]) => {
    const ranges = Object.entries(ff?.methods ?? {})
      .map(([key, m]) => {
        const low = Number(m?.low), high = Number(m?.high);
        if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
        return { name: String(m?.label ?? key), low: Math.min(low, high), high: Math.max(low, high), mark: Number.isFinite(Number(m?.mark)) ? Number(m.mark) : null };
      })
      .filter(Boolean);
    return {
      ticker,
      name: uni.get(ticker)?.name ?? score.get(ticker)?.name,
      current: Number.isFinite(Number(score.get(ticker)?.current_price)) ? Number(score.get(ticker).current_price) : null,
      ranges,
      score: score.get(ticker),
    };
  });
  return { panels, takeaways: result.takeaways ?? [], sources: result.sources ?? [] };
}

const LABEL_W = 132;

function FootballField({ panel }) {
  const values = [
    ...panel.ranges.flatMap((r) => [r.low, r.high, ...(r.mark != null ? [r.mark] : [])]),
    ...(panel.current != null ? [panel.current] : []),
  ];
  const lo = Math.min(...values), hi = Math.max(...values);
  const pad = (hi - lo) * 0.1 || Math.abs(hi) * 0.1 || 1;
  const min = lo - pad, max = hi + pad, span = max - min || 1;
  const x = (v) => ((v - min) / span) * 100;
  const axis = ticks(min, max).filter((t) => t >= min && t <= max);

  return (
    <div className="card card-pad">
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, marginBottom: 18 }}>
        {panel.name ?? panel.ticker} ({panel.ticker})
        {panel.current != null && <span className="muted" style={{ fontWeight: 600 }}> · Current: {money(panel.current)}</span>}
      </div>
      {panel.ranges.length === 0 ? (
        <div className="empty tiny">No valuation ranges returned for this ticker.</div>
      ) : (
        <>
          <div style={{ position: 'relative' }}>
            <div className="col" style={{ gap: 6 }}>
              {panel.ranges.map((r, i) => (
                <div key={r.name + i} className="row" style={{ height: 30 }}>
                  <div style={{ width: LABEL_W, flexShrink: 0, textAlign: 'right', paddingRight: 10, fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)' }}>
                    {r.name}
                  </div>
                  <div style={{ flex: 1, position: 'relative', height: '100%' }}>
                    <div style={{
                      position: 'absolute', top: '50%', transform: 'translateY(-50%)', height: 20,
                      left: `${x(r.low)}%`, width: `${Math.max(x(r.high) - x(r.low), 0.6)}%`,
                      background: methodColor(r.name, i), borderRadius: 4,
                    }} />
                    <span className="tnum" style={{ position: 'absolute', top: '50%', left: `${x(r.low)}%`, transform: 'translate(calc(-100% - 6px), -50%)', fontSize: 10.5, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                      {money(r.low)}
                    </span>
                    <span className="tnum" style={{ position: 'absolute', top: '50%', left: `${x(r.high)}%`, transform: 'translate(6px, -50%)', fontSize: 10.5, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
                      {money(r.high)}
                    </span>
                    {r.mark != null && (
                      <span style={{ position: 'absolute', top: '50%', left: `${x(r.mark)}%`, transform: 'translate(-50%, -50%)', width: 9, height: 9, borderRadius: '50%', background: 'var(--ink)', border: '1.5px solid var(--surface)', zIndex: 2 }} />
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <div style={{ width: LABEL_W, flexShrink: 0 }} />
              <div style={{ flex: 1, position: 'relative', height: 30, borderTop: '1px solid var(--line)' }}>
                {axis.map((t) => (
                  <div key={t} style={{ position: 'absolute', left: `${x(t)}%`, top: 0, transform: 'translateX(-50%)', textAlign: 'center' }}>
                    <div style={{ width: 1, height: 5, background: 'var(--line-2)', margin: '0 auto' }} />
                    <div className="tnum muted" style={{ fontSize: 10, marginTop: 2 }}>{t}</div>
                  </div>
                ))}
              </div>
            </div>
            {panel.current != null && (
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: LABEL_W, right: 0, pointerEvents: 'none', zIndex: 4 }}>
                <div style={{ position: 'absolute', top: -2, bottom: 34, left: `${x(panel.current)}%`, borderLeft: '2px dashed var(--neg)' }} />
                <div style={{ position: 'absolute', bottom: 8, left: `${x(panel.current)}%`, transform: 'translateX(-50%)', fontSize: 10.5, fontWeight: 700, color: 'var(--neg)', background: 'var(--surface)', padding: '0 4px', whiteSpace: 'nowrap' }}>
                  Current: {money(panel.current)}
                </div>
              </div>
            )}
          </div>
          <div className="muted" style={{ textAlign: 'center', fontSize: 11.5, marginTop: 10 }}>Implied Share Price (USD)</div>
        </>
      )}
    </div>
  );
}

const upside = (pct) => (pct == null ? '' : ` (${fmtPct(pct, 0)})`);
const METRICS = [
  { label: 'Current Price', get: (s) => money(s.current_price) },
  { label: 'DCF Implied Price', get: (s) => (s.dcf_implied_price != null ? money(s.dcf_implied_price) + upside(s.dcf_upside_pct) : '—'), tone: (s) => (s.dcf_upside_pct == null ? undefined : s.dcf_upside_pct >= 0 ? 'pos' : 'neg') },
  { label: 'Analyst Consensus', get: (s) => s.analyst_rating ?? '—' },
  { label: 'Avg Analyst Target', get: (s) => (s.avg_analyst_target != null ? money(s.avg_analyst_target) + upside(s.avg_target_upside_pct) : '—'), tone: (s) => (s.avg_target_upside_pct == null ? undefined : s.avg_target_upside_pct >= 0 ? 'pos' : 'neg') },
  { label: 'Target Range', get: (s) => (s.target_range_low != null && s.target_range_high != null ? `${money(s.target_range_low)} – ${money(s.target_range_high)}` : '—') },
  { label: 'Forward P/E', get: (s) => (s.forward_pe != null ? `${Number(s.forward_pe).toFixed(0)}x` : '—') },
  { label: 'PEG Ratio', get: (s) => (s.peg_ratio != null ? `${Number(s.peg_ratio).toFixed(2)}x` : '—') },
  { label: 'EV/EBITDA (TTM)', get: (s) => (s.ev_ebitda_ttm != null ? `${Number(s.ev_ebitda_ttm).toFixed(0)}x` : '—') },
  { label: 'Beta', get: (s) => (s.beta != null ? Number(s.beta).toFixed(2) : '—') },
  { label: 'Revenue Growth Y1', get: (s) => (s.revenue_growth_y1_pct != null ? `${Number(s.revenue_growth_y1_pct).toFixed(0)}%` : '—') },
  { label: 'Market Cap', get: (s) => fmtBigUsd(s.market_cap_usd) },
  { label: 'Key Moat', get: (s) => s.key_moat ?? '—' },
  { label: 'Key Risk', get: (s) => s.key_risk ?? '—' },
];

function Scorecard({ panels }) {
  const scored = panels.filter((p) => p.score);
  if (!scored.length) return null;
  const th = { padding: '9px 12px', textAlign: 'center', fontSize: 12.5, fontWeight: 700, color: '#fff', background: 'oklch(0.36 0.06 250)', borderRight: '1px solid oklch(0.5 0.05 250)' };
  const td = { padding: '8px 12px', textAlign: 'center', fontSize: 12.5, borderRight: '1px solid var(--line)', borderBottom: '1px solid var(--line)' };
  const rowHead = { ...td, textAlign: 'left', fontWeight: 600, background: 'oklch(0.96 0.012 250)', color: 'var(--ink-2)' };
  return (
    <div className="card card-pad">
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Valuation Comparison Scorecard</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--line)' }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>Metric</th>
              {scored.map((p) => <th key={p.ticker} style={th}>{p.ticker}</th>)}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m, i) => (
              <tr key={m.label} style={{ background: i % 2 ? 'oklch(0.98 0.006 250)' : 'var(--surface)' }}>
                <td style={rowHead}>{m.label}</td>
                {scored.map((p) => {
                  const tone = m.tone?.(p.score);
                  return (
                    <td key={p.ticker} className={'tnum' + (tone ? ' ' + tone : '')} style={{ ...td, fontWeight: tone ? 600 : 500 }}>
                      {m.get(p.score)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Valuation() {
  const [stocks, setStocks] = useState([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/stocks').then((r) => setStocks(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  const needle = q.trim().toLowerCase();
  const chosen = new Set(selected.map((s) => s.ticker));
  const matches = needle
    ? stocks.filter((s) => !chosen.has(s.ticker) && (s.ticker.toLowerCase().includes(needle) || s.name.toLowerCase().includes(needle))).slice(0, 8)
    : [];

  const add = (s) => { setSelected((xs) => (xs.some((x) => x.ticker === s.ticker) ? xs : [...xs, s])); setQ(''); setOpen(false); };

  const run = () => {
    if (!selected.length) return;
    setLoading(true);
    setError('');
    api(`/api/valuation?tickers=${encodeURIComponent(selected.map((s) => s.ticker).join(','))}`)
      .then(setResult)
      .catch((e) => { setResult(null); setError(e.message || "Couldn't fetch the valuation. Please try again."); })
      .finally(() => setLoading(false));
  };

  const view = result ? normalise(result) : null;
  const title = view?.panels.map((p) => p.ticker).join(' vs ');

  return (
    <div className="page">
      <div className="container">
        <div style={{ marginBottom: 24 }}>
          <div className="row gap-10" style={{ flexWrap: 'wrap' }}>
            <h1 className="page-h">Football Field Valuation</h1>
            <span className="pill pill-neg">Beta</span>
          </div>
          <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
            Search one or more securities and compare their valuation ranges side by side.
          </div>
        </div>

        <div className="card card-pad" style={{ marginBottom: 16, overflow: 'visible' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <Icon name="search" size={18} color="var(--ink-4)" />
            </span>
            <input className="input" style={{ paddingLeft: 46, height: 50, fontSize: 15 }}
              placeholder="Search a ticker or company to add (e.g. AAPL or Apple)…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => { if (e.key === 'Enter' && matches[0]) add(matches[0]); }} />
            {open && matches.length > 0 && (
              <div className="card" style={{ position: 'absolute', top: 56, left: 0, right: 0, zIndex: 30, padding: 6, maxHeight: 320, overflowY: 'auto' }}>
                {matches.map((s) => (
                  <div key={s.ticker} className="sresult" style={{ cursor: 'pointer' }} onClick={() => add(s)}>
                    <span className="ticker" style={{ minWidth: 56 }}>{s.ticker}</span>
                    <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                    <span className="pill pill-gray">{s.type}</span>
                    <Icon name="plus" size={13} color="var(--ink-3)" />
                  </div>
                ))}
              </div>
            )}
          </div>
          {selected.length > 0 && (
            <div className="row gap-8 wrap" style={{ marginTop: 14 }}>
              {selected.map((s) => (
                <span key={s.ticker} className="row gap-6" style={{ padding: '6px 8px 6px 12px', border: '1px solid var(--line)', borderRadius: 999, background: 'var(--surface-2)' }}>
                  <span className="ticker" style={{ fontSize: 12 }}>{s.ticker}</span>
                  <button className="btn btn-icon btn-ghost" style={{ width: 20, height: 20, padding: 0 }}
                    onClick={() => setSelected((xs) => xs.filter((x) => x.ticker !== s.ticker))} aria-label={`Remove ${s.ticker}`}>
                    <Icon name="x" size={11} color="var(--ink-3)" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={run} disabled={selected.length === 0 || loading}>
            {loading ? 'Loading…' : 'Show Football Field Valuation'}
          </button>
        </div>

        {loading && (
          <div className="card card-pad" style={{ borderColor: 'var(--ai-line)', background: 'linear-gradient(180deg, var(--ai-soft) 0%, var(--surface) 40%)' }}>
            <AiThinking messages={MESSAGES} />
          </div>
        )}
        {!loading && error && <div className="card card-pad"><div className="empty">{error}</div></div>}
        {!loading && !error && view && view.panels.length > 0 && (
          <div className="col gap-16">
            <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 18, letterSpacing: '-0.01em' }}>
              Valuation Football Fields{title ? ` — ${title}` : ''}
            </div>
            {view.panels.map((p) => <FootballField key={p.ticker} panel={p} />)}
            <Scorecard panels={view.panels} />
            {view.takeaways.length > 0 && (
              <div className="card card-pad" style={{ borderColor: 'var(--ai-line)', background: 'linear-gradient(180deg, var(--ai-soft) 0%, var(--surface) 45%)' }}>
                <div className="row gap-10" style={{ marginBottom: 14, justifyContent: 'center' }}>
                  <div className="insight-icon" style={{ background: 'var(--ai)' }}><Icon name="sparkle" size={15} color="#fff" /></div>
                  <div className="card-title">Key Takeaways</div>
                </div>
                <div className="col gap-12">
                  {view.takeaways.map((t, i) => (
                    <div key={i} className="row gap-10" style={{ alignItems: 'flex-start' }}>
                      <span className="tnum" style={{ fontWeight: 700, color: 'var(--ai)', flexShrink: 0 }}>{i + 1}.</span>
                      <span style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink-2)' }}>{t}</span>
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
