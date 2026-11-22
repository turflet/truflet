/** 19 · My profile. Phone = the Flutter screen. Desktop = profile card on the left, sections on the right. */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck, Check, ChevronRight, CircleHelp, CreditCard, Heart, LayoutDashboard, Mail, MapPin, Pencil, Phone, Plus, Shield, User, UserPlus } from 'lucide-react';
import { isStaffOrOwner, useSession } from '../../app/session';
import { routes } from '../../app/nav';
import { Shell } from '../../app/Shell';
import { SignInGate } from '../auth/SignInGate';
import { ProfileForm } from '../auth/ProfileForm';
import { asList, asMap, errText } from '../../lib/api';
import { share } from '../../lib/actions';
import { userRepo } from '../../lib/repos';
import { inr } from '../../lib/format';
import { C, d, shadow, t } from '../../theme';
import { useIsDesktop } from '../../ui/hooks';
import { useOverlay } from '../../ui/overlay';
import { CardBox, GhostButton, H2, Img, Pill, Sk, Toggle } from '../../ui/kit';

const LEVELS = [
  ['Beginner', 0.3, C.teal, C.tealSoft],
  ['Intermediate', 0.6, C.amber, C.amberSoft],
  ['Advanced', 0.9, C.green700, C.mint],
];

export default function ProfilePage() {
  return (
    <Shell nav>
      <SignInGate>
        <Profile />
      </SignInGate>
    </Shell>
  );
}

function Profile() {
  const app = useSession();
  const nav = useNavigate();
  const desktop = useIsDesktop();
  const { toast, sheet } = useOverlay();
  const [editing, setEditing] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  useEffect(() => {
    app.refreshMe().finally(() => setRefreshing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const u = app.user;
  if (!u || (refreshing && !u.email))
    return (
      <div style={{ padding: 20, display: 'grid', gap: 12 }}>
        <Sk h={160} r={24} />
        <Sk h={220} r={20} />
      </div>
    );

  const stats = asMap(u.stats);
  const sports = asList(u.sports);
  const area = u.home_area == null ? app.cityName || app.areaName : u.home_area.city;
  const reward = app.config.referral_reward ?? 50;

  const editDetails = () =>
    sheet((close) => (
      <div>
        <div style={{ ...d(22), marginBottom: 16 }}>Edit details</div>
        <ProfileForm
          submitLabel="Save details"
          showHandle
          onSaved={() => {
            close();
            toast('Profile updated');
          }}
        />
      </div>
    ));

  const setSports = async (next) => {
    try {
      app.setUser(await userRepo.setSports(next.map((x) => ({ sport_id: x.sport_id, level: x.level }))));
    } catch (e) {
      toast(errText(e));
    }
  };

  const addSport = async () => {
    const have = new Set(sports.map((x) => x.sport_id));
    const options = app.sports.filter((x) => !have.has(x.id));
    if (!options.length) return;
    const picked = await sheet((close) => (
      <div>
        <div style={{ ...d(22), marginBottom: 14 }}>Add a sport</div>
        {options.map((o) => (
          <button
            key={o.id}
            className="tap"
            onClick={() => close(o)}
            style={{ width: '100%', padding: '10px 0', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left' }}
          >
            <span style={{ width: 40, height: 40 }}>
              <Img url={o.image} radius={12} />
            </span>
            <span style={t(15, { w: 600 })}>{o.name}</span>
          </button>
        ))}
      </div>
    ));
    if (picked) setSports([...sports, { sport_id: picked.id, level: 0 }]);
  };

  const invite = async () => {
    const r = await share(`Join me on Turflet! Use my code ${u.referral_code} and we both get ₹${reward} off.`);
    if (r === 'copied') toast('Invite copied');
  };

  const card = (
    <div style={{ padding: 16, borderRadius: 24, background: '#fff', boxShadow: shadow.big }}>
      <button onClick={editDetails} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left' }}>
        <span style={{ position: 'relative', width: 76, height: 76, flex: 'none' }}>
          <span style={{ width: 72, height: 72, borderRadius: 24, background: C.lime, display: 'grid', placeItems: 'center', ...d(26) }}>{u.initials ?? 'ME'}</span>
          <span
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              width: 26,
              height: 26,
              borderRadius: 99,
              background: C.brand,
              border: '3px solid #fff',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            {editing ? <Pencil size={12} color="#fff" /> : <Check size={12} color="#fff" />}
          </span>
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', ...d(20) }}>{String(u.name ?? '') || 'Add your name'}</span>
          <span style={{ display: 'block', marginTop: 3, ...t(13, { c: C.muted }) }}>
            {u.handle ? `@${u.handle} · ` : ''}
            {area}
          </span>
          <span className="clamp1" style={{ display: 'block', marginTop: 3, ...t(12, { c: C.muted }) }}>
            {u.email} · verified
          </span>
        </span>
      </button>
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.divider}`, display: 'grid', gridTemplateColumns: '1fr 1fr', textAlign: 'center' }}>
        <div>
          <div style={d(20)}>{stats.games ?? 0}</div>
          <div style={t(11, { c: C.muted })}>Games</div>
        </div>
        <div>
          <div style={d(20)}>{stats.hours ?? 0}h</div>
          <div style={t(11, { c: C.muted })}>Played</div>
        </div>
      </div>
    </div>
  );

  const details = (
    <CardBox padding="14px 16px 6px">
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <H2 size={16} style={{ flex: 1 }}>
          Personal details
        </H2>
        <button onClick={editDetails} style={{ padding: '6px 0', ...t(13, { w: 700, c: C.brand }) }}>
          Edit
        </button>
      </div>
      <div style={{ height: 6 }} />
      <Detail icon={User} label="Name" value={u.name} placeholder="Add your name" onClick={editDetails} />
      <Detail icon={Mail} label="Email" value={u.email} verified />
      <Detail icon={Phone} label="Mobile" value={u.phone} placeholder="Add mobile number" onClick={editDetails} />
      <Detail icon={MapPin} label="Address" value={u.address} placeholder="Add address (optional)" onClick={editDetails} last />
    </CardBox>
  );

  const mySports = (
    <CardBox>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <H2 size={16} style={{ flex: 1 }}>
          My sports
        </H2>
        <span style={t(12, { c: C.muted })}>{editing ? 'Tap Change to set level' : 'Your sports & levels'}</span>
      </div>
      <div style={{ height: 12 }} />
      {sports.map((sp, i) => {
        const lv = LEVELS[Math.min(2, Math.max(0, sp.level ?? 0))];
        return (
          <div key={sp.sport_id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{ width: 40, height: 40, flex: 'none' }}>
              <Img url={sp.image} radius={12} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ flex: 1, ...t(14, { w: 700 }) }}>{sp.name}</span>
                <Pill bg={lv[3]} fg={lv[2]} padding="2px 8px">
                  {lv[0]}
                </Pill>
              </div>
              <div style={{ marginTop: 4, height: 6, borderRadius: 999, background: C.divider, overflow: 'hidden' }}>
                <div style={{ width: `${lv[1] * 100}%`, height: '100%', background: lv[2], transition: 'width 250ms' }} />
              </div>
            </div>
            {editing && (
              <GhostButton
                height={34}
                radius={10}
                fontSize={12}
                bg={C.ground}
                onClick={() => setSports(sports.map((x, k) => (k === i ? { ...x, level: ((x.level ?? 0) + 1) % 3 } : x)))}
              >
                Change
              </GhostButton>
            )}
          </div>
        );
      })}
      {sports.length === 0 && <div style={t(13, { c: C.muted })}>Add the sports you play.</div>}
      {editing && sports.length < app.sports.length && (
        <GhostButton icon={Plus} height={40} radius={12} fontSize={13} onClick={addSport} style={{ marginTop: 4 }}>
          Add sport
        </GhostButton>
      )}
    </CardBox>
  );

  const prefs = (
    <CardBox padding="6px 16px">
      <button
        role="switch"
        aria-checked={u.notifications_on === true}
        onClick={() => app.updateMe({ notifications_on: !(u.notifications_on === true) })}
        style={{ width: '100%', padding: '10px 0', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}
      >
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', ...t(14, { w: 600 }) }}>Booking & slot notifications</span>
          <span style={{ display: 'block', ...t(12, { c: C.muted }) }}>Reminders, confirmations and offers</span>
        </span>
        <Toggle value={u.notifications_on === true} />
      </button>
    </CardBox>
  );

  const menu = (
    <CardBox padding={0} style={{ overflow: 'hidden' }}>
      {isStaffOrOwner(u) && (
        <Menu
          icon={LayoutDashboard}
          fg="#fff"
          bg={C.ink}
          label="Venue dashboard"
          sub={u.is_staff ? 'Admin panel' : 'Manage your venues & bookings'}
          onClick={() => nav('/admin')}
        />
      )}
      <Menu icon={Heart} fg={C.rose} bg={C.roseSoft} label="Saved venues" sub={`${app.saved.size} venues`} onClick={() => nav('/saved')} />
      <Menu icon={CreditCard} fg={C.blue} bg={C.blueSoft} label="Payments & refunds" sub={`Wallet ${inr(u.wallet_balance)}`} onClick={() => nav(routes.bookings)} />
      <Menu icon={UserPlus} fg={C.purple} bg={C.purpleSoft} label="Invite friends" sub={`Code ${u.referral_code} · ₹${reward} each`} onClick={invite} />
      <Menu icon={CircleHelp} fg={C.green700} bg={C.mint} label="Help & support" sub="Chat, call, FAQs" onClick={() => nav('/help')} />
      <Menu icon={Shield} fg={C.teal} bg={C.tealSoft} label="Privacy & refund policy" sub="How we handle data & money" onClick={() => nav('/policy')} last />
    </CardBox>
  );

  const logout = (
    <>
      <GhostButton fg="#B91C1C" border="#FECACA" onClick={() => (app.logout(), nav(routes.home, { replace: true }))} style={{ width: '100%' }}>
        Log out
      </GhostButton>
      <div style={{ marginTop: 12, textAlign: 'center', ...t(12, { c: C.muted }) }}>Turflet v{app.config.app_version ?? '1.1'}</div>
    </>
  );

  const editBtn = (light) => (
    <GhostButton
      height={40}
      radius={12}
      fontSize={13}
      fg={light ? '#fff' : C.ink}
      bg={light ? 'rgba(255,255,255,.18)' : '#fff'}
      border={light ? 'transparent' : C.line}
      onClick={() => setEditing(!editing)}
    >
      {editing ? 'Done' : 'Edit profile'}
    </GhostButton>
  );

  if (desktop) {
    return (
      <div>
        <div style={{ position: 'relative', borderRadius: 32, background: C.brand, overflow: 'hidden', padding: '36px 40px 110px' }}>
          <span style={{ position: 'absolute', right: -60, top: -60, width: 260, height: 260, borderRadius: 999, background: 'rgba(255,220,207,.18)' }} />
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <h1 style={{ margin: 0, flex: 1, ...d(34, { c: '#fff' }) }}>My profile</h1>
            {editBtn(true)}
          </div>
        </div>
        <div style={{ marginTop: -80, padding: '0 28px', display: 'grid', gridTemplateColumns: '360px 1fr', gap: 28, alignItems: 'start' }}>
          <div style={{ position: 'sticky', top: 96, display: 'grid', gap: 14 }}>
            {card}
            {prefs}
            {logout}
          </div>
          <div style={{ position: 'relative', paddingTop: 80, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
            <div style={{ display: 'grid', gap: 18 }}>
              {details}
              {mySports}
            </div>
            {menu}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 'calc(var(--safe-top) + 126px)',
            background: C.brand,
            borderRadius: '0 0 32px 32px',
            overflow: 'hidden',
          }}
        >
          <span style={{ position: 'absolute', right: -60, top: -40, width: 200, height: 200, borderRadius: 999, background: 'rgba(255,220,207,.18)' }} />
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ padding: 'calc(var(--safe-top) + 16px) 20px 14px', display: 'flex', alignItems: 'center' }}>
            <div style={{ flex: 1, ...d(22, { c: '#fff' }) }}>My profile</div>
            {editBtn(true)}
          </div>
          <div style={{ padding: '0 20px' }}>{card}</div>
        </div>
      </div>
      <div style={{ padding: '16px 20px 20px', display: 'grid', gap: 14 }}>
        {details}
        {mySports}
        {prefs}
        {menu}
        {logout}
      </div>
    </div>
  );
}

function Detail({ icon: I, label, value, placeholder = '', verified, last, onClick }) {
  const empty = !String(value ?? '').trim();
  return (
    <button
      disabled={verified}
      onClick={onClick}
      style={{ width: '100%', padding: '10px 0', borderBottom: last ? undefined : `1px solid ${C.divider}`, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}
    >
      <span style={{ width: 36, height: 36, flex: 'none', borderRadius: 10, background: C.mint, display: 'grid', placeItems: 'center' }}>
        <I size={17} color={C.green700} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', ...t(11, { c: C.muted }) }}>{label}</span>
        <span className="clamp2" style={{ marginTop: 1, ...t(14, { w: 600, c: empty ? C.brand : C.ink }) }}>
          {empty ? placeholder : value}
        </span>
      </span>
      {verified ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, ...t(12, { w: 600, c: C.green700 }) }}>
          <BadgeCheck size={16} color={C.green700} /> Verified
        </span>
      ) : (
        <ChevronRight size={18} color={C.muted} />
      )}
    </button>
  );
}

function Menu({ icon: I, fg, bg, label, sub, onClick, last }) {
  return (
    <button
      className="tap"
      onClick={onClick}
      style={{
        width: '100%',
        minHeight: 62,
        padding: '0 16px',
        borderBottom: last ? undefined : `1px solid ${C.divider}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        textAlign: 'left',
        background: '#fff',
      }}
    >
      <span style={{ width: 36, height: 36, flex: 'none', borderRadius: 10, background: bg, display: 'grid', placeItems: 'center' }}>
        <I size={18} color={fg} />
      </span>
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', ...t(14, { w: 600 }) }}>{label}</span>
        <span style={{ display: 'block', ...t(12, { c: C.muted }) }}>{sub}</span>
      </span>
      <ChevronRight size={18} color={C.muted} />
    </button>
  );
}
