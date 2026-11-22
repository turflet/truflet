/** Admin dashboard (the backend's old /admin-panel/ URLs redirect here). Admins see everything; turf owners see their
 *  own grounds and bookings. Same sign-in as the app (email code → JWT). */
import { useEffect, useRef, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Gauge, LogOut, Megaphone, Menu, ScanLine, Search, Settings, ShieldAlert, X } from 'lucide-react';
import { useSession } from '../app/session';
import { routes } from '../app/nav';
import { errText } from '../lib/api';
import { initials } from '../lib/format';
import { C, t } from '../theme';
import { useIsDesktop } from '../ui/hooks';
import { Avatar, Empty, PrimaryButton, Spinner } from '../ui/kit';
import { adminRepo } from './api';
import { ICONS } from './ui';
import Home from './pages/Home';
import ResourceList from './pages/ResourceList';
import ResourceForm from './pages/ResourceForm';
import VenueDetail from './pages/VenueDetail';
import Board from './pages/Board';
import BookingDetail from './pages/BookingDetail';
import Checkin from './pages/Checkin';
import UserDetail from './pages/UserDetail';
import SettingsPage from './pages/Settings';
import Broadcast from './pages/Broadcast';

export default function AdminApp() {
  const s = useSession();
  const nav = useNavigate();
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!s.loggedIn) return;
    adminRepo.meta().then(
      (m) => setMeta(m),
      (e) => setError(errText(e)),
    );
  }, [s.loggedIn]);

  if (!s.loggedIn) {
    return (
      <Center>
        <Empty
          icon={ShieldAlert}
          title="Venue & admin dashboard"
          body="Sign in with the email linked to your Turflet admin or turf-owner account."
          action={<PrimaryButton onClick={() => nav(routes.login, { state: { back: '/admin' } })}>Sign in with email</PrimaryButton>}
        />
      </Center>
    );
  }
  if (error) {
    return (
      <Center>
        <Empty icon={ShieldAlert} title="No dashboard access" body={error} action={<PrimaryButton onClick={() => nav(routes.home)}>Back to Turflet</PrimaryButton>} />
      </Center>
    );
  }
  if (!meta)
    return (
      <Center>
        <Spinner size={28} stroke={3} color={C.brand} />
      </Center>
    );

  const admin = meta.role === 'admin';
  return (
    <Layout meta={meta}>
      <Routes>
        <Route index element={<Home meta={meta} />} />
        <Route path="checkin" element={<Checkin />} />
        <Route path="venues/:id" element={<VenueDetail />} />
        <Route path="venues/:id/board" element={<Board />} />
        <Route path="bookings/:id" element={<BookingDetail />} />
        {admin && <Route path="users/:id" element={<UserDetail />} />}
        {admin && <Route path="settings" element={<SettingsPage />} />}
        {admin && <Route path="broadcast" element={<Broadcast />} />}
        <Route path="r/:slug" element={<ResourceList />} />
        <Route path="r/:slug/new" element={<ResourceForm />} />
        <Route path="r/:slug/:id/edit" element={<ResourceForm />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Layout>
  );
}

const Center = ({ children }) => <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>{children}</div>;

function Layout({ meta, children }) {
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);

  const sidebar = <Sidebar meta={meta} />;
  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: C.ground }}>
      {desktop ? (
        <aside style={{ width: 268, flex: 'none', position: 'sticky', top: 0, height: '100vh' }}>{sidebar}</aside>
      ) : (
        open && (
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(12,36,25,.45)', animation: 'fadeIn 150ms' }}>
            <aside onClick={(e) => e.stopPropagation()} style={{ width: 280, height: '100%', animation: 'pop 200ms' }}>
              {sidebar}
            </aside>
          </div>
        )
      )}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 40,
            height: 68,
            padding: desktop ? '0 32px' : '0 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'rgba(247,245,239,.88)',
            backdropFilter: 'blur(12px)',
            borderBottom: `1px solid ${C.line}`,
          }}
        >
          {!desktop && (
            <button
              aria-label="Menu"
              className="tap"
              onClick={() => setOpen(true)}
              style={{ width: 42, height: 42, borderRadius: 12, background: '#fff', border: `1px solid ${C.line}`, display: 'grid', placeItems: 'center' }}
            >
              <Menu size={20} />
            </button>
          )}
          <GlobalSearch />
          <div style={{ flex: 1 }} />
          {desktop && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar initials={initials(meta.user.name || meta.user.email)} size={34} />
              <span>
                <span style={{ display: 'block', ...t(13, { w: 700 }) }}>{meta.user.name || meta.user.email}</span>
                <span style={{ display: 'block', ...t(11, { c: C.muted }) }}>{meta.role === 'admin' ? 'Turflet admin' : 'Turf owner'}</span>
              </span>
            </span>
          )}
        </header>
        <main className="page" style={{ flex: 1, padding: desktop ? '28px 32px 48px' : '20px 16px 40px', maxWidth: 1400, width: '100%' }}>
          {children}
        </main>
      </div>
    </div>
  );
}

function Sidebar({ meta }) {
  const s = useSession();
  const nav = useNavigate();
  const sections = {};
  for (const n of meta.nav) (sections[n.section] ??= []).push(n);
  const link = (to, label, I, end = false) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      className="tap"
      style={({ isActive }) => ({
        position: 'relative',
        height: 40,
        padding: '0 12px',
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: isActive ? 'rgba(255,255,255,.1)' : 'transparent',
        ...t(14, { w: isActive ? 700 : 500, c: isActive ? '#fff' : 'rgba(255,255,255,.72)' }),
      })}
    >
      {({ isActive }) => (
        <>
          <I size={18} color={isActive ? '#fff' : 'rgba(255,255,255,.6)'} />
          <span className="clamp1" style={{ flex: 1 }}>
            {label}
          </span>
          {isActive && <span style={{ width: 7, height: 7, borderRadius: 99, background: C.coral }} />}
        </>
      )}
    </NavLink>
  );
  return (
    <div style={{ height: '100%', background: C.brandDark, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ padding: '7px 10px', borderRadius: 12, background: '#fff', display: 'flex' }}>
          <img src="/images/logo.png" alt="Turflet" style={{ height: 20 }} />
        </span>
        <span style={{ ...t(11, { w: 700, c: 'rgba(255,255,255,.6)', ls: 1 }), textTransform: 'uppercase' }}>{meta.role === 'admin' ? 'Admin' : 'Venue'}</span>
      </div>
      <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {link('/admin', 'Overview', Gauge, true)}
        {link('/admin/checkin', 'Check-in desk', ScanLine)}
        {Object.entries(sections).map(([section, items]) => (
          <div key={section} style={{ marginTop: 14 }}>
            <div style={{ padding: '0 12px 6px', ...t(11, { w: 700, c: 'rgba(255,255,255,.45)', ls: 0.8 }), textTransform: 'uppercase' }}>{section}</div>
            {items.map((n) => link(`/admin/r/${n.slug}`, n.title, ICONS[n.icon] ?? ICONS.table))}
          </div>
        ))}
        {meta.role === 'admin' && (
          <div style={{ marginTop: 14 }}>
            <div style={{ padding: '0 12px 6px', ...t(11, { w: 700, c: 'rgba(255,255,255,.45)', ls: 0.8 }), textTransform: 'uppercase' }}>Platform</div>
            {link('/admin/broadcast', 'Broadcast', Megaphone)}
            {link('/admin/settings', 'App settings', Settings)}
          </div>
        )}
      </nav>
      <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,.08)', display: 'grid', gap: 2 }}>
        <button
          className="tap"
          onClick={() => nav(routes.home)}
          style={{ height: 40, padding: '0 12px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, ...t(14, { w: 500, c: 'rgba(255,255,255,.72)' }) }}
        >
          <ArrowLeft size={18} color="rgba(255,255,255,.6)" /> Back to the app
        </button>
        <button
          className="tap"
          onClick={() => (s.logout(), nav(routes.home))}
          style={{ height: 40, padding: '0 12px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, ...t(14, { w: 500, c: 'rgba(255,255,255,.72)' }) }}
        >
          <LogOut size={18} color="rgba(255,255,255,.6)" /> Log out
        </button>
      </div>
    </div>
  );
}

function GlobalSearch() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const timer = useRef(undefined);
  useEffect(() => {
    window.clearTimeout(timer.current);
    if (q.trim().length < 2) return setResults([]);
    timer.current = window.setTimeout(
      () =>
        adminRepo.search(q.trim()).then(
          (r) => setResults(r.results ?? []),
          () => undefined,
        ),
      250,
    );
  }, [q]);
  return (
    <div style={{ position: 'relative', width: 'min(440px, 100%)' }}>
      <div style={{ height: 42, padding: '0 14px', borderRadius: 14, background: '#fff', border: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Search size={17} color={C.muted} />
        <input
          value={q}
          placeholder="Search bookings, venues, players"
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => setQ(e.target.value)}
          style={t(14)}
        />
        {q && (
          <button aria-label="Clear" onClick={() => setQ('')}>
            <X size={16} color={C.muted} />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 48,
            left: 0,
            right: 0,
            zIndex: 50,
            padding: 6,
            borderRadius: 16,
            background: '#fff',
            border: `1px solid ${C.line}`,
            boxShadow: '0 16px 40px rgba(12,36,25,.15)',
          }}
        >
          {results.map((r, i) => (
            <button
              key={i}
              className="tap"
              onMouseDown={() => (nav(r.to), setQ(''))}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}
            >
              <span style={{ width: 64, ...t(11, { w: 700, c: C.muted, ls: 0.4 }), textTransform: 'uppercase' }}>{r.kind}</span>
              <span className="clamp1" style={{ flex: 1, ...t(14, { w: 600 }) }}>
                {r.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
