import React, { useEffect, useState } from 'react';

// Minimal line-icon set (20x20 stroke icons).
const PATHS = {
  trend: <><polyline points="2,15 8,9 12,12 18,4" /><polyline points="13,4 18,4 18,9" /></>,
  refresh: <><path d="M16.5 7A6 6 0 1 0 17 11" /><polyline points="16.5,3 16.5,7 12.5,7" /></>,
  sparkle: <path d="M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6z" />,
  plus: <><line x1="10" y1="4" x2="10" y2="16" /><line x1="4" y1="10" x2="16" y2="10" /></>,
  search: <><circle cx="9" cy="9" r="5.5" /><line x1="13.5" y1="13.5" x2="17" y2="17" /></>,
  upload: <><path d="M10 13V4" /><polyline points="6,7 10,3.5 14,7" /><path d="M3.5 13v2.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V13" /></>,
  x: <><line x1="5" y1="5" x2="15" y2="15" /><line x1="15" y1="5" x2="5" y2="15" /></>,
  check: <polyline points="4,10.5 8,14.5 16,5.5" />,
  logout: <><path d="M12 14v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><polyline points="9,10 17,10" /><polyline points="14,7 17,10 14,13" /></>,
  arrow: <><line x1="4" y1="10" x2="16" y2="10" /><polyline points="11,5 16,10 11,15" /></>,
  edit: <path d="M13 4l3 3-8 8H5v-3z" />,
  trash: <><polyline points="4,6 16,6" /><path d="M6 6l.7 9a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L14 6" /><path d="M8 6V4.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V6" /></>,
  grid: <><rect x="3.5" y="3.5" width="5" height="5" rx="1" /><rect x="11.5" y="3.5" width="5" height="5" rx="1" /><rect x="3.5" y="11.5" width="5" height="5" rx="1" /><rect x="11.5" y="11.5" width="5" height="5" rx="1" /></>,
  users: <><circle cx="7.5" cy="7" r="2.5" /><path d="M3 16c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" /><path d="M13 5.2a2.5 2.5 0 0 1 0 4.6" /><path d="M13.5 12.2c1.8.4 3 1.8 3 3.8" /></>,
  bank: <><polyline points="3,8 10,3.5 17,8" /><line x1="4.8" y1="8.5" x2="4.8" y2="14.5" /><line x1="8.3" y1="8.5" x2="8.3" y2="14.5" /><line x1="11.7" y1="8.5" x2="11.7" y2="14.5" /><line x1="15.2" y1="8.5" x2="15.2" y2="14.5" /><line x1="3.2" y1="16.5" x2="16.8" y2="16.5" /></>,
  eye: <><path d="M2 10s3-5.5 8-5.5 8 5.5 8 5.5-3 5.5-8 5.5S2 10 2 10z" /><circle cx="10" cy="10" r="2.2" /></>,
  'eye-off': <><path d="M2 10s3-5.5 8-5.5 8 5.5 8 5.5-3 5.5-8 5.5S2 10 2 10z" /><circle cx="10" cy="10" r="2.2" /><line x1="3.5" y1="3.5" x2="16.5" y2="16.5" /></>,
  drag: <>{[6, 10, 14].flatMap((y) => [7, 13].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.1" fill="currentColor" stroke="none" />))}</>,
  bolt: <path d="M11 2L4 12h5l-1 6 7-10h-5z" />,
  play: <path d="M6 4l10 6-10 6z" />,
  stop: <rect x="5" y="5" width="10" height="10" rx="1.5" />,
};

export function Icon({ name, size = 16, color = 'currentColor', sw = 1.7 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={color}
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'block', flex: 'none' }}>
      {PATHS[name] || null}
    </svg>
  );
}

export function BrandMark({ size = 30 }) {
  return (
    <div className="brand-ring" style={{ width: size + 6, height: size + 6 }}>
      <div className="brand-mark" style={{ width: size, height: size, borderRadius: Math.round(size * 0.26) }}>
        <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 20 20">
          <polyline points="3,14 8,8 11.5,11 17,4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="17" cy="4" r="1.8" fill="#fff" />
        </svg>
      </div>
    </div>
  );
}

export function Modal({ children, onClose, width, closeOnBackdrop = true }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && closeOnBackdrop) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, closeOnBackdrop]);
  return (
    <div className="scrim" onMouseDown={closeOnBackdrop ? onClose : undefined}>
      <div className="modal" style={width ? { maxWidth: width } : undefined} onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function RiskPill({ risk }) {
  const cls = { Conservative: 'pill-pos', Moderate: 'pill-brand', Aggressive: 'pill-neg' }[risk] || 'pill-gray';
  return <span className={`pill ${cls}`}>{risk} risk</span>;
}

export function ActionPill({ action }) {
  const tone = { Buy: 'pill-pos', Sell: 'pill-neg', Hold: 'pill-hold' }[action] || 'pill-hold';
  return <span className={`pill ${tone}`} style={{ minWidth: 46, justifyContent: 'center' }}>{action}</span>;
}

export function NaTip({ tip }) {
  return (
    <span className="tip" data-tip={tip} style={{ cursor: 'default', color: 'var(--ink-4)', fontSize: 13, gap: 3 }}>
      N/A <span style={{ fontSize: 11 }}>ⓘ</span>
    </span>
  );
}

// Renders "**bold**" markers inside AI text.
export function Emphasis({ text }) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    const m = part.match(/^\*\*([^*]+)\*\*$/);
    return m
      ? <strong key={i} style={{ color: 'var(--ink)' }}>{m[1]}</strong>
      : <span key={i}>{part}</span>;
  });
}

const SECTIONS = [
  { key: 'latest news impact', label: 'Latest News Impact', emoji: '📰', color: '#8430CE' },
  { key: 'bullish', label: 'Bullish AI', emoji: '🟢', color: '#1E8E3E' },
  { key: 'bearish', label: 'Bearish AI', emoji: '🔴', color: '#C5221F' },
  { key: 'balanced', label: 'Balanced AI', emoji: '⚪', color: '#5F6368' },
  { key: 'moderator', label: 'Moderator AI', emoji: '🧭', color: '#1A73E8' },
];

export function SectionedSummary({ summary }) {
  const blocks = summary
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter((b) => b && !/^[-*_\s]+$/.test(b))
    .map((block) => {
      const idx = block.indexOf(':');
      if (idx <= 0) return { section: undefined, body: block };
      const head = block.slice(0, idx).replace(/[*_#`]/g, '').trim().toLowerCase();
      const section = SECTIONS.find((s) => head.startsWith(s.key));
      if (!section) return { section: undefined, body: block };
      return { section, body: block.slice(idx + 1).trim().replace(/^\*\*\s+/, '') };
    });
  return (
    <>
      {blocks.map(({ section, body }, i) => (
        <div key={i} style={{
          borderLeft: `3px solid ${section ? section.color : 'var(--line)'}`,
          background: section ? `${section.color}0D` : 'var(--surface-2)',
          borderRadius: 10, padding: '12px 14px', marginBottom: 10,
        }}>
          {section && (
            <div className="row gap-8" style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 15, lineHeight: 1 }}>{section.emoji}</span>
              <span style={{ fontWeight: 700, fontSize: 13, color: section.color, letterSpacing: '0.01em' }}>
                {section.label}
              </span>
            </div>
          )}
          <div style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--ink-2)' }}>
            <Emphasis text={body} />
          </div>
        </div>
      ))}
    </>
  );
}

export function AiThinking({ messages, cadence = 1600 }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % messages.length), cadence);
    return () => clearInterval(t);
  }, [messages, cadence]);
  return (
    <div style={{ padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
      <div style={{ position: 'relative', width: 64, height: 64 }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--ai-soft)',
          border: '1.5px solid var(--ai-line)', display: 'grid', placeItems: 'center',
        }}>
          <Icon name="sparkle" size={26} color="var(--ai)" />
        </div>
        <svg style={{ position: 'absolute', inset: -5, animation: 'rot 1.8s linear infinite' }}
          width={74} height={74} viewBox="0 0 74 74" fill="none">
          <circle cx="37" cy="37" r="32" stroke="var(--ai-line)" strokeWidth="2.5" strokeDasharray="8 6" strokeLinecap="round" />
        </svg>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div key={i} style={{ fontSize: 15, fontWeight: 700, color: 'var(--ai)', letterSpacing: '0.01em', animation: 'msgfade .6s ease' }}>
          {messages[i]}
        </div>
      </div>
      <div className="row gap-8">
        {[0, 1, 2].map((k) => <div key={k} className="load-dot" style={{ background: 'var(--ai)' }} />)}
      </div>
    </div>
  );
}

export function LoadDots() {
  return (
    <div className="row gap-8">
      <div className="load-dot" /><div className="load-dot" /><div className="load-dot" />
    </div>
  );
}

export function EmptyState({ icon = 'users', title, body, action, footnote }) {
  return (
    <div className="page" style={{ display: 'grid', placeItems: 'center', minHeight: 'calc(100vh - 200px)' }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: '0 24px' }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20, background: 'var(--ai-soft)',
          border: '1.5px solid var(--ai-line)', display: 'grid', placeItems: 'center', margin: '0 auto 24px',
        }}>
          <Icon name={icon} size={32} color="var(--ai)" sw={1.4} />
        </div>
        <div className="serif" style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.015em', marginBottom: 10 }}>
          {title}
        </div>
        <p className="muted" style={{ fontSize: 14.5, lineHeight: 1.6, margin: '0 0 28px' }}>{body}</p>
        {action}
        {footnote && <div className="tiny muted" style={{ marginTop: 16 }}>{footnote}</div>}
      </div>
    </div>
  );
}

export function TickerSearchBox({ stocks, onPick, placeholder }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const needle = q.trim().toLowerCase();
  const matches = needle
    ? stocks.filter((s) => s.ticker.toLowerCase().includes(needle) || s.name.toLowerCase().includes(needle)).slice(0, 8)
    : [];
  const pick = (s) => { onPick(s); setQ(s.ticker); setOpen(false); };
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
        <Icon name="search" size={18} color="var(--ink-4)" />
      </span>
      <input
        className="input"
        style={{ paddingLeft: 46, height: 50, fontSize: 15 }}
        placeholder={placeholder}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' && matches[0]) pick(matches[0]); }}
      />
      {open && matches.length > 0 && (
        <div className="card" style={{ position: 'absolute', top: 56, left: 0, right: 0, zIndex: 30, padding: 6, maxHeight: 320, overflowY: 'auto' }}>
          {matches.map((s) => (
            <div key={s.ticker} className="sresult" style={{ cursor: 'pointer' }} onClick={() => pick(s)}>
              <span className="ticker" style={{ minWidth: 56 }}>{s.ticker}</span>
              <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
              <span className="pill pill-gray">{s.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
