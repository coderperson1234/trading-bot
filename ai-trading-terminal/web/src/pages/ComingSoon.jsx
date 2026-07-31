import React from 'react';
import { Icon } from '../components/ui';

export default function ComingSoon({ title }) {
  return (
    <div className="page">
      <div className="container">
        <div style={{ marginBottom: 24 }}>
          <h1 className="page-h">{title}</h1>
        </div>
        <div className="card card-pad" style={{ display: 'grid', placeItems: 'center', minHeight: '52vh' }}>
          <div style={{ textAlign: 'center', maxWidth: 420, padding: '0 24px' }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: 'var(--ai-soft)', border: '1.5px solid var(--ai-line)', display: 'grid', placeItems: 'center', margin: '0 auto 24px' }}>
              <Icon name="sparkle" size={30} color="var(--ai)" />
            </div>
            <div className="serif" style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.015em', marginBottom: 10 }}>
              Coming Soon
            </div>
            <p className="muted" style={{ fontSize: 14.5, lineHeight: 1.6, margin: 0 }}>{title} is on the way.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
