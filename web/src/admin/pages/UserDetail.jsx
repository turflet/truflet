/** Player page (admins): profile, spend, sports, bookings, and wallet adjustments. */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil } from 'lucide-react';
import { asList, errText } from '../../lib/api';
import { initials, inr } from '../../lib/format';
import { C, t } from '../../theme';
import { useData, useIsDesktop } from '../../ui/hooks';
import { useOverlay } from '../../ui/overlay';
import { Avatar, ErrorRetry, Sk } from '../../ui/kit';
import { adminRepo } from '../api';
import { Badge, Btn, PageHeader, Panel, StatTile, inputStyle } from '../ui';
import { BookingRows } from './Home';

export default function UserDetail() {
  const id = Number(useParams().id);
  const nav = useNavigate();
  const desktop = useIsDesktop();
  const { toast } = useOverlay();
  const { data: u, error, retry, setData } = useData(() => adminRepo.user(id), [id]);
  const [amount, setAmount] = useState('');

  if (error) return <ErrorRetry message={error} onRetry={retry} />;
  if (!u)
    return (
      <div style={{ display: 'grid', gap: 14 }}>
        <Sk h={60} w={320} />
        <Sk h={220} r={20} />
      </div>
    );

  const adjust = async (sign) => {
    const n = Math.round(Number(amount));
    if (!n || n < 0) return toast('Enter an amount in rupees.');
    try {
      const r = await adminRepo.wallet(id, sign * n);
      setData({ ...u, wallet_balance: r.balance });
      setAmount('');
      toast(`Wallet is now ${inr(r.balance)}.`);
    } catch (e) {
      toast(errText(e));
    }
  };

  return (
    <>
      <button onClick={() => nav(-1)} style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, ...t(13, { w: 600, c: C.brand }) }}>
        <ArrowLeft size={16} color={C.brand} /> Back
      </button>
      <PageHeader
        eyebrow="Player"
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 14 }}>
            <Avatar initials={initials(u.name || u.email)} size={48} index={u.id} />
            {u.name || u.email}
          </span>
        }
        sub={`${u.email}${u.phone ? ` · ${u.phone}` : ''}${u.home_area ? ` · ${u.home_area}` : ''}`}
        actions={
          <Btn icon={Pencil} onClick={() => nav(`/admin/r/users/${id}/edit?next=/admin/users/${id}`)}>
            Edit player
          </Btn>
        }
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
        <StatTile label="Wallet" value={inr(u.wallet_balance)} accent={C.brand} />
        <StatTile label="Total spent" value={inr(u.spent)} />
        <StatTile label="Bookings" value={asList(u.bookings).length} sub="Latest 20 shown" />
        <StatTile label="Joined" value={u.date_joined ? new Date(u.date_joined).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} />
      </div>
      <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: desktop ? '1.5fr 1fr' : '1fr', gap: 18, alignItems: 'start' }}>
        <Panel title="Bookings" pad={0}>
          <BookingRows rows={asList(u.bookings)} empty="No bookings yet." />
        </Panel>
        <div style={{ display: 'grid', gap: 18 }}>
          <Panel title="Adjust wallet">
            <div style={t(13, { c: C.muted, h: 1.5 })}>Credit goodwill or correct a balance. The player gets a notification.</div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <input type="number" min={0} value={amount} placeholder="₹ amount" onChange={(e) => setAmount(e.target.value)} style={inputStyle} />
              <Btn kind="soft" onClick={() => adjust(1)}>
                Add
              </Btn>
              <Btn kind="danger" onClick={() => adjust(-1)}>
                Remove
              </Btn>
            </div>
          </Panel>
          <Panel title="Account">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 10, alignItems: 'center', ...t(14) }}>
              <span>Active</span>
              <Badge value={u.is_active ? 'active' : 'none'} label={u.is_active ? 'Yes' : 'No'} />
              <span>Turf owner</span>
              <Badge value={u.is_venue_owner ? 'active' : 'none'} label={u.is_venue_owner ? 'Yes' : 'No'} />
              <span>Admin</span>
              <Badge value={u.is_staff ? 'active' : 'none'} label={u.is_staff ? 'Yes' : 'No'} />
              {u.referral_code && (
                <>
                  <span>Referral code</span>
                  <span style={t(13, { w: 700 })}>{u.referral_code}</span>
                </>
              )}
            </div>
          </Panel>
          {asList(u.sports).length > 0 && (
            <Panel title="Sports">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {asList(u.sports).map((s) => (
                  <Badge key={s.name} value="open" label={`${s.name} · ${s.level}`} />
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
