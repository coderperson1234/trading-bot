import React, { useEffect, useState } from 'react';
import { useStore, useActiveClient } from '../lib/store';
import { fetchPrice } from '../lib/api';
import { fmtUsd } from '../lib/format';
import { Icon, Modal } from './ui';

// Compact "Add to portfolio" control usable in any table row.
// Adds to whichever client is currently active (top-bar selector).
export default function AddToPortfolio({ ticker, name, assetType, size = 'sm' }) {
  const client = useActiveClient();
  const { addHolding, showToast } = useStore();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(10);
  const [cost, setCost] = useState(0);
  const [price, setPrice] = useState(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const held = client?.portfolio.holdings.some((h) => h.ticker === ticker);

  useEffect(() => {
    if (!open) return;
    setPriceLoading(true);
    fetchPrice(ticker)
      .then((p) => {
        setPrice(p);
        if (p) setCost((c) => (c > 0 ? c : Number(p.toFixed(2))));
      })
      .finally(() => setPriceLoading(false));
  }, [open, ticker]);

  const confirm = async () => {
    setBusy(true);
    try {
      await addHolding(client.id, ticker, Number(qty) || 0, Number(cost) || 0, {
        assetType,
        orgName: name,
      });
      setOpen(false);
      setQty(10);
      setCost(0);
    } catch (e) {
      showToast(e.message || 'Failed to add holding');
    } finally {
      setBusy(false);
    }
  };

  if (!client) {
    return (
      <span className="tip" data-tip="Select a client first">
        <button className={`btn btn-ghost btn-${size}`} disabled>
          <Icon name="plus" size={12} /> Add
        </button>
      </span>
    );
  }

  return (
    <>
      <button
        className={`btn btn-${size} ${held ? 'btn-soft' : 'btn-ghost'}`}
        onClick={() => setOpen(true)}
        title={held ? `${ticker} is already in this portfolio — add more` : `Add ${ticker} to ${client.name}'s portfolio`}
      >
        <Icon name="plus" size={12} /> {held ? 'Add more' : 'Add'}
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} width={420}>
          <div className="modal-pad">
            <div className="row gap-10" style={{ marginBottom: 6 }}>
              <div className="insight-icon" style={{ background: 'var(--brand-soft)' }}>
                <Icon name="plus" size={15} color="var(--brand-2)" />
              </div>
              <div>
                <div className="card-title">Add to portfolio</div>
                <div className="card-sub">{client.name} · {client.portfolio.name}</div>
              </div>
              <button className="btn btn-icon btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => setOpen(false)}>
                <Icon name="x" />
              </button>
            </div>
            <div className="row gap-10" style={{ margin: '14px 0 4px', alignItems: 'center' }}>
              <span className="ticker" style={{ fontSize: 14 }}>{ticker}</span>
              {name && <span className="tkr-name grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>}
              {assetType && <span className="pill pill-gray">{assetType}</span>}
              {held && <span className="pill pill-brand">in portfolio</span>}
            </div>
            <div className="tiny muted" style={{ marginBottom: 14 }}>
              {priceLoading ? 'Fetching current price…' : price != null ? <>Current price <b style={{ color: 'var(--ink)' }}>{fmtUsd(price)}</b></> : 'No live price — enter avg cost manually'}
            </div>
            <div className="row gap-12">
              <div className="grow">
                <label className="field-label">Quantity</label>
                <input className="input tnum" type="number" min={0} value={qty} onChange={(e) => setQty(Number(e.target.value))} autoFocus />
              </div>
              <div className="grow">
                <label className="field-label">Avg cost</label>
                <input className="input tnum" type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(Number(e.target.value))} />
              </div>
            </div>
            {qty > 0 && cost > 0 && (
              <div className="tiny muted" style={{ marginTop: 8 }}>Estimated cost basis {fmtUsd(qty * cost, 0)}</div>
            )}
            <div className="row gap-10" style={{ marginTop: 18 }}>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary grow" onClick={confirm} disabled={busy || qty <= 0}>
                {busy ? 'Adding…' : `Add ${ticker} to portfolio`}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
