import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveClient } from '../lib/store';
import { api } from '../lib/api';
import { Icon, AiThinking, EmptyState } from '../components/ui';
import AddToPortfolio from '../components/AddToPortfolio';

const MESSAGES = [
  'Scanning global market universe…',
  'Analysing risk-adjusted opportunities…',
  'Matching securities to investment mandate…',
  'Evaluating sector exposures…',
  'Ranking by conviction score…',
  'Finalising AI recommendations…',
];

const PHIL = { G: 'Growth', V: 'Value', I: 'Income', X: 'Index', C: 'Contrarian' };
const philosophyLabel = (p) =>
  p ? p.split(',').map((x) => PHIL[x.trim().toUpperCase()] ?? x.trim()).join(', ') : '';

const cache = new Map();

export default function Recommender() {
  const client = useActiveClient();
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState(null);

  const fetchList = (force = false) => {
    if (!client || (!force && cache.has(client.id))) return;
    setLoading(true);
    const started = Date.now();
    api(`/api/ai-watchlist?client_id=${encodeURIComponent(client.id)}${force ? '&force=true' : ''}`)
      .then((r) => {
        const list = Array.isArray(r) ? r : [];
        const ts = new Date();
        setItems(list);
        setUpdated(ts);
        cache.set(client.id, { items: list, ts });
      })
      .catch(() => {})
      .finally(() => {
        const wait = Math.max(0, 6000 - (Date.now() - started));
        setTimeout(() => setLoading(false), wait);
      });
  };

  useEffect(() => {
    if (!client) return;
    const cached = cache.get(client.id);
    if (cached) { setItems(cached.items); setUpdated(cached.ts); return; }
    setItems([]);
    setUpdated(null);
    fetchList();
  }, [client?.id]);

  if (!client) {
    return (
      <EmptyState icon="eye" title="No clients yet"
        body="Onboard a client first to start building watchlists and tracking securities of interest."
        action={<button className="btn btn-primary btn-lg" onClick={() => nav('/manage')}><Icon name="sparkle" size={15} color="#fff" /> Onboard first client</button>}
        footnote="Takes less than a minute to set up" />
    );
  }

  return (
    <div className="page">
      <div className="container">
        <div style={{ marginBottom: 24 }}>
          <h1 className="page-h">AI Recommender</h1>
          <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>AI-generated securities to research</div>
        </div>
        <div className="card card-pad" style={{ borderColor: 'var(--ai-line)', background: 'linear-gradient(180deg, var(--ai-soft) 0%, var(--surface) 40%)' }}>
          <div className="card-head" style={{ marginBottom: loading ? 0 : 16 }}>
            <div className="row gap-10">
              <div className="insight-icon" style={{ background: 'var(--ai)', boxShadow: 'var(--shadow-sm)' }}>
                <Icon name="sparkle" size={16} color="#fff" />
              </div>
              <div>
                <div className="card-title">AI Recommender</div>
                <div className="card-sub">Curated by AI for {client.name}</div>
              </div>
            </div>
            {!loading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <button className="btn btn-soft btn-sm" onClick={() => fetchList(true)}>
                  <Icon name="refresh" size={13} /> Refresh
                </button>
                {updated && (
                  <span className="tiny muted">
                    Generated {updated.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            )}
          </div>
          {loading ? (
            <AiThinking messages={MESSAGES} cadence={700} />
          ) : items.length === 0 ? (
            <div className="empty">No AI suggestions for this client yet. Try Refresh to generate them.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ width: 80 }}>Symbol</th>
                    <th>Company</th>
                    <th style={{ width: 140 }}>Philosophy</th>
                    <th>Commentary</th>
                    <th style={{ width: 110 }}>Generated</th>
                    <th style={{ width: 96 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} style={{ cursor: 'default' }}>
                      <td><span className="ticker">{it.ticker}</span></td>
                      <td><span style={{ fontWeight: 600, fontSize: 13.5 }}>{it.orgName}</span></td>
                      <td><span className="tiny" style={{ color: 'var(--ai)', fontWeight: 600 }}>{philosophyLabel(it.philosophy)}</span></td>
                      <td><span className="tiny" style={{ color: 'var(--ink-2)', lineHeight: 1.5 }}>{it.commentary}</span></td>
                      <td>
                        <span className="tiny muted">
                          {new Date(it.generatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <AddToPortfolio ticker={it.ticker} name={it.orgName} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
