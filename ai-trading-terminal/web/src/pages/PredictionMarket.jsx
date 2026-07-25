import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { fmtUsd, fmtPct, fmtNum } from '../lib/format';
import { Icon, AiThinking, TickerSearchBox } from '../components/ui';

const MESSAGES = [
  'Fetching analyst consensus & price targets…',
  'Scanning prediction markets…',
  'Reading sentiment, valuation & macro signals…',
  'Weighing competitor & industry dynamics…',
  'Synthesising the overall prediction…',
];

const DIMENSIONS = [
  { key: 'stock_sentiment', label: 'Stock Sentiment', icon: 'trend', accent: 'oklch(0.55 0.2 295)' },
  { key: 'valuation', label: 'Valuation', icon: 'bank', accent: 'oklch(0.55 0.14 250)' },
  { key: 'macro', label: 'Macro', icon: 'grid', accent: 'oklch(0.64 0.13 70)' },
  { key: 'industry', label: 'Industry', icon: 'users', accent: 'oklch(0.6 0.11 190)' },
  { key: 'competitor', label: 'Competitor', icon: 'users', accent: 'oklch(0.58 0.17 12)' },
];

const RATING_BUCKETS = [
  { key: 'strong_buy', label: 'Strong Buy', color: 'oklch(0.58 0.15 150)' },
  { key: 'buy', label: 'Buy', color: 'oklch(0.72 0.14 150)' },
  { key: 'hold', label: 'Hold', color: 'oklch(0.78 0.09 85)' },
  { key: 'sell', label: 'Sell', color: 'oklch(0.72 0.16 35)' },
  { key: 'strong_sell', label: 'Strong Sell', color: 'oklch(0.57 0.19 25)' },
];

const stanceColors = (stance) => {
  const s = (stance ?? '').toLowerCase();
  if (s.includes('bull')) return { color: 'var(--pos)', soft: 'var(--pos-soft)' };
  if (s.includes('bear')) return { color: 'var(--neg)', soft: 'var(--neg-soft)' };
  return { color: 'var(--ai)', soft: 'var(--ai-soft)' };
};
const stancePill = (stance) => {
  const s = (stance ?? '').toLowerCase();
  return s.includes('bull') ? 'pill pill-pos' : s.includes('bear') ? 'pill pill-neg' : 'pill pill-ai';
};

function StatBox({ label, value, color, sub }) {
  return (
    <div style={{ padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 12 }}>
      <div className="tiny muted" style={{ marginBottom: 4 }}>{label}</div>
      <div className="tnum" style={{ fontSize: 18, fontWeight: 700, color: color ?? 'var(--ink)', lineHeight: 1.1 }}>{value}</div>
      {sub && <div className="tiny muted" style={{ marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function RangeMarker({ pos, color, label, above }) {
  return (
    <div style={{ position: 'absolute', left: `${pos}%`, top: '50%', transform: 'translate(-50%, -50%)' }}>
      <div style={{ width: 14, height: 14, borderRadius: '50%', background: color, border: '2.5px solid var(--surface)', boxShadow: 'var(--shadow-sm)' }} />
      <div className="tiny tnum" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', ...(above ? { bottom: 16 } : { top: 16 }), whiteSpace: 'nowrap', fontWeight: 700, color }}>
        {label}
      </div>
    </div>
  );
}

function AnalystForecast({ af }) {
  const price = af.current_price ?? null;
  const avg = af.average_price_target ?? null;
  const upsidePct = price != null && avg != null && price > 0 ? ((avg - price) / price) * 100 : null;
  const upColor = upsidePct == null ? undefined : upsidePct >= 0 ? 'var(--pos)' : 'var(--neg)';
  const lo = af.low_price_target, hi = af.high_price_target;
  const hasRange = lo != null && hi != null && hi > lo;
  const clamp = (v) => (hasRange && v != null ? Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100)) : null);
  const counts = af.counts ?? {};
  const totalCounts = RATING_BUCKETS.reduce((s, b) => s + (counts[b.key] ?? 0), 0);
  const bull = af.bullish_pct ?? 0, neutral = af.neutral_pct ?? 0, bear = af.bearish_pct ?? 0;

  return (
    <div className="card card-pad">
      <div className="row gap-10 wrap" style={{ marginBottom: 16 }}>
        <div className="card-title">Analyst Forecast</div>
        {af.consensus_rating && <span className="pill pill-pos" style={{ fontSize: 12 }}>{af.consensus_rating} consensus</span>}
        {af.num_analysts != null && <span className="tiny muted" style={{ marginLeft: 'auto' }}>{fmtNum(af.num_analysts)} analysts</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 18 }}>
        {price != null && <StatBox label="Current price" value={fmtUsd(price)} />}
        {avg != null && <StatBox label="Avg target" value={fmtUsd(avg)} color={upColor} sub={upsidePct != null ? `${fmtPct(upsidePct)} vs current` : undefined} />}
        {af.median_price_target != null && <StatBox label="Median target" value={fmtUsd(af.median_price_target)} />}
        {af.recommendation_mean != null && <StatBox label="Rec. mean" value={af.recommendation_mean.toFixed(2)} sub="1 = Strong Buy · 5 = Sell" />}
      </div>
      {hasRange && (
        <div style={{ marginBottom: 20 }}>
          <div className="tiny muted" style={{ marginBottom: 10, fontWeight: 600 }}>Price target range</div>
          <div style={{ position: 'relative', height: 8, borderRadius: 999, background: 'linear-gradient(90deg, var(--neg-soft), var(--surface-3) 50%, var(--pos-soft))', margin: '18px 0' }}>
            {clamp(price) != null && <RangeMarker pos={clamp(price)} color="var(--ink)" label={`Now ${fmtUsd(price, 0)}`} above />}
            {clamp(avg) != null && <RangeMarker pos={clamp(avg)} color="var(--ai)" label={`Avg ${fmtUsd(avg, 0)}`} />}
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="tiny muted">Low {fmtUsd(lo, 0)}</span>
            <span className="tiny muted">High {fmtUsd(hi, 0)}</span>
          </div>
        </div>
      )}
      {bull + neutral + bear > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div className="tiny muted" style={{ marginBottom: 8, fontWeight: 600 }}>Analyst sentiment</div>
          <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', background: 'var(--surface-3)' }}>
            <div style={{ width: `${bull}%`, background: 'var(--pos)' }} />
            <div style={{ width: `${neutral}%`, background: 'oklch(0.8 0.04 250)' }} />
            <div style={{ width: `${bear}%`, background: 'var(--neg)' }} />
          </div>
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 7 }}>
            <span className="tiny" style={{ color: 'var(--pos)', fontWeight: 700 }}>{bull}% Bullish</span>
            <span className="tiny muted">{neutral}% Neutral</span>
            <span className="tiny" style={{ color: 'var(--neg)', fontWeight: 700 }}>{bear}% Bearish</span>
          </div>
        </div>
      )}
      {totalCounts > 0 && (
        <div>
          <div className="tiny muted" style={{ marginBottom: 8, fontWeight: 600 }}>Recommendation breakdown</div>
          <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', background: 'var(--surface-3)' }}>
            {RATING_BUCKETS.map((b) => {
              const c = counts[b.key] ?? 0;
              return c ? <div key={b.key} style={{ width: `${(c / totalCounts) * 100}%`, background: b.color }} title={`${b.label}: ${c}`} /> : null;
            })}
          </div>
          <div className="row gap-10 wrap" style={{ marginTop: 9 }}>
            {RATING_BUCKETS.map((b) => {
              const c = counts[b.key] ?? 0;
              return c ? (
                <span key={b.key} className="row gap-6">
                  <span className="dot" style={{ background: b.color }} />
                  <span className="tiny" style={{ fontWeight: 600 }}>{b.label} <b className="tnum">{c}</b></span>
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MarketCard({ m, accent }) {
  const outcomes = (m.outcomes ?? []).slice(0, 4);
  const outcomeColor = (name) => {
    const n = (name ?? '').toLowerCase();
    return n === 'yes' ? 'var(--pos)' : n === 'no' ? 'var(--neg)' : accent;
  };
  return (
    <div style={{ padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 10 }}>
      <div className="row gap-8" style={{ alignItems: 'flex-start' }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, lineHeight: 1.45 }}>
          {m.question ?? 'Prediction market'}
        </span>
        {m.level && <span className="pill pill-gray" style={{ fontSize: 10.5, flexShrink: 0 }}>{m.level}</span>}
      </div>
      {outcomes.length > 0 && (
        <div className="col gap-4" style={{ marginTop: 8 }}>
          {outcomes.map((o, i) => {
            const pct = o.probability_pct ?? 0;
            const c = outcomeColor(o.name);
            return (
              <div key={i} className="row gap-8">
                <span style={{ minWidth: 64, fontSize: 12, fontWeight: 600, color: c }}>{o.name ?? '—'}</span>
                <span style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}>
                  <span style={{ display: 'block', width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', background: c }} />
                </span>
                <span className="tnum" style={{ minWidth: 44, textAlign: 'right', fontSize: 12, fontWeight: 700, color: c }}>
                  {pct.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PredictionResult({ data }) {
  const stance = data.overall?.stance;
  const tone = stanceColors(stance);
  const meta = [data.sector, data.industry].filter(Boolean).join(' · ');
  const generated = data._meta?.generated_at
    ? new Date(data._meta.generated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';
  const sub = [meta, generated ? `as of ${generated}` : ''].filter(Boolean).join(' · ');
  const marketsFound = data._meta?.markets_found ?? 0;

  return (
    <div className="col gap-16">
      <div className="card card-pad" style={{ textAlign: 'center', background: `linear-gradient(180deg, ${tone.soft} 0%, var(--surface) 70%)`, borderColor: tone.color }}>
        <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: '-0.02em' }}>
          {data.ticker}
          {data.company_name && <span style={{ color: 'var(--ink-2)', fontWeight: 700 }}> · {data.company_name}</span>}
        </div>
        {sub && <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>{sub}</div>}
        <div className="row gap-8" style={{ justifyContent: 'center', marginTop: 14 }}>
          {data.asset_type && <span className="pill pill-gray">{data.asset_type}</span>}
          {stance && (
            <span className={stancePill(stance)} style={{ textTransform: 'capitalize', fontSize: 13, padding: '5px 14px', fontWeight: 700 }}>
              <span className="dot" style={{ background: tone.color, marginRight: 2 }} /> {stance}
            </span>
          )}
        </div>
      </div>

      {data.overall?.read && (
        <div className="card card-pad" style={{ borderLeft: `4px solid ${tone.color}` }}>
          <div className="row gap-8" style={{ marginBottom: 10 }}>
            <Icon name="sparkle" size={15} color={tone.color} />
            <div className="card-title">Overall read</div>
          </div>
          <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.7, color: 'var(--ink-2)' }}>{data.overall.read}</p>
        </div>
      )}

      {data.analyst_forecast && <AnalystForecast af={data.analyst_forecast} />}

      <div className="card card-pad">
        <div className="card-title" style={{ marginBottom: 14 }}>Prediction market reads</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {DIMENSIONS.map(({ key, label, icon, accent }) => {
            const dim = data.dimensions?.[key];
            if (!dim) return null;
            const hasMarkets = Array.isArray(dim.markets) && dim.markets.length > 0;
            return (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14, border: '1px solid var(--line)', borderLeft: `3px solid ${accent}`, borderRadius: 12 }}>
                <div className="row gap-8">
                  <div className="insight-icon" style={{ background: `color-mix(in oklch, ${accent} 14%, var(--surface))` }}>
                    <Icon name={icon} size={14} color={accent} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: accent }}>{label}</div>
                </div>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--ink-2)' }}>{dim.read}</p>
                {hasMarkets ? (
                  <div className="col gap-6" style={{ marginTop: 4 }}>
                    {dim.markets.map((m, i) => <MarketCard key={i} m={m} accent={accent} />)}
                  </div>
                ) : (
                  <div className="row gap-6" style={{ marginTop: 2 }}>
                    <span className="dot" style={{ background: 'var(--ink-4)', width: 6, height: 6 }} />
                    <span className="tiny muted">Qualitative read — no live market</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {marketsFound === 0 && (
          <div className="tiny muted" style={{ marginTop: 14 }}>
            No live prediction-market contracts matched this security — reads are qualitative.
          </div>
        )}
      </div>
    </div>
  );
}

export default function PredictionMarket() {
  const [stocks, setStocks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/stocks').then((r) => setStocks(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  const predict = (s) => {
    setSelected(s);
    setError('');
    setLoading(true);
    const started = Date.now();
    api(`/api/predictions?tckr=${encodeURIComponent(s.ticker)}`)
      .then((r) => {
        if (r && r.dimensions) setData(r);
        else { setData(null); setError('No prediction is available for this security yet. Please try again shortly.'); }
      })
      .catch(() => { setData(null); setError("Couldn't fetch the prediction. Please try again."); })
      .finally(() => {
        const wait = Math.max(0, 6000 - (Date.now() - started));
        setTimeout(() => setLoading(false), wait);
      });
  };

  return (
    <div className="page">
      <div className="container">
        <div style={{ marginBottom: 24 }}>
          <div className="row gap-10" style={{ flexWrap: 'wrap' }}>
            <h1 className="page-h">Prediction Market</h1>
            <span className="pill pill-neg">Beta</span>
          </div>
          <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
            Search a security to see an AI prediction read across sentiment, valuation, macro, industry & competitor dimensions.
          </div>
        </div>
        <div className="card card-pad" style={{ marginBottom: 16, overflow: 'visible' }}>
          <TickerSearchBox stocks={stocks} onPick={predict} placeholder="Enter a security, company or fund to predict — one at a time" />
        </div>
        {loading && (
          <div className="card card-pad" style={{ borderColor: 'var(--ai-line)', background: 'linear-gradient(180deg, var(--ai-soft) 0%, var(--surface) 40%)' }}>
            <AiThinking messages={MESSAGES} cadence={2000} />
          </div>
        )}
        {!loading && error && <div className="card card-pad"><div className="empty">{error}</div></div>}
        {!loading && !error && data && <PredictionResult data={data} />}
      </div>
    </div>
  );
}
