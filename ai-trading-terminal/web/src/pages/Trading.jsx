import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useStore } from '../lib/store';
import { fmtUsd, fmtPct, fmtNum } from '../lib/format';
import { Icon, Modal } from '../components/ui';

function ConnectModal({ onClose, onSaved }) {
  const { showToast } = useStore();
  const [keyId, setKeyId] = useState('');
  const [secret, setSecret] = useState('');
  const [paper, setPaper] = useState(true);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api('/api/alpaca/credentials', { method: 'POST', body: JSON.stringify({ keyId, secret, paper }) });
      showToast('Alpaca keys saved');
      onSaved();
      onClose();
    } catch (e) {
      showToast(e.message || 'Failed to save keys');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={460}>
      <div className="modal-pad">
        <div className="row gap-10" style={{ marginBottom: 6 }}>
          <div className="insight-icon" style={{ background: 'var(--brand-soft)' }}>
            <Icon name="bolt" size={15} color="var(--brand-2)" />
          </div>
          <div className="card-title">Connect Alpaca</div>
          <button className="btn btn-icon btn-ghost" style={{ marginLeft: 'auto' }} onClick={onClose}><Icon name="x" /></button>
        </div>
        <p className="tiny muted" style={{ margin: '0 0 18px', lineHeight: 1.55 }}>
          Paste your Alpaca API keys (paper keys recommended). Keys can also be provided via the
          server environment variables <span className="kbd">ALPACA_API_KEY_ID</span> / <span className="kbd">ALPACA_API_SECRET_KEY</span>.
        </p>
        <div className="col gap-14">
          <div>
            <label className="field-label">API Key ID</label>
            <input className="input mono" placeholder="PK…" value={keyId} onChange={(e) => setKeyId(e.target.value)} />
          </div>
          <div>
            <label className="field-label">API Secret</label>
            <input className="input mono" type="password" placeholder="••••••••" value={secret} onChange={(e) => setSecret(e.target.value)} />
          </div>
          <div className="row gap-10">
            <label className="field-label" style={{ margin: 0 }}>Environment</label>
            <div className="seg">
              <button className={paper ? 'on' : ''} onClick={() => setPaper(true)}>Paper</button>
              <button className={!paper ? 'on' : ''} onClick={() => setPaper(false)}>Live</button>
            </div>
          </div>
          {!paper && (
            <div className="tiny" style={{ color: 'var(--neg)', lineHeight: 1.5 }}>
              Live mode sends real orders with real money. Use paper trading unless you are certain.
            </div>
          )}
          <button className="btn btn-primary btn-block" onClick={save} disabled={busy || !keyId || !secret}>
            {busy ? 'Saving…' : 'Save & connect'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function OrderTicket({ onPlaced }) {
  const { showToast } = useStore();
  const [symbol, setSymbol] = useState('');
  const [side, setSide] = useState('buy');
  const [type, setType] = useState('market');
  const [mode, setMode] = useState('qty');
  const [qty, setQty] = useState('1');
  const [notional, setNotional] = useState('100');
  const [limitPrice, setLimitPrice] = useState('');
  const [tif, setTif] = useState('day');
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState(null);

  useEffect(() => {
    const sym = symbol.trim().toUpperCase();
    if (!sym) { setQuote(null); return; }
    const t = setTimeout(() => {
      api(`/api/prices/${encodeURIComponent(sym)}`).then(setQuote).catch(() => setQuote(null));
    }, 400);
    return () => clearTimeout(t);
  }, [symbol]);

  const submit = async () => {
    setBusy(true);
    try {
      const payload = {
        symbol: symbol.trim().toUpperCase(),
        side, type, time_in_force: tif,
        ...(mode === 'qty' ? { qty: Number(qty) } : { notional: Number(notional) }),
        ...(type === 'limit' ? { limit_price: Number(limitPrice) } : {}),
      };
      const order = await api('/api/alpaca/orders', { method: 'POST', body: JSON.stringify(payload) });
      showToast(`${side.toUpperCase()} order for ${payload.symbol} submitted (${order.status})`);
      onPlaced();
    } catch (e) {
      showToast(e.message || 'Order failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card card-pad">
      <div className="card-title" style={{ marginBottom: 14 }}>Order Ticket</div>
      <div className="col gap-12">
        <div>
          <label className="field-label">Symbol</label>
          <input className="input mono" placeholder="AAPL" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} />
          {quote && (
            <div className="tiny muted" style={{ marginTop: 5 }}>
              Last price <b style={{ color: 'var(--ink)' }}>{fmtUsd(quote.price)}</b>
              <span className="pill pill-gray" style={{ marginLeft: 6, fontSize: 10.5 }}>{quote.source}</span>
            </div>
          )}
        </div>
        <div className="row gap-10">
          <div className="seg" style={{ flex: 1, display: 'flex' }}>
            <button className={side === 'buy' ? 'on' : ''} style={{ flex: 1, color: side === 'buy' ? 'var(--pos)' : undefined }} onClick={() => setSide('buy')}>Buy</button>
            <button className={side === 'sell' ? 'on' : ''} style={{ flex: 1, color: side === 'sell' ? 'var(--neg)' : undefined }} onClick={() => setSide('sell')}>Sell</button>
          </div>
          <div className="seg" style={{ flex: 1, display: 'flex' }}>
            <button className={type === 'market' ? 'on' : ''} style={{ flex: 1 }} onClick={() => setType('market')}>Market</button>
            <button className={type === 'limit' ? 'on' : ''} style={{ flex: 1 }} onClick={() => setType('limit')}>Limit</button>
          </div>
        </div>
        <div className="row gap-10">
          <div className="seg" style={{ display: 'flex' }}>
            <button className={mode === 'qty' ? 'on' : ''} onClick={() => setMode('qty')}>Shares</button>
            <button className={mode === 'notional' ? 'on' : ''} onClick={() => setMode('notional')}>Dollars</button>
          </div>
          {mode === 'qty' ? (
            <input className="input input-sm tnum grow" type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
          ) : (
            <input className="input input-sm tnum grow" type="number" min="0" step="any" value={notional} onChange={(e) => setNotional(e.target.value)} />
          )}
        </div>
        {type === 'limit' && (
          <div className="row gap-10">
            <label className="tiny muted" style={{ minWidth: 70 }}>Limit price</label>
            <input className="input input-sm tnum grow" type="number" min="0" step="any" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} />
          </div>
        )}
        <div className="row gap-10">
          <label className="tiny muted" style={{ minWidth: 70 }}>Time in force</label>
          <select className="select" value={tif} onChange={(e) => setTif(e.target.value)}>
            <option value="day">Day</option>
            <option value="gtc">GTC</option>
            <option value="ioc">IOC</option>
            <option value="fok">FOK</option>
          </select>
        </div>
        <button
          className="btn btn-block btn-lg"
          style={{ background: side === 'buy' ? 'var(--pos)' : 'var(--neg)', color: '#fff' }}
          disabled={busy || !symbol.trim() || (type === 'limit' && !limitPrice)}
          onClick={submit}>
          {busy ? 'Submitting…' : `${side === 'buy' ? 'Buy' : 'Sell'} ${symbol.trim().toUpperCase() || '—'}`}
        </button>
      </div>
    </div>
  );
}

export default function Trading() {
  const { showToast } = useStore();
  const [status, setStatus] = useState(null);
  const [positions, setPositions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [showConnect, setShowConnect] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    api('/api/alpaca/status').then(setStatus).catch(() => setStatus({ configured: false })).finally(() => setLoading(false));
    api('/api/alpaca/positions').then((r) => setPositions(Array.isArray(r) ? r : [])).catch(() => setPositions([]));
    api('/api/alpaca/orders?status=open').then((r) => setOrders(Array.isArray(r) ? r : [])).catch(() => setOrders([]));
  };
  useEffect(refresh, []);

  const cancelOrder = async (id) => {
    try {
      await api(`/api/alpaca/orders/${id}`, { method: 'DELETE' });
      showToast('Order cancelled');
      refresh();
    } catch (e) {
      showToast(e.message || 'Cancel failed');
    }
  };

  const acct = status?.account;
  const connected = status?.configured && acct;

  return (
    <div className="page">
      <div className="container">
        <div className="row wrap" style={{ justifyContent: 'space-between', marginBottom: 24, alignItems: 'flex-end' }}>
          <div>
            <div className="row gap-10" style={{ flexWrap: 'wrap' }}>
              <h1 className="page-h">Trading</h1>
              {status && (
                <span className={`pill ${connected ? 'pill-pos' : 'pill-gray'}`}>
                  {connected ? `Alpaca connected · ${status.paper ? 'paper' : 'LIVE'}` : 'Not connected'}
                </span>
              )}
            </div>
            <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>
              Trade through your Alpaca account — account, positions and orders in one place.
            </div>
          </div>
          <div className="row gap-8">
            <button className="btn btn-ghost btn-sm" onClick={refresh}><Icon name="refresh" size={13} /> Refresh</button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowConnect(true)}>
              <Icon name="bolt" size={13} color="#fff" /> {connected ? 'Update keys' : 'Connect Alpaca'}
            </button>
          </div>
        </div>

        {!loading && !status?.configured && (
          <div className="card card-pad" style={{ marginBottom: 16, borderColor: 'var(--ai-line)', background: 'linear-gradient(180deg, var(--ai-soft) 0%, var(--surface) 55%)' }}>
            <div className="row gap-12">
              <div className="insight-icon" style={{ background: 'var(--ai)' }}><Icon name="bolt" size={15} color="#fff" /></div>
              <div className="grow">
                <div style={{ fontWeight: 700, fontSize: 14 }}>Connect your Alpaca account to start trading</div>
                <div className="tiny muted" style={{ marginTop: 3, lineHeight: 1.5 }}>
                  Create free paper-trading keys at alpaca.markets, then click Connect Alpaca. Prices and news
                  automatically upgrade to live Alpaca data once connected.
                </div>
              </div>
              <button className="btn btn-ai-solid btn-sm" onClick={() => setShowConnect(true)}>Connect</button>
            </div>
          </div>
        )}
        {status?.configured && status?.error && (
          <div className="card card-pad" style={{ marginBottom: 16, borderColor: 'var(--neg)' }}>
            <div className="tiny" style={{ color: 'var(--neg)' }}>Alpaca error: {status.error}</div>
          </div>
        )}

        {acct && (
          <div className="stats-grid four">
            {[
              ['Equity', fmtUsd(Number(acct.equity), 0)],
              ['Buying Power', fmtUsd(Number(acct.buying_power), 0)],
              ['Cash', fmtUsd(Number(acct.cash), 0)],
              ['Day P/L', (() => { const pl = Number(acct.equity) - Number(acct.last_equity); return `${pl >= 0 ? '+' : '−'}${fmtUsd(Math.abs(pl), 0)}`; })()],
            ].map(([label, value]) => (
              <div key={label} className="stat">
                <div className="stat-label">{label}</div>
                <div className="stat-body"><div className="stat-value" style={{ fontSize: 26 }}>{value}</div></div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.4fr', gap: 16, alignItems: 'start' }}>
          <OrderTicket onPlaced={refresh} />
          <div className="col gap-16">
            <div className="card card-pad">
              <div className="card-head" style={{ marginBottom: 12 }}>
                <div>
                  <div className="card-title">Positions</div>
                  <div className="card-sub">{positions.length} open position{positions.length !== 1 ? 's' : ''}</div>
                </div>
              </div>
              {positions.length === 0 ? (
                <div className="empty tiny">{connected ? 'No open positions.' : 'Connect Alpaca to see positions.'}</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Symbol</th><th className="num">Qty</th><th className="num">Avg Entry</th>
                        <th className="num">Current</th><th className="num">Mkt Value</th><th className="num">Unrealised P/L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((p) => {
                        const pl = Number(p.unrealized_pl);
                        const plPct = Number(p.unrealized_plpc) * 100;
                        return (
                          <tr key={p.symbol} style={{ cursor: 'default' }}>
                            <td><span className="ticker">{p.symbol}</span></td>
                            <td className="num tnum">{fmtNum(Number(p.qty))}</td>
                            <td className="num tnum muted">{fmtUsd(Number(p.avg_entry_price))}</td>
                            <td className="num tnum">{fmtUsd(Number(p.current_price))}</td>
                            <td className="num tnum" style={{ fontWeight: 600 }}>{fmtUsd(Number(p.market_value), 0)}</td>
                            <td className={'num tnum ' + (pl >= 0 ? 'pos' : 'neg')} style={{ fontWeight: 600 }}>
                              {pl >= 0 ? '+' : '−'}{fmtUsd(Math.abs(pl), 0)} ({fmtPct(plPct, 1)})
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card card-pad">
              <div className="card-head" style={{ marginBottom: 12 }}>
                <div>
                  <div className="card-title">Open Orders</div>
                  <div className="card-sub">Working orders awaiting fill</div>
                </div>
              </div>
              {orders.length === 0 ? (
                <div className="empty tiny">{connected ? 'No open orders.' : 'Connect Alpaca to see orders.'}</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Symbol</th><th>Side</th><th>Type</th><th className="num">Qty / Notional</th>
                        <th className="num">Limit</th><th>Status</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr key={o.id} style={{ cursor: 'default' }}>
                          <td><span className="ticker">{o.symbol}</span></td>
                          <td><span className={`pill ${o.side === 'buy' ? 'pill-pos' : 'pill-neg'}`}>{o.side}</span></td>
                          <td className="muted">{o.type}</td>
                          <td className="num tnum">{o.qty ?? (o.notional ? fmtUsd(Number(o.notional), 0) : '—')}</td>
                          <td className="num tnum muted">{o.limit_price ? fmtUsd(Number(o.limit_price)) : '—'}</td>
                          <td><span className="pill pill-gray">{o.status}</span></td>
                          <td style={{ textAlign: 'right' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => cancelOrder(o.id)}>Cancel</button>
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
      </div>
      {showConnect && <ConnectModal onClose={() => setShowConnect(false)} onSaved={refresh} />}
    </div>
  );
}
