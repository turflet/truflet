/** Shared frame for the public legal pages (/privacy, /delete-account): green header, overlapping card.
 *  These pages are linked from the Play Store listing, so they work without signing in and skip the splash. */
import { Link } from 'react-router-dom';
import { C, d, t } from '../../theme';

export function LegalLayout({ title, sub, children }) {
  return (
    <div style={{ minHeight: '100vh', background: C.ground, color: C.ink }}>
      <header style={{ background: C.brand, color: '#fff', padding: '40px 16px 76px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <img src="/images/icon_rounded.png" alt="" width={32} height={32} style={{ borderRadius: 9 }} />
            <span style={d(20, { c: '#fff' })}>Turflet</span>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: C.coral, marginTop: -12 }} />
          </Link>
          <h1 style={{ margin: '22px 0 6px', ...d(34, { c: '#fff' }), lineHeight: 1.15 }}>{title}</h1>
          {sub && <p style={{ margin: 0, ...t(15, { c: 'rgba(255,255,255,.8)', h: 1.5 }) }}>{sub}</p>}
        </div>
      </header>
      <main style={{ padding: '0 16px 48px' }}>
        <div className="legal" style={{ maxWidth: 760, margin: '-46px auto 0', background: '#fff', border: `1px solid ${C.line}`, borderRadius: 22, padding: 'clamp(20px, 4vw, 30px)', ...t(15, { h: 1.65 }) }}>
          {children}
        </div>
        <div style={{ maxWidth: 760, margin: '18px auto 0', display: 'flex', gap: 18, flexWrap: 'wrap', ...t(13, { c: C.muted }) }}>
          <Link to="/privacy" style={{ color: C.muted }}>
            Privacy policy
          </Link>
          <Link to="/delete-account" style={{ color: C.muted }}>
            Delete your account
          </Link>
          <Link to="/" style={{ color: C.muted }}>
            Open Turflet
          </Link>
        </div>
      </main>
    </div>
  );
}
