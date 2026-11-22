/** 8 · Booking confirmed — URL: /booking-confirmed/:bookingId */
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarPlus, Check, UserPlus } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { routes } from '../../app/nav';
import { Shell } from '../../app/Shell';
import { asMap } from '../../lib/api';
import { addToCalendar, inviteText, share } from '../../lib/actions';
import { bookingRepo } from '../../lib/repos';
import { inr } from '../../lib/format';
import { C, d, hex, shadow, t } from '../../theme';
import { useData, useIsDesktop } from '../../ui/hooks';
import { useOverlay } from '../../ui/overlay';
import { ErrorRetry, GhostButton, Img, KV, ListSkeleton, Perforation, Pill, PrimaryButton } from '../../ui/kit';

export default function BookingConfirmed() {
  const id = Number(useParams().bookingId);
  const nav = useNavigate();
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

  return (
    <div className="page" style={{ position: 'relative', minHeight: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', top: -140, left: -60, right: -60, height: 360, background: C.limeSoft, borderRadius: '0 0 50% 50% / 0 0 180px 180px' }} />
      <div style={{ position: 'relative', flex: 1, padding: 'calc(var(--safe-top) + 28px) 20px 20px' }}>
        {hero}
        {card}
        <div style={{ height: 18 }} />
        {actions}
      </div>
      <div style={{ position: 'relative', padding: '12px 20px calc(24px + var(--safe-bottom) / 2)' }}>{nextBtns}</div>
    </div>
  );
}
