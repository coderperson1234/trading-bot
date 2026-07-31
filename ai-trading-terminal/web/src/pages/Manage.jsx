import React, { useEffect, useState } from 'react';
import { useStore, useActiveClient } from '../lib/store';
import { api, fetchPrice } from '../lib/api';
import { portfolioStats, holdingRows, lookupStock } from '../lib/portfolio';
import { fmtUsd, fmtUsdCompact } from '../lib/format';
import { Icon, Modal, EmptyState, LoadDots } from '../components/ui';

const RISKS = ['Conservative', 'Moderate', 'Aggressive'];
const STRATEGIES = ['Growth', 'Income', 'Value', 'Index', 'Custom'];
const HORIZONS = ['Short-term', 'Mid-term', 'Long-term'];

const PI_TYPES = {
  Instruments: ['Fixed deposits', 'Singapore Savings Bonds (SSBs)', 'Treasury Bills (T-bills)', 'CPF Special Account / CPF-related strategies', 'REITs', 'Unit trusts'],
  Unlisted: ['Private equity', 'Private credit', 'Real Estate', 'Hedge funds'],
};

function ClientSummaryCard({ client, piRefresh }) {
  const stats = portfolioStats(client.portfolio);
  const [pis, setPis] = useState([]);
  useEffect(() => {
    api(`/api/private-investments?clientId=${encodeURIComponent(client.id)}`)
      .then((r) => setPis(Array.isArray(r) ? r : []))
      .catch(() => setPis([]));
  }, [client.id, piRefresh]);
  const piCost = pis.reduce((s, p) => s + (p.avgPrice || 0), 0);
  const piValue = pis.reduce((s, p) => s + (p.currentPrice || 0), 0);
  const value = stats.value + piValue;
  const cost = stats.cost + piCost;
  const gain = stats.gain + (piValue - piCost);
  const gainPct = cost > 0 ? (gain / cost) * 100 : 0;
  const riskCls = { Conservative: 'pill-pos', Moderate: 'pill-brand', Aggressive: 'pill-neg' }[client.risk] || 'pill-gray';
  return (
    <div className="card card-pad">
      <div className="row gap-12" style={{ alignItems: 'flex-start' }}>
        <div className="avatar" style={{ width: 44, height: 44, fontSize: 16, borderRadius: 12 }}>
          {client.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
        </div>
        <div className="grow">
          <div className="row gap-10 wrap">
            <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em' }}>{client.name}</div>
            <span className={`pill ${riskCls}`}>{client.risk} risk</span>
            <span className="pill pill-gray">{client.portfolio.strategy}</span>
          </div>
          <div className="tiny muted" style={{ marginTop: 4 }}>{client.email} · {client.horizon} horizon</div>
        </div>
        <div className="col gap-4" style={{ textAlign: 'right' }}>
          <div className="serif tnum" style={{ fontSize: 22 }}>{fmtUsdCompact(value)}</div>
          <div className={(gain >= 0 ? 'pos' : 'neg') + ' tiny'} style={{ fontWeight: 600 }}>
            {gain >= 0 ? '+' : '−'}{fmtUsd(Math.abs(gain), 0)} ({gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%)
          </div>
        </div>
      </div>
    </div>
  );
}

function NewClientModal({ onClose }) {
  const { addClient, showToast } = useStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [risk, setRisk] = useState('Moderate');
  const [horizon, setHorizon] = useState('Long-term');
  const [strategy, setStrategy] = useState('Growth');
  const [added, setAdded] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [stocksLoading, setStocksLoading] = useState(true);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [qty, setQty] = useState(1);
  const [cost, setCost] = useState(0);
  const [priceBusy, setPriceBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api('/api/stocks').then((r) => setStocks(Array.isArray(r) ? r : [])).catch(() => setStocks([])).finally(() => setStocksLoading(false));
  }, []);

  const needle = q.trim().toLowerCase();
  const matches = needle ? stocks.filter((s) => s.ticker.toLowerCase().includes(needle) || (s.name ?? '').toLowerCase().includes(needle)) : stocks;

  const addRow = async (s) => {
    setPriceBusy(true);
    const price = (await fetchPrice(s.ticker)) ?? cost;
    setPriceBusy(false);
    setAdded((rows) =>
      rows.find((r) => r.ticker === s.ticker)
        ? rows.map((r) => (r.ticker === s.ticker ? { ...r, qty: String(Number(r.qty) + qty), currentPrice: price } : r))
        : [...rows, { ticker: s.ticker, qty: String(qty), cost: String(cost), currentPrice: price, orgName: s.name, assetType: s.type }],
    );
    setSel(null); setQ(''); setQty(1); setCost(0);
  };

  const create = async () => {
    setCreating(true);
    try {
      await addClient({
        name: name.trim(),
        email: email.trim() || name.trim().toLowerCase().replace(/\s+/g, '.') + '@client.com',
        risk, horizon, strategy,
        holdings: added.map((r) => ({
          ticker: r.ticker, qty: Number(r.qty) || 0, avgCost: Number(r.cost) || 0,
          currentPrice: r.currentPrice, orgName: r.orgName, assetType: r.assetType,
        })),
        watchlist: [],
      });
      onClose();
    } catch (e) {
      showToast('Failed to create client — ' + (e instanceof Error ? e.message : 'server error'));
    } finally {
      setCreating(false);
    }
  };

  const selected = matches.find((s) => s.ticker === sel);

  return (
    <Modal onClose={onClose} width={640} closeOnBackdrop={false}>
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '88vh', overflow: 'hidden' }}>
        <div style={{ padding: '26px 28px 18px', flexShrink: 0 }}>
          <div className="row gap-10">
            <div className="insight-icon" style={{ background: 'var(--brand-soft)' }}>
              <Icon name="users" size={15} color="var(--brand-2)" />
            </div>
            <div className="card-title">Onboard a new client</div>
            <button className="btn btn-icon btn-ghost" style={{ marginLeft: 'auto' }} onClick={onClose}><Icon name="x" /></button>
          </div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 28px' }}>
          <div className="col gap-16">
            <div className="row gap-12">
              <div className="grow">
                <label className="field-label">Full name</label>
                <input className="input" placeholder="Dana Whitfield" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </div>
              <div className="grow">
                <label className="field-label">Email</label>
                <input className="input" placeholder="dana@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="field-label">Risk tolerance</label>
              <div className="seg" style={{ display: 'flex' }}>
                {RISKS.map((r) => (
                  <button key={r} className={risk === r ? 'on' : ''} style={{ flex: 1 }} onClick={() => setRisk(r)}>{r}</button>
                ))}
              </div>
            </div>
            <div className="row gap-12">
              <div className="grow">
                <label className="field-label">Growth horizon</label>
                <select className="select" style={{ width: '100%' }} value={horizon} onChange={(e) => setHorizon(e.target.value)}>
                  {HORIZONS.map((h) => <option key={h}>{h}</option>)}
                </select>
              </div>
              <div className="grow">
                <label className="field-label">Investment strategy</label>
                <select className="select" style={{ width: '100%' }} value={strategy} onChange={(e) => setStrategy(e.target.value)}>
                  {STRATEGIES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ padding: '14px 16px', background: 'var(--surface-2)', borderRadius: 12, border: '1px solid var(--line)' }}>
              <label className="field-label">Initial holdings <span className="muted">(optional)</span></label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <Icon name="search" size={16} color="var(--ink-4)" />
                </span>
                <input className="input" style={{ paddingLeft: 38 }} placeholder="Search ticker or company name"
                  value={q} onChange={(e) => { setQ(e.target.value); setSel(null); }} />
              </div>
              <div className="col gap-6" style={{ marginTop: 10, maxHeight: 90, overflowY: 'auto', paddingRight: 2 }}>
                {stocksLoading && <LoadDots />}
                {!stocksLoading && q && matches.length === 0 && <div className="empty">No matches for "{q}".</div>}
                {!stocksLoading && matches.slice(0, 40).map((s) => (
                  <div key={s.ticker} className="sresult"
                    style={{ padding: '8px 12px', cursor: 'pointer', background: sel === s.ticker ? 'var(--brand-soft)' : 'var(--surface)', borderColor: sel === s.ticker ? 'var(--brand-2)' : undefined }}
                    onClick={() => { setSel(sel === s.ticker ? null : s.ticker); setQty(1); setCost(0); }}>
                    <span className="ticker" style={{ minWidth: 46, fontSize: 11 }}>{s.ticker}</span>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 600, fontSize: 12 }}>{s.name}</span>
                      <span className="pill pill-gray" style={{ marginLeft: 5, fontSize: 10 }}>{s.type}</span>
                    </div>
                    <Icon name="plus" size={12} color="var(--ink-3)" />
                  </div>
                ))}
              </div>
              {selected && (
                <div className="row gap-12 wrap" style={{ padding: '12px 14px', background: 'var(--surface)', borderRadius: 10, marginTop: 10, border: '1px solid var(--brand-2)' }}>
                  <span className="ticker" style={{ fontSize: 13 }}>{selected.ticker}</span>
                  <div className="row gap-6">
                    <label className="tiny muted">Qty</label>
                    <input className="input input-sm tnum" style={{ width: 88 }} type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
                  </div>
                  <div className="row gap-6">
                    <label className="tiny muted">Avg cost</label>
                    <input className="input input-sm tnum" style={{ width: 100 }} type="number" value={cost} onChange={(e) => setCost(Number(e.target.value))} />
                  </div>
                  <button className="btn btn-primary btn-sm" disabled={priceBusy} onClick={() => addRow(selected)}>
                    {priceBusy ? '…' : 'Add holding'}
                  </button>
                  <button className="linklike tiny" onClick={() => setSel(null)}>cancel</button>
                </div>
              )}
              {added.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                  <div className="tiny muted" style={{ marginBottom: 8, fontWeight: 600, letterSpacing: '0.03em' }}>Added ({added.length})</div>
                  <div className="col gap-6">
                    {added.map((r, i) => (
                      <div key={r.ticker} className="row gap-10" style={{ padding: '9px 12px', border: '1px solid var(--line)', borderRadius: 10, background: 'var(--surface)' }}>
                        <span className="ticker">{r.ticker}</span>
                        <span className="tiny muted grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.orgName}</span>
                        <span className="tiny tnum">{r.qty} × ${Number(r.cost).toFixed(2)}</span>
                        {r.currentPrice != null && <span className="pill pill-pos" style={{ fontSize: 11 }}>${r.currentPrice.toFixed(2)}</span>}
                        <button className="btn btn-icon btn-ghost" style={{ width: 22, height: 22, padding: 0 }}
                          onClick={() => setAdded((rows) => rows.filter((_, j) => j !== i))}>
                          <Icon name="x" size={11} color="var(--ink-3)" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{ padding: '14px 28px 22px', borderTop: '1px solid var(--line)', flexShrink: 0, background: 'var(--surface)' }}>
          <button className="btn btn-primary btn-block btn-lg" disabled={name.trim().length < 2 || creating} onClick={create}>
            {creating ? 'Creating…' : 'Create client'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EditHoldingsModal({ client, onClose }) {
  const { replaceHoldings } = useStore();
  const [rows, setRows] = useState(() => client.portfolio.holdings.map((h) => ({ ...h })));
  const update = (id, key, val) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: key === 'ticker' ? val : Number(val) || 0 } : r)));
  return (
    <Modal onClose={onClose} width={600}>
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '88vh', overflow: 'hidden' }}>
        <div style={{ padding: '26px 28px 18px', flexShrink: 0 }}>
          <div className="row gap-10">
            <div className="insight-icon" style={{ background: 'var(--brand-soft)' }}>
              <Icon name="edit" size={15} color="var(--brand-2)" />
            </div>
            <div className="card-title">Edit holdings — {client.portfolio.name}</div>
            <button className="btn btn-icon btn-ghost" style={{ marginLeft: 'auto' }} onClick={onClose}><Icon name="x" /></button>
          </div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 28px' }}>
          <div className="row gap-10" style={{ padding: '0 6px 8px', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-4)' }}>
            <span style={{ width: 150 }}>Security</span>
            <span style={{ width: 92, textAlign: 'right' }}>Shares</span>
            <span style={{ width: 104, textAlign: 'right' }}>Avg cost</span>
            <span style={{ width: 26 }} />
          </div>
          {rows.map((r) => (
            <div key={r.id} className="row gap-10" style={{ padding: '8px 6px', borderBottom: '1px solid var(--line-2)' }}>
              <div style={{ width: 150 }}>
                <div className="ticker">{r.ticker}</div>
                <div className="tkr-name" style={{ fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.orgName ?? lookupStock(r.ticker).name}
                </div>
              </div>
              <input className="input input-sm tnum" style={{ width: 92, textAlign: 'right' }} type="number" value={r.qty} onChange={(e) => update(r.id, 'qty', e.target.value)} />
              <input className="input input-sm tnum" style={{ width: 104, textAlign: 'right' }} type="number" value={r.avgCost} onChange={(e) => update(r.id, 'avgCost', e.target.value)} />
              <button className="btn btn-icon btn-ghost" style={{ width: 26, height: 26, padding: 0 }} onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>
                <Icon name="trash" size={13} color="var(--neg)" />
              </button>
            </div>
          ))}
        </div>
        <div style={{ padding: '16px 28px 22px', borderTop: '1px solid var(--line)', flexShrink: 0, background: 'var(--surface)' }}>
          <div className="row gap-10">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary grow" onClick={() => { replaceHoldings(client.id, rows); onClose(); }}>Save all changes</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function EditWatchlistModal({ client, onClose }) {
  const { removeWatchlistItems } = useStore();
  const [selected, setSelected] = useState(new Set());
  const all = client.portfolio.watchlist.map((w) => w.id);
  const toggle = (id) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <Modal onClose={onClose} width={420}>
      <div className="modal-pad">
        <div className="row gap-10" style={{ marginBottom: 18 }}>
          <div className="card-title">Edit watchlist</div>
          <button className="btn btn-icon btn-ghost" style={{ marginLeft: 'auto' }} onClick={onClose}><Icon name="x" /></button>
        </div>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <span className="tiny muted">{selected.size} selected</span>
          <button className="linklike tiny" onClick={() => setSelected(selected.size === all.length ? new Set() : new Set(all))}>
            {selected.size === all.length ? 'Deselect all' : 'Select all'}
          </button>
        </div>
        <div className="col gap-8">
          {client.portfolio.watchlist.map((w) => (
            <div key={w.id} className="row gap-10"
              style={{ padding: '9px 10px', border: '1px solid var(--line)', borderRadius: 9, cursor: 'pointer', background: selected.has(w.id) ? 'var(--neg-soft)' : 'var(--surface)' }}
              onClick={() => toggle(w.id)}>
              <button className="btn btn-icon" style={{ width: 22, height: 22, padding: 0, border: '1px solid var(--line)', background: selected.has(w.id) ? 'var(--neg)' : 'var(--surface)' }}
                onClick={(e) => { e.stopPropagation(); toggle(w.id); }}>
                {selected.has(w.id) && <Icon name="check" size={12} color="#fff" />}
              </button>
              <span className="ticker">{w.ticker}</span>
              <span className="tkr-name grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {w.orgName ?? lookupStock(w.ticker).name}
              </span>
            </div>
          ))}
        </div>
        <div className="row gap-10" style={{ marginTop: 18 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary grow" style={{ background: selected.size ? 'var(--neg)' : undefined }} disabled={selected.size === 0}
            onClick={() => { removeWatchlistItems(client.id, [...selected]); onClose(); }}>
            Remove {selected.size > 0 ? selected.size : ''} selected
          </button>
        </div>
      </div>
    </Modal>
  );
}

function OcrImport({ onResult }) {
  const { showToast } = useStore();
  const [state, setState] = useState('idle');
  const [fileName, setFileName] = useState('');
  const inputRef = React.useRef(null);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setFileName(file.name);
    setState('scanning');
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const b64 = reader.result.split(',')[1];
        const extMime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', heif: 'image/heif', pdf: 'application/pdf', csv: 'text/csv' };
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        const mime = file.type || extMime[ext] || 'image/jpeg';
        const r = await api('/api/ocr', { method: 'POST', body: JSON.stringify({ imageBase64: b64, mimeType: mime }) });
        const holdings = r.holdings ?? [];
        if (!holdings.length) { showToast('No recognised stocks found in the file'); setState('idle'); return; }
        setState('idle');
        onResult(holdings);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'OCR failed');
        setState('idle');
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <div className="row gap-8" style={{ marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>Import from a file</span>
        <span className="pill pill-ai"><Icon name="sparkle" size={10} color="var(--ai)" /> OCR</span>
      </div>
      {state === 'idle' ? (
        <div className="dropzone" style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 26, cursor: 'pointer' }}
          onClick={() => inputRef.current?.click()}>
          <div className="insight-icon" style={{ background: 'var(--ai-soft)', width: 38, height: 38 }}>
            <Icon name="upload" size={18} color="var(--ai)" />
          </div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Click to upload a portfolio statement</div>
          <div className="tiny muted">JPG · PNG · HEIF · PDF · CSV</div>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/heic,image/heif,application/pdf,.pdf,.csv" style={{ display: 'none' }} onChange={onFile} />
        </div>
      ) : (
        <div className="dropzone over" style={{ alignItems: 'center', justifyContent: 'center', padding: 30 }}>
          <span className="spin spin-ai" style={{ width: 22, height: 22 }} />
          <div style={{ fontWeight: 600, marginTop: 4 }}>Reading {fileName}…</div>
        </div>
      )}
    </div>
  );
}

function ReviewExtractedModal({ clientId, initial, existingHoldings, onClose }) {
  const existing = new Map(existingHoldings.map((h) => [h.ticker, h]));
  const { addHolding } = useStore();
  const [rows, setRows] = useState(initial.map((h) => ({
    ticker: h.ticker, name: h.name, qty: h.qty > 0 ? String(h.qty) : '', avgCost: h.avgCost > 0 ? String(h.avgCost) : '',
    assetType: h.assetType,
  })));
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState(null);

  const save = async () => {
    setBusy(true);
    for (const r of rows) {
      setCurrent(r.ticker);
      await addHolding(clientId, r.ticker, Number(r.qty) || 0, Number(r.avgCost) || 0, { assetType: r.assetType, orgName: r.name });
    }
    setBusy(false);
    setCurrent(null);
    onClose();
  };

  return (
    <Modal onClose={onClose} width={660} closeOnBackdrop={false}>
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '82vh' }}>
        <div style={{ padding: '16px 22px 12px', flexShrink: 0 }}>
          <div className="row gap-10">
            <div className="insight-icon" style={{ background: 'var(--ai-soft)', width: 36, height: 36, borderRadius: 10 }}>
              <Icon name="sparkle" size={16} color="var(--ai)" />
            </div>
            <div className="grow">
              <div style={{ fontWeight: 700, fontSize: 15 }}>Review extracted holdings</div>
              <div className="tiny muted" style={{ marginTop: 2 }}>
                {rows.length} stock{rows.length !== 1 ? 's' : ''} matched · adjust qty & cost if needed
              </div>
            </div>
            <button className="btn btn-icon btn-ghost" onClick={onClose} disabled={busy}><Icon name="x" size={13} /></button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '10px 22px' }}>
          {rows.length === 0 ? (
            <div className="empty">All holdings removed. Close and try a different file.</div>
          ) : (
            <div className="col" style={{ gap: 6 }}>
              {rows.map((r) => {
                const held = existing.get(r.ticker);
                return (
                  <div key={r.ticker} style={{ border: held ? '1.5px solid var(--brand)' : '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', opacity: busy && current !== r.ticker && current !== null ? 0.38 : 1 }}>
                    {held && (
                      <div style={{ background: 'var(--brand-soft)', borderBottom: '1px solid var(--line)', padding: '5px 12px' }}>
                        <div className="row gap-6">
                          <Icon name="check" size={11} color="var(--brand-2)" />
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--brand-2)' }}>Already in portfolio</span>
                          <span className="tiny muted">{held.qty} shares @ {fmtUsd(held.avgCost)}</span>
                        </div>
                      </div>
                    )}
                    <div className="row gap-10" style={{ padding: '10px 12px' }}>
                      <div className="avatar" style={{ width: 32, height: 32, fontSize: 10, borderRadius: 8, flexShrink: 0, fontWeight: 700 }}>
                        {r.ticker.slice(0, 2)}
                      </div>
                      <div className="grow" style={{ minWidth: 0 }}>
                        <div className="row gap-6">
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{r.ticker}</span>
                          <span className="pill pill-gray" style={{ fontSize: 10.5 }}>{r.assetType}</span>
                          {busy && current === r.ticker && (
                            <span className="pill pill-ai" style={{ fontSize: 10.5 }}>
                              <span className="spin spin-ai" style={{ width: 9, height: 9 }} /> Adding
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                      </div>
                      <input className="input input-sm tnum" style={{ width: 80, textAlign: 'right' }} type="number" min={0} placeholder="0"
                        value={r.qty} disabled={busy}
                        onChange={(e) => setRows((rs) => rs.map((x) => (x.ticker === r.ticker ? { ...x, qty: e.target.value } : x)))} />
                      <input className="input input-sm tnum" style={{ width: 90, textAlign: 'right' }} type="number" min={0} step="0.01" placeholder="0.00"
                        value={r.avgCost} disabled={busy}
                        onChange={(e) => setRows((rs) => rs.map((x) => (x.ticker === r.ticker ? { ...x, avgCost: e.target.value } : x)))} />
                      <button className="btn btn-icon btn-ghost" style={{ width: 28, height: 28, padding: 0 }} disabled={busy}
                        onClick={() => setRows((rs) => rs.filter((x) => x.ticker !== r.ticker))}>
                        <Icon name="x" size={11} color="var(--ink-4)" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div style={{ padding: '12px 22px 18px', borderTop: '1px solid var(--line)', flexShrink: 0 }}>
          <div className="row gap-8">
            <button className="btn btn-ghost" onClick={onClose} disabled={busy} style={{ minWidth: 80 }}>Cancel</button>
            <button className="btn btn-primary grow" onClick={save} disabled={busy || rows.length === 0}>
              {busy ? `Adding ${current}…` : `Add ${rows.length} holding${rows.length !== 1 ? 's' : ''} to portfolio`}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function AddHoldingsPanel({ clientId, pf }) {
  const { addHolding, addToWatch } = useStore();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [qty, setQty] = useState(10);
  const [cost, setCost] = useState(0);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/stocks').then((r) => setStocks(Array.isArray(r) ? r : [])).catch(() => setStocks([])).finally(() => setLoading(false));
  }, []);

  const needle = q.trim().toLowerCase();
  const matches = needle ? stocks.filter((s) => s.ticker.toLowerCase().includes(needle) || s.name.toLowerCase().includes(needle)) : stocks;
  const held = new Set(pf.holdings.map((h) => h.ticker));
  const watched = new Set(pf.watchlist.map((w) => w.ticker));

  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 9 }}>Search from Master List</div>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }}>
          <Icon name="search" size={16} color="var(--ink-4)" />
        </span>
        <input className="input" style={{ paddingLeft: 38 }} placeholder="Search ticker or company name"
          value={q} onChange={(e) => { setQ(e.target.value); setSel(null); }} />
      </div>
      <div className="col gap-8" style={{ marginTop: 12, maxHeight: 264, overflowY: 'auto', paddingRight: 2 }}>
        {loading && <LoadDots />}
        {!loading && needle && matches.length === 0 && <div className="empty">No matches for "{q}".</div>}
        {!loading && matches.slice(0, 60).map((s) => (
          <div key={s.ticker}>
            <div className="sresult">
              <span className="ticker" style={{ minWidth: 54 }}>{s.ticker}</span>
              <div className="grow" style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 600, fontSize: 13.5 }}>{s.name}</span>
                <span className="pill pill-gray" style={{ marginLeft: 6 }}>{s.type}</span>
                {held.has(s.ticker) && <span className="pill pill-brand" style={{ marginLeft: 4 }}>in portfolio</span>}
                {watched.has(s.ticker) && <span className="pill pill-gray" style={{ marginLeft: 4 }}>watching</span>}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => { setSel(s.ticker); setCost(0); setQty(10); }}>
                <Icon name="plus" size={12} /> Holding
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => addToWatch(clientId, s.ticker, 'manual', s.name)}>
                <Icon name="plus" size={12} /> Watchlist
              </button>
            </div>
            {sel === s.ticker && (
              <div className="row gap-10 wrap" style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 11, marginTop: 8 }}>
                <span className="ticker">{s.ticker}</span>
                <div className="row gap-6">
                  <label className="tiny muted">Qty</label>
                  <input className="input input-sm tnum" style={{ width: 78 }} type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
                </div>
                <div className="row gap-6">
                  <label className="tiny muted">Avg cost</label>
                  <input className="input input-sm tnum" style={{ width: 92 }} type="number" value={cost} onChange={(e) => setCost(Number(e.target.value))} />
                </div>
                {cost > 0 && <span className="tiny muted">est. {fmtUsd(qty * cost, 0)}</span>}
                <button className="btn btn-primary btn-sm" onClick={() => { addHolding(clientId, s.ticker, qty, cost, { assetType: s.type, orgName: s.name }); setSel(null); setQ(''); }}>
                  Add holding
                </button>
                <button className="linklike tiny" onClick={() => setSel(null)}>cancel</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const newPiRow = () => ({ category: 'Instruments', assetType: '', avgPrice: 0, currentPrice: 0 });

function AddPrivatePanel({ clientId, onSaved }) {
  const { showToast } = useStore();
  const [rows, setRows] = useState([newPiRow()]);
  const [busy, setBusy] = useState(false);
  const update = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = async () => {
    if (rows.some((r) => !r.assetType)) return showToast('Please select an asset type for each investment before adding.');
    if (rows.some((r) => !(r.avgPrice > 0) && !(r.currentPrice > 0))) return showToast('Enter an average or current price for each investment before adding.');
    setBusy(true);
    try {
      await api('/api/private-investments', {
        method: 'POST',
        body: JSON.stringify({
          clientId,
          investments: rows.map((r) => ({ assetCategory: r.category, assetType: r.assetType, avgPrice: r.avgPrice, currentPrice: r.currentPrice })),
        }),
      });
      showToast(`${rows.length} other investment${rows.length !== 1 ? 's' : ''} added successfully.`);
      setRows([newPiRow()]);
      onSaved?.();
    } catch {
      showToast("Couldn't save the other investments — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="col gap-10">
      {rows.map((r, i) => (
        <div key={i} style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--surface-2)' }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <span className="pill pill-gray">Investment {i + 1}</span>
            {rows.length > 1 && (
              <button className="btn btn-icon btn-ghost" style={{ width: 24, height: 24, padding: 0 }} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                <Icon name="x" size={12} color="var(--ink-3)" />
              </button>
            )}
          </div>
          <div className="row" style={{ gap: 0, marginBottom: 12 }}>
            {['Instruments', 'Unlisted'].map((cat, j) => (
              <button key={cat} className={'btn btn-sm ' + (r.category === cat ? 'btn-primary' : 'btn-soft')}
                style={{ borderRadius: j === 0 ? '8px 0 0 8px' : '0 8px 8px 0', flex: 1 }}
                onClick={() => update(i, { category: cat, assetType: '' })}>
                {cat}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 12px' }}>
            <div className="col gap-4" style={{ gridColumn: '1 / -1' }}>
              <label className="tiny muted">Asset type</label>
              <select className="input input-sm" value={r.assetType} onChange={(e) => update(i, { assetType: e.target.value })}>
                <option value="" disabled>Select asset type…</option>
                {PI_TYPES[r.category].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="col gap-4">
              <label className="tiny muted">Avg price</label>
              <input className="input input-sm tnum" type="number" value={r.avgPrice} onChange={(e) => update(i, { avgPrice: Number(e.target.value) })} />
            </div>
            <div className="col gap-4">
              <label className="tiny muted">Current price</label>
              <input className="input input-sm tnum" type="number" value={r.currentPrice} onChange={(e) => update(i, { currentPrice: Number(e.target.value) })} />
            </div>
          </div>
        </div>
      ))}
      <button className="row gap-6" style={{ justifyContent: 'center', padding: '10px 0', border: '1px dashed var(--line)', borderRadius: 10, background: 'transparent', color: 'var(--ink-2)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
        onClick={() => setRows((rs) => [...rs, newPiRow()])}>
        <Icon name="plus" size={13} /> Add another investment
      </button>
      <button className="btn btn-primary btn-block" onClick={save} disabled={busy}>
        {busy ? 'Saving…' : 'Add to other investment'}
      </button>
    </div>
  );
}

function EditPisModal({ initial, onClose, onSaved }) {
  const { showToast } = useStore();
  const [rows, setRows] = useState(() => initial.map((r) => ({ ...r })));
  const [busy, setBusy] = useState(false);
  const update = (id, patch) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const save = async () => {
    setBusy(true);
    try {
      const keep = new Set(rows.map((r) => r.id));
      const removed = initial.filter((r) => !keep.has(r.id));
      await Promise.all([
        ...removed.map((r) => api(`/api/private-investments/${r.id}`, { method: 'DELETE' })),
        ...rows.map((r) => api(`/api/private-investments/${r.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ assetCategory: r.assetCategory, assetType: r.assetType, avgPrice: r.avgPrice, currentPrice: r.currentPrice }),
        })),
      ]);
      showToast('Other investments updated');
      onSaved();
      onClose();
    } catch {
      showToast('Failed to save — check connection');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={600}>
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '88vh', overflow: 'hidden' }}>
        <div style={{ padding: '26px 28px 18px', flexShrink: 0 }}>
          <div className="row gap-10">
            <div className="insight-icon" style={{ background: 'var(--brand-soft)' }}>
              <Icon name="edit" size={15} color="var(--brand-2)" />
            </div>
            <div className="card-title">Edit other investments</div>
            <button className="btn btn-icon btn-ghost" style={{ marginLeft: 'auto' }} onClick={onClose}><Icon name="x" /></button>
          </div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 28px' }}>
          {rows.length === 0 ? (
            <div className="empty" style={{ padding: '28px 0' }}>All other investments removed. Save to confirm.</div>
          ) : (
            <div className="col gap-10">
              {rows.map((r) => (
                <div key={r.id} style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 12, background: 'var(--surface-2)' }}>
                  <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                    <span className="pill pill-gray">{r.assetType || 'Investment'}</span>
                    <button className="btn btn-icon btn-ghost" style={{ width: 26, height: 26, padding: 0 }} onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>
                      <Icon name="trash" size={13} color="var(--neg)" />
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 12px' }}>
                    <div className="col gap-4">
                      <label className="tiny muted">Avg price</label>
                      <input className="input input-sm tnum" type="number" value={r.avgPrice} onChange={(e) => update(r.id, { avgPrice: Number(e.target.value) })} />
                    </div>
                    <div className="col gap-4">
                      <label className="tiny muted">Current price</label>
                      <input className="input input-sm tnum" type="number" value={r.currentPrice} onChange={(e) => update(r.id, { currentPrice: Number(e.target.value) })} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding: '16px 28px 22px', borderTop: '1px solid var(--line)', flexShrink: 0 }}>
          <div className="row gap-10">
            <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="btn btn-primary grow" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save all changes'}</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function PiListCard({ clientId, refreshKey, onChanged }) {
  const [pis, setPis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const loadPis = () => {
    setLoading(true);
    api(`/api/private-investments?clientId=${encodeURIComponent(clientId)}`)
      .then((r) => setPis(Array.isArray(r) ? r : []))
      .catch(() => setPis([]))
      .finally(() => setLoading(false));
  };
  useEffect(loadPis, [clientId, refreshKey]);

  return (
    <div className="card card-pad">
      <div className="card-head" style={{ marginBottom: 14 }}>
        <div>
          <div className="card-title">Other investments</div>
          <div className="card-sub">Edit prices & asset type, or remove.</div>
        </div>
        {pis.length > 0 && (
          <button className="btn btn-soft btn-sm" onClick={() => setEditing(true)}>
            <Icon name="edit" size={13} /> Edit
          </button>
        )}
      </div>
      {loading ? <LoadDots /> : pis.length === 0 ? (
        <div className="empty tiny" style={{ padding: '16px 0' }}>No other investments yet. Add one on the left.</div>
      ) : (
        <div className="col gap-8">
          {pis.map((p) => (
            <div key={p.id} className="row gap-10" style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 10 }}>
              <div className="grow" style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{p.assetType || '—'}</div>
                <div className="tiny muted" style={{ marginTop: 2 }}>{p.assetCategory}</div>
              </div>
              <div className="tnum tiny" style={{ fontWeight: 600 }}>{fmtUsd(p.currentPrice, 0)}</div>
            </div>
          ))}
        </div>
      )}
      {editing && <EditPisModal initial={pis} onClose={() => setEditing(false)} onSaved={() => { loadPis(); onChanged(); }} />}
    </div>
  );
}

function DragBoard({ client }) {
  const { moveHoldingToWatch, moveWatchToHolding } = useStore();
  const [over, setOver] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [editHoldings, setEditHoldings] = useState(false);
  const [editWatch, setEditWatch] = useState(false);
  const rows = holdingRows(client.portfolio);

  const drop = (zone) => {
    if (!dragging) return;
    if (dragging.from === 'pf' && zone === 'watch') moveHoldingToWatch(client.id, dragging.id);
    if (dragging.from === 'watch' && zone === 'pf') moveWatchToHolding(client.id, dragging.id);
    setDragging(null);
    setOver(null);
  };

  return (
    <div className="card card-pad">
      <div className="card-head" style={{ marginBottom: 14 }}>
        <div>
          <div className="card-title">Portfolio & watchlist</div>
          <div className="card-sub">Drag to copy between columns.</div>
        </div>
      </div>
      <div className="col gap-16">
        <div>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="tiny muted" style={{ fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Holdings · {rows.length}
            </div>
            {rows.length > 0 && (
              <button className="btn btn-soft btn-sm" onClick={() => setEditHoldings(true)}>
                <Icon name="edit" size={13} /> Edit holdings
              </button>
            )}
          </div>
          <div className={'dropzone' + (over === 'pf' ? ' over' : '')}
            onDragOver={(e) => { e.preventDefault(); setOver('pf'); }}
            onDragLeave={() => setOver(null)}
            onDrop={() => drop('pf')}>
            {rows.length === 0 && <div className="empty tiny">Drag here to add to portfolio</div>}
            {rows.map((r) => (
              <div key={r.id} draggable
                onDragStart={() => setDragging({ from: 'pf', id: r.id })}
                onDragEnd={() => setDragging(null)}
                className={'dragcard' + (dragging?.id === r.id ? ' dragging' : '')}>
                <Icon name="drag" size={16} color="var(--ink-4)" />
                <span className="ticker">{r.ticker}</span>
                <span className="tkr-name grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="tiny muted" style={{ fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Watchlist · {client.portfolio.watchlist.length}
            </div>
            {client.portfolio.watchlist.length > 0 && (
              <button className="btn btn-soft btn-sm" onClick={() => setEditWatch(true)}>
                <Icon name="edit" size={13} /> Edit watchlist
              </button>
            )}
          </div>
          <div className={'dropzone' + (over === 'watch' ? ' over' : '')}
            onDragOver={(e) => { e.preventDefault(); setOver('watch'); }}
            onDragLeave={() => setOver(null)}
            onDrop={() => drop('watch')}>
            {client.portfolio.watchlist.length === 0 && (
              <div style={{ padding: '18px 0', textAlign: 'center' }}>
                <div className="muted" style={{ fontSize: 13, fontWeight: 500 }}>No securities on watchlist</div>
                <div className="tiny muted" style={{ marginTop: 4 }}>Search above and click Watchlist, or drag a holding here</div>
              </div>
            )}
            {client.portfolio.watchlist.map((w) => (
              <div key={w.id} draggable
                onDragStart={() => setDragging({ from: 'watch', id: w.id })}
                onDragEnd={() => setDragging(null)}
                className={'dragcard' + (dragging?.id === w.id ? ' dragging' : '')}>
                <Icon name="drag" size={16} color="var(--ink-4)" />
                <span className="ticker">{w.ticker}</span>
                <span className="tkr-name grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {w.orgName ?? lookupStock(w.ticker).name}
                </span>
                {w.source === 'ai' && <span className="pill pill-ai">AI</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
      {editHoldings && <EditHoldingsModal client={client} onClose={() => setEditHoldings(false)} />}
      {editWatch && <EditWatchlistModal client={client} onClose={() => setEditWatch(false)} />}
    </div>
  );
}

export default function Manage() {
  const client = useActiveClient();
  const [showNew, setShowNew] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [piRefresh, setPiRefresh] = useState(0);

  return (
    <div className="page">
      <div className="container">
        <div className="row wrap" style={{ justifyContent: 'space-between', marginBottom: 24, alignItems: 'flex-end' }}>
          <div>
            <h1 className="page-h">Manage Portfolios</h1>
            <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>Onboard clients, build portfolios and import holdings.</div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>
            <Icon name="plus" size={15} color="#fff" /> New client
          </button>
        </div>

        {client ? (
          <div className="col gap-16">
            <ClientSummaryCard client={client} piRefresh={piRefresh} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
              <div className="col gap-16">
                <div className="card card-pad">
                  <div className="card-title" style={{ marginBottom: 16 }}>Add holdings</div>
                  <AddHoldingsPanel clientId={client.id} pf={client.portfolio} />
                  <hr className="divider" style={{ margin: '18px 0' }} />
                  <OcrImport onResult={setOcrResult} />
                </div>
                <div className="card card-pad">
                  <div className="card-title" style={{ marginBottom: 16 }}>Add other investments</div>
                  <AddPrivatePanel clientId={client.id} onSaved={() => setPiRefresh((n) => n + 1)} />
                </div>
              </div>
              <div className="col gap-16">
                <DragBoard client={client} />
                <PiListCard clientId={client.id} refreshKey={piRefresh} onChanged={() => setPiRefresh((n) => n + 1)} />
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No clients yet"
            body="Add your first client to start building portfolios, importing holdings, and managing their book."
            action={<button className="btn btn-primary btn-lg" onClick={() => setShowNew(true)}><Icon name="plus" size={15} color="#fff" /> Onboard first client</button>}
            footnote="Takes less than a minute to set up"
          />
        )}
      </div>
      {showNew && <NewClientModal onClose={() => setShowNew(false)} />}
      {ocrResult && client && (
        <ReviewExtractedModal clientId={client.id} initial={ocrResult} existingHoldings={client.portfolio.holdings} onClose={() => setOcrResult(null)} />
      )}
    </div>
  );
}
