/** 7 · Review & pay: hold countdown, coupon, price details, pay (the gateway checkout picks the method). URL: /payment/:bookingId
 *  Phone = the Flutter screen. Desktop = details on the left, sticky price + pay card on the right. */
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Clock, ShieldCheck } from 'lucide-react';
import { useSession } from '../../app/session';
import { routes, useBack } from '../../app/nav';
import { Shell } from '../../app/Shell';
import { asMap, errText } from '../../lib/api';
import { bookingRepo } from '../../lib/repos';
import { inr, mmss } from '../../lib/format';
import { C, d, shadow, t } from '../../theme';
import { useData, useIsDesktop, useNow } from '../../ui/hooks';
import { useOverlay } from '../../ui/overlay';
import { BackSquare, CardBox, ErrorRetry, H2, Img, KV, ListSkeleton, PriceRow, Spinner, SportPill } from '../../ui/kit';
import { reserveTab, showUpiCheckout } from './upiCheckout';

export default function PaymentPage() {
  const id = Number(useParams().bookingId);
  const { data, error, retry, setData } = useData(() => bookingRepo.details(id), [id]);
  if (error)
    return (
      <Shell>
        <ErrorRetry message={error} onRetry={retry} />
      </Shell>
    );
  if (!data)
    return (
      <Shell>
        <ListSkeleton rows={4} />
      </Shell>
    );
  return <Payment booking={data} setBooking={(b) => setData(b)} />;
}

function Payment({ booking: b, setBooking }) {
  const app = useSession();
  const nav = useNavigate();
  const back = useBack();
  const desktop = useIsDesktop();
  const { toast, sheet } = useOverlay();
  const now = useNow();
  const [code, setCode] = useState(b.coupon ?? '');
  const [busy, setBusy] = useState(false);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState(null);

  const until = b.held_until ? new Date(b.held_until).getTime() : null;
  const left = until == null ? 0 : Math.max(0, until - now);
  const applied = b.coupon != null;
  const peak = (b.peak_hours ?? 0) > 0;
  const gatewayUpi = app.config.upi_checkout === true;
  const venue = asMap(b.venue),
    sport = asMap(b.sport),
    court = asMap(b.court);

  if (b.status === 'confirmed') return <Navigate to={routes.confirmed(b.id)} replace />;

  const toggleCoupon = async () => {
    setCouponBusy(true);
    setCouponError(null);
    try {
      const r = await bookingRepo.applyCoupon(b.id, applied ? '' : code.trim());
      setBooking(r);
      if (applied) setCode('');
    } catch (e) {
      setCouponError(errText(e));
    } finally {
      setCouponBusy(false);
    }
  };

  const pay = async () => {
    if (left === 0) return toast('Your slot hold expired. Please pick the slot again.');
    const tab = gatewayUpi ? reserveTab() : null;
    setBusy(true);
    try {
      const r = await bookingRepo.pay(b.id, 'upi', '');
      const payment = r.payment;
      if (payment && typeof payment === 'object' && payment.status === 'pending' && r.status !== 'confirmed') {
        setBooking(r); // hold was extended for the payment window
        const done = await showUpiCheckout(sheet, { payment, poll: () => bookingRepo.paymentStatus(b.id), tab });
        if (!done) return;
        app.refreshMe();
        nav(routes.confirmed(b.id), { replace: true });
        return;
      }
      tab?.close();
      app.refreshMe(); // wallet balance may have changed
      nav(routes.confirmed(b.id), { replace: true });
    } catch (e) {
      tab?.close();
      toast(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const holdPill = (
    <span style={{ padding: '6px 10px', borderRadius: 999, background: C.warnBg, display: 'inline-flex', alignItems: 'center', gap: 6, ...t(12, { w: 600, c: C.warnInk }) }}>
      <Clock size={14} color={C.warnInk} /> {left === 0 ? 'Hold expired' : `Slot held ${mmss(left).padStart(5, '0')}`}
    </span>
  );

  const summaryCard = (
    <div style={{ borderRadius: 22, background: '#fff', boxShadow: shadow.card, overflow: 'hidden' }}>
      <div style={{ padding: 14, display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ width: 72, height: 72, flex: 'none' }}>
          <Img url={venue.image} radius={16} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={d(17)}>{venue.name}</div>
          <div style={{ margin: '4px 0', ...t(13, { c: C.muted }) }}>
            {venue.area}, {venue.city}
          </div>
          <SportPill sport={sport} label={`${sport.name} · ${court.name}`} />
        </div>
        <button onClick={back} style={{ padding: '8px 0', ...t(13, { w: 600, c: C.brand }) }}>
          Edit
        </button>
      </div>
      <div style={{ padding: '12px 14px 14px', background: C.ground, borderTop: `1px dashed ${C.dashed}`, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <KV k="Date" v={b.date_label} vSize={13} />
        <KV k="Time" v={b.time_short} vSize={13} />
        <KV k="Duration" v={`${b.duration} ${b.duration === 1 ? 'hr' : 'hrs'}`} vSize={13} />
      </div>
    </div>
  );

  const coupon = (
    <div style={{ padding: 14, borderRadius: 20, background: '#fff', border: `1px solid ${C.line}` }}>
      <div style={t(13, { w: 600 })}>Have a coupon?</div>
      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, height: 48, padding: '0 14px', borderRadius: 12, background: C.ground, border: `1px solid ${C.line}`, display: 'flex', alignItems: 'center' }}>
          <input disabled={applied} value={code} placeholder="Enter code" onChange={(e) => setCode(e.target.value.toUpperCase())} style={t(14)} />
        </div>
        <button
          className="tap"
          disabled={couponBusy}
          onClick={toggleCoupon}
          style={{ height: 48, padding: '0 18px', borderRadius: 12, background: applied ? C.mint : C.brand, ...t(14, { w: 700, c: applied ? C.brand : '#fff' }) }}
        >
          {couponBusy ? <Spinner size={18} color={applied ? C.brand : '#fff'} /> : applied ? 'Remove' : 'Apply'}
        </button>
      </div>
      <div style={{ marginTop: 10 }}>
        {couponError ? (
          <span style={t(12, { c: C.warnInk })}>{couponError}</span>
        ) : applied ? (
          <span style={t(13, { w: 600, c: C.brand })}>
            {b.coupon} applied — you save {inr(b.discount)}
          </span>
        ) : (
          <span style={t(12, { c: C.muted })}>
            Try <b style={{ color: C.ink }}>PLAY100</b> for ₹100 off your first booking
          </span>
        )}
      </div>
    </div>
  );

  const prices = (
    <div style={{ padding: 16, borderRadius: 20, background: '#fff', border: desktop ? 'none' : `1px solid ${C.line}`, display: 'grid', gap: 10 }}>
      <H2 size={16} style={{ marginBottom: 4 }}>
        Price details
      </H2>
      <PriceRow k={`Slot charges (${b.duration} × ${inr(b.rate)}${peak ? ' peak' : ''})`} v={inr(b.slot_amount)} />
      <PriceRow k="Convenience fee" v={inr(b.convenience_fee)} />
      <PriceRow k={`GST on fee (${Math.round(app.config.gst_percent ?? 18)}%)`} v={inr(b.gst)} />
      {applied && <PriceRow k="Coupon discount" v={`−${inr(b.discount)}`} color={C.brand} />}
      <PriceRow k="To pay" v={inr(b.total)} bold top size={16} />
    </div>
  );

  const reassure = (
    <>
      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, textAlign: 'center', ...t(12, { c: C.muted }) }}>
        <ShieldCheck size={14} color={C.muted} /> 100% secure payments · Free cancellation up to 6 hrs before
      </div>
      <div style={{ marginTop: 6, textAlign: 'center', ...t(12, { c: C.muted }) }}>Not ready? Go back and pay later from My Bookings before the hold ends.</div>
    </>
  );

  const payBtn = (
    <button
      className="tap"
      disabled={busy}
      onClick={pay}
      style={{
        width: '100%',
        height: 56,
        padding: '0 20px',
        borderRadius: 16,
        background: C.brand,
        boxShadow: shadow.brand,
        display: 'flex',
        alignItems: 'center',
        justifyContent: busy ? 'center' : 'space-between',
        gap: 6,
      }}
    >
      {busy ? (
        <Spinner />
      ) : (
        <>
          <span style={t(16, { w: 700, c: '#fff' })}>Pay {inr(b.total)}</span>
          <ArrowRight size={18} color="#fff" />
        </>
      )}
    </button>
  );

  if (desktop) {
    return (
      <Shell>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
          <BackSquare onClick={back} />
          <h1 style={{ margin: 0, flex: 1, ...d(30) }}>Review & pay</h1>
          {holdPill}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 36, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 18, minWidth: 0 }}>
            {summaryCard}
            {coupon}
          </div>
          <aside style={{ position: 'sticky', top: 96 }}>
            <CardBox padding={8} radius={24} shadowCss={shadow.big}>
              {prices}
              <div style={{ padding: '4px 8px 12px' }}>
                {payBtn}
                {reassure}
              </div>
            </CardBox>
          </aside>
        </div>
      </Shell>
    );
  }

  return (
    <div className="page" style={{ minHeight: '100dvh', paddingBottom: 110 }}>
      <div style={{ padding: 'calc(var(--safe-top) + 8px) 20px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <BackSquare onClick={back} />
        <div style={{ flex: 1, ...d(20) }}>Review & pay</div>
        {holdPill}
      </div>
      <div style={{ padding: '4px 20px 24px', display: 'grid', gap: 16 }}>
        {summaryCard}
        {coupon}
        {prices}
        <div>{reassure}</div>
      </div>
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 40,
          padding: '14px 20px calc(14px + var(--safe-bottom))',
          background: '#fff',
          borderTop: `1px solid ${C.line}`,
        }}
      >
        {payBtn}
      </div>
    </div>
  );
}
