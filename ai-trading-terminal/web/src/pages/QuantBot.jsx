import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useStore } from '../lib/store';
import { Icon, Modal } from '../components/ui';

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

function BotCard({ bot, strategies, onChanged }) {
  const { showToast } = useStore();
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  const strategy = strategies.find((s) => s.id === bot.strategyId);
  const running = bot.status === 'running';

  useEffect(() => {
    if (!showLogs) return;
    const loadLogs = () => api(`/api/quant/bots/${bot.id}/logs`).then(setLogs).catch(() => {});
    loadLogs();
    const t = setInterval(loadLogs, 5000);
    return () => clearInterval(t);
  }, [showLogs, bot.id]);

  const act = async (action) => {
    try {
      await api(`/api/quant/bots/${bot.id}/${action}`, { method: 'POST' });
      onChanged();
    } catch (e) {
      showToast(e.message || `Failed to ${action} bot`);
    }
  };
  const remove = async () => {
    try {
      await api(`/api/quant/bots/${bot.id}`, { method: 'DELETE' });
      showToast('Bot deleted');
      onChanged();
    } catch (e) {
      showToast(e.message);
    }
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
        <span className={`pill ${bot.live ? 'pill-neg' : 'pill-ai'}`}>{bot.live ? 'auto-trade' : 'signal only'}</span>
        {bot.lastSignal && <span className={`pill ${signalTone}`}>last: {bot.lastSignal}</span>}
        <span className="grow" />
        {running
          ? <button className="btn btn-ghost btn-sm" onClick={() => act('stop')}><Icon name="stop" size={12} /> Stop</button>
          : <button className="btn btn-primary btn-sm" onClick={() => act('start')}><Icon name="play" size={12} color="#fff" /> Start</button>}
        <button className="btn btn-ghost btn-sm" onClick={() => setShowLogs((v) => !v)}>{showLogs ? 'Hide log' : 'Log'}</button>
        <button className="btn btn-icon btn-ghost" onClick={remove}><Icon name="trash" size={13} color="var(--neg)" /></button>
      </div>
      <div className="row gap-12 wrap tiny muted">
        <span>every {bot.intervalSec}s</span>
        {Object.entries(bot.params || {}).map(([k, v]) => (
          <span key={k} className="mono">{k}={String(v)}</span>
        ))}
        {bot.lastRun && <span>last run {new Date(bot.lastRun).toLocaleTimeString()}</span>}
      </div>
      {showLogs && (
        <div style={{ marginTop: 12, maxHeight: 220, overflowY: 'auto', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px' }}>
          {logs.length === 0 ? (
            <div className="tiny muted">No log entries yet.</div>
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
