/** 8 · Booking confirmed — URL: /booking-confirmed/:bookingId */
import { useNavigate, useParams } from 'react-router-dom';
import { QrCode, UserPlus } from 'lucide-react';
import { CalendarDays, CalendarPlus, Check, MapPin, MapPinned, Phone } from '../../ui/icons';
import { QRCodeSVG } from 'qrcode.react';
import { routes } from '../../app/nav';
import { useSession } from '../../app/session';
import { Shell } from '../../app/Shell';
import { asMap } from '../../lib/api';
import { addToCalendar, inviteText, share } from '../../lib/actions';
import { bookingRepo } from '../../lib/repos';
import { inr } from '../../lib/format';
import { C, d, hex, shadow, t } from '../../theme';
import { useData, useIsDesktop } from '../../ui/hooks';
import { useOverlay } from '../../ui/overlay';
import { ErrorRetry, GhostButton, Img, KV, ListSkeleton, Perforation, Pill, PrimaryButton } from '../../ui/kit';
import { Disc, GoButton, Script } from '../../ui/brand';
import { openMaps } from '../venue/VenueDetails';

export default function BookingConfirmed() {
  const id = Number(useParams().bookingId);
  const nav = useNavigate();
  const app = useSession();
  const desktop = useIsDesktop();
  const { toast } = useOverlay();
  const { data: b, error, retry } = useData(() => bookingRepo.details(id), [id]);
  if (error)
    return (
      <Shell>
        <ErrorRetry message={error} onRetry={retry} />
      </Shell>
    );
  if (!b)
    return (
      <Shell>
        <ListSkeleton />
      </Shell>
    );
  const venue = asMap(b.venue),
    sport = asMap(b.sport),
    court = asMap(b.court);

  const card = (
    <div style={{ borderRadius: 24, background: '#fff', boxShadow: shadow.big, overflow: 'hidden' }}>
      <div style={{ position: 'relative', height: 110 }}>
        <Img url={venue.image} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 20%, rgba(0,0,0,.65) 100%)' }} />
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 12, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={d(18, { c: '#fff' })}>{venue.name}</div>
            <div style={t(12, { c: '#fff' })}>
              {venue.area}, {venue.city}
            </div>
          </div>
          <Pill bg={C.lime} fg={C.ink}>
            CONFIRMED
          </Pill>
        </div>
      </div>
      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <KV k="Date" v={b.date_long} />
        <KV k="Time" v={b.time_long} />
        <KV
          k="Court"
          v={
            <>
              {court.name} · <span style={{ color: hex(sport.fg) }}>{sport.name}</span>
            </>
          }
        />
        <KV k="Booking ID" v={b.code} />
      </div>
      <Perforation bg={desktop ? C.ground : C.ground} />
      <div style={{ padding: '10px 16px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
        <span style={{ width: 96, height: 96, padding: 6, borderRadius: 12, border: `1px solid ${C.line}`, flex: 'none' }}>
          <QRCodeSVG value={String(b.qr_payload ?? b.code)} size={82} fgColor={C.ink} aria-label="Check-in QR code" />
        </span>
        <div>
          <div style={t(14, { w: 700 })}>Show at the counter</div>
          <div style={{ marginTop: 6, ...t(12, { c: C.muted, h: 1.5 }) }}>Scan this QR at check-in. Please arrive 10 minutes early.</div>
        </div>
      </div>
    </div>
  );

  const actions = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <GhostButton icon={CalendarPlus} onClick={() => addToCalendar(b)}>
        Add to calendar
      </GhostButton>
      <GhostButton icon={UserPlus} onClick={async () => (await share(inviteText(b))) === 'copied' && toast('Invite copied')}>
        Invite team
      </GhostButton>
    </div>
  );
  const nextBtns = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
      <GhostButton height={56} radius={18} fontSize={15} onClick={() => nav(routes.home, { replace: true })}>
        Home
      </GhostButton>
      {b.lobby ? (
        <PrimaryButton onClick={() => nav(routes.match(b.lobby.id), { replace: true })}>Open Match Room</PrimaryButton>
      ) : (
        <PrimaryButton onClick={() => nav(routes.ticket(b.id), { replace: true })}>View full ticket</PrimaryButton>
      )}
    </div>
  );
  const hero = (
    <>
      <div style={{ display: 'grid', placeItems: 'center' }}>
        <span
          style={{
            width: 84,
            height: 84,
            borderRadius: 99,
            background: C.brand,
            display: 'grid',
            placeItems: 'center',
            boxShadow: '0 0 0 10px rgba(20,61,43,.15), 0 14px 30px rgba(20,61,43,.25)',
            animation: 'pop 500ms cubic-bezier(.3,1.6,.5,1)',
          }}
        >
          <Check size={40} color="#fff" />
        </span>
      </div>
      <h1 style={{ margin: '18px 0 0', textAlign: 'center', ...d(desktop ? 36 : 28, { ls: -0.4 }) }}>Booking confirmed!</h1>
      <p style={{ margin: '6px 0 18px', textAlign: 'center', ...t(14, { c: C.muted, h: 1.5 }) }}>
        {inr(b.total)} paid via {b.payment_method_label}. Details sent to your email.
      </p>
    </>
  );

  if (desktop) {
    return (
      <Shell>
        <div style={{ position: 'relative', maxWidth: 560, margin: '0 auto', paddingTop: 20 }}>
          <div style={{ position: 'absolute', top: -200, left: -240, right: -240, height: 420, borderRadius: '0 0 50% 50%', background: C.limeSoft, zIndex: -1 }} />
          {hero}
          {card}
          <div style={{ height: 18 }} />
          {actions}
          <div style={{ height: 12 }} />
          {nextBtns}
        </div>
      </Shell>
    );
  }

  // Phone (redesign): green hero with the trophy, an overlapping ticket, round quick actions and the next step.
  const firstName = String(app.user?.name ?? '').trim().split(' ')[0];
  const quick = [
    { label: 'Directions', icon: MapPinned, on: () => openMaps(venue) },
    venue.phone ? { label: 'Call venue', icon: Phone, on: () => (window.location.href = `tel:${venue.phone}`) } : { label: 'Full ticket', icon: QrCode, on: () => nav(routes.ticket(b.id)) },
    { label: 'Add to calendar', icon: CalendarPlus, on: () => addToCalendar(b) },
  ];
  const pin = String(b.checkin_pin ?? '').split('');
  return (
    <div className="page" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: C.brandDark }}>
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            background: C.brand,
            borderRadius: '0 0 32px 32px',
            padding: 'calc(var(--safe-top) + 30px) 16px 76px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <svg viewBox="0 0 390 180" width="100%" height="180" preserveAspectRatio="xMidYMin slice" aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0 }}>
            <g fill={C.sun}>
              <rect x="52" y="40" width="10" height="5" rx="2.5" transform="rotate(30 57 42)" />
              <rect x="320" y="58" width="12" height="5" rx="2.5" transform="rotate(-25 326 60)" />
              <circle cx="300" cy="28" r="4" />
            </g>
            <g fill={C.coral}>
              <circle cx="86" cy="104" r="3.5" />
              <rect x="270" y="118" width="9" height="4" rx="2" transform="rotate(50 274 120)" />
              <rect x="36" y="136" width="10" height="4" rx="2" transform="rotate(-40 41 138)" />
              <circle cx="352" cy="140" r="3" />
            </g>
          </svg>
          <span
            style={{
              position: 'relative',
              width: 112,
              height: 112,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 30%, #FFFFFF 0%, #DCEBE0 70%, #B9D3C1 100%)',
              boxShadow: '0 12px 26px rgba(0,0,0,.35)',
              display: 'grid',
              placeItems: 'center',
              animation: 'pop 500ms cubic-bezier(.3,1.6,.5,1)',
            }}
          >
            <img src="/images/trophy.png" alt="" style={{ width: 92, height: 92, objectFit: 'contain', filter: 'drop-shadow(0 6px 8px rgba(0,0,0,.25))' }} />
            <span style={{ position: 'absolute', right: -2, bottom: 4, width: 36, height: 36, borderRadius: '50%', background: C.green700, border: `3px solid ${C.brand}`, display: 'grid', placeItems: 'center' }}>
              <Check size={18} color="#fff" strokeWidth={3} />
            </span>
          </span>
          <h1 style={{ position: 'relative', margin: '16px 0 0', ...d(30, { c: '#fff', ls: -1 }) }}>
            You're on{firstName ? ', ' : ''}
            <Script>{firstName ? `${firstName}!` : '!'}</Script>
          </h1>
          <div style={{ position: 'relative', marginTop: 4, ...t(14, { w: 600, c: C.panelInk }) }}>
            Booking confirmed · {inr(b.total)} paid{b.payment_method_label ? ` with ${b.payment_method_label}` : ''}
          </div>
        </div>
      </header>

      <div
        style={{ position: 'relative', margin: '-56px 16px 0', borderRadius: 26, background: '#fff', overflow: 'hidden', boxShadow: '0 1px 2px rgba(12,36,25,.08), 0 14px 34px rgba(12,36,25,.16)' }}
      >
        <div style={{ position: 'relative', height: 96 }}>
          <Img url={venue.image} alt={venue.name} />
          <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(11,42,29,.85) 0%, rgba(11,42,29,.2) 100%)' }} />
          <span style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column' }}>
            <span style={d(18, { c: '#fff', ls: -0.4 })}>{venue.name}</span>
            <span style={t(12.5, { w: 600, c: C.panelInk })}>
              {court.name} · {sport.name}
            </span>
          </span>
        </div>
        <button onClick={() => nav(routes.ticket(b.id))} style={{ width: '100%', display: 'flex', gap: 16, padding: 18, alignItems: 'center', textAlign: 'left' }}>
          <span style={{ padding: 8, borderRadius: 12, border: `1px solid ${C.hair}`, flex: 'none', lineHeight: 0 }}>
            <QRCodeSVG value={String(b.qr_payload ?? b.code)} size={105} fgColor={C.ink} aria-label="Check-in QR code" />
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <span style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={t(11, { w: 800, c: C.muted, ls: 1 })}>BOOKING ID</span>
              <span style={{ whiteSpace: 'nowrap', ...t('clamp(13px, 4.2vw, 16px)', { w: 800, ls: 0.3 }) }}>{b.code}</span>
            </span>
            {pin.length > 0 && (
              <span style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={t(11, { w: 800, c: C.muted, ls: 1 })}>CHECK-IN PIN</span>
                <span style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                  {pin.map((x, i) => (
                    <span key={i} style={{ width: 26, height: 32, borderRadius: 8, background: C.mint, display: 'grid', placeItems: 'center', ...t(17, { w: 800, c: C.brand, h: 1 }) }}>
                      {x}
                    </span>
                  ))}
                </span>
              </span>
            )}
          </span>
        </button>
        <div style={{ margin: '0 18px', borderTop: `1px dashed ${C.chipLine}` }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px 18px 18px' }}>
          {[
            [CalendarDays, `${b.date_long} · ${b.time_long}`, 'Reach 10 minutes early to check in'],
            [MapPin, venue.address || `${venue.area}, ${venue.city}`, `${venue.area}, ${venue.city}`],
          ].map(([I, title, sub]) => (
            <div key={title} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Disc icon={I} size={40} iconSize={20} />
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span className="clamp2" style={t(14.5, { w: 800 })}>
                  {title}
                </span>
                <span style={t(12.5, { w: 600, c: C.muted })}>{sub}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, padding: '22px 16px 0' }}>
        {quick.map((q) => (
          <button key={q.label} className="tap" onClick={q.on} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, ...t(12.5, { w: 800 }) }}>
            <Disc icon={q.icon} size={60} iconSize={24} />
            {q.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 24 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 16px calc(22px + var(--safe-bottom))' }}>
        {b.lobby ? (
          <GoButton style={{ flex: 'none' }} onClick={() => nav(routes.match(b.lobby.id), { replace: true })}>
            Open Match Room
          </GoButton>
        ) : (
          <GoButton style={{ flex: 'none' }} onClick={async () => (await share(inviteText(b))) === 'copied' && toast('Invite copied')}>
            Invite your squad
          </GoButton>
        )}
        <button onClick={() => nav(routes.home, { replace: true })} style={{ height: 48, borderRadius: 16, ...t(15, { w: 800, c: C.brand }) }}>
          Back to home
        </button>
      </div>
    </div>
  );
}
