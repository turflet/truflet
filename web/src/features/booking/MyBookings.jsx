/** 9 · My bookings: upcoming / completed / cancelled, plus rating a finished game. */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, CircleHelp, QrCode, Star } from 'lucide-react';
import { useSession } from '../../app/session';
import { routes } from '../../app/nav';
import { Shell } from '../../app/Shell';
import { SignInGate } from '../auth/SignInGate';
import { asList, asMap, errText } from '../../lib/api';
import { bookingRepo, venueRepo } from '../../lib/repos';
import { inr } from '../../lib/format';
import { C, d, shadow, t } from '../../theme';
import { useData, useIsDesktop } from '../../ui/hooks';
import { useOverlay } from '../../ui/overlay';
import { ErrorRetry, GhostButton, Img, KV, ListSkeleton, Pill, PrimaryButton, Segmented, SportPill } from '../../ui/kit';

const TABS = ['upcoming', 'completed', 'cancelled'];

export default function MyBookingsPage() {
  return (
    <Shell nav>
      <SignInGate>
        <MyBookings />
      </SignInGate>
    </Shell>
  );
}

function MyBookings() {
  const app = useSession();
  const nav = useNavigate();
  const desktop = useIsDesktop();
  const { toast, sheet } = useOverlay();
  const [tab, setTab] = useState(0);
  const { data, error, retry, reload } = useData(() => bookingRepo.list(TABS[tab]), [tab]);
  const counts = asMap(data?.counts);
  const items = asList(data?.items);

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

  return (
    <div style={{ padding: desktop ? 0 : 'calc(var(--safe-top) + 12px) 0 20px' }}>
      <div style={{ padding: desktop ? 0 : '0 20px', display: 'flex', alignItems: 'flex-end', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, ...d(desktop ? 36 : 28, { ls: -0.5 }) }}>My bookings</h1>
          <div style={{ marginTop: 4, ...t(13, { c: C.muted }) }}>Linked to {app.user?.masked_email ?? app.user?.email ?? ''}</div>
        </div>
        <GhostButton icon={CircleHelp} height={40} radius={999} fontSize={13} onClick={() => nav('/help')}>
          Help
        </GhostButton>
      </div>
      <div style={{ padding: desktop ? '22px 0 0' : '18px 20px 0', maxWidth: desktop ? 560 : undefined }}>
        <Segmented labels={['Upcoming', 'Completed', 'Cancelled']} counts={[counts.upcoming ?? 0, counts.completed ?? 0, counts.cancelled ?? 0]} index={tab} onChange={setTab} />
      </div>
      <div style={{ height: 16 }} />
      {error && <ErrorRetry message={error} onRetry={retry} />}
      {!data && !error && <ListSkeleton rows={3} />}
      {data && items.length === 0 && (
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
      )}
      <div style={{ display: 'grid', gridTemplateColumns: desktop ? 'repeat(auto-fill, minmax(420px, 1fr))' : '1fr', gap: desktop ? 20 : 14, padding: desktop ? 0 : '0 20px' }}>
        {items.map((b) => (
          <BookingCard key={b.id} b={b} onRate={() => rate(b)} />
        ))}
      </div>
    </div>
  );
}

function BookingCard({ b, onRate }) {
  const nav = useNavigate();
  const status = b.status;
  const st = {
    held: ['Payment due', C.coralSoft, C.orangeInk],
    confirmed: ['Confirmed', C.mint, C.green700],
    completed: ['Completed', C.chip, C.muted],
    cancelled: [(b.refund_amount ?? 0) > 0 ? 'Refunded' : 'Cancelled', C.orangeSoft, C.orangeInk],
  };
  const [label, bg, fg] = st[status] ?? [status, C.chip, C.muted];
  const venue = asMap(b.venue),
    sport = asMap(b.sport),
    court = asMap(b.court);
  const open = () => nav(routes.ticket(b.id));
  return (
    <div className="lift" style={{ borderRadius: 22, background: '#fff', boxShadow: shadow.card, overflow: 'hidden' }}>
      <button onClick={open} style={{ width: '100%', padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start', textAlign: 'left' }}>
        <span style={{ width: 76, height: 76, flex: 'none' }}>
          <Img url={venue.image} radius={16} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, ...d(16, { h: 1.2 }) }}>{venue.name}</div>
            <Pill bg={bg} fg={fg} padding="3px 9px">
              {label}
            </Pill>
          </div>
          <div style={{ margin: '4px 0', ...t(13, { c: C.muted }) }}>{venue.area}</div>
          <SportPill sport={sport} label={`${sport.name} · ${court.name}`} />
          {b.lobby && (
            <div style={{ marginTop: 6 }}>
              <Pill bg={C.limeSoft} fg={C.green700}>
                {b.role === 'player' ? 'Joined match' : 'Match'} · {b.lobby.taken}/{b.lobby.capacity} in
              </Pill>
            </div>
          )}
        </div>
      </button>
      <div style={{ padding: '12px 14px', background: C.ground, borderTop: `1px dashed ${C.dashed}`, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <KV k="Date" v={b.date_label} vSize={13} />
        <KV k="Time" v={b.time_short} vSize={13} />
        <KV k={status === 'cancelled' ? 'Refund' : status === 'held' ? 'Due' : 'Paid'} v={inr(status === 'cancelled' ? b.refund_amount : (b.my_paid ?? b.total))} vSize={13} />
      </div>
      <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, ...t(12, { c: C.muted }) }}>{b.note ?? ''}</div>
        {status === 'confirmed' && (
          <button
            className="tap"
            onClick={open}
            style={{ height: 40, padding: '0 14px', borderRadius: 12, background: C.brand, display: 'flex', alignItems: 'center', gap: 6, ...t(13, { w: 600, c: '#fff' }) }}
          >
            <QrCode size={16} color="#fff" /> View ticket
          </button>
        )}
        {status === 'held' && (
          <div style={{ width: 112 }}>
            <PrimaryButton height={40} radius={12} fontSize={13} shadowOn={false} onClick={() => nav(routes.payment(b.id))}>
              Pay now
            </PrimaryButton>
          </div>
        )}
        {status === 'completed' && (
          <>
            {b.can_review === true && (
              <GhostButton height={40} radius={12} fontSize={13} onClick={onRate}>
                Rate
              </GhostButton>
            )}
            <GhostButton height={40} radius={12} fontSize={13} bg={C.mint} fg={C.green700} border="transparent" onClick={() => nav(`/book?venue=${venue.id}&sport=${sport.id}`)}>
              Book again
            </GhostButton>
          </>
        )}
        {status === 'cancelled' && (
          <button onClick={() => nav('/policy?tab=0')} style={{ padding: '10px 0', textDecoration: 'underline', ...t(13, { w: 600, c: C.brand }) }}>
            Refund policy
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
