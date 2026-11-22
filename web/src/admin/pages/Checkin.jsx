/** Check-in desk: type or scan a booking code (or the QR text, or today's 4-digit PIN) and check the group in. */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleCheck, ScanLine } from 'lucide-react';
import { errText } from '../../lib/api';
import { inr } from '../../lib/format';
import { C, d, t } from '../../theme';
import { useOverlay } from '../../ui/overlay';
import { Spinner, WarnBox } from '../../ui/kit';
import { adminRepo } from '../api';
import { Badge, Btn, PageHeader, Panel } from '../ui';

export default function Checkin() {
  const nav = useNavigate();
  const { toast } = useOverlay();
  const [code, setCode] = useState('');
  const [b, setB] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const find = async () => {
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    setB(null);
    try {
      setB(await adminRepo.checkin(code.trim()));
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };
  const checkIn = async () => {
    if (!b) return;
    try {
      toast((await adminRepo.bookingAction(b.id, 'checkin')).message);
      setB(await adminRepo.checkin(b.code));
    } catch (e) {
      toast(errText(e));
    }
  };

  return (
    <div style={{ maxWidth: 680 }}>
      <PageHeader eyebrow="Front desk" title="Check-in" sub="Enter the booking code from the player's ticket, the QR text from a scanner, or today's 4-digit PIN." />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          find();
        }}
        style={{ display: 'flex', gap: 10 }}
      >
        <div
          style={{ flex: 1, height: 56, padding: '0 16px', borderRadius: 16, background: '#fff', border: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 12 }}
        >
          <ScanLine size={20} color={C.muted} />
          <input
            autoFocus
            value={code}
            placeholder="TRF-21N26-4821 or 4-digit PIN"
            onChange={(e) => setCode(e.target.value)}
            style={{ ...t(17, { w: 600 }), letterSpacing: 0.5 }}
          />
        </div>
        <button type="submit" className="tap" style={{ height: 56, padding: '0 22px', borderRadius: 16, background: C.brand, ...t(15, { w: 700, c: '#fff' }) }}>
          {busy ? <Spinner size={20} /> : 'Find'}
        </button>
      </form>
      {error && <WarnBox style={{ marginTop: 14 }}>{error}</WarnBox>}
      {b && (
        <Panel style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <div style={d(24)}>{b.player}</div>
              <div style={{ marginTop: 4, ...t(14, { c: C.muted }) }}>
                {b.code} · {b.venue} · {b.court} · {b.sport}
              </div>
            </div>
            {b.checked_in ? <Badge value="success" label="Already checked in" /> : <Badge value={b.status} label={b.status_label} />}
          </div>
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
            {[
              ['Date', b.date_label + (b.is_today ? ' (today)' : '')],
              ['Time', b.time],
              ['Players', `Up to ${b.players}`],
              ['Paid', inr(b.total)],
            ].map(([k, v]) => (
              <div key={k} style={{ padding: 12, borderRadius: 14, background: C.ground }}>
                <div style={t(12, { c: C.muted })}>{k}</div>
                <div style={{ marginTop: 2, ...t(15, { w: 700 }) }}>{v}</div>
              </div>
            ))}
          </div>
          {!b.is_today && b.status === 'confirmed' && <WarnBox style={{ marginTop: 14 }}>This booking is not for today — check the date before letting the group in.</WarnBox>}
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            {b.status === 'confirmed' && !b.checked_in && (
              <Btn kind="primary" icon={CircleCheck} onClick={checkIn}>
                Check in now
              </Btn>
            )}
            <Btn onClick={() => nav(`/admin/bookings/${b.id}`)}>Open booking</Btn>
          </div>
        </Panel>
      )}
    </div>
  );
}
