import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useStore } from '../lib/store';
import { Icon, Modal } from '../components/ui';
import { fmtUsd, fmtPct, fmtNum } from '../lib/format';

function NewBotModal({ strategies, onClose, onCreated }) {
  const { showToast } = useStore();
  const [strategyId, setStrategyId] = useState(strategies[0]?.id ?? '');
  const [symbol, setSymbol] = useState('SPY');
  const [intervalSec, setIntervalSec] = useState(300);
  const [live, setLive] = useState(false);
  const [params, setParams] = useState({});
  const [busy, setBusy] = useState(false);

  const strategy = strategies.find((s) => s.id === strategyId);

  useEffect(() => {
    if (!strategy) return;
    const defaults = {};
    strategy.params.forEach((p) => { defaults[p.key] = p.default; });
    setParams(defaults);
  }, [strategyId]);

  const create = async () => {
    setBusy(true);
    try {
      await api('/api/quant/bots', {
        method: 'POST',
        body: JSON.stringify({ strategyId, symbol, params, intervalSec, live }),
      });
      onCreated();
      onClose();
    } catch (e) {
      showToast(e.message || 'Failed to create bot');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={520}>
      <div className="modal-pad">
        <div className="row gap-10" style={{ marginBottom: 16 }}>
          <div className="insight-icon" style={{ background: 'var(--ai-soft)' }}>
            <Icon name="bolt" size={15} color="var(--ai)" />
          </div>
          <div className="card-title">New quant bot</div>
          <button className="btn btn-icon btn-ghost" style={{ marginLeft: 'auto' }} onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="col gap-14">
          <div>
            <label className="field-label">Strategy</label>
            <select className="select" style={{ width: '100%' }} value={strategyId} onChange={(e) => setStrategyId(e.target.value)}>
              {strategies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {strategy && <div className="tiny muted" style={{ marginTop: 6, lineHeight: 1.5 }}>{strategy.description}</div>}
          </div>
          <div className="row gap-12">
            <div className="grow">
              <label className="field-label">Symbol</label>
              <input className="input mono" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
            </div>
            <div className="grow">
              <label className="field-label">Evaluate every (seconds)</label>
              <input className="input tnum" type="number" min={30} value={intervalSec} onChange={(e) => setIntervalSec(Number(e.target.value))} />
            </div>
          </div>
          {strategy && strategy.params.length > 0 && (
            <div style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 12, border: '1px solid var(--line)' }}>
              <div className="tiny muted" style={{ fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>
                Strategy parameters
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 12px' }}>
                {strategy.params.map((p) => (
                  <div key={p.key} className="col gap-4">
                    <label className="tiny muted">{p.label}</label>
                    <input className="input input-sm tnum" type={p.type === 'number' ? 'number' : 'text'}
                      min={p.min} max={p.max} value={params[p.key] ?? ''}
                      onChange={(e) => setParams((ps) => ({ ...ps, [p.key]: p.type === 'number' ? Number(e.target.value) : e.target.value }))} />
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="row gap-10">
            <label className="field-label" style={{ margin: 0 }}>Mode</label>
            <div className="seg">
              <button className={!live ? 'on' : ''} onClick={() => setLive(false)}>Signal only</button>
              <button className={live ? 'on' : ''} onClick={() => setLive(true)}>Auto-trade</button>
            </div>
          </div>
          {live && (
            <div className="tiny" style={{ color: 'var(--neg)', lineHeight: 1.5 }}>
              Auto-trade submits orders through your connected Alpaca account whenever the strategy signals.
              Use a paper account while testing.
            </div>
          )}
          <button className="btn btn-primary btn-block" onClick={create} disabled={busy || !symbol.trim()}>
            {busy ? 'Creating…' : 'Create bot'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Stat({ label, value, tone, sub }) {
  return (
    <div style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--surface)' }}>
      <div className="tiny muted" style={{ marginBottom: 3 }}>{label}</div>
      <div className="tnum" style={{ fontSize: 16, fontWeight: 700, color: tone ?? 'var(--ink)', lineHeight: 1.15 }}>{value}</div>
      {sub && <div className="tiny muted" style={{ marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function InsightsPanel({ botId }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    const loadIt = () => api(`/api/quant/bots/${botId}/insights`)
      .then((d) => { if (alive) { setData(d); setErr(''); } })
      .catch((e) => { if (alive) setErr(e.message); });
    loadIt();
    const t = setInterval(loadIt, 10000);
    return () => { alive = false; clearInterval(t); };
  }, [botId]);

  if (err) return <div className="empty tiny">{err}</div>;
  if (!data) return <div className="tiny muted" style={{ padding: 10 }}>Loading insights…</div>;

  const { activity, position, pnl, account, trades, priceNow, dataError } = data;
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
      {dataError && (
        <div className="tiny" style={{ color: 'var(--neg)', marginBottom: 10 }}>{dataError}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 12 }}>
        <Stat label="Evaluations" value={fmtNum(activity.evaluations)}
          sub={activity.lastRun ? `last ${new Date(activity.lastRun).toLocaleTimeString()}` : 'not run yet'} />
        <Stat label="Signals" value={`${activity.signalCounts.buy}B / ${activity.signalCounts.sell}S / ${activity.signalCounts.hold}H`} />
        <Stat label="Orders placed" value={fmtNum(activity.tradeCount)}
          sub={`${activity.buyCount} buy · ${activity.sellCount} sell`} />
        <Stat label="Market price" value={priceNow != null ? fmtUsd(priceNow) : '—'} />
        <Stat label="Realised P&L" value={fmtUsd(pnl.realised)}
          tone={pnl.realised > 0 ? 'var(--pos)' : pnl.realised < 0 ? 'var(--neg)' : undefined}
          sub="from this bot's fills" />
        {account && <Stat label="Account equity" value={fmtUsd(account.equity, 0)} sub={`buying power ${fmtUsd(account.buyingPower, 0)}`} />}
      </div>

      <div style={{ marginBottom: 12 }}>
        <div className="tiny muted" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
          Position
        </div>
        {position ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
            <Stat label="Shares" value={fmtNum(position.qty)} />
            <Stat label="Avg entry" value={fmtUsd(position.avgEntry)} />
            <Stat label="Market value" value={fmtUsd(position.marketValue, 0)} />
            <Stat label="Unrealised P&L" value={`${fmtUsd(position.unrealisedPl, 0)} (${fmtPct(position.unrealisedPlPct, 1)})`}
              tone={position.unrealisedPl >= 0 ? 'var(--pos)' : 'var(--neg)'} />
          </div>
        ) : (
          <div className="tiny muted">No open position in this symbol.</div>
        )}
      </div>

      {activity.lastReason && (
        <div style={{ marginBottom: 12 }}>
          <div className="tiny muted" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
            Last evaluation
          </div>
          <div className="tiny" style={{ color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 6 }}>{activity.lastReason}</div>
          {activity.lastMetrics && (
            <div className="row gap-6 wrap">
              {Object.entries(activity.lastMetrics).map(([k, v]) => (
                <span key={k} className="kbd">{k}={String(v)}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {trades.length > 0 && (
        <div>
          <div className="tiny muted" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
            Order history
          </div>
          <div style={{ maxHeight: 160, overflowY: 'auto' }}>
            <table className="tbl">
              <tbody>
                {trades.map((t, i) => (
                  <tr key={i} style={{ cursor: 'default' }}>
                    <td className="tiny muted" style={{ padding: '6px 8px' }}>{new Date(t.ts).toLocaleString()}</td>
                    <td style={{ padding: '6px 8px' }}>
                      <span className={`pill ${t.side === 'buy' ? 'pill-pos' : 'pill-neg'}`}>{t.side}</span>
                    </td>
                    <td className="tnum tiny" style={{ padding: '6px 8px' }}>{t.qty} @ {fmtUsd(t.price)}</td>
                    <td className="tiny muted" style={{ padding: '6px 8px' }}>{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function BotCard({ bot, strategies, onChanged }) {
  const { showToast } = useStore();
  const [logs, setLogs] = useState([]);
  const [tab, setTab] = useState(null); // null | 'insights' | 'log'
  const strategy = strategies.find((s) => s.id === bot.strategyId);
  const running = bot.status === 'running';

  useEffect(() => {
    if (tab !== 'log') return;
    const loadLogs = () => api(`/api/quant/bots/${bot.id}/logs`).then(setLogs).catch(() => {});
    loadLogs();
    const t = setInterval(loadLogs, 5000);
    return () => clearInterval(t);
  }, [tab, bot.id]);

  const act = async (action) => {
    try {
      await api(`/api/quant/bots/${bot.id}/${action}`, { method: 'POST' });
      onChanged();
    } catch (e) {
      showToast(e.message || `Failed to ${action} bot`);
    }
  };
  const toggleLive = async () => {
    try {
      await api(`/api/quant/bots/${bot.id}`, { method: 'PATCH', body: JSON.stringify({ live: !bot.live }) });
      showToast(!bot.live ? 'Auto-trade enabled — signals will place paper orders' : 'Switched to signal-only');
      onChanged();
    } catch (e) { showToast(e.message); }
  };
  const remove = async () => {
    try {
      await api(`/api/quant/bots/${bot.id}`, { method: 'DELETE' });
      showToast('Bot deleted');
      onChanged();
    } catch (e) { showToast(e.message); }
  };

  const signalTone = { buy: 'pill-pos', sell: 'pill-neg', hold: 'pill-hold' }[bot.lastSignal] ?? 'pill-gray';
  const logColor = { error: 'var(--neg)', warn: 'oklch(0.52 0.13 75)', trade: 'var(--pos)' };

  return (
    <div className="card card-pad">
      <div className="row gap-10 wrap" style={{ marginBottom: 10 }}>
        <span className="ticker" style={{ fontSize: 15 }}>{bot.symbol}</span>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{strategy?.name ?? bot.strategyId}</span>
        <span className={`pill ${running ? 'pill-pos' : 'pill-gray'}`}>
          {running && <span className="dot" style={{ background: 'var(--pos)', width: 6, height: 6 }} />}
          {running ? 'running' : 'stopped'}
        </span>
        <button className={`pill ${bot.live ? 'pill-neg' : 'pill-ai'}`} onClick={toggleLive}
          style={{ border: 'none', cursor: 'pointer' }}
          title="Click to switch between signal-only and auto-trade">
          {bot.live ? 'auto-trade' : 'signal only'}
        </button>
        {bot.lastSignal && <span className={`pill ${signalTone}`}>last: {bot.lastSignal}</span>}
        <span className="grow" />
        {running
          ? <button className="btn btn-ghost btn-sm" onClick={() => act('stop')}><Icon name="stop" size={12} /> Stop</button>
          : <button className="btn btn-primary btn-sm" onClick={() => act('start')}><Icon name="play" size={12} color="#fff" /> Start</button>}
        <button className={'btn btn-sm ' + (tab === 'insights' ? 'btn-soft' : 'btn-ghost')}
          onClick={() => setTab(tab === 'insights' ? null : 'insights')}>Insights</button>
        <button className={'btn btn-sm ' + (tab === 'log' ? 'btn-soft' : 'btn-ghost')}
          onClick={() => setTab(tab === 'log' ? null : 'log')}>Log</button>
        <button className="btn btn-icon btn-ghost" onClick={remove}><Icon name="trash" size={13} color="var(--neg)" /></button>
      </div>
      <div className="row gap-12 wrap tiny muted">
        <span>every {bot.intervalSec}s</span>
        {Object.entries(bot.params || {}).map(([k, v]) => (
          <span key={k} className="mono">{k}={String(v)}</span>
        ))}
        {bot.lastRun && <span>last run {new Date(bot.lastRun).toLocaleTimeString()}</span>}
      </div>
      {bot.lastReason && (
        <div className="tiny" style={{ marginTop: 8, color: 'var(--ink-2)', lineHeight: 1.45 }}>{bot.lastReason}</div>
      )}

      {tab === 'insights' && <InsightsPanel botId={bot.id} />}
      {tab === 'log' && (
        <div style={{ marginTop: 12, maxHeight: 240, overflowY: 'auto', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px' }}>
          {logs.length === 0 ? (
            <div className="tiny muted">No log entries yet — start the bot to begin evaluating.</div>
          ) : logs.map((l, i) => (
            <div key={i} className="row gap-8" style={{ padding: '2px 0', alignItems: 'flex-start' }}>
              <span className="mono tiny muted" style={{ flexShrink: 0 }}>{new Date(l.ts).toLocaleTimeString()}</span>
              <span className="tiny" style={{ color: logColor[l.level] ?? 'var(--ink-2)', lineHeight: 1.45 }}>{l.msg}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function QuantBot() {
  const [strategies, setStrategies] = useState([]);
  const [bots, setBots] = useState([]);
  const [alpacaOk, setAlpacaOk] = useState(null);
  const [showNew, setShowNew] = useState(false);

  const refresh = () => {
    api('/api/quant/strategies').then(setStrategies).catch(() => {});
    api('/api/quant/bots').then((r) => setBots(Array.isArray(r) ? r : [])).catch(() => {});
    api('/api/alpaca/status').then((s) => setAlpacaOk(Boolean(s.configured))).catch(() => setAlpacaOk(false));
  };
  useEffect(refresh, []);
  useEffect(() => {
    const t = setInterval(() => api('/api/quant/bots').then((r) => setBots(Array.isArray(r) ? r : [])).catch(() => {}), 8000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="page">
      <div className="container">
        <div className="row wrap" style={{ justifyContent: 'space-between', marginBottom: 24, alignItems: 'flex-end' }}>
          <div>
            <div className="row gap-10" style={{ flexWrap: 'wrap' }}>
              <h1 className="page-h">Quant Bot</h1>
              <span className="pill pill-ai">Framework</span>
            </div>
            <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
              Configure rule-based strategies, run them against live market data, and (optionally) auto-trade via Alpaca.
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowNew(true)} disabled={!strategies.length}>
            <Icon name="plus" size={15} color="#fff" /> New bot
          </button>
        </div>

        {alpacaOk === false && (
          <div className="card card-pad" style={{ marginBottom: 16, borderColor: 'var(--ai-line)', background: 'linear-gradient(180deg, var(--ai-soft) 0%, var(--surface) 55%)' }}>
            <div className="row gap-12">
              <div className="insight-icon" style={{ background: 'var(--ai)' }}><Icon name="bolt" size={15} color="#fff" /></div>
              <div className="grow">
                <div style={{ fontWeight: 700, fontSize: 14 }}>Bots need market data from Alpaca</div>
                <div className="tiny muted" style={{ marginTop: 3 }}>
                  Connect your Alpaca keys on the Trading tab first — strategies evaluate real bars pulled from Alpaca's data API.
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 10 }}>Available strategies</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {strategies.map((s) => (
              <div key={s.id} style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 12 }}>
                <div className="row gap-8" style={{ marginBottom: 6 }}>
                  <Icon name="bolt" size={14} color="var(--ai)" />
                  <span style={{ fontWeight: 700, fontSize: 13.5 }}>{s.name}</span>
                  <span className="pill pill-gray mono" style={{ fontSize: 10.5 }}>{s.id}</span>
                </div>
                <div className="tiny muted" style={{ lineHeight: 1.5 }}>{s.description}</div>
                <div className="row gap-6 wrap" style={{ marginTop: 8 }}>
                  {s.params.map((p) => <span key={p.key} className="kbd">{p.key}</span>)}
                </div>
              </div>
            ))}
          </div>
          <div className="tiny muted" style={{ marginTop: 12, lineHeight: 1.5 }}>
            The framework is parameter-driven — new strategies drop into <span className="kbd">server/quant/strategies/</span> and
            expose their own parameter schema, so custom parameter sets can be added at any time.
          </div>
        </div>

        <div className="col gap-12">
          {bots.length === 0 ? (
            <div className="card card-pad">
              <div className="empty">No bots yet. Create one to start generating signals.</div>
            </div>
          ) : (
            bots.map((b) => <BotCard key={b.id} bot={b} strategies={strategies} onChanged={refresh} />)
          )}
        </div>
      </div>
      {showNew && <NewBotModal strategies={strategies} onClose={() => setShowNew(false)} onCreated={refresh} />}
    </div>
  );
}
