import React, { useEffect, useState } from 'react';
import { useActiveClient } from '../lib/store';
import { api } from '../lib/api';
import { Icon, AiThinking, SectionedSummary, TickerSearchBox } from '../components/ui';
import SimulatedNotice from '../components/SimulatedNotice';
import { fmtUsd } from '../lib/format';

const MESSAGES = [
  'Dispatching analyst agents…',
  'Gathering latest news & filings…',
  'Running the bull / bear debate…',
  'Weighing analyst ratings & valuation…',
  "Synthesising the swarm's verdict…",
];

function ResultPanel({ data }) {
  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--ai-line)' }}>
      <div className="row gap-12 wrap" style={{ marginBottom: 16 }}>
        {data.assetType && <span className="pill pill-gray">{data.assetType}</span>}
        {data.currentPrice != null && (
          <span className="tiny muted">Price <b style={{ color: 'var(--ink)' }}>{fmtUsd(data.currentPrice)}</b></span>
        )}
        {data.analystValuation != null && (
          <span className="tiny muted">Analyst target <b style={{ color: 'var(--ink)' }}>{fmtUsd(data.analystValuation)}</b></span>
        )}
        {data.analystRating && (
          <span className="pill pill-brand" style={{ textTransform: 'capitalize' }}>{data.analystRating.replace(/_/g, ' ')}</span>
        )}
        {data.generatedAt && (
          <span className="tiny muted" style={{ marginLeft: 'auto' }}>
            Generated {new Date(data.generatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>
      <SectionedSummary summary={data.summary || ''} />
    </div>
  );
}

export default function Swarm() {
  const client = useActiveClient();
  const [stocks, setStocks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/stocks').then((r) => setStocks(Array.isArray(r) ? r : [])).catch(() => {});
  }, []);

  const analyse = (s) => {
    setSelected(s);
    setError('');
    setLoading(true);
    const started = Date.now();
    api(`/api/stock-summary?tckr=${encodeURIComponent(s.ticker)}`)
      .then((r) => {
        if (r && r.summary) setData(r);
        else { setData(null); setError('No AI analysis is available for this security yet. Please try again shortly.'); }
      })
      .catch(() => { setData(null); setError("Couldn't fetch the analysis. Please try again."); })
      .finally(() => {
        const wait = Math.max(0, 7000 - (Date.now() - started));
        setTimeout(() => setLoading(false), wait);
      });
  };

  return (
    <div className="page">
      <div className="container">
        <div style={{ marginBottom: 24 }}>
          <h1 className="page-h">AI Swarm Playground</h1>
          <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
            Ask the AI swarm to analyse any security, company, or fund.
          </div>
        </div>
        <SimulatedNotice what="analyst target and rating" />
        <div className="card card-pad" style={{ marginBottom: 16, overflow: 'visible' }}>
          <TickerSearchBox stocks={stocks} onPick={analyse}
            placeholder="Enter the security, company or fund you want the AI to analyse" />
        </div>
        {(loading || data || error) && (
          <div className="card card-pad" style={{ borderColor: 'var(--ai-line)', background: 'linear-gradient(180deg, var(--ai-soft) 0%, var(--surface) 40%)' }}>
            <div className="card-head" style={{ marginBottom: 0 }}>
              <div className="row gap-10">
                <div className="insight-icon" style={{ background: 'var(--ai)', boxShadow: 'var(--shadow-sm)' }}>
                  <Icon name="sparkle" size={16} color="#fff" />
                </div>
                <div>
                  <div className="card-title">{selected ? `${selected.ticker} · ${selected.name}` : 'AI Analysis'}</div>
                  <div className="card-sub">AI swarm analysis</div>
                </div>
              </div>
            </div>
            {loading ? <AiThinking messages={MESSAGES} /> :
              error ? <div className="empty" style={{ marginTop: 8 }}>{error}</div> :
              data ? <ResultPanel data={data} /> : null}
          </div>
        )}
      </div>
    </div>
  );
}
