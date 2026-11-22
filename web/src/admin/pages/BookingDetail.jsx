/** Booking page: player, slot, money, check-in PIN and the desk actions (check in, complete, cancel, notes). */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCheck, CircleCheck, Mail, Phone, XCircle } from 'lucide-react';
import { errText } from '../../lib/api';
import { inr } from '../../lib/format';
import { C, d, t } from '../../theme';
import { useData, useIsDesktop } from '../../ui/hooks';
import { useOverlay } from '../../ui/overlay';
import { ErrorRetry, PriceRow, PrimaryButton, Sk } from '../../ui/kit';
import { adminRepo } from '../api';
import { Badge, Btn, PageHeader, Panel, inputStyle } from '../ui';

const when = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—');

export default function BookingDetail() {
  const id = Number(useParams().id);
  const nav = useNavigate();
  const desktop = useIsDesktop();
  const { toast, sheet } = useOverlay();
  const { data: b, error, retry, reload } = useData(() => adminRepo.booking(id), [id]);
  const [notes, setNotes] = useState(null);

  if (error) return <ErrorRetry message={error} onRetry={retry} />;
  if (!b)
    return (
      <div style={{ display: 'grid', gap: 14 }}>
        <Sk h={40} w={300} />
        <Sk h={260} r={20} />
      </div>
    );

  const act = async (action, data = {}) => {
    try {
      const r = await adminRepo.bookingAction(id, action, data);
      toast(r.message);
      reload();
    } catch (e) {
      toast(errText(e));
    }
  };
  const cancel = async () => {
    const reason = await sheet((close) => <CancelSheet quote={b.quote} close={close} />);
    if (reason != null) act('cancel', { reason });
  };
  const row = (k, v) => (
    <>
      <span style={t(13, { c: C.muted })}>{k}</span>
      <span style={t(14, { w: 600 })}>{v}</span>
    </>
  );

  return (
    <>
      <button onClick={() => nav(-1)} style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, ...t(13, { w: 600, c: C.brand }) }}>
        <ArrowLeft size={16} color={C.brand} /> Back
      </button>
      <PageHeader
        eyebrow="Booking"
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {b.code} <Badge value={b.checked_in ? 'success' : b.status} label={b.checked_in ? 'Checked in' : b.status_label} />
          </span>
        }
        sub={`${b.venue} · ${b.court} · ${b.sport}`}
        actions={
          <>
            {b.status === 'confirmed' && !b.checked_in && (
              <Btn kind="primary" icon={CircleCheck} onClick={() => act('checkin')}>
                Check in
              </Btn>
            )}
            {b.status === 'confirmed' && (
              <Btn icon={CheckCheck} onClick={() => act('complete')}>
                Mark completed
              </Btn>
            )}
            {b.status === 'confirmed' && (
              <Btn kind="danger" icon={XCircle} onClick={cancel}>
                Cancel & refund
              </Btn>
            )}
          </>
        }
      />
      <div style={{ display: 'grid', gridTemplateColumns: desktop ? '1.3fr 1fr' : '1fr', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <Panel title="Slot">
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: 12 }}>
              {row('Date', b.date_label)}
              {row('Time', `${b.time} · ${b.duration} hr${b.duration === 1 ? '' : 's'}`)}
              {row('Court', `${b.court} · ${b.sport}`)}
              {row('Players', `Up to ${b.players}`)}
              {row('Check-in PIN', <span style={{ letterSpacing: 4, ...d(18, { c: C.brand }) }}>{b.pin}</span>)}
              {row('Checked in', when(b.checked_in_at))}
              {row('Booked', when(b.created_at))}
            </div>
          </Panel>
          <Panel
            title="Internal notes"
            actions={
              notes != null && (
                <Btn small kind="primary" onClick={() => (act('notes', { notes }), setNotes(null))}>
                  Save
                </Btn>
              )
            }
          >
            <textarea
              rows={4}
              value={notes ?? b.notes ?? ''}
              placeholder="Only your team sees this."
              onChange={(e) => setNotes(e.target.value)}
              style={{ ...inputStyle, padding: '12px 14px', resize: 'vertical' }}
            />
          </Panel>
        </div>
        <div style={{ display: 'grid', gap: 18 }}>
          <Panel title="Player">
            <div style={t(16, { w: 700 })}>{b.user?.name || '—'}</div>
            <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
              <a href={`mailto:${b.user?.email}`} style={{ display: 'flex', alignItems: 'center', gap: 8, ...t(14, { c: C.mutedInk }) }}>
                <Mail size={15} /> {b.user?.email}
              </a>
              {b.user?.phone && (
                <a href={`tel:${b.user.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 8, ...t(14, { c: C.mutedInk }) }}>
                  <Phone size={15} /> {b.user.phone}
                </a>
              )}
            </div>
          </Panel>
          <Panel title="Payment">
            <div style={{ display: 'grid', gap: 10 }}>
              <PriceRow k="Slot charges" v={inr(b.slot_amount)} />
              <PriceRow k="Convenience fee" v={inr(b.convenience_fee)} />
              <PriceRow k="GST" v={inr(b.gst)} />
              {b.discount > 0 && <PriceRow k={`Coupon ${b.coupon ?? ''}`} v={`−${inr(b.discount)}`} color={C.brand} />}
              <PriceRow k="Total" v={inr(b.total)} bold top />
            </div>
            <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 8, ...t(13) }}>
              <span style={{ color: C.muted }}>Status</span>
              <span>
                <Badge value={b.payment_status} />
              </span>
              <span style={{ color: C.muted }}>Method</span>
              <span>{b.payment_method || '—'}</span>
              <span style={{ color: C.muted }}>Transaction</span>
              <span style={{ wordBreak: 'break-all' }}>{b.transaction_id || '—'}</span>
              <span style={{ color: C.muted }}>Paid</span>
              <span>{when(b.paid_at)}</span>
              {b.status === 'cancelled' && (
                <>
                  <span style={{ color: C.muted }}>Cancelled</span>
                  <span>
                    {when(b.cancelled_at)} · {b.cancellation_code} · refund {inr(b.refund_amount)}
                    {b.cancel_reason ? ` · ${b.cancel_reason}` : ''}
                  </span>
                </>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function CancelSheet({ quote, close }) {
  const [reason, setReason] = useState('');
  return (
    <div>
      <div style={d(22)}>Cancel this booking?</div>
      <div style={{ margin: '8px 0 14px', ...t(14, { c: C.muted, h: 1.5 }) }}>
        A venue cancellation refunds the player in full{quote?.amount_paid ? ` (${inr(quote.amount_paid)})` : ''} and frees the slot.
      </div>
      <input value={reason} placeholder="Reason (shown to the player), e.g. Rain" onChange={(e) => setReason(e.target.value)} style={inputStyle} />
      <div style={{ height: 14 }} />
      <PrimaryButton color={C.red} shadowOn={false} height={50} onClick={() => close(reason.trim() || 'Cancelled by venue')}>
        Cancel with full refund
      </PrimaryButton>
    </div>
  );
}
