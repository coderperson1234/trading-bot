import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { useStore } from './lib/store';
import { api } from './lib/api';
import { setMasterList } from './lib/portfolio';
import { Icon, BrandMark, Modal } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Manage from './pages/Manage';
import Recommender from './pages/Recommender';
import Swarm from './pages/Swarm';
import Valuation from './pages/Valuation';
import StockFinder from './pages/StockFinder';
import PredictionMarket from './pages/PredictionMarket';
import ComingSoon from './pages/ComingSoon';
import Trading from './pages/Trading';
import QuantBot from './pages/QuantBot';

const TABS = [
  ['/', 'Dashboard', true],
  ['/manage', 'Manage Portfolios'],
  ['/watchlist', 'AI Recommender'],
  ['/ai-swarm', 'AI Swarm Playground'],
  ['/analysis', 'Analysis'],
  ['/valuation', 'Valuation'],
  ['/stock-finder', 'Stock Finder'],
  ['/prediction-market', 'Prediction Market'],
  ['/risk-exposure', 'Risk Exposure'],
  ['/trading', 'Trading'],
  ['/quant-bot', 'Quant Bot'],
];

function Nav() {
  const { advisor, clients, activeClientId, setActiveClient, logout } = useStore();
  const [confirmOut, setConfirmOut] = useState(false);
  const cls = ({ isActive }) => 'nav-tab' + (isActive ? ' active' : '');
  return (
    <>
      {confirmOut && (
        <Modal onClose={() => setConfirmOut(false)}>
          <div className="modal-pad" style={{ textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--neg-soft)', display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}>
              <Icon name="logout" size={24} color="var(--neg)" />
            </div>
            <div className="serif" style={{ fontSize: 22, fontWeight: 500, marginBottom: 8 }}>Sign out?</div>
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>
              You'll need to sign back in to access your portfolios and client data.
            </p>
            <div className="row gap-10" style={{ justifyContent: 'center' }}>
              <button className="btn btn-soft" style={{ minWidth: 100 }} onClick={() => setConfirmOut(false)}>Cancel</button>
              <button className="btn btn-neg" style={{ minWidth: 100 }} onClick={() => { logout(); setConfirmOut(false); }}>Sign out</button>
            </div>
          </div>
        </Modal>
      )}
      <div className="nav">
        <div className="container nav-inner">
          <div className="brand">
            <BrandMark size={46} />
            <div className="brand-name">
              AI Trading Terminal
              <small>Onboard. Allocate. Outperform.</small>
            </div>
          </div>
          <div className="nav-right">
            {clients.length > 0 && (
              <>
                <select className="select" value={activeClientId ?? ''} onChange={(e) => setActiveClient(e.target.value)}>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div style={{ width: 1, height: 26, background: 'var(--line)' }} />
              </>
            )}
            <div className="row gap-8">
              <div className="avatar">
                {advisor.fullName.split(' ').map((w) => w[0]).slice(0, 2).join('')}
              </div>
              <div style={{ lineHeight: 1.15, whiteSpace: 'nowrap' }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{advisor.fullName}</div>
                <div className="tiny muted">Wealth Manager</div>
              </div>
            </div>
            <button className="btn btn-ghost btn-icon" title="Log out" onClick={() => setConfirmOut(true)}>
              <Icon name="logout" size={16} color="var(--ink-3)" />
            </button>
          </div>
        </div>
        <div className="nav-tabs-bar">
          <div className="container">
            <div className="nav-tabs">
              {TABS.map(([to, label, end]) => (
                <NavLink key={to} to={to} end={end} className={cls}>{label}</NavLink>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function App() {
  const { ready, user, initAuth, toast } = useStore();
  const nav = useNavigate();

  useEffect(() => { initAuth(); }, []);
  useEffect(() => {
    if (user) api('/api/stocks').then(setMasterList).catch(() => {});
  }, [user]);

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <span className="spin" style={{ width: 28, height: 28, borderWidth: 3 }} />
      </div>
    );
  }
  if (!user) return <Login onSuccess={() => nav('/', { replace: true })} />;

  return (
    <div className="shell">
      <Nav />
      <div className="grow">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/manage" element={<Manage />} />
          <Route path="/watchlist" element={<Recommender />} />
          <Route path="/ai-swarm" element={<Swarm />} />
          <Route path="/analysis" element={<ComingSoon title="Analysis" />} />
          <Route path="/valuation" element={<Valuation />} />
          <Route path="/stock-finder" element={<StockFinder />} />
          <Route path="/prediction-market" element={<PredictionMarket />} />
          <Route path="/risk-exposure" element={<ComingSoon title="Risk Exposure" />} />
          <Route path="/trading" element={<Trading />} />
          <Route path="/quant-bot" element={<QuantBot />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {toast && (
        <div className="toast">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="oklch(0.7 0.12 152)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4,10.5 8,14.5 16,5.5" />
          </svg>
          {toast}
        </div>
      )}
    </div>
  );
}
