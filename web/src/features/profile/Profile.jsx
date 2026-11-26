/** 19 · My profile. Phone = dark band + green identity panel (redesign). Desktop = profile card on the left, sections on the right. */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck, BellRing, LayoutDashboard, Mail, Pencil, Plus, User, UserPlus } from 'lucide-react';
import { Bell, Check, ChevronRight, CircleHelp, CreditCard, FileText, Heart, LogOut, MapPin, Phone, Ticket, Wallet } from '../../ui/icons';
import { isStaffOrOwner, useSession } from '../../app/session';
import { routes, useBack } from '../../app/nav';
import { Shell } from '../../app/Shell';
import { SignInGate } from '../auth/SignInGate';
import { ProfileForm } from '../auth/ProfileForm';
import { asList, asMap, errText } from '../../lib/api';
import { share } from '../../lib/actions';
import { userRepo } from '../../lib/repos';
import { sportThumb } from '../../lib/art';
import { inr } from '../../lib/format';
import { C, d, shadow, t } from '../../theme';
import { useIsDesktop } from '../../ui/hooks';
import { useOverlay } from '../../ui/overlay';
import { CardBox, GhostButton, H2, Img, Pill, Sk, Toggle } from '../../ui/kit';
import { Band, Disc, Panel, PanelTile, ProfileButton, Rule, Script } from '../../ui/brand';

const LEVELS = [
  ['Beginner', 0.3, C.teal, C.tealSoft],
  ['Intermediate', 0.6, C.amber, C.amberSoft],
  ['Advanced', 0.9, C.green700, C.mint],
];

export default function ProfilePage() {
  const { loggedIn } = useSession();
  const desktop = useIsDesktop();
  const back = useBack();
  return (
    <Shell>
      {!loggedIn && !desktop && <Band title="Profile" back={back} right={<ProfileButton />} />}
      <SignInGate>
        <Profile />
      </SignInGate>
    </Shell>
  );
}

function Profile() {
  const app = useSession();
  const nav = useNavigate();
  const back = useBack();
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

  const box = { borderRadius: 20, border: `1px solid ${C.hair}`, overflow: 'hidden', background: '#fff' };
  const menu = (
    <div style={box}>
      {isStaffOrOwner(u) && <Menu icon={LayoutDashboard} label="Venue dashboard" sub={u.is_staff ? 'Admin panel' : 'Manage your venues & bookings'} onClick={() => nav('/admin')} />}
      <Menu icon={Ticket} label="My bookings" sub="Upcoming, played and refunds" onClick={() => nav(routes.bookings)} />
      <Menu icon={Heart} label="Saved venues" sub={`${app.saved.size} favourite${app.saved.size === 1 ? '' : 's'}`} onClick={() => nav('/saved')} />
      <Menu icon={CreditCard} label="Payments & refunds" sub={`Wallet ${inr(u.wallet_balance)}`} onClick={() => nav(routes.bookings)} />
      <Menu icon={Bell} label="Notifications" sub="Lobby invites, reminders, offers" onClick={() => nav('/notifications')} />
      <Menu
        icon={BellRing}
        label="Booking & slot alerts"
        sub={u.notifications_on === true ? 'On' : 'Off'}
        onClick={() => app.updateMe({ notifications_on: !(u.notifications_on === true) })}
        right={<Toggle value={u.notifications_on === true} />}
      />
      <Menu icon={UserPlus} label="Invite friends" sub={`Code ${u.referral_code} · ₹${reward} each`} onClick={invite} last />
    </div>
  );
  const support = (
    <div style={box}>
      <Menu icon={CircleHelp} label="Help & support" sub="FAQs, chat with us, call" onClick={() => nav('/help')} />
      <Menu icon={FileText} label="Policies" sub="Terms, privacy, refunds" onClick={() => nav('/policy')} last />
    </div>
  );

  const logout = (
    <div>
      <button
        className="tap"
        onClick={() => (app.logout(), nav(routes.home, { replace: true }))}
        style={{ width: '100%', height: 50, borderRadius: 16, border: `1px solid ${C.hair}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...t(14.5, { w: 800, c: C.redInk }) }}
      >
        <LogOut size={20} color={C.redInk} /> Log out
      </button>
      <div style={{ marginTop: 12, textAlign: 'center', ...t(12, { c: C.muted }) }}>Turflet v{app.config.app_version ?? '1.1'}</div>
    </div>
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
            {logout}
          </div>
          <div style={{ position: 'relative', paddingTop: 80, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
            <div style={{ display: 'grid', gap: 18 }}>
              {details}
              {mySports}
            </div>
            <div style={{ display: 'grid', gap: 18 }}>
              {menu}
              {support}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const name = String(u.name ?? '').trim();
  const [first, ...lastParts] = name.split(' ');
  const last = lastParts.join(' ');
  const badge = sports[0] ? sportThumb(sports[0].name, sports[0].image) : null;

  return (
    <>
      <Band
        title="Profile"
        back={back}
        right={
          <button
            className="tap"
            onClick={() => setEditing(!editing)}
            style={{ height: 40, padding: '0 16px', borderRadius: 999, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)', ...t(13, { w: 800, c: '#fff' }) }}
          >
            {editing ? 'Done' : 'Edit'}
          </button>
        }
      >
        <Panel padding="24px 16px 20px">
          <button onClick={editDetails} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
            <span
              style={{
                position: 'relative',
                width: 88,
                height: 88,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 30%, #FF8A65 0%, #F2552C 60%, #C23E1C 100%)',
                boxShadow: '0 10px 22px rgba(0,0,0,.35)',
                display: 'grid',
                placeItems: 'center',
                ...d(30, { c: '#fff', h: 1 }),
              }}
            >
              {u.initials ?? 'ME'}
              <span style={{ position: 'absolute', right: -4, bottom: -2, width: 36, height: 36, borderRadius: '50%', background: '#fff', border: `3px solid ${C.brand}`, overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
                {badge ? <Img url={badge} /> : <Pencil size={14} color={C.brand} />}
              </span>
            </span>
            <span style={d(26, { c: '#fff', ls: -0.8 })}>
              {name ? (
                <>
                  {first} {last && <Script>{last}</Script>}
                </>
              ) : (
                'Add your name'
              )}
            </span>
            <span className="clamp1" style={{ maxWidth: '100%', ...t(13, { w: 600, c: C.panelInk }) }}>
              {u.email}
              {u.phone ? ` · ${u.phone}` : ''}
            </span>
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            {[
              [String(stats.games ?? 0), 'Games played'],
              [`${stats.hours ?? 0}h`, 'On the turf'],
              [String(app.saved.size), 'Saved venues'],
            ].map(([v, l]) => (
              <PanelTile key={l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '12px 4px' }}>
                <span style={d(21, { c: C.sun, ls: -0.5 })}>{v}</span>
                <span style={t(11.5, { w: 700, c: C.panelInk })}>{l}</span>
              </PanelTile>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, borderRadius: 20, background: '#fff' }}>
            <Disc icon={Wallet} size={46} />
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <span style={t(12, { w: 700, c: C.muted })}>Turflet wallet</span>
              <span style={d(22, { ls: -0.6 })}>{inr(u.wallet_balance)}</span>
            </span>
            <button className="tap" onClick={() => nav(routes.bookings)} style={{ height: 40, padding: '0 14px', borderRadius: 12, background: C.brand, ...t(13, { w: 800, c: '#fff' }) }}>
              History
            </button>
          </div>
        </Panel>
      </Band>
      <main style={{ display: 'flex', flexDirection: 'column', gap: 22, padding: '24px 16px 28px' }}>
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Rule extra={editing ? 'tap to change level' : null}>Your sports</Rule>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '14px 8px' }}>
            {sports.map((sp, i) => {
              const lv = LEVELS[Math.min(2, Math.max(0, sp.level ?? 0))];
              return (
                <button
                  key={sp.sport_id}
                  disabled={!editing}
                  onClick={() => setSports(sports.map((x, k) => (k === i ? { ...x, level: ((x.level ?? 0) + 1) % 3 } : x)))}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
                >
                  <span style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', boxShadow: i === 0 ? `0 0 0 3px ${C.brand}` : undefined }}>
                    <Img url={sportThumb(sp.name, sp.image)} />
                  </span>
                  <span className="clamp1" style={{ maxWidth: '100%', ...t(12.5, { w: 700, c: C.mutedInk }) }}>
                    {sp.name}
                  </span>
                  <span style={t(10.5, { w: 800, c: lv[2], ls: 0.3 })}>{lv[0].toUpperCase()}</span>
                </button>
              );
            })}
            {sports.length < app.sports.length && (
              <button onClick={addSport} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <Disc icon={Plus} size={64} />
                <span style={t(12.5, { w: 700, c: C.mutedInk })}>Add</span>
              </button>
            )}
          </div>
        </section>
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Rule>Your details</Rule>
          <div style={{ borderRadius: 20, border: `1px solid ${C.hair}`, overflow: 'hidden' }}>
            <Detail icon={User} label="Name" value={u.name} placeholder="Add your name" onClick={editDetails} />
            <Detail icon={Phone} label="Mobile" value={u.phone} placeholder="Add mobile number" onClick={editDetails} />
            <Detail icon={MapPin} label="Address" value={u.address} placeholder="Add address (optional)" onClick={editDetails} last />
          </div>
        </section>
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Rule>Your stuff</Rule>
          {menu}
        </section>
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Rule>Support</Rule>
          {support}
        </section>
        {logout}
      </main>
    </>
  );
}

function Detail({ icon: I, label, value, placeholder = '', verified, last, onClick }) {
  const empty = !String(value ?? '').trim();
  return (
    <button
      disabled={verified}
      onClick={onClick}
      style={{ width: '100%', padding: '13px 14px', borderBottom: last ? undefined : `1px solid ${C.hair}`, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', background: '#fff' }}
    >
      <Disc icon={I} size={42} iconSize={20} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', ...t(12, { w: 600, c: C.muted }) }}>{label}</span>
        <span className="clamp2" style={t(14.5, { w: 800, c: empty ? C.brand : C.ink })}>
          {empty ? placeholder : value}
        </span>
      </span>
      {verified ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, ...t(12, { w: 700, c: C.green700 }) }}>
          <BadgeCheck size={16} color={C.green700} /> Verified
        </span>
      ) : (
        <ChevronRight size={18} color={C.radioOff} strokeWidth={2.4} />
      )}
    </button>
  );
}

function Menu({ icon: I, label, sub, onClick, last, right }) {
  return (
    <button
      className="tap"
      onClick={onClick}
      style={{ width: '100%', padding: '13px 14px', borderBottom: last ? undefined : `1px solid ${C.hair}`, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', background: '#fff' }}
    >
      <Disc icon={I} size={42} iconSize={21} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', ...t(14.5, { w: 800 }) }}>{label}</span>
        <span className="clamp1" style={{ display: 'block', ...t(12, { w: 600, c: C.muted }) }}>
          {sub}
        </span>
      </span>
      {right ?? <ChevronRight size={18} color={C.radioOff} strokeWidth={2.4} />}
    </button>
  );
}
