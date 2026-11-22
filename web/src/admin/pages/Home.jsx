/** Overview: today at a glance, 14-day revenue, top venues, today's slots and the latest bookings. */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanLine } from 'lucide-react';
import { asList, asMap } from '../../lib/api';
import { inr } from '../../lib/format';
import { C, t } from '../../theme';
import { useData, useIsDesktop } from '../../ui/hooks';
import { ErrorRetry, Sk } from '../../ui/kit';
import { adminRepo } from '../api';

import { Badge, Btn, PageHeader, Panel, StatTile } from '../ui';

export default function Home({ meta }) {
  const nav = useNavigate();
  const desktop = useIsDesktop();
  const { data, error, retry } = useData(() => adminRepo.home());
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const first = String(meta.user.name || '').split(' ')[0];

  if (error) return <ErrorRetry message={error} onRetry={retry} />;
  const s = asMap(data?.stats);
  const admin = meta.role === 'admin';

  return (
    <>
      <PageHeader
        eyebrow={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={`${greet}${first ? `, ${first}` : ''}`}
        sub={admin ? 'Everything happening across Turflet today.' : 'How your grounds are doing today.'}
        actions={
          <Btn kind="primary" icon={ScanLine} onClick={() => nav('/admin/checkin')}>
            Check in a booking
          </Btn>
        }
      />
      {!data ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <Sk key={i} h={108} r={20} />
          ))}
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
            <StatTile label="Bookings today" value={s.today_bookings} sub={`${s.today_checked_in} checked in`} accent={C.brand} />
            <StatTile label="Revenue this month" value={inr(s.month_revenue)} sub={`Refunds ${inr(s.refunds)}`} accent={C.coral} />
            <StatTile label="Upcoming bookings" value={s.upcoming_bookings} sub="After today" />
            <StatTile label={admin ? 'Live venues' : 'Live grounds'} value={s.venues} sub={s.pending_venues ? `${s.pending_venues} awaiting approval` : 'All approved'} />
            {admin && <StatTile label="Players" value={s.users} sub={`${s.new_users} joined this week`} />}
            {admin && (s.refunds_due > 0 || s.open_tickets > 0) && (
              <StatTile
                label="Needs attention"
                value={(s.refunds_due ?? 0) + (s.open_tickets ?? 0)}
                sub={`${s.refunds_due} UPI refunds · ${s.open_tickets} open tickets`}
                accent={C.orange}
              />
            )}
          </div>

          <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: desktop ? '1.6fr 1fr' : '1fr', gap: 18 }}>
            <Panel title="Revenue · last 14 days" actions={<span style={t(13, { c: C.muted })}>{inr(asList(data.days).reduce((a, x) => a + (x.amount ?? 0), 0))} total</span>}>
              <RevenueChart days={asList(data.days)} />
            </Panel>
            <Panel title="Top venues" pad={8}>
              {asList(data.top_venues).length === 0 && <div style={{ padding: 16, ...t(14, { c: C.muted }) }}>No paid bookings yet.</div>}
              {asList(data.top_venues).map((v, i) => (
                <button
                  key={v.id}
                  className="tap"
                  onClick={() => nav(`/admin/venues/${v.id}`)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}
                >
                  <span style={{ width: 22, ...t(13, { w: 700, c: C.muted }) }}>{i + 1}</span>
                  {v.image ? (
                    <img src={v.image} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover' }} />
                  ) : (
                    <span style={{ width: 40, height: 40, borderRadius: 10, background: C.chip }} />
                  )}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="clamp1" style={{ display: 'block', ...t(14, { w: 700 }) }}>
                      {v.name}
                    </span>
                    <span style={{ display: 'block', ...t(12, { c: C.muted }) }}>{v.bookings} bookings</span>
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', ...t(14, { w: 700 }) }}>{inr(v.revenue)}</span>
                </button>
              ))}
            </Panel>
          </div>

          <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: desktop ? '1fr 1fr' : '1fr', gap: 18 }}>
            <Panel title="Today's slots" pad={0}>
              <BookingRows rows={asList(data.today)} empty="No confirmed slots today." showDate={false} />
            </Panel>
            <Panel
              title="Latest bookings"
              actions={
                <Btn small onClick={() => nav('/admin/r/bookings')}>
                  View all
                </Btn>
              }
              pad={0}
            >
              <BookingRows rows={asList(data.recent)} empty="No bookings yet." />
            </Panel>
          </div>
        </>
      )}
    </>
  );
}

export function BookingRows({ rows, empty, showDate = true }) {
  const nav = useNavigate();
  if (!rows.length) return <div style={{ padding: 20, ...t(14, { c: C.muted }) }}>{empty}</div>;
  return (
    <div>
      {rows.map((b, i) => (
        <button
          key={b.id}
          className="tap"
          onClick={() => nav(`/admin/bookings/${b.id}`)}
          style={{
            width: '100%',
            padding: '12px 20px',
            borderTop: i ? `1px solid ${C.divider}` : undefined,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            textAlign: 'left',
            background: '#fff',
          }}
        >
          <span style={{ width: 84, flex: 'none' }}>
            <span style={{ display: 'block', ...t(13, { w: 700 }) }}>{b.time}</span>
            {showDate && <span style={{ display: 'block', ...t(12, { c: C.muted }) }}>{b.date_label}</span>}
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="clamp1" style={{ display: 'block', ...t(14, { w: 600 }) }}>
              {b.player}
            </span>
            <span className="clamp1" style={{ display: 'block', ...t(12, { c: C.muted }) }}>
              {b.venue} · {b.court} · {b.code}
            </span>
          </span>
          {b.checked_in ? <Badge value="success" label="Checked in" /> : <Badge value={b.status} label={b.status_label} />}
          <span style={{ width: 76, textAlign: 'right', fontVariantNumeric: 'tabular-nums', ...t(14, { w: 700 }) }}>{inr(b.total)}</span>
        </button>
      ))}
    </div>
  );
}

/** Single-series column chart: thin bars rounded at the data end, recessive grid, hover tooltip per bar. */
function RevenueChart({ days }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...days.map((x) => x.amount ?? 0));
  const nice = (() => {
    const p = Math.pow(10, Math.floor(Math.log10(max)));
    return Math.ceil(max / p) * p;
  })();
  const H = 200;
  const ticks = [0, 0.5, 1].map((f) => Math.round(nice * f));
  return (
    <div>
      <div style={{ position: 'relative', height: H, display: 'flex', gap: 0, paddingLeft: 52 }}>
        {ticks.map((v) => (
          <div
            key={v}
            style={{ position: 'absolute', left: 52, right: 0, bottom: (v / nice) * H, borderTop: `1px ${v === 0 ? 'solid' : 'dashed'} ${v === 0 ? C.line : C.divider}` }}
          >
            <span style={{ position: 'absolute', left: -52, top: -8, width: 44, textAlign: 'right', ...t(11, { c: C.muted }) }}>
              {v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`}
            </span>
          </div>
        ))}
        {days.map((x, i) => {
          const h = ((x.amount ?? 0) / nice) * H;
          const on = hover === i;
          return (
            <div
              key={x.date}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              aria-label={`${x.label}: ${inr(x.amount)} from ${x.count} bookings`}
              style={{ position: 'relative', flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', cursor: 'default', outline: 'none' }}
            >
              <div
                style={{
                  width: 'min(22px, 60%)',
                  height: Math.max(h, x.amount ? 3 : 0),
                  borderRadius: '4px 4px 0 0',
                  background: on ? C.brand : C.green700,
                  opacity: hover == null || on ? 1 : 0.55,
                  transition: 'opacity 120ms',
                }}
              />
              {on && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: Math.min(h + 10, H - 40),
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 2,
                    padding: '8px 10px',
                    borderRadius: 10,
                    background: C.ink,
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                  }}
                >
                  <div style={t(11, { c: 'rgba(255,255,255,.7)' })}>{x.label}</div>
                  <div style={t(13, { w: 700, c: '#fff' })}>{inr(x.amount)}</div>
                  <div style={t(11, { c: 'rgba(255,255,255,.7)' })}>
                    {x.count} booking{x.count === 1 ? '' : 's'}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', paddingLeft: 52, marginTop: 8 }}>
        {days.map((x, i) => (
          <span key={x.date} style={{ flex: 1, textAlign: 'center', ...t(11, { c: i === days.length - 1 ? C.ink : C.muted, w: i === days.length - 1 ? 700 : 400 }) }}>
            {i % 2 === days.length % 2 || i === days.length - 1 ? x.short : ''}
          </span>
        ))}
      </div>
    </div>
  );
}
