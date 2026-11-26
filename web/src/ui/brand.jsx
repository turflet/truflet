/** Redesign building blocks: the dark header band, the circular section tabs, the green panel under them,
 *  white underline tabs, "SECTION ——" rules and the soft icon discs. Mirrors mobile/lib/core/widgets/brand.dart. */

import { NavLink, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Ticket } from './icons';
import { routes } from '../app/nav';
import { useSession } from '../app/session';
import { initials } from '../lib/format';
import { C, d, t } from '../theme';

const bandBtn = {
  width: 44,
  height: 44,
  flex: 'none',
  borderRadius: '50%',
  background: 'rgba(255,255,255,.08)',
  border: '1px solid rgba(255,255,255,.14)',
  display: 'grid',
  placeItems: 'center',
};

/** Round translucent button on the dark band (back, share…). */
export function BandButton({ icon: I = ChevronLeft, label = 'Back', onClick, size = 22 }) {
  const nav = useNavigate();
  return (
    <button aria-label={label} className="tap" onClick={onClick ?? (() => nav(-1))} style={bandBtn}>
      <I size={size} color="#fff" strokeWidth={2.2} />
    </button>
  );
}

/** Ticket icon → My bookings, with the coral stub from the logo. */
export function BookingsButton() {
  return (
    <NavLink to={routes.bookings} aria-label="My bookings" className="tap" style={{ ...bandBtn, position: 'relative' }}>
      <Ticket size={22} color="#fff" strokeWidth={1.8} />
    </NavLink>
  );
}

/** Coral initials disc → Profile (or sign in). */
export function ProfileButton() {
  const s = useSession();
  return (
    <NavLink
      to={s.loggedIn ? routes.profile : routes.login}
      aria-label={s.loggedIn ? 'Profile' : 'Sign in'}
      className="tap"
      style={{ width: 44, height: 44, flex: 'none', borderRadius: '50%', background: C.coral, display: 'grid', placeItems: 'center', ...t(14, { w: 800, c: '#fff', h: 1 }) }}
    >
      {s.loggedIn ? initials(s.user?.name || s.user?.email) : '?'}
    </NavLink>
  );
}

/** Dark band at the top of a screen. [title] 24px white, optional [subtitle]; [onTitle] makes it a button with a chevron
 *  (the location picker on Home). [back] adds a round back button. [right] sits at the end of the row. [children] go
 *  below the row (section tabs, the green panel). */
export function Band({ title, subtitle, onTitle, back, right, children }) {
  const head = (
    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, textAlign: 'left' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, ...d(24, { c: '#fff', ls: -0.6, h: 1.15 }) }}>
        <span className="clamp1">{title}</span>
        {onTitle && <ChevronRight size={22} color="#fff" strokeWidth={2.6} style={{ flex: 'none' }} />}
      </span>
      {subtitle && (
        <span className="clamp1" style={t(13, { c: C.bandInk })}>
          {subtitle}
        </span>
      )}
    </span>
  );
  return (
    <header style={{ background: C.brandDark, paddingTop: 'var(--safe-top)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 16px 16px' }}>
        {back && <BandButton onClick={back === true ? undefined : back} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          {onTitle ? (
            <button onClick={onTitle} style={{ display: 'block', maxWidth: '100%' }}>
              {head}
            </button>
          ) : (
            head
          )}
        </div>
        {right && <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 'none' }}>{right}</div>}
      </div>
      {children}
    </header>
  );
}

const SECTIONS = [
  { to: routes.home, label: 'Turfs', art: '/images/tab-turfs.png' },
  { to: routes.matches, label: 'Matches', art: '/images/tab-matches.png' },
];

/** The big circular section tabs (Turfs · Matches) that replace the bottom nav. [badge] sits under Matches. */
export function SectionTabs({ active, badge }) {
  return (
    <nav aria-label="Sections" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 104px)', gap: 4, padding: '6px 12px 0', alignItems: 'end' }}>
      {SECTIONS.map((s, i) => {
        const on = i === active;
        return (
          <NavLink
            key={s.to}
            to={s.to}
            replace
            aria-current={on ? 'page' : undefined}
            style={{
              position: 'relative',
              zIndex: on ? 2 : 1,
              height: 124,
              paddingBottom: 14,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 8,
              ...t(14, { w: on ? 800 : 700, c: on ? '#fff' : '#C9D8CE', ls: -0.1 }),
            }}
          >
            <svg viewBox="0 0 112 124" preserveAspectRatio="none" aria-hidden="true" style={{ position: 'absolute', left: -12, top: 0, width: 'calc(100% + 24px)', height: '100%', zIndex: -1 }}>
              <path
                d="M0 124C10 124 12 118 12 106V30C12 15 22 4 38 4H74C90 4 100 15 100 30V106C100 118 102 124 112 124Z"
                fill={on ? C.brand : 'rgba(255,255,255,.045)'}
                stroke={on ? C.brand : 'rgba(255,255,255,.08)'}
              />
            </svg>
            <span
              style={{
                position: 'relative',
                width: 66,
                height: 66,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                transform: on ? 'translateY(-4px)' : undefined,
                background: on
                  ? 'radial-gradient(circle at 35% 30%, #FFFFFF 0%, #DCEBE0 70%, #B9D3C1 100%)'
                  : 'radial-gradient(circle at 35% 30%, rgba(255,255,255,.22) 0%, rgba(255,255,255,.08) 70%)',
                boxShadow: on ? '0 10px 22px rgba(0,0,0,.35), inset 0 -3px 0 rgba(20,61,43,.18)' : 'inset 0 0 0 1px rgba(255,255,255,.12)',
              }}
            >
              <img src={s.art} alt="" style={{ width: 60, height: 60, objectFit: 'contain', filter: 'drop-shadow(0 6px 8px rgba(0,0,0,.28))' }} />
              {i === 1 && badge && (
                <span
                  style={{
                    position: 'absolute',
                    left: '50%',
                    bottom: -9,
                    transform: 'translateX(-50%)',
                    whiteSpace: 'nowrap',
                    padding: '3px 7px',
                    borderRadius: 7,
                    background: '#2563EB',
                    boxShadow: '0 2px 6px rgba(37,99,235,.45)',
                    ...t(10.5, { w: 800, c: '#fff', h: 1.2 }),
                  }}
                >
                  {badge}
                </span>
              )}
            </span>
            {s.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

/** The green panel under the band. [flat] = straight top (sits right under the section tabs). */
export const Panel = ({ children, flat, gap = 18, padding = '20px 16px 22px', style }) => (
  <div
    style={{
      background: C.brand,
      borderRadius: flat ? '0 0 32px 32px' : '28px 28px 32px 32px',
      padding,
      display: 'flex',
      flexDirection: 'column',
      gap,
      color: '#fff',
      ...style,
    }}
  >
    {children}
  </div>
);

/** Italic sun-yellow word inside a headline: Game on, <Script>Arjun!</Script> */
export const Script = ({ children }) => <span style={{ fontStyle: 'italic', color: C.sun }}>{children}</span>;

/** Big centred white headline inside the panel. */
export const PanelHeadline = ({ children, size = 30 }) => <div style={{ textAlign: 'center', ...d(size, { c: '#fff', h: 1.05, ls: -1 }) }}>{children}</div>;

/** White-underline tabs on the green panel (ALL · OFFERS · NEARBY, UPCOMING · COMPLETED …). */
export function UnderlineTabs({ items, index, onChange, role = 'tablist' }) {
  return (
    <div role={role} className="hscroll" style={{ alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,.14)', margin: '0 -16px', padding: '0 16px' }}>
      {items.map((it, i) => {
        const on = i === index;
        const label = typeof it === 'string' ? it : it.label;
        const I = typeof it === 'string' ? null : it.icon;
        const fg = on ? '#fff' : 'rgba(255,255,255,.74)';
        return (
          <button
            key={label}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(i)}
            style={{ position: 'relative', flex: 'none', height: 44, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 6, ...t(13, { w: 800, c: fg, ls: 0.4 }) }}
          >
            {I && <I size={16} color={fg} strokeWidth={2} />}
            {label}
            <span style={{ position: 'absolute', left: 6, right: 6, bottom: -1, height: 3, borderRadius: '3px 3px 0 0', background: on ? '#fff' : 'transparent' }} />
          </button>
        );
      })}
    </div>
  );
}

/** White pill toggle on the panel (Open lobbies | My matches). */
export function PanelSwitch({ labels, index, onChange }) {
  return (
    <div role="tablist" style={{ display: 'grid', gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))`, padding: 4, borderRadius: 16, background: 'rgba(255,255,255,.08)' }}>
      {labels.map((l, i) => {
        const on = i === index;
        return (
          <button
            key={l}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(i)}
            style={{ height: 44, borderRadius: 12, background: on ? '#fff' : 'transparent', transition: 'background 160ms', ...t(14, { w: on ? 800 : 700, c: on ? C.brand : C.panelInk }) }}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

/** "AMENITIES ——————" section heading. */
export const Rule = ({ children, extra, style }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, ...style }}>
    <h2 style={{ margin: 0, textTransform: 'uppercase', ...t(12, { w: 800, c: C.muted, ls: 1.4 }) }}>{children}</h2>
    {extra && <span style={t(12, { w: 600, c: C.muted })}>{extra}</span>}
    <span style={{ flex: 1, height: 1, background: C.hair }} />
  </div>
);

/** Soft mint disc holding a line icon (amenities, pay methods, menu rows). */
export const Disc = ({ icon: I, size = 44, iconSize, color = C.brand, children }) => (
  <span
    style={{
      width: size,
      height: size,
      flex: 'none',
      borderRadius: '50%',
      background: 'radial-gradient(circle at 35% 30%, #FFFFFF 0%, #E9F0EA 75%)',
      border: `1px solid ${C.discLine}`,
      display: 'grid',
      placeItems: 'center',
    }}
  >
    {I ? <I size={iconSize ?? Math.round(size * 0.5)} color={color} strokeWidth={1.8} /> : children}
  </span>
);

/** Dark-green tile inside the panel (deals, stats, promo cards). */
export const PanelTile = ({ children, style, onClick }) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={onClick ? 'tap' : undefined} style={{ borderRadius: 18, background: C.green900, padding: '12px 14px', textAlign: 'left', ...style }}>
      {children}
    </Tag>
  );
};

/** Green rating badge with a white star. */
export const RatingBadge = ({ value, size = 13 }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 8, background: C.green700, flex: 'none', ...t(size, { w: 800, c: '#fff', h: 1.1 }) }}>
    {value}
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="#fff" />
    </svg>
  </span>
);

/** Fixed bottom bar (phone) holding the main action. */
export const StickyBar = ({ children, style }) => (
  <div
    style={{
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 40,
      padding: '12px 16px calc(20px + var(--safe-bottom))',
      background: '#fff',
      borderTop: `1px solid ${C.hair}`,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      ...style,
    }}
  >
    {children}
  </div>
);

/** Primary forest-green CTA with the sun chevron. */
export function GoButton({ children, onClick, height = 56, disabled, loading, style }) {
  return (
    <button
      className="tap"
      disabled={disabled || loading}
      onClick={onClick}
      style={{
        flex: 1,
        height,
        borderRadius: 18,
        background: disabled ? C.line : C.brand,
        boxShadow: disabled ? undefined : '0 10px 24px rgba(20,61,43,.28)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        ...t(16, { w: 800, c: disabled ? '#57625A' : '#fff' }),
        ...style,
      }}
    >
      {loading ? (
        <span className="spin" style={{ width: 22, height: 22, borderRadius: '50%', border: '2.4px solid #fff', borderRightColor: 'transparent' }} />
      ) : (
        <>
          <span className="clamp1">{children}</span>
          {!disabled && <ChevronRight size={18} color={C.sun} strokeWidth={2.6} />}
        </>
      )}
    </button>
  );
}
