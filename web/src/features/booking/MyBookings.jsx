/** 9 · My bookings (redesign): dark band + green panel with the up-next ticket, then the rest as cards with
 *  rating / book-again / pay actions. */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, QrCode } from 'lucide-react';
import { MapPinned, Phone, Star } from '../../ui/icons';
import { useSession } from '../../app/session';
import { routes, useBack } from '../../app/nav';
import { Shell } from '../../app/Shell';
import { SignInGate } from '../auth/SignInGate';
import { asList, asMap, errText } from '../../lib/api';
import { bookingRepo, venueRepo } from '../../lib/repos';
import { inr } from '../../lib/format';
import { C, d, t } from '../../theme';
import { useData, useIsDesktop } from '../../ui/hooks';
import { useOverlay } from '../../ui/overlay';
import { ErrorRetry, Img, ListSkeleton, PrimaryButton, Segmented } from '../../ui/kit';
import { Band, Panel, PanelHeadline, ProfileButton, Rule, UnderlineTabs } from '../../ui/brand';
import { openMaps } from '../venue/VenueDetails';

const TABS = ['upcoming', 'completed', 'cancelled'];

export default function MyBookingsPage() {
  const back = useBack();
  const desktop = useIsDesktop();
  const { loggedIn } = useSession();
  if (!loggedIn || desktop)
    return (
      <Shell>
        {!desktop && <Band title="My bookings" back={back} right={<ProfileButton />} />}
        <SignInGate>
          <MyBookings />
        </SignInGate>
      </Shell>
    );
  return (
    <Shell>
      <MyBookings />
    </Shell>
  );
}

function MyBookings() {
  const nav = useNavigate();
  const back = useBack();
  const desktop = useIsDesktop();
  const { toast, sheet } = useOverlay();
  const [tab, setTab] = useState(0);
  const { data, error, retry, reload } = useData(() => bookingRepo.list(TABS[tab]), [tab]);
  const counts = asMap(data?.counts);
  const items = asList(data?.items);
  const [next, ...rest] = items;
  const showNext = tab === 0 && next && !desktop;
  const listed = showNext ? rest : items;

  const rate = async (b) => {
    const stars = await sheet((close) => <RateSheet name={b.venue?.name} close={close} />);
    if (!stars) return;
    try {
      await venueRepo.review(b.venue.id, stars, b.id);
      toast('Thanks for rating!');
      reload();
    } catch (e) {
      toast(errText(e));
    }
  };

  const emptyNote = data && items.length === 0 && (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      <Calendar size={40} color={C.muted} />
      <div style={{ marginTop: 12, ...t(14, { c: C.muted }) }}>{['No upcoming games. Book a slot!', 'No completed games yet.', 'No cancellations.'][tab]}</div>
      {tab === 0 && (
        <div style={{ marginTop: 16, width: 220 }}>
          <PrimaryButton height={48} onClick={() => nav(routes.home)}>
            Explore turfs
          </PrimaryButton>
        </div>
      )}
    </div>
  );

  const cards = (
    <div style={{ display: 'grid', gridTemplateColumns: desktop ? 'repeat(auto-fill, minmax(420px, 1fr))' : 'minmax(0, 1fr)', gap: 16 }}>
      {listed.map((b) => (
        <BookingCard key={b.id} b={b} onRate={() => rate(b)} />
      ))}
    </div>
  );

  const labels = [`Upcoming · ${counts.upcoming ?? 0}`, `Completed · ${counts.completed ?? 0}`, `Cancelled · ${counts.cancelled ?? 0}`];

  if (desktop) {
    return (
      <div>
        <h1 style={{ margin: 0, ...d(36, { ls: -0.5 }) }}>My bookings</h1>
        <div style={{ marginTop: 4, ...t(14, { c: C.muted }) }}>
          {counts.upcoming ?? 0} upcoming · {counts.completed ?? 0} played
        </div>
        <div style={{ padding: '22px 0 18px', maxWidth: 560 }}>
          <Segmented labels={labels} index={tab} onChange={setTab} />
        </div>
        {error && <ErrorRetry message={error} onRetry={retry} />}
        {!data && !error && <ListSkeleton rows={3} />}
        {emptyNote}
        {cards}
      </div>
    );
  }

  return (
    <>
      <Band title="My bookings" subtitle={data ? `${counts.upcoming ?? 0} upcoming · ${counts.completed ?? 0} played` : ' '} back={back} right={<ProfileButton />}>
        <Panel padding="6px 16px 22px">
          <UnderlineTabs items={labels.map((l) => l.toUpperCase())} index={tab} onChange={setTab} />
          {showNext && <UpNext b={next} />}
          {tab > 0 && data && (
            <PanelHeadline size={28}>
              {tab === 1 ? `${counts.completed ?? 0} games played` : `${counts.cancelled ?? 0} cancelled`}
            </PanelHeadline>
          )}
        </Panel>
      </Band>
      <main style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '24px 16px 32px' }}>
        {error && <ErrorRetry message={error} onRetry={retry} />}
        {!data && !error && <ListSkeleton rows={3} />}
        {emptyNote}
        {showNext && listed.length > 0 && <Rule>Also coming up</Rule>}
        {cards}
      </main>
    </>
  );
}

/** "Kick-off in 2 days" — or hours when it's today. */
function kickoff(b) {
  const h = Number(b.hours_left ?? 0);
  if (h <= 0) return 'ON NOW';
  if (h < 1) return 'KICK-OFF SOON';
  if (h < 24) return `KICK-OFF IN ${Math.round(h)} HR${Math.round(h) === 1 ? '' : 'S'}`;
  const days = Math.round(h / 24);
  return `KICK-OFF IN ${days} DAY${days === 1 ? '' : 'S'}`;
}

/** The next game as a white ticket inside the green panel. */
function UpNext({ b }) {
  const nav = useNavigate();
  const venue = asMap(b.venue),
    sport = asMap(b.sport),
    court = asMap(b.court);
  const held = b.status === 'held';
  const open = () => nav(held ? routes.payment(b.id) : routes.ticket(b.id));
  const quick = [
    { label: 'Directions', icon: MapPinned, on: () => openMaps(venue) },
    venue.phone ? { label: 'Call', icon: Phone, on: () => (window.location.href = `tel:${venue.phone}`) } : null,
    { label: held ? 'Pay now' : 'Pass', icon: QrCode, on: open },
  ].filter(Boolean);
  return (
    <div style={{ borderRadius: 22, overflow: 'hidden', background: '#fff', color: C.ink }}>
      <button onClick={open} style={{ display: 'block', width: '100%', textAlign: 'left' }}>
        <span style={{ position: 'relative', display: 'block', height: 140 }}>
          <Img url={venue.image} alt={venue.name ?? ''} />
          <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(12,36,25,.1) 0%, rgba(12,36,25,.85) 100%)' }} />
          <span style={{ position: 'absolute', top: 12, right: 12, padding: '6px 10px', borderRadius: 999, background: C.sun, ...t(12, { w: 800, h: 1.2 }) }}>
            {held ? 'Payment due' : 'Show pass'}
          </span>
          <span style={{ position: 'absolute', left: 16, bottom: 12, display: 'flex', flexDirection: 'column' }}>
            <span style={t(12, { w: 800, c: C.sun, ls: 1 })}>{kickoff(b)}</span>
            <span style={d(18, { c: '#fff', ls: -0.4 })}>
              {b.date_label} · {b.time_short}
            </span>
          </span>
        </span>
        <span style={{ display: 'flex', gap: 12, padding: '14px 16px', alignItems: 'center' }}>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="clamp1" style={t(16, { w: 800 })}>
              {venue.name}
            </span>
            <span className="clamp1" style={t(12.5, { w: 600, c: C.mutedInk })}>
              {court.name} · {sport.name} · {b.duration} hr{b.duration === 1 ? '' : 's'}
            </span>
            <span style={t(12.5, { c: C.muted })}>
              ID {b.code}
              {b.checkin_pin ? ` · PIN ${b.checkin_pin}` : ''}
            </span>
          </span>
          <span style={t(15, { w: 800 })}>{inr(b.my_paid ?? b.total)}</span>
        </span>
      </button>
      <span style={{ display: 'grid', gridTemplateColumns: `repeat(${quick.length}, minmax(0, 1fr))`, borderTop: `1px solid ${C.hair}` }}>
        {quick.map((q, i) => (
          <button
            key={q.label}
            className="tap"
            onClick={q.on}
            style={{
              padding: '12px 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              borderRight: i < quick.length - 1 ? `1px solid ${C.hair}` : undefined,
              ...t(12.5, { w: 800, c: C.brand }),
            }}
          >
            <q.icon size={16} color={C.brand} /> {q.label}
          </button>
        ))}
      </span>
    </div>
  );
}

function BookingCard({ b, onRate }) {
  const nav = useNavigate();
  const status = b.status;
  const st = {
    held: ['PAYMENT DUE', C.coralSoft, C.orangeInk],
    confirmed: ['CONFIRMED', C.mint, C.brand],
    completed: ['PLAYED', C.mint, C.brand],
    cancelled: [(b.refund_amount ?? 0) > 0 ? `REFUNDED ${inr(b.refund_amount)}` : 'CANCELLED', C.coralSoft, C.orangeInk],
  };
  const [label, bg, fg] = st[status] ?? [String(status).toUpperCase(), C.chip, C.muted];
  const venue = asMap(b.venue),
    sport = asMap(b.sport),
    court = asMap(b.court);
  const open = () => nav(routes.ticket(b.id));
  const again = () => nav(`/book?venue=${venue.id}&sport=${sport.id}`);
  const cta = { padding: '0 14px', height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', ...t(13, { w: 800, c: C.brand }) };
  return (
    <div style={{ borderRadius: 20, border: `1px solid ${C.hair}`, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12, background: '#fff' }}>
      <button onClick={open} style={{ display: 'flex', gap: 12, alignItems: 'center', textAlign: 'left' }}>
        <span style={{ width: 52, height: 52, borderRadius: '50%', overflow: 'hidden', flex: 'none' }}>
          <Img url={venue.image} />
        </span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span className="clamp1" style={t(15, { w: 800 })}>
            {venue.name}
          </span>
          <span className="clamp1" style={t(12.5, { w: 600, c: C.muted })}>
            {b.date_label} · {b.time_short} · {sport.name} · {court.name}
          </span>
        </span>
        <span style={{ flex: 'none', padding: '4px 8px', borderRadius: 6, background: bg, ...t(11, { w: 800, c: fg, h: 1.2 }) }}>{label}</span>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 12, borderTop: `1px dashed ${C.chipLine}` }}>
        <span className="clamp1" style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, ...t(12.5, { w: 700, c: C.mutedInk }) }}>
          {status === 'completed' && b.can_review === true ? (
            <button onClick={onRate} style={{ display: 'flex', alignItems: 'center', gap: 3, ...t(12.5, { w: 700, c: C.mutedInk }) }}>
              Rate
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} size={16} color="#DDD9CE" fill="#DDD9CE" />
              ))}
            </button>
          ) : (
            <span className="clamp1">{b.note || `${inr(status === 'cancelled' ? b.refund_amount : (b.my_paid ?? b.total))} paid`}</span>
          )}
        </span>
        {status === 'confirmed' && (
          <button className="tap" onClick={open} style={{ ...cta, background: C.brand, color: '#fff', display: 'flex', gap: 6, alignItems: 'center' }}>
            <QrCode size={15} color="#fff" /> Ticket
          </button>
        )}
        {status === 'held' && (
          <button className="tap" onClick={() => nav(routes.payment(b.id))} style={{ ...cta, background: C.brand, color: '#fff' }}>
            Pay now
          </button>
        )}
        {(status === 'completed' || status === 'cancelled') && (
          <button className="tap" onClick={again} style={{ ...cta, border: `1.5px solid ${C.brand}` }}>
            Book again
          </button>
        )}
      </div>
    </div>
  );
}

function RateSheet({ name, close }) {
  const [stars, setStars] = useState(5);
  return (
    <div>
      <div style={d(20)}>Rate {name}</div>
      <div style={{ margin: '16px 0', display: 'flex', justifyContent: 'center', gap: 4 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button key={i} aria-label={`${i} stars`} className="tap" onClick={() => setStars(i)} style={{ padding: 4 }}>
            <Star size={40} color={C.star} fill={i <= stars ? C.star : 'none'} />
          </button>
        ))}
      </div>
      <PrimaryButton height={52} onClick={() => close(stars)}>
        Submit
      </PrimaryButton>
    </div>
  );
}
