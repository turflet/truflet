/** App chrome. Phones: no bottom nav — each screen's dark header carries the Turfs · Matches section tabs and the
 *  bookings / profile buttons. Desktop: a sticky dark top bar with the logo, the two sections, location and account. */

import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';
import { Bell, ChevronDown, MapPin, Ticket } from '../ui/icons';
import { C, t } from '../theme';
import { useIsDesktop } from '../ui/hooks';
import { initials } from '../lib/format';
import { isStaffOrOwner, useSession } from './session';
import { routes } from './nav';

export const TABS = [
  { to: routes.home, label: 'Turfs' },
  { to: routes.matches, label: 'Matches' },
];

/** Which section a path belongs to (for the active state), or -1. */
export function tabOf(path) {
  if (path === routes.home) return 0;
  if (path === routes.matches || path.startsWith('/lobbies')) return 1;
  return -1;
}

const barBtn = {
  height: 42,
  borderRadius: 999,
  background: 'rgba(255,255,255,.08)',
  border: '1px solid rgba(255,255,255,.14)',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

function TopBar() {
  const s = useSession();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const current = tabOf(pathname);
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 60, background: C.brandDark }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', height: 72, padding: '0 32px', display: 'flex', alignItems: 'center', gap: 28 }}>
        <NavLink to={routes.home} aria-label="Turflet home" style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/images/logo.png" alt="Turflet" style={{ height: 30, filter: 'brightness(0) invert(1)' }} />
        </NavLink>
        <nav style={{ display: 'flex', gap: 4 }}>
          {TABS.map((it, i) => {
            const on = i === current;
            return (
              <NavLink
                key={it.to}
                to={it.to}
                className="tap"
                style={{
                  position: 'relative',
                  height: 42,
                  padding: '0 18px',
                  borderRadius: 999,
                  display: 'flex',
                  alignItems: 'center',
                  background: on ? C.brand : 'transparent',
                  ...t(14, { w: on ? 800 : 700, c: on ? '#fff' : '#C9D8CE' }),
                }}
              >
                {it.label}
              </NavLink>
            );
          })}
        </nav>
        <div style={{ flex: 1 }} />
        <button className="tap" onClick={() => nav('/location')} style={{ ...barBtn, padding: '0 14px' }}>
          <MapPin size={16} color={C.sun} />
          <span className="clamp1" style={{ maxWidth: 160, ...t(14, { w: 700, c: '#fff' }) }}>
            {s.cityName || s.areaName || 'Choose city'}
          </span>
          <ChevronDown size={15} color="#fff" />
        </button>
        {s.loggedIn && isStaffOrOwner(s.user) && (
          <NavLink to="/admin" className="tap" style={{ ...barBtn, padding: '0 14px', ...t(13, { w: 700, c: '#fff' }) }}>
            <LayoutDashboard size={16} color="#fff" /> Dashboard
          </NavLink>
        )}
        {s.loggedIn ? (
          <>
            <NavLink to="/notifications" aria-label="Notifications" className="tap" style={{ ...barBtn, width: 42, justifyContent: 'center' }}>
              <Bell size={19} color="#fff" />
            </NavLink>
            <NavLink to={routes.bookings} aria-label="My bookings" className="tap" style={{ ...barBtn, width: 42, justifyContent: 'center' }}>
              <Ticket size={19} color="#fff" />
            </NavLink>
            <NavLink
              to={routes.profile}
              aria-label="Profile"
              className="tap"
              style={{ ...barBtn, gap: 10, padding: '4px 14px 4px 4px', height: 44 }}
            >
              <span style={{ width: 34, height: 34, borderRadius: '50%', background: C.coral, display: 'grid', placeItems: 'center', ...t(12, { w: 800, c: '#fff', h: 1 }) }}>
                {initials(s.user?.name || s.user?.email)}
              </span>
              <span className="clamp1" style={{ maxWidth: 120, ...t(14, { w: 700, c: '#fff' }) }}>
                {String(s.user?.name || 'You').split(' ')[0]}
              </span>
            </NavLink>
          </>
        ) : (
          <button
            className="tap"
            onClick={() => nav(routes.login, { state: { back: pathname } })}
            style={{ height: 44, padding: '0 20px', borderRadius: 14, background: '#fff', ...t(14, { w: 800, c: C.brand }) }}
          >
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${C.line}`, marginTop: 64 }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '32px 32px 40px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <img src="/images/logo.png" alt="Turflet" style={{ height: 24, opacity: 0.9 }} />
        <span style={t(13, { c: C.muted })}>Book turfs and courts, split the cost, show up and play.</span>
        <div style={{ flex: 1 }} />
        <NavLink to="/help" style={t(13, { w: 600, c: C.mutedInk })}>
          Help
        </NavLink>
        <NavLink to="/policy?tab=2" style={t(13, { w: 600, c: C.mutedInk })}>
          Terms
        </NavLink>
        <NavLink to="/policy?tab=1" style={t(13, { w: 600, c: C.mutedInk })}>
          Privacy
        </NavLink>
        <NavLink to="/policy?tab=0" style={t(13, { w: 600, c: C.mutedInk })}>
          Refunds
        </NavLink>
      </div>
    </footer>
  );
}

/** Wraps every player page. [nav] is kept for callers but the phone layout no longer has a bottom nav. */
// eslint-disable-next-line no-unused-vars
export function Shell({ children, nav = false }) {
  const desktop = useIsDesktop();
  if (desktop) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <TopBar />
        <main className="page" style={{ flex: 1, width: '100%', maxWidth: 1240, margin: '0 auto', padding: '28px 32px 0' }}>
          {children}
        </main>
        <Footer />
      </div>
    );
  }
  return (
    <div className="page" style={{ minHeight: '100vh' }}>
      {children}
    </div>
  );
}
