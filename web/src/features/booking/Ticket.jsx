/** 10 · Ticket (full QR pass) with cancel / reschedule. URL: /tickets/:bookingId
 *  Desktop: the pass on the left, details and actions on the right. */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, CircleHelp, MessagesSquare, Navigation, Phone, Share2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { routes, useBack } from '../../app/nav';
import { Shell } from '../../app/Shell';
import { asMap, errText } from '../../lib/api';
import { share } from '../../lib/actions';
import { bookingRepo } from '../../lib/repos';
import { inr } from '../../lib/format';
import { C, d, hex, shadow, t } from '../../theme';
import { useData, useIsDesktop } from '../../ui/hooks';
import { useOverlay } from '../../ui/overlay';
import { BackSquare, CardBox, ErrorRetry, GhostButton, H2, Img, KV, ListSkeleton, Perforation, Pill, PrimaryButton, PriceRow, SquareIconButton } from '../../ui/kit';
import { openMaps } from '../venue/VenueDetails';

const STATUS = { confirmed: 'CONFIRMED', completed: 'COMPLETED', cancelled: 'CANCELLED', held: 'AWAITING PAYMENT', expired: 'EXPIRED' };

export default function Ticket() {
  const id = Number(useParams().bookingId);
  const nav = useNavigate();
  const back = useBack(routes.bookings);
  const desktop = useIsDesktop();
  const { toast, sheet } = useOverlay();
  const { data: b, error, retry, refetch } = useData(() => bookingRepo.details(id), [id]);
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
  const status = b.status;
  const confirmed = status === 'confirmed';
  const hoursLeft = Number(b.hours_left ?? 0);

  const cancel = async () => {
    let quote;
    try {
      quote = await bookingRepo.cancelQuote(b.id);
    } catch (e) {
      return toast(errText(e));
    }
    const cancelled = await sheet((close) => <CancelSheet b={b} quote={quote} close={close} onDone={() => nav(routes.bookings)} />);
    if (cancelled) refetch();
  };

  const shareTicket = async () =>
    (await share(`Turflet booking ${b.code} · ${venue.name} · ${b.date_long} ${b.time_long} · ${court.name}`)) === 'copied' && toast('Ticket details copied');

  const pass = (
    <div style={{ borderRadius: 26, background: '#fff', boxShadow: shadow.big, overflow: 'hidden' }}>
      <div style={{ position: 'relative', height: 120 }}>
        <Img url={venue.image} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,.05) 10%, rgba(0,0,0,.7) 100%)' }} />
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 12, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={d(19, { c: '#fff' })}>{venue.name}</div>
            <div className="clamp1" style={t(12, { c: '#fff' })}>
              {venue.address ?? ''}
            </div>
          </div>
          <Pill bg={confirmed ? C.lime : '#fff'} fg={C.ink}>
            {STATUS[status] ?? status.toUpperCase()}
          </Pill>
        </div>
      </div>
      <div style={{ padding: '20px 16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ width: 196, height: 196, padding: 10, borderRadius: 18, border: `2px solid ${C.line}`, opacity: confirmed ? 1 : 0.35 }}>
          <QRCodeSVG value={String(b.qr_payload ?? b.code)} size={172} fgColor={C.ink} aria-label="Entry QR code" />
        </span>
        <div style={{ marginTop: 10, ...d(18, { ls: 1 }) }}>{b.code}</div>
        <div style={{ marginTop: 10, textAlign: 'center', whiteSpace: 'pre-line', ...t(12, { c: C.muted, h: 1.5 }) }}>
          {'Show this QR at the venue counter. One scan\nverifies your full booking — no login needed.'}
        </div>
        <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
          {['Booking ID', 'Venue & court', 'Date & slot', 'Players', 'Payment status'].map((x) => (
            <Pill key={x} bg={C.chip} fg={C.mutedInk} padding="4px 9px">
              {x}
            </Pill>
          ))}
        </div>
      </div>
      <Perforation height={26} notch={24} />
      <div style={{ padding: '6px 16px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 12px' }}>
        <KV k="Sport" v={sport.name} vColor={hex(sport.fg)} />
        <KV k="Court" v={`${court.name}${court.meta ? ` · ${court.meta}` : ''}`} />
        <KV k="Date" v={b.date_long} />
        <KV k="Time" v={b.time_long} />
        <KV k="Duration" v={`${b.duration} hour${b.duration === 1 ? '' : 's'}`} />
        <KV k="Players" v={`Up to ${b.players}`} />
        <KV k="Booked on" v={b.paid_at ?? '—'} />
        {b.masked_phone ? <KV k="Mobile" v={b.masked_phone} /> : <KV k="Email" v={b.masked_email ?? ''} />}
      </div>
    </div>
  );

  const lobby = b.lobby;
  const side = (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <GhostButton icon={Navigation} height={50} bg={C.blueSoft} fg={C.blue} border="transparent" onClick={() => openMaps(venue)}>
          Directions
        </GhostButton>
        <GhostButton icon={Phone} height={50} bg={C.mint} fg={C.green700} border="transparent" onClick={() => venue.phone && (window.location.href = `tel:${venue.phone}`)}>
          Call venue
        </GhostButton>
      </div>
      <CardBox style={{ display: 'grid', gap: 10 }}>
        <H2 size={16} style={{ marginBottom: 2 }}>
          Payment
        </H2>
        <PriceRow k={`Slot charges (${b.duration} × ${inr(b.rate)})`} v={inr(b.slot_amount)} />
        <PriceRow k="Convenience fee + GST" v={inr((b.convenience_fee ?? 0) + (b.gst ?? 0))} />
        {(b.discount ?? 0) > 0 && <PriceRow k={`Coupon ${b.coupon}`} v={`−${inr(b.discount)}`} color={C.brand} />}
        <PriceRow k={String(b.payment_method_label ?? '') ? `Paid via ${b.payment_method_label}` : 'Total'} v={inr(b.total)} bold top />
        {String(b.transaction_id ?? '') && <div style={t(12, { c: C.muted })}>Transaction ID: {b.transaction_id}</div>}
        {status === 'cancelled' && (
          <div style={t(12, { w: 600, c: C.orangeInk })}>
            Cancelled · {b.cancellation_code} · refund {inr(b.refund_amount)}
          </div>
        )}
        {status === 'held' && (
          <PrimaryButton height={48} onClick={() => nav(routes.payment(b.id))}>
            Complete payment
          </PrimaryButton>
        )}
      </CardBox>
      {lobby && (
        <CardBox>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <H2 size={16} style={{ flex: 1 }}>
              Match
            </H2>
            <Pill bg={C.limeSoft} fg={C.green700}>
              {lobby.paid_count}/{lobby.capacity} paid
            </Pill>
          </div>
          <div style={{ margin: '8px 0 12px', ...t(13, { c: C.muted, h: 1.5 }) }}>
            {b.role === 'player'
              ? `You paid ${inr(b.my_paid)} into escrow. The host booked the slot.`
              : lobby.payment_rule === 'host'
                ? 'You covered the slot — your squad plays free.'
                : 'Shares are collected in the Match Room and released to you when the venue checks your group in.'}
          </div>
          <GhostButton icon={MessagesSquare} height={46} radius={14} onClick={() => nav(routes.match(lobby.id))} style={{ width: '100%' }}>
            Open Match Room
          </GhostButton>
        </CardBox>
      )}
      {confirmed && b.role !== 'player' && (
        <div style={{ padding: 16, borderRadius: 20, background: C.orangeBg, border: `1px solid ${C.orangeSoft}` }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <H2 size={16} color={C.orangeInk} style={{ flex: 1 }}>
              Cancellation
            </H2>
            <button onClick={() => nav('/policy?tab=0')} style={{ padding: '6px 0', textDecoration: 'underline', ...t(13, { w: 600, c: C.orangeInk }) }}>
              Refund policy
            </button>
          </div>
          <div style={{ margin: '10px 0', ...t(13, { c: C.orangeDeep, h: 1.5 }) }}>
            {hoursLeft < 6
              ? 'Your slot starts in under 6 hours, so cancelling now is not refundable. You can still reschedule once for free up to 2 hours before.'
              : hoursLeft < 24
                ? 'Cancel now for a 50% refund of slot charges, or reschedule once for free up to 2 hours before.'
                : 'Cancel now for a full refund of slot charges. You can also reschedule once for free.'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <GhostButton
              height={46}
              radius={14}
              fg={C.orangeInk}
              border="#FED7AA"
              onClick={() =>
                (b.reschedule_count ?? 0) >= 1 || hoursLeft < 2 ? toast('Free reschedule is used up or the slot is too close.') : nav(`/book?venue=${venue.id}&reschedule=${b.id}`)
              }
            >
              Reschedule
            </GhostButton>
            <GhostButton height={46} radius={14} fg="#fff" bg={C.orange} border="transparent" onClick={cancel}>
              Cancel booking
            </GhostButton>
          </div>
        </div>
      )}
      <GhostButton icon={CircleHelp} onClick={() => nav(`/help?booking=${b.id}`)}>
        Need help with this booking?
      </GhostButton>
    </div>
  );

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: desktop ? '0 0 22px' : 'calc(var(--safe-top) + 8px) 20px 12px' }}>
      <BackSquare onClick={back} />
      <div style={{ flex: 1, ...d(desktop ? 30 : 20) }}>Your ticket</div>
      <SquareIconButton icon={Share2} iconSize={18} label="Share ticket" onClick={shareTicket} />
    </div>
  );

  if (desktop) {
    return (
      <Shell>
        {header}
        <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 36, alignItems: 'start' }}>
          <div style={{ position: 'sticky', top: 96 }}>{pass}</div>
          {side}
        </div>
      </Shell>
    );
  }
  return (
    <div className="page" style={{ paddingBottom: 32 }}>
      {header}
      <div style={{ padding: '4px 20px 0', display: 'grid', gap: 14 }}>
        {pass}
        {side}
      </div>
    </div>
  );
}

function CancelSheet({ b, quote, close, onDone }) {
  const { toast } = useOverlay();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  if (result) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <span style={{ width: 56, height: 56, borderRadius: 99, background: C.orangeSoft, display: 'grid', placeItems: 'center' }}>
          <Check color={C.orangeInk} />
        </span>
        <div style={{ marginTop: 12, ...d(22) }}>Booking cancelled</div>
        <div style={{ margin: '12px 0', ...t(14, { c: C.muted, h: 1.5 }) }}>
          Cancellation ID {result.cancellation_code}.{' '}
          {(result.refund_amount ?? 0) > 0 ? `${inr(result.refund_amount)} will be refunded to your ${result.payment_method_label}.` : 'A confirmation has been sent by email.'}
        </div>
        <PrimaryButton height={52} radius={16} shadowOn={false} fontSize={15} onClick={() => (close(true), onDone())}>
          Back to my bookings
        </PrimaryButton>
      </div>
    );
  }
  return (
    <div>
      <div style={d(22)}>Cancel this booking?</div>
      <div style={{ marginTop: 14, padding: 14, borderRadius: 16, background: C.ground, display: 'grid', gap: 8 }}>
        <PriceRow k="Amount paid" v={inr(quote.amount_paid)} />
        <PriceRow k={`Cancellation charge (${quote.percent}% refund)`} v={<span style={{ color: C.orange }}>−{inr(quote.charge)}</span>} />
        <PriceRow k="Refund" v={inr(quote.refund)} bold top />
      </div>
      <div style={{ margin: '14px 0', ...t(13, { c: C.muted, h: 1.5 }) }}>Tip: rescheduling is free once. The venue can then release this slot to other players.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <PrimaryButton height={52} radius={16} shadowOn={false} fontSize={15} onClick={() => close(false)}>
          Keep booking
        </PrimaryButton>
        <GhostButton
          fg={C.orangeInk}
          bg={C.orangeBg}
          border="#FED7AA"
          fontSize={15}
          onClick={
            busy
              ? undefined
              : async () => {
                  setBusy(true);
                  try {
                    setResult(await bookingRepo.cancel(b.id));
                  } catch (e) {
                    setBusy(false);
                    toast(errText(e));
                  }
                }
          }
        >
          {busy ? 'Cancelling…' : 'Cancel anyway'}
        </GhostButton>
      </div>
    </div>
  );
}
