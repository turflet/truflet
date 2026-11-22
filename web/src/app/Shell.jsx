/** App chrome. Phones: the Flutter bottom nav (Explore · Matches · Bookings · Profile) on tab screens.
 *  Desktop: a sticky top bar with the logo, the same four sections, location, notifications and account. */

import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Bell, Calendar, ChevronDown, House, LayoutDashboard, MapPin, User, UsersRound } from 'lucide-react';
import { C, shadow, t } from '../theme';
import { useIsDesktop } from '../ui/hooks';
import { Avatar } from '../ui/kit';
import { initials } from '../lib/format';
import { isStaffOrOwner, useSession } from './session';
import { routes } from './nav';

export const TABS = [
  { to: routes.home, icon: House, label: 'Explore' },
  { to: routes.matches, icon: UsersRound, label: 'Matches' },
  { to: routes.bookings, icon: Calendar, label: 'Bookings' },
  { to: routes.profile, icon: User, label: 'Profile' },
];

const tabPaths = TABS.map((x) => x.to);

/** Which tab a path belongs to (for the active state), or -1. */
export function tabOf(path) {
  if (path.startsWith('/saved')) return 3;
  if (path.startsWith('/help')) return 3;
  return tabPaths.findIndex((p) => path === p);
}

export function BottomNav() {
  const { pathname } = useLocation();
  const current = tabOf(pathname);
  return (
    <nav
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        background: '#fff',
        borderTop: `1px solid ${C.line}`,
        padding: '8px 6px calc(12px + var(--safe-bottom))',
        display: 'flex',
      }}
    >
      {TABS.map((it, i) => {
        const on = i === current;
        const I = it.icon;
        return (
          <NavLink
            key={it.to}
            to={it.to}
            replace
            aria-label={it.label}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '2px 0', borderRadius: 16 }}
          >
            {on ? (
              // active tab echoes the logo mark: forest glyph with the coral ball top-right
              <span style={{ position: 'relative', width: 48, height: 30, borderRadius: 999, background: C.mint, display: 'grid', placeItems: 'center' }}>
                <I size={20} color={C.brand} />
                <span style={{ position: 'absolute', right: 6, top: -2, width: 8, height: 8, borderRadius: 99, background: C.coral }} />
              </span>
            ) : (
              <span style={{ height: 30, display: 'grid', placeItems: 'center' }}>
                <I size={22} color={C.muted} />
              </span>
            )}
            <span style={t(11, { w: on ? 700 : 500, c: on ? C.brand : C.muted })}>{it.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

function TopBar() {
  const s = useSession();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const current = tabOf(pathname);
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 60,
        background: 'rgba(247,245,239,0.86)',
        backdropFilter: 'saturate(1.4) blur(14px)',
        WebkitBackdropFilter: 'saturate(1.4) blur(14px)',
        borderBottom: `1px solid ${C.line}`,
      }}
    >
      <div style={{ maxWidth: 1240, margin: '0 auto', height: 72, padding: '0 32px', display: 'flex', alignItems: 'center', gap: 28 }}>
        <NavLink to={routes.home} aria-label="Turflet home" style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/images/logo.png" alt="Turflet" style={{ height: 30 }} />
        </NavLink>
        <nav style={{ display: 'flex', gap: 4 }}>
          {TABS.map((it, i) => {
            const on = i === current;
            const I = it.icon;
            return (
              <NavLink
                key={it.to}
                to={it.to}
                className="tap"
                style={{
                  position: 'relative',
                  height: 42,
                  padding: '0 16px',
                  borderRadius: 999,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: on ? C.mint : 'transparent',
                  ...t(14, { w: on ? 700 : 600, c: on ? C.brand : C.mutedInk }),
                }}
              >
                <I size={18} color={on ? C.brand : C.muted} />
                {it.label}
                {on && <span style={{ position: 'absolute', right: 8, top: 7, width: 7, height: 7, borderRadius: 99, background: C.coral }} />}
              </NavLink>
            );
          })}
        </nav>
        <div style={{ flex: 1 }} />
        <button
          className="tap"
          onClick={() => nav('/location')}
          style={{ height: 42, padding: '0 14px', borderRadius: 999, border: `1px solid ${C.line}`, background: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <MapPin size={16} color={C.brand} />
          <span className="clamp1" style={{ maxWidth: 160, ...t(14, { w: 700 }) }}>
            {s.cityName || s.areaName || 'Choose city'}
          </span>
          <ChevronDown size={15} />
        </button>
        {s.loggedIn && isStaffOrOwner(s.user) && (
          <NavLink
            to="/admin"
            className="tap"
            style={{ height: 42, padding: '0 14px', borderRadius: 999, background: C.ink, display: 'flex', alignItems: 'center', gap: 6, ...t(13, { w: 700, c: '#fff' }) }}
          >
            <LayoutDashboard size={16} color="#fff" /> Dashboard
          </NavLink>
        )}
        {s.loggedIn ? (
          <>
            <NavLink
              to="/notifications"
              aria-label="Notifications"
              className="tap"
              style={{ width: 42, height: 42, borderRadius: 14, border: `1px solid ${C.line}`, background: '#fff', display: 'grid', placeItems: 'center' }}
            >
              <Bell size={19} />
            </NavLink>
            <NavLink
              to={routes.profile}
              aria-label="Profile"
              className="tap"
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 14px 4px 4px', borderRadius: 999, background: '#fff', border: `1px solid ${C.line}` }}
            >
              <Avatar initials={initials(s.user?.name || s.user?.email)} size={34} />
              <span className="clamp1" style={{ maxWidth: 120, ...t(14, { w: 700 }) }}>
                {String(s.user?.name || 'You').split(' ')[0]}
              </span>
            </NavLink>
          </>
        ) : (
          <button
            className="tap"
            onClick={() => nav(routes.login, { state: { back: pathname } })}
            style={{ height: 44, padding: '0 20px', borderRadius: 14, background: C.brand, boxShadow: shadow.brandSm, ...t(14, { w: 700, c: '#fff' }) }}
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

/** Wraps every player page. [nav] = show the phone bottom nav (tab screens, Saved, Help). */
export function Shell({ children, nav = false, wide = false }) {
  const desktop = useIsDesktop();
  if (desktop) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <TopBar />
        <main className="page" style={{ flex: 1, width: '100%', maxWidth: wide ? 1240 : 1240, margin: '0 auto', padding: '28px 32px 0' }}>
          {children}
        </main>
        <Footer />
      </div>
    );
  }
  return (
    <div className="page" style={{ minHeight: '100vh', paddingBottom: nav ? 'calc(84px + var(--safe-bottom))' : 0 }}>
      {children}
      {nav && <BottomNav />}
    </div>
  );
}
