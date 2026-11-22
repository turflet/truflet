/** 7 · Split Checkout & Escrow: itemised turf share + platform fee, UPI (YOUPI checkout when on) or wallet.
 *  Also the host's "pay the balance". Resolves to the updated lobby once paid, or undefined. */
import { useEffect, useState } from 'react';
import { ChevronsRight, ShieldCheck, Wallet } from 'lucide-react';
import { useSession } from '../../app/session';
import { errText } from '../../lib/api';
import { lobbyRepo } from '../../lib/repos';
import { inr, mmss } from '../../lib/format';
import { C, d, t } from '../../theme';
import { useNow } from '../../ui/hooks';
import { useOverlay } from '../../ui/overlay';
import { CardBox, Choice, ErrorRetry, Pill, PriceRow, PrimaryButton, RadioDot, Spinner } from '../../ui/kit';
import { reserveTab, showUpiCheckout } from '../booking/upiCheckout';

export const showSplitCheckout = (sheet, lobbyId) => sheet((close) => <CheckoutSheet lobbyId={lobbyId} close={close} />);
export const showPayBalance = (sheet, lobbyId, amount) => sheet((close) => <CheckoutSheet lobbyId={lobbyId} balance={amount} close={close} />);

function CheckoutSheet({ lobbyId, balance, close }) {
  const app = useSession();
  const { toast, sheet } = useOverlay();
  const now = useNow();
  const isBalance = balance != null;
  const [quote, setQuote] = useState(isBalance ? { total: balance } : null);
  const [error, setError] = useState(null);
  const [method, setMethod] = useState('upi');
  const [upi, setUpi] = useState('');
  const [busy, setBusy] = useState(false);
  const gatewayUpi = app.config.upi_checkout === true;

  const load = () => {
    setError(null);
    lobbyRepo.checkout(lobbyId).then(setQuote, (e) => setError(errText(e)));
  };
  useEffect(() => {
    if (!isBalance) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pay = async () => {
    const tab = method === 'upi' && gatewayUpi ? reserveTab() : null;
    setBusy(true);
    try {
      const r = isBalance ? await lobbyRepo.action(lobbyId, 'pay-balance', { method, upi_id: upi.trim() }) : await lobbyRepo.pay(lobbyId, method, upi.trim());
      let result = r;
      const payment = r.payment;
      if (payment && typeof payment === 'object' && payment.status === 'pending') {
        // UPI via the gateway checkout: wait until the server has the money
        const done = await showUpiCheckout(sheet, {
          payment,
          poll: () => lobbyRepo.paymentStatus(lobbyId),
          done: (s) => !!s.payment && s.payment.status === 'success',
          tab,
        });
        if (!done) return;
        result = done;
      } else tab?.close();
      app.refreshMe(); // wallet may have changed
      close(result);
    } catch (e) {
      tab?.close();
      toast(errText(e));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <ErrorRetry message={error} onRetry={load} />;
  if (!quote)
    return (
      <div style={{ height: 260, display: 'grid', placeItems: 'center' }}>
        <Spinner size={28} stroke={3} color={C.brand} />
      </div>
    );

  const wallet = app.user?.wallet_balance ?? 0;
  const until = quote.pay_by ? new Date(quote.pay_by).getTime() : null;
  const left = until == null ? null : Math.max(0, until - now);
  const option = (id, title, sub, I) => (
    <Choice
      selected={method === id}
      selBg="#fff"
      selWidth={2}
      height={60}
      padding="0 14px"
      onClick={() => setMethod(id)}
      style={{ width: '100%', justifyContent: 'flex-start', gap: 12, textAlign: 'left', marginBottom: 8 }}
    >
      <I size={20} color={C.green700} />
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', ...t(14, { w: 600 }) }}>{title}</span>
        <span style={{ display: 'block', ...t(12, { c: C.muted }) }}>{sub}</span>
      </span>
      <RadioDot on={method === id} />
    </Choice>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: 40 }}>
        <div style={{ flex: 1, ...d(22) }}>{isBalance ? 'Pay the balance' : 'Split checkout'}</div>
        {left != null && (
          <Pill bg={left < 300000 ? C.redSoft : C.amberSoft} fg={left < 300000 ? C.redInk : C.amber}>
            {mmss(left)} left
          </Pill>
        )}
      </div>
      <CardBox shadowCss={null} border={`1px solid ${C.line}`} style={{ marginTop: 14, display: 'grid', gap: 8 }}>
        {isBalance ? (
          <PriceRow k="Missing from the pool" v={inr(quote.total)} />
        ) : (
          <>
            <PriceRow k="Your turf share" v={inr(quote.turf_share)} />
            {(quote.guests ?? 0) > 0 && <PriceRow k={`Your guests (${quote.guests} × ${inr(quote.turf_share)})`} v={inr(quote.guest_shares)} />}
            <PriceRow k="Platform fee" v={inr(quote.platform_fee)} />
          </>
        )}
        <div style={{ height: 4 }} />
        <PriceRow k="Total" v={inr(quote.total)} bold top size={16} />
      </CardBox>
      <div style={{ marginTop: 12, padding: 12, borderRadius: 14, background: C.limeSoft, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <ShieldCheck size={18} color={C.green700} style={{ flex: 'none' }} />
        <span style={t(12, { c: C.green900, h: 1.5 })}>
          {isBalance ? 'The turf is booked as soon as you pay. Players who still pay their share recover your money through escrow.' : (quote.escrow_note ?? '')}
        </span>
      </div>
      <div style={{ height: 14 }} />
      {option('upi', 'UPI', gatewayUpi ? 'Pay on a secure page with any UPI app' : 'One tap with any UPI app', ChevronsRight)}
      {method === 'upi' && !gatewayUpi && (
        <div
          style={{ height: 46, marginBottom: 8, padding: '0 14px', borderRadius: 12, background: C.ground, border: `1px solid ${C.line}`, display: 'flex', alignItems: 'center' }}
        >
          <input type="email" value={upi} placeholder="UPI ID (optional), e.g. yourname@bank" onChange={(e) => setUpi(e.target.value)} style={t(14)} />
        </div>
      )}
      {option('wallet', 'Turflet balance', `Balance ${inr(wallet)}`, Wallet)}
      <div style={{ height: 8 }} />
      <PrimaryButton loading={busy} onClick={pay}>
        Pay {inr(quote.total)}
      </PrimaryButton>
    </div>
  );
}
