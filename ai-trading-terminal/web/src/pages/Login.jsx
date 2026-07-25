import React, { useState } from 'react';
import { useStore } from '../lib/store';
import { BrandMark, Icon } from '../components/ui';

const HIGHLIGHTS = [
  { k: 'Paper + Live', v: 'Alpaca connectivity built in' },
  { k: '11 modules', v: 'from dashboards to quant bots' },
  { k: 'AI-assisted', v: 'insights on every portfolio' },
];

export default function Login({ onSuccess }) {
  const { login, signup } = useStore();
  const [mode, setMode] = useState('login');
  const [id, setId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'login') await login(id, password);
      else await signup(email, password, fullName, username);
      onSuccess?.(mode);
    } catch (err) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1.05fr 0.95fr' }}>
      <div style={{ background: 'var(--brand)', color: '#fff', padding: '44px 56px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.5,
          background: 'radial-gradient(120% 80% at 100% 0%, oklch(0.45 0.07 258) 0%, transparent 55%), radial-gradient(90% 70% at 0% 100%, oklch(0.40 0.06 280) 0%, transparent 50%)',
        }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
          <BrandMark size={66} />
          <div style={{ fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em' }}>AI Trading Terminal</div>
        </div>
        <div style={{ position: 'relative', marginTop: 'auto', marginBottom: 'auto', paddingTop: 60, paddingBottom: 40 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 44, lineHeight: 1.08, letterSpacing: '-0.02em', maxWidth: 460 }}>
            Onboard. Allocate. Outperform.
          </div>
          <p style={{ marginTop: 20, fontSize: 16, lineHeight: 1.55, color: 'oklch(0.92 0.02 258)', maxWidth: 440 }}>
            Onboard clients, build and rebalance portfolios, trade through Alpaca,
            and run quant strategies — all in one workspace built for wealth managers.
          </p>
          <div style={{ display: 'flex', gap: 40, marginTop: 44 }}>
            {HIGHLIGHTS.map((h) => (
              <div key={h.k}>
                <div className="serif tnum" style={{ fontSize: 28, fontWeight: 500 }}>{h.k}</div>
                <div style={{ fontSize: 12.5, color: 'oklch(0.85 0.02 258)', marginTop: 2 }}>{h.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', placeItems: 'center', padding: 32, background: 'var(--bg)' }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div className="seg" style={{ marginBottom: 26 }}>
            <button className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>Log in</button>
            <button className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>Create account</button>
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 30, letterSpacing: '-0.015em', margin: '0 0 6px' }}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="muted" style={{ margin: '0 0 26px', fontSize: 14 }}>
            {mode === 'login' ? 'Sign in to your trading workspace.' : 'Set up your trading workspace in seconds.'}
          </p>
          <form onSubmit={submit} className="col gap-16">
            {mode === 'login' ? (
              <div>
                <label className="field-label">Email or username</label>
                <input className="input" placeholder="name@example.com" value={id}
                  onChange={(e) => setId(e.target.value)} required autoComplete="username" />
              </div>
            ) : (
              <>
                <div>
                  <label className="field-label">Email</label>
                  <input className="input" type="email" placeholder="name@example.com" value={email}
                    onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                </div>
                <div>
                  <label className="field-label">Full name</label>
                  <input className="input" placeholder="Jane Smith" value={fullName}
                    onChange={(e) => setFullName(e.target.value)} required autoComplete="name" />
                </div>
                <div>
                  <label className="field-label">Username</label>
                  <input className="input" placeholder="janesmith" value={username}
                    onChange={(e) => setUsername(e.target.value)} required autoComplete="username" />
                </div>
              </>
            )}
            <div>
              <label className="field-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input className="input" style={{ paddingRight: 42 }} placeholder="••••••••"
                  type={showPw ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)} required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'grid', placeItems: 'center', padding: 6, background: 'none', border: 'none', cursor: 'pointer' }}>
                  <Icon name={showPw ? 'eye-off' : 'eye'} size={18} color="var(--ink-4)" />
                </button>
              </div>
            </div>
            {error && <div className="tiny" style={{ color: 'var(--neg)' }}>{error}</div>}
            <button className="btn btn-primary btn-lg btn-block" disabled={busy} style={{ marginTop: 4 }}>
              {busy
                ? (<><span className="spin" style={{ borderColor: 'oklch(1 0 0 / 0.3)', borderTopColor: '#fff' }} /> {mode === 'login' ? 'Signing in…' : 'Creating account…'}</>)
                : mode === 'login' ? 'Log in' : 'Sign up'}
            </button>
          </form>
          <p className="tiny muted" style={{ textAlign: 'center', marginTop: 22 }}>
            Demo login: <span className="kbd">jmorgan</span> / <span className="kbd">Password@123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
