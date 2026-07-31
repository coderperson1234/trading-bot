import React, { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { api, fetchPrice } from '../lib/api';
import { fmtUsd } from '../lib/format';
import { Icon, Modal } from './ui';

// Sell / reduce a holding straight from a holdings row.
export default function SellHolding({ clientId, holding, size = 'sm' }) {
  const { sellHolding } = useStore();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(holding.qty);
  const [price, setPrice] = useState(holding.currentPrice ?? null);
  const [alpacaOn, setAlpacaOn] = useState(false);
  const [placeOrder, setPlaceOrder] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQty(holding.qty);
    fetchPrice(holding.ticker).then((p) => { if (p) setPrice(p); });
    api('/api/alpaca/status').then((s) => setAlpacaOn(Boolean(s.configured))).catch(() => setAlpacaOn(false));
  }, [open, holding.ticker, holding.qty]);

  const confirm = async () => {
    setBusy(true);
    try {
      await sellHolding(clientId, holding.id, qty, { placeOrder: alpacaOn && placeOrder });
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const proceeds = (Number(qty) || 0) * (price ?? 0);
  const full = Number(qty) >= holding.qty;

  return (
    <>
      <button className={`btn btn-${size} btn-ghost`} style={{ color: 'var(--neg)' }} onClick={() => setOpen(true)}
        title={`Sell ${holding.ticker}`}>
        <Icon name="trend" size={12} color="var(--neg)" /> Sell
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} width={420}>
          <div className="modal-pad">
            <div className="row gap-10" style={{ marginBottom: 6 }}>
              <div className="insight-icon" style={{ background: 'var(--neg-soft)' }}>
                <Icon name="trend" size={15} color="var(--neg)" />
              </div>
              <div>
                <div className="card-title">Sell {holding.ticker}</div>
                <div className="card-sub">You hold {holding.qty} shares</div>
              </div>
              <button className="btn btn-icon btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => setOpen(false)}>
                <Icon name="x" />
              </button>
            </div>
            <div className="tiny muted" style={{ margin: '14px 0 10px' }}>
              {price != null ? <>Current price <b style={{ color: 'var(--ink)' }}>{fmtUsd(price)}</b></> : 'No live price available'}
            </div>
            <label className="field-label">Shares to sell</label>
            <div className="row gap-8">
              <input className="input tnum grow" type="number" min={0} max={holding.qty} value={qty}
                onChange={(e) => setQty(Math.min(Number(e.target.value), holding.qty))} autoFocus />
              <button className="btn btn-ghost btn-sm" onClick={() => setQty(holding.qty)}>Max</button>
            </div>
            {proceeds > 0 && (
              <div className="tiny muted" style={{ marginTop: 8 }}>
                Estimated proceeds {fmtUsd(proceeds, 0)}{full ? ' · closes the position' : ''}
              </div>
            )}
            {alpacaOn && (
              <label className="row gap-8" style={{ marginTop: 14, cursor: 'pointer' }}>
                <input type="checkbox" checked={placeOrder} onChange={(e) => setPlaceOrder(e.target.checked)} />
                <span className="tiny">Also submit a market SELL order to Alpaca (paper)</span>
              </label>
            )}
            <div className="row gap-10" style={{ marginTop: 18 }}>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-neg grow" onClick={confirm} disabled={busy || qty <= 0}>
                {busy ? 'Selling…' : full ? `Sell all ${holding.ticker}` : `Sell ${qty} ${holding.ticker}`}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
