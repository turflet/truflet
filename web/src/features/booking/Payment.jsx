/** 7 · Review & pay: hold countdown, coupon, price details, pay (the gateway checkout picks the method). URL: /payment/:bookingId
 *  Phone = dark band + green summary panel + sticky pay bar (redesign). Desktop = details on the left, sticky price + pay card on the right. */
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Check, Clock, ShieldCheck, Tag } from '../../ui/icons';
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
import { BandButton, GoButton, Panel, Rule, StickyBar } from '../../ui/brand';

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

  // Phone (redesign): dark band with the hold timer, booking summary in the green panel, coupon + bill, sticky pay bar.
  return (
    <div className="page" style={{ minHeight: '100dvh', paddingBottom: 'calc(110px + var(--safe-bottom))' }}>
      <header style={{ background: C.brandDark, paddingTop: 'var(--safe-top)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 16px 16px' }}>
          <BandButton onClick={back} />
          <span style={{ flex: 1, ...d(22, { c: '#fff', ls: -0.6 }) }}>Review &amp; pay</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 999, background: left === 0 ? C.coralSoft : C.sun, ...t(12.5, { w: 800, h: 1.2 }) }}>
            <Clock size={15} color={C.ink} strokeWidth={2.2} />
            {left === 0 ? 'Hold expired' : `Held ${mmss(left).padStart(5, '0')}`}
          </span>
        </div>
        <Panel padding="18px 16px 20px" gap={14}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ width: 64, height: 64, borderRadius: 16, overflow: 'hidden', flex: 'none' }}>
              <Img url={venue.image} />
            </span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="clamp1" style={t(17, { w: 800, c: '#fff' })}>
                {venue.name}
              </span>
              <span className="clamp1" style={t(12.5, { w: 600, c: C.panelInk })}>
                {venue.area}, {venue.city}
              </span>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 14, borderRadius: 18, background: C.green900 }}>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={t(15, { w: 800, c: '#fff' })}>
                {court.name} · {sport.name}
              </span>
              <span style={t(13, { w: 600, c: C.panelInk })}>
                {b.date_label} · {b.time_short} · {b.duration} hr{b.duration === 1 ? '' : 's'}
              </span>
              <button onClick={back} style={{ alignSelf: 'flex-start', marginTop: 2, ...t(12.5, { w: 800, c: C.sun }) }}>
                Change slot
              </button>
            </span>
            <span style={t(16, { w: 800, c: '#fff' })}>{inr(b.slot_amount)}</span>
          </div>
        </Panel>
      </header>

      <main style={{ display: 'flex', flexDirection: 'column', gap: 22, padding: '22px 16px' }}>
        {applied ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 18, border: `1.5px dashed ${C.green700}`, background: '#F4F8F5' }}>
            <span style={{ width: 40, height: 40, borderRadius: '50%', background: C.green700, display: 'grid', placeItems: 'center', flex: 'none' }}>
              <Check size={20} color="#fff" strokeWidth={2.4} />
            </span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span style={t(14, { w: 800 })}>
                {b.coupon} applied · {inr(b.discount)} saved
              </span>
              <span style={t(12, { w: 600, c: C.muted })}>Taken off your total below</span>
            </span>
            <button disabled={couponBusy} onClick={toggleCoupon} style={{ padding: '8px 0', ...t(13, { w: 800, c: '#B4401F' }) }}>
              {couponBusy ? <Spinner size={16} color="#B4401F" /> : 'Remove'}
            </button>
          </div>
        ) : (
          <div style={{ padding: '12px 12px 12px 16px', borderRadius: 18, border: `1.5px dashed ${C.chipLine}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Tag size={20} color={C.green700} />
              <input value={code} aria-label="Coupon code" placeholder="Have a coupon code?" onChange={(e) => setCode(e.target.value.toUpperCase())} style={t(14, { w: 700 })} />
              <button
                className="tap"
                disabled={couponBusy || !code.trim()}
                onClick={toggleCoupon}
                style={{ height: 40, padding: '0 16px', borderRadius: 12, background: code.trim() ? C.brand : C.chip, flex: 'none', ...t(13, { w: 800, c: code.trim() ? '#fff' : C.muted }) }}
              >
                {couponBusy ? <Spinner size={16} /> : 'Apply'}
              </button>
            </div>
            {couponError && <div style={{ marginTop: 8, ...t(12, { c: C.warnInk }) }}>{couponError}</div>}
          </div>
        )}

        <section id="bill" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Rule>Bill details</Rule>
          <div style={{ borderRadius: 20, border: `1px solid ${C.hair}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <BillRow k={`Court fee (${b.duration} × ${inr(b.rate)}${peak ? ' peak' : ''})`} v={inr(b.slot_amount)} />
            <BillRow k="Convenience fee" v={inr(b.convenience_fee)} />
            <BillRow k={`GST on fee (${Math.round(app.config.gst_percent ?? 18)}%)`} v={inr(b.gst)} />
            {applied && <BillRow k={`Coupon ${b.coupon}`} v={`−${inr(b.discount)}`} green />}
            <div style={{ borderTop: `1px solid ${C.hair}`, margin: '4px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', ...t(16, { w: 800 }) }}>
              <span>To pay</span>
              <span>{inr(b.total)}</span>
            </div>
          </div>
        </section>

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '0 4px', ...t(12.5, { c: C.muted, h: 1.5 }) }}>
          <ShieldCheck size={18} color={C.green700} style={{ flex: 'none', marginTop: 1 }} />
          <span>Secure UPI payment. Not ready? Pay later from My bookings before the hold ends. Refunds follow the venue's cancellation policy.</span>
        </div>
      </main>

      <StickyBar>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 'none' }}>
          <span style={d(19, { ls: -0.4 })}>{inr(b.total)}</span>
          <a href="#bill" style={t(12, { w: 800, c: C.green700 })}>
            View bill
          </a>
        </div>
        <GoButton loading={busy} onClick={pay}>
          Pay {inr(b.total)}
        </GoButton>
      </StickyBar>
    </div>
  );
}

const BillRow = ({ k, v, green }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, ...t(14, { w: green ? 800 : 600, c: green ? C.green700 : C.ink }) }}>
    <span>{k}</span>
    <span>{v}</span>
  </div>
);
