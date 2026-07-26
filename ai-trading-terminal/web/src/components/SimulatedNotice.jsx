import React from 'react';
import { Icon } from './ui';

// Honest labelling: prices come from the live market data provider, but the
// analyst estimates / fundamentals / prediction-market odds on these pages are
// generated placeholders, not real research. Never let them read as real.
export default function SimulatedNotice({ what = 'analyst estimates, fundamentals and prediction-market odds' }) {
  return (
    <div
      className="card"
      style={{
        padding: '12px 16px',
        marginBottom: 16,
        borderColor: 'oklch(0.82 0.09 75)',
        background: 'oklch(0.98 0.03 90)',
      }}
    >
      <div className="row gap-10" style={{ alignItems: 'flex-start' }}>
        <div className="insight-icon" style={{ background: 'oklch(0.94 0.07 85)', flexShrink: 0 }}>
          <Icon name="bolt" size={14} color="oklch(0.52 0.13 75)" />
        </div>
        <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink-2)' }}>
          <b style={{ color: 'oklch(0.45 0.12 60)' }}>Prices are live. The {what} on this page are simulated placeholders.</b>{' '}
          They are generated for demonstration and are <b>not real analyst research</b> — do not
          rely on them for investment decisions. Connect a fundamentals/estimates data provider to
          replace them with real figures.
        </div>
      </div>
    </div>
  );
}
