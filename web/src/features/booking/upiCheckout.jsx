/** YOUPI UPI checkout on the web. The checkout page opens in a new tab (its UPI app buttons hand off to GPay,
 *  PhonePe, Paytm … on phones); this sheet polls the backend until it confirms the money.
 *  The booking/share is confirmed by the server (signed webhook or its own status check), never by the browser. */
import { useEffect, useRef, useState } from 'react';
import { CircleAlert } from 'lucide-react';

import { inr } from '../../lib/format';
import { C, d, t } from '../../theme';
import { GhostButton, PrimaryButton, Spinner } from '../../ui/kit';

const FAILED = {
  failed: 'The payment did not go through. No money was taken for this booking.',
  expired: 'The payment window ran out. If money left your account it will be matched or refunded.',
  cancelled: 'The payment was cancelled.',
};

/** Opens a blank tab synchronously inside the click handler, so the browser doesn't block it as a pop-up.
 *  Point it at the checkout once the server answers, or close it if no checkout was needed. */
export function reserveTab() {
  try {
    const w = window.open('', '_blank');
    if (w) w.document.write('<title>Opening payment…</title><p style="font-family:system-ui;padding:24px;color:#0C2419">Opening the secure payment page…</p>');
    return w;
  } catch {
    return null;
  }
}

export function showUpiCheckout(sheet, o) {
  const done = o.done ?? ((r) => r.status === 'confirmed');
  return sheet((close) => <UpiCheckout payment={o.payment} poll={o.poll} done={done} tab={o.tab ?? null} close={close} />, { dismissible: false, width: 460 });
}

function UpiCheckout({ payment, poll, done, tab, close }) {
  const [error, setError] = useState(null);
  const checking = useRef(false);
  const started = useRef(Date.now());
  const tabRef = useRef(tab);

  const open = () => {
    const url = String(payment.checkout_url ?? '');
    if (!url) return;
    if (tabRef.current && !tabRef.current.closed) {
      tabRef.current.location.href = url;
      tabRef.current.focus();
    } else tabRef.current = window.open(url, '_blank');
    if (!tabRef.current) window.location.assign(url); // pop-ups blocked: go there in this tab
  };

  useEffect(() => {
    open();
    const check = async () => {
      if (checking.current) return;
      checking.current = true;
      try {
        const r = await poll();
        const status = r.payment && typeof r.payment === 'object' ? r.payment.status : null;
        if (done(r)) {
          clearInterval(id);
          try {
            tabRef.current?.close();
          } catch {
            /* not ours to close */
          }
          close(r);
        } else if (status && FAILED[status]) {
          clearInterval(id);
          setError(FAILED[status]);
        } else if (Date.now() - started.current > 15 * 60 * 1000) {
          clearInterval(id);
          setError("We haven't heard from your bank yet. If you paid, the booking will confirm on its own: check My Bookings in a few minutes.");
        }
      } catch {
        // network blip: the next tick tries again
      } finally {
        checking.current = false;
      }
    };
    const id = window.setInterval(check, 3000);
    const onVis = () => document.visibilityState === 'visible' && check(); // back from the UPI app / tab
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const failed = error != null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', textAlign: 'center', paddingTop: 8 }}>
      <div style={{ display: 'grid', placeItems: 'center', height: 40 }}>
        {failed ? <CircleAlert size={40} color={C.muted} /> : <Spinner size={36} stroke={3} color={C.brand} />}
      </div>
      <div style={{ marginTop: 16, ...d(20) }}>{failed ? 'Payment not completed' : 'Complete the payment'}</div>
      <div style={{ marginTop: 8, ...t(14, { c: C.muted, h: 1.4 }) }}>
        {failed ? error : `Pay ${inr(payment.amount)} on the payment page that opened. This screen updates by itself once your bank confirms — usually within a minute.`}
      </div>
      <div style={{ height: 20 }} />
      {!failed && (
        <>
          <PrimaryButton height={52} onClick={open}>
            Open payment page
          </PrimaryButton>
          <div style={{ height: 10 }} />
        </>
      )}
      <GhostButton onClick={() => close(undefined)}>{failed ? 'Close' : "I'll pay later"}</GhostButton>
    </div>
  );
}
