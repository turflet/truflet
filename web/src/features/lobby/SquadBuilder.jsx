/** 4 · Squad Builder: capacity, friends tagged Known / Guest, one-time payment rule, open to solo players,
 *  Book & Recover vs Crowdfund. URL: /squad?venue&sport&court&date&start&dur&price */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, ArrowRight, HandCoins, Lock, PiggyBank, Plus, User, UserPlus, X } from 'lucide-react';
import { useSession } from '../../app/session';
import { routes, useBack } from '../../app/nav';
import { Shell } from '../../app/Shell';
import { asList, asMap, errText } from '../../lib/api';
import { lobbyRepo, venueRepo } from '../../lib/repos';
import { eeeDMmm, fmtHour, fmtTime, inr } from '../../lib/format';
import { C, d, t } from '../../theme';
import { useData, useIsDesktop } from '../../ui/hooks';
import { useOverlay } from '../../ui/overlay';
import { Avatar, BackSquare, CardBox, Choice, ErrorRetry, GhostButton, Img, Label, ListSkeleton, Pill, PriceRow, PrimaryButton, RadioDot, Toggle } from '../../ui/kit';

export default function SquadBuilderPage() {
  const [p] = useSearchParams();
  const { data: venue, error, retry } = useData(() => venueRepo.details(Number(p.get('venue'))), [p.get('venue')]);
  if (error)
    return (
      <Shell>
        <ErrorRetry message={error} onRetry={retry} />
      </Shell>
    );
  if (!venue)
    return (
      <Shell>
        <ListSkeleton />
      </Shell>
    );
  const sport = asList(venue.venue_sports).find((s) => String(s.sport_id) === p.get('sport')) ?? asList(venue.venue_sports)[0];
  const court = asList(venue.courts).find((c) => String(c.id) === p.get('court')) ?? asList(venue.courts)[0];
  const [y, m, dd] = String(p.get('date')).split('-').map(Number);
  return (
    <SquadBuilder
      venue={venue}
      sport={sport}
      court={court}
      date={new Date(y, m - 1, dd)}
      dateStr={String(p.get('date'))}
      startHour={Number(p.get('start'))}
      duration={Number(p.get('dur') ?? 1)}
      turfPrice={Number(p.get('price') ?? 0)}
    />
  );
}

function SquadBuilder({ venue, sport, court, date, dateStr, startHour, duration, turfPrice }) {
  const app = useSession();
  const nav = useNavigate();
  const back = useBack();
  const desktop = useIsDesktop();
  const { toast, sheet } = useOverlay();
  const splitFee = app.config.split_fee ?? 0;
  const maxPlayers = sport?.max_players ?? 16;
  const isPrime = startHour >= 18 && startHour < 22;

  const [capacity, setCap] = useState(Math.min(10, Math.max(2, sport?.max_players ?? 10)));
  const [friends, setFriends] = useState([]);
  const [rule, setRule] = useState('split');
  const [mode, setMode] = useState(isPrime ? 'book_recover' : 'crowdfund');
  const [isPublic, setPublic] = useState(true);
  const [recent, setRecent] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    lobbyRepo.recentPlayers().then(
      (r) => setRecent(asList(r.recent)),
      () => undefined,
    );
  }, []);

  // derived — same rules as SquadBuilderState in the Flutter app
  const squad = 1 + friends.length;
  const openSpots = Math.max(0, capacity - squad);
  const namedGuests = friends.filter((f) => f.tag === 'guest').length;
  const isPrivate = !isPublic || openSpots === 0;
  const ownSquad = isPrivate && !friends.some((f) => f.tag === 'known');
  const guests = namedGuests + (isPublic ? 0 : openSpots);
  const split = !ownSquad && rule === 'split';
  const crowdfund = split && mode === 'crowdfund';
  const share = Math.ceil(turfPrice / capacity);
  const hostPaysNow = crowdfund ? share * (1 + guests) + splitFee : turfPrice;
  const perHead = split ? share + splitFee : 0;
  const dateLabel = eeeDMmm(date);

  const setCapacity = (n) => setCap(Math.min(maxPlayers, Math.max(Math.max(2, squad), n)));
  const add = (f) => {
    setFriends((x) => [...x, f]);
    setCap((c) => Math.max(c, squad + 1));
  };
  const addKnown = (player) => {
    if (friends.some((f) => f.user_id === player.id)) return toast(`${player.name} is already in your squad.`);
    if (squad >= maxPlayers) return toast(`The squad is at the ${maxPlayers}-player limit.`);
    add({ tag: 'known', user_id: player.id, name: player.name, initials: player.initials });
  };
  const addGuest = (name) => {
    const n = name.trim();
    if (!n) return toast('Give your guest a name.');
    if (squad >= maxPlayers) return toast(`The squad is at the ${maxPlayers}-player limit.`);
    add({ tag: 'guest', name: n, initials: n[0].toUpperCase() });
  };

  const create = async () => {
    setBusy(true);
    try {
      const lobby = await lobbyRepo.create({
        venue: venue.id,
        court: court.id,
        sport: sport.sport_id,
        date: dateStr,
        start_hour: startHour,
        duration,
        capacity,
        payment_rule: ownSquad ? 'host' : rule,
        booking_mode: ownSquad ? 'book_recover' : mode,
        is_public: isPublic && openSpots > 0,
        friends: friends.map((f) => (f.tag === 'guest' ? { tag: 'guest', name: f.name } : { tag: 'known', user_id: f.user_id })),
      });
      if (ownSquad) {
        // private booking with the host's own players: hold the slot and go straight to payment
        const booking = asMap((await lobbyRepo.action(lobby.id, 'lock')).checkout_booking);
        nav(routes.payment(booking.id), { replace: true });
        return;
      }
      toast(lobby.status === 'draft' ? "Match created. Lock the turf when you're ready." : 'Match created. Pay your share to start the pool.');
      nav(routes.match(lobby.id), { replace: true });
    } catch (e) {
      toast(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const addFriend = async () => {
    const p = await sheet((close) => <FindPlayer close={close} />);
    if (p) addKnown(p);
  };
  const addGuestSheet = async () => {
    const n = await sheet((close) => <AddGuest close={close} />);
    if (n != null) addGuest(n);
  };

  const me = app.user ?? {};
  const recentLeft = recent.filter((p) => !friends.some((f) => f.user_id === p.id));
  const others = capacity - 1 - guests;
  const half = Math.floor(capacity / 2);
  const ctaLabel = ownSquad
    ? `Book & pay ${inr(turfPrice)}`
    : crowdfund
      ? `Create lobby · pay ${inr(hostPaysNow)}`
      : isPublic && openSpots > 0
        ? 'Lock turf & publish lobby'
        : `Lock turf · ${inr(turfPrice)}`;

  const slotCard = (
    <CardBox padding={14} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ width: 52, height: 52, flex: 'none' }}>
        <Img url={venue.image} radius={14} />
      </span>
      <div style={{ flex: 1 }}>
        <div style={t(15, { w: 700 })}>
          {sport?.name} · {court?.name}
        </div>
        <div style={t(13, { c: C.muted })}>
          {dateLabel} · {fmtTime(startHour)} – {fmtTime(startHour + duration)}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={d(18)}>{inr(turfPrice)}</div>
        <div style={t(11, { c: C.muted })}>turf</div>
      </div>
    </CardBox>
  );

  const stepBtn = (label, primary, onClick, aria) => (
    <button
      aria-label={aria}
      className="tap"
      onClick={onClick}
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        background: primary ? C.brand : C.ground,
        border: primary ? 'none' : `1px solid ${C.line}`,
        ...t(20, { w: 700, c: primary ? '#fff' : C.ink, h: 1 }),
      }}
    >
      {label}
    </button>
  );

  const capacityCard = (
    <CardBox padding={14} shadowCss={null} border={`1px solid ${C.line}`} style={{ display: 'flex', alignItems: 'center' }}>
      <div style={{ flex: 1 }}>
        <div style={t(14, { w: 600 })}>Total players</div>
        <div style={t(12, { c: C.muted })}>
          {capacity % 2 === 0 ? `${half}v${half} · ` : ''}including you · max {maxPlayers}
        </div>
      </div>
      {stepBtn('−', false, () => setCapacity(capacity - 1), 'Fewer players')}
      <span style={{ width: 48, textAlign: 'center', ...d(22) }}>{capacity}</span>
      {stepBtn('+', true, () => setCapacity(capacity + 1), 'More players')}
    </CardBox>
  );

  const person = (initials, name, tag, bg, fg, onRemove, index = 0) => (
    <div key={`${name}${index}`} style={{ padding: '5px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
      <Avatar initials={initials} size={32} index={index} />
      <span className="clamp1" style={{ flex: 1, ...t(14, { w: 600 }) }}>
        {name}
      </span>
      <Pill bg={bg} fg={fg}>
        {tag}
      </Pill>
      {onRemove && (
        <button aria-label="Remove" className="tap" onClick={onRemove} style={{ width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center' }}>
          <X size={16} color={C.muted} />
        </button>
      )}
    </div>
  );

  const squadCard = (
    <CardBox padding={14} shadowCss={null} border={`1px solid ${C.line}`}>
      {person(me.initials ?? 'ME', 'You', 'Host', C.mint, C.green700)}
      {friends.map((f, i) =>
        person(
          f.initials,
          f.name,
          f.tag === 'guest' ? 'Guest' : 'Known',
          f.tag === 'guest' ? C.amberSoft : C.blueSoft,
          f.tag === 'guest' ? C.amber : C.blue,
          () => setFriends((x) => x.filter((_, k) => k !== i)),
          i + 1,
        ),
      )}
      {openSpots > 0 && (
        <div style={{ marginTop: 6, padding: '10px 12px', borderRadius: 12, background: C.ground, display: 'flex', alignItems: 'center', gap: 8, ...t(13, { c: C.mutedInk }) }}>
          <UserPlus size={16} color={C.muted} />
          {isPublic ? `${openSpots} open spot${openSpots === 1 ? '' : 's'} for solo players` : `${openSpots} more of your own players`}
        </div>
      )}
      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <GhostButton icon={UserPlus} height={44} radius={12} fontSize={13} onClick={addFriend}>
          Add friend
        </GhostButton>
        <GhostButton icon={User} height={44} radius={12} fontSize={13} onClick={addGuestSheet}>
          Add guest
        </GhostButton>
      </div>
      {recentLeft.length > 0 && (
        <>
          <div style={{ margin: '12px 0 6px', ...t(12, { c: C.muted }) }}>Played with recently</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {recentLeft.slice(0, 8).map((p) => (
              <button
                key={p.id}
                className="tap"
                onClick={() => addKnown(p)}
                style={{
                  padding: '4px 10px 4px 4px',
                  borderRadius: 999,
                  background: '#fff',
                  border: `1px solid ${C.line}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  ...t(12, { w: 600 }),
                }}
              >
                <Avatar initials={p.initials ?? ''} size={22} index={p.id ?? 0} />
                {String(p.name ?? '').split(' ')[0]}
                <Plus size={12} color={C.brand} />
              </button>
            ))}
          </div>
        </>
      )}
    </CardBox>
  );

  const canPublic = openSpots > 0;
  const publicOn = isPublic && canPublic;
  const publicToggle = (
    <button
      role="switch"
      aria-checked={publicOn}
      disabled={!canPublic}
      onClick={() => setPublic(!isPublic)}
      style={{
        width: '100%',
        padding: 14,
        borderRadius: 20,
        background: '#fff',
        border: `1px solid ${publicOn ? C.brand : C.line}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        textAlign: 'left',
      }}
    >
      <span style={{ flex: 1 }}>
        <span style={{ display: 'block', ...t(14, { w: 700 }) }}>Open to solo players</span>
        <span style={{ display: 'block', marginTop: 2, ...t(12, { c: C.muted, h: 1.4 }) }}>
          {!canPublic
            ? 'Your squad is full — this is a private booking.'
            : publicOn
              ? `List ${openSpots} spot${openSpots === 1 ? '' : 's'} publicly. You screen every request in a private chat first.`
              : 'Private: only your squad plays.'}
        </span>
      </span>
      <Toggle value={publicOn} />
    </button>
  );

  const option = (on, title, sub, I, onClick) => (
    <Choice
      selected={on}
      selBg={C.mint}
      selWidth={2}
      height={96}
      padding={12}
      onClick={onClick}
      style={{ flexDirection: 'column', alignItems: 'stretch', justifyContent: 'center', textAlign: 'left', minWidth: 0 }}
    >
      <span style={{ display: 'flex', alignItems: 'center' }}>
        <I size={18} color={on ? C.green700 : C.muted} />
        <span style={{ flex: 1 }} />
        <RadioDot on={on} />
      </span>
      <span style={{ marginTop: 6, ...t(14, { w: 700 }) }}>{title}</span>
      <span className="clamp1" style={t(11, { c: C.muted })}>
        {sub}
      </span>
    </Choice>
  );

  const modeCard = (id, title, body, I, badge) => {
    const on = mode === id;
    const risky = badge?.startsWith('Risky');
    return (
      <button
        aria-pressed={on}
        className="tap"
        onClick={() => setMode(id)}
        style={{
          width: '100%',
          padding: 14,
          borderRadius: 16,
          background: on ? C.mint : '#fff',
          border: `${on ? 2 : 1}px solid ${on ? C.brand : C.line}`,
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          textAlign: 'left',
          transition: 'all 140ms',
        }}
      >
        <I size={20} color={on ? C.green700 : C.muted} style={{ flex: 'none' }} />
        <span style={{ flex: 1 }}>
          <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <span style={t(14, { w: 700 })}>{title}</span>
            {badge && (
              <Pill bg={risky ? C.orangeSoft : C.lime} fg={risky ? C.orangeInk : C.ink} size={10}>
                {badge}
              </Pill>
            )}
          </span>
          <span style={{ display: 'block', marginTop: 4, ...t(12, { c: C.mutedInk, h: 1.45 }) }}>{body}</span>
        </span>
        <RadioDot on={on} />
      </button>
    );
  };

  const rules = ownSquad ? (
    <div style={{ marginTop: 10, padding: 14, borderRadius: 16, background: C.limeSoft, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <Lock size={18} color={C.green700} style={{ flex: 'none' }} />
      <span style={t(13, { c: C.mutedInk, h: 1.45 })}>
        Your own squad: you pay the full turf now and the slot is booked right away. Add friends who are on Turflet to split the cost, or open spots to solo players.
      </span>
    </div>
  ) : (
    <>
      <Label style={{ padding: '20px 0 10px' }}>Payment rule · set once</Label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {option(rule === 'split', 'Split equally', split ? `${inr(perHead)} each` : 'Everyone pays a share', ArrowLeftRight, () => setRule('split'))}
        {option(rule === 'host', "I'll pay full", 'Everyone else plays free', HandCoins, () => setRule('host'))}
      </div>
      {split && (
        <>
          <Label style={{ padding: '20px 0 10px' }}>How to book the turf</Label>
          <div style={{ display: 'grid', gap: 10 }}>
            {modeCard(
              'book_recover',
              'Book & recover',
              `Pay ${inr(turfPrice)} now to lock the turf. Shares come back to you through escrow as players pay — released when your group checks in.`,
              Lock,
              isPrime ? 'Recommended for prime slots' : null,
            )}
            {modeCard(
              'crowdfund',
              'Crowdfund first',
              "Pay only your share. The turf is booked once the pool covers it — if another group books first or it isn't full near kickoff, you choose what to do and paid players are refunded.",
              PiggyBank,
              isPrime ? 'Risky at peak hours' : 'Zero upfront risk',
            )}
          </div>
        </>
      )}
    </>
  );

  const summary = (
    <CardBox color={C.ground} shadowCss={null} border={`1px solid ${C.line}`} style={{ display: 'grid', gap: 8 }}>
      <PriceRow k={`Turf · ${duration} hr${duration === 1 ? '' : 's'}`} v={inr(turfPrice)} />
      <PriceRow k="Players" v={ownSquad ? `${capacity} · your squad` : `${capacity} (${squad} in squad${isPublic && openSpots > 0 ? `, ${openSpots} open` : ''})`} />
      {split && <PriceRow k="Each player pays" v={`${inr(share)} + ${inr(splitFee)} fee`} />}
      {split && guests > 0 && <PriceRow k={`You cover ${guests} guest${guests === 1 ? '' : 's'}`} v={inr(share * guests)} />}
      <div style={{ height: 4 }} />
      <PriceRow k={crowdfund ? 'You pay now (into escrow)' : 'You pay now (+ booking fee)'} v={inr(hostPaysNow)} bold top />
      {split && !crowdfund && others > 0 && <PriceRow k="You recover up to" v={inr(share * others)} color={C.green700} />}
    </CardBox>
  );

  const cta = (
    <PrimaryButton loading={busy} trailing={<ArrowRight size={18} color="#fff" />} onClick={create}>
      {ctaLabel}
    </PrimaryButton>
  );

  const header = (
    <div style={{ padding: desktop ? '0 0 18px' : 'calc(var(--safe-top) + 8px) 20px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <BackSquare onClick={back} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={d(desktop ? 30 : 20)}>Build your squad</div>
        <div className="clamp1" style={t(13, { c: C.muted })}>
          {venue.name} · {dateLabel} · {fmtHour(startHour)} – {fmtHour(startHour + duration)}
        </div>
      </div>
    </div>
  );

  if (desktop) {
    return (
      <Shell>
        {header}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 36, alignItems: 'start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <div>
                <Label style={{ padding: '0 0 10px' }}>Team capacity</Label>
                {capacityCard}
                <div style={{ height: 16 }} />
                {publicToggle}
              </div>
              <div>
                <Label style={{ padding: '0 0 10px' }}>Your squad</Label>
                {squadCard}
              </div>
            </div>
            {rules}
          </div>
          <aside style={{ position: 'sticky', top: 96, display: 'grid', gap: 14 }}>
            {slotCard}
            {summary}
            {cta}
          </aside>
        </div>
      </Shell>
    );
  }

  return (
    <div className="page" style={{ minHeight: '100dvh', paddingBottom: 100 }}>
      {header}
      <div style={{ padding: '0 20px 24px' }}>
        {slotCard}
        <Label style={{ padding: '20px 0 10px' }}>Team capacity</Label>
        {capacityCard}
        <Label style={{ padding: '20px 0 10px' }}>Your squad</Label>
        {squadCard}
        <div style={{ height: 16 }} />
        {publicToggle}
        {rules}
        <div style={{ height: 20 }} />
        {summary}
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
        {cta}
      </div>
    </div>
  );
}

function FindPlayer({ close }) {
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const find = async () => {
    setBusy(true);
    setError(null);
    try {
      close(asMap((await lobbyRepo.lookup(contact.trim())).player));
    } catch (e) {
      setError(errText(e));
      setBusy(false);
    }
  };
  return (
    <form onSubmit={(e) => (e.preventDefault(), find())}>
      <div style={d(22)}>Add a friend</div>
      <div style={{ margin: '6px 0 14px', ...t(13, { c: C.muted, h: 1.4 }) }}>Known players are on Turflet: they get an invite and join once they accept.</div>
      <div style={{ height: 50, padding: '0 14px', borderRadius: 14, background: C.ground, border: `1px solid ${C.line}`, display: 'flex', alignItems: 'center' }}>
        <input autoFocus value={contact} placeholder="Email, mobile or referral code" onChange={(e) => setContact(e.target.value)} style={t(15)} />
      </div>
      {error && <div style={{ marginTop: 8, ...t(13, { c: C.redInk }) }}>{error}</div>}
      <div style={{ height: 12 }} />
      <PrimaryButton type="submit" height={52} loading={busy}>
        Find player
      </PrimaryButton>
    </form>
  );
}

function AddGuest({ close }) {
  const [name, setName] = useState('');
  return (
    <form onSubmit={(e) => (e.preventDefault(), close(name))}>
      <div style={d(22)}>Add a guest</div>
      <div style={{ margin: '6px 0 14px', ...t(13, { c: C.muted, h: 1.4 }) }}>Guests aren't on Turflet. You cover their share.</div>
      <div style={{ height: 50, padding: '0 14px', borderRadius: 14, background: C.ground, border: `1px solid ${C.line}`, display: 'flex', alignItems: 'center' }}>
        <input autoFocus value={name} placeholder="Guest name" autoCapitalize="words" onChange={(e) => setName(e.target.value)} style={t(15)} />
      </div>
      <div style={{ height: 12 }} />
      <PrimaryButton type="submit" height={52}>
        Add guest
      </PrimaryButton>
    </form>
  );
}
