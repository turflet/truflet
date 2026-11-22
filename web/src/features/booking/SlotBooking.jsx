/** 2 · Venue & Slot Matrix: date strip + slot grid tagged Available / Open lobby / Booked. After picking a slot:
 *  Join solo (open lobbies on that slot) or Create a group (Squad Builder). Also reschedules a booking.
 *  URL: /book?venue=ID[&sport=][&date=yyyy-mm-dd][&start=H][&reschedule=bookingId] */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, UserPlus, Users } from 'lucide-react';
import { useBack, useRequireProfile } from '../../app/nav';
import { Shell } from '../../app/Shell';
import { asList, errText } from '../../lib/api';
import { bookingRepo, venueRepo } from '../../lib/repos';
import { addDays, dayName, eeeDMmm, fmtHour, fmtTime, inr, ymd } from '../../lib/format';
import { C, d, shadow, t } from '../../theme';
import { useIsDesktop } from '../../ui/hooks';
import { useOverlay } from '../../ui/overlay';
import { BackSquare, CardBox, Choice, ErrorRetry, GhostButton, Img, Label, PrimaryButton, Segmented, Sk, WarnBox } from '../../ui/kit';

const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const groupsDef = [
  ['Morning', 0, 11],
  ['Afternoon', 12, 15],
  ['Evening', 16, 19],
  ['Night', 20, 23],
];

export default function SlotBookingPage() {
  const [p] = useSearchParams();
  const venueId = Number(p.get('venue'));
  const rsId = p.get('reschedule');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = async () => {
    setError(null);
    try {
      const [venue, reschedule] = await Promise.all([venueRepo.details(venueId), rsId ? bookingRepo.details(Number(rsId)) : Promise.resolve(null)]);
      setData({ venue, reschedule });
    } catch (e) {
      setError(errText(e));
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId, rsId]);
  if (error)
    return (
      <Shell>
        <ErrorRetry message={error} onRetry={load} />
      </Shell>
    );
  if (!data)
    return (
      <Shell>
        <div style={{ padding: 20, display: 'grid', gap: 12 }}>
          <Sk h={44} w={220} />
          <Sk h={72} />
          <Sk h={60} />
          <Sk h={320} r={20} />
        </div>
      </Shell>
    );
  const sportParam = p.get('sport');
  return (
    <SlotBooking
      venue={data.venue}
      reschedule={data.reschedule}
      initialSportId={sportParam ? Number(sportParam) : undefined}
      initialDate={p.get('date') ?? undefined}
      initialStart={p.get('start') ? Number(p.get('start')) : undefined}
    />
  );
}

function SlotBooking({ venue, reschedule, initialSportId, initialDate, initialStart }) {
  const nav = useNavigate();
  const back = useBack();
  const desktop = useIsDesktop();
  const { toast } = useOverlay();
  const requireProfile = useRequireProfile();
  const today = useMemo(() => new Date(), []);
  const sports = asList(venue.venue_sports);
  const allCourts = asList(venue.courts);
  const isReschedule = reschedule != null;

  const [sportIdx, setSportIdx] = useState(() => {
    const wanted = reschedule ? reschedule.sport?.id : initialSportId;
    return Math.max(
      0,
      sports.findIndex((s) => s.sport_id === wanted),
    );
  });
  const [day, setDay] = useState(() => {
    if (!initialDate) return 0;
    const [y, m, dd] = initialDate.split('-').map(Number);
    const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.min(13, Math.max(0, Math.round((new Date(y, m - 1, dd).getTime() - base.getTime()) / 86400000)));
  });
  const sport = sports[sportIdx];
  const courts = allCourts.filter((c) => asList(c.sport_ids).includes(sport?.sport_id));
  const [courtIdx, setCourtIdx] = useState(() =>
    reschedule
      ? Math.max(
          0,
          courts.findIndex((c) => c.id === reschedule.court?.id),
        )
      : 0,
  );
  const [dur, setDur] = useState(reschedule ? reschedule.duration : initialStart != null ? 1 : 2);
  const [start, setStart] = useState(initialStart ?? null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const court = courts.length ? courts[Math.min(courtIdx, courts.length - 1)] : null;
  const date = addDays(today, day);

  const load = async () => {
    if (!sport || !court) return setLoading(false);
    setLoading(true);
    try {
      const r = await venueRepo.availability(venue.id, ymd(date), sport.sport_id, court.id);
      const s = asList(r.slots);
      setSlots(s);
      setStart((cur) => {
        if (cur != null && s.some((x) => x.hour === cur)) return cur;
        // keep the chosen start if possible, otherwise preselect the first evening slot that fits
        const free = s.filter((x) => x.status === 'free').map((x) => x.hour);
        return free.find((h) => h >= 18) ?? free[0] ?? (s.length ? s[0].hour : 18);
      });
    } catch (e) {
      toast(errText(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sportIdx, day, courtIdx]);

  if (!sports.length || !courts.length) {
    return (
      <Shell>
        <div style={{ padding: 20 }}>
          <BackSquare onClick={back} />
          <div style={{ padding: '80px 20px', textAlign: 'center', ...t(15, { c: C.muted, h: 1.5 }) }}>{venue.name} has no bookable courts yet. Please try another venue.</div>
        </div>
      </Shell>
    );
  }

  const slotAt = (h) => slots.find((s) => s.hour === h);
  const check = (() => {
    if (start == null) return { valid: false, total: 0, error: 'Pick a start time.' };
    let total = 0;
    const closes = venue.closes_at;
    for (let k = 0; k < dur; k++) {
      const h = start + k;
      if (h >= closes) return { valid: false, total: 0, error: `Venue closes at ${fmtHour(closes)}. Pick an earlier start or a shorter duration.` };
      const s = slotAt(h);
      if (!s || s.status !== 'free') return { valid: false, total: 0, error: `The ${fmtHour(h)} slot is not available. Pick another start time or duration.` };
      total += s.price;
    }
    return { valid: true, total, error: '' };
  })();
  const lobbiesAtStart = start == null ? 0 : (slotAt(start)?.lobbies ?? 0);
  const dateLabel = eeeDMmm(date);
  const hrs = `${dur} ${dur === 1 ? 'hr' : 'hrs'}`;

  const doReschedule = async () => {
    if (!(await requireProfile())) return;
    setBusy(true);
    try {
      await bookingRepo.reschedule(reschedule.id, ymd(date), start, court.id);
      toast('Booking rescheduled');
      back();
    } catch (e) {
      toast(errText(e));
      load();
    } finally {
      setBusy(false);
    }
  };
  const createGroup = async () => {
    if (!(await requireProfile())) return;
    nav(`/squad?venue=${venue.id}&sport=${sport.sport_id}&court=${court.id}&date=${ymd(date)}&start=${start}&dur=${dur}&price=${check.total}`);
  };
  const joinSolo = () =>
    nav(
      `/lobbies?venue=${venue.id}&sport=${sport.sport_id}&court=${court.id}&date=${ymd(date)}&start=${start}&subtitle=${encodeURIComponent(`${dateLabel} · ${fmtHour(start)} · ${court.name}`)}`,
    );

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: desktop ? '0 0 8px' : 'calc(var(--safe-top) + 8px) 20px 12px' }}>
      <BackSquare onClick={back} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={d(desktop ? 28 : 20)}>{isReschedule ? 'Reschedule slot' : 'Pick a slot'}</div>
        <div className="clamp1" style={t(13, { c: C.muted })}>
          {venue.name} · {venue.area}
        </div>
      </div>
      <span style={{ width: 52, height: 52, borderRadius: 14, border: '2px solid #fff', boxShadow: '0 4px 12px rgba(12,36,25,.15)', overflow: 'hidden', flex: 'none' }}>
        <Img url={venue.image} />
      </span>
    </div>
  );

  const pad = desktop ? '0' : '0 20px';
  const selectors = (
    <>
      {sports.length > 1 && !isReschedule && (
        <div style={{ padding: desktop ? '8px 0 0' : '4px 20px 0' }}>
          <Segmented bg="#E6ECE3" height={44} labels={sports.map((s) => s.name)} index={sportIdx} onChange={(i) => (setSportIdx(i), setCourtIdx(0))} />
        </div>
      )}
      <Label style={{ padding: desktop ? '20px 0 10px' : undefined }}>
        {MONTHS_LONG[date.getMonth()]} {date.getFullYear()}
      </Label>
      <div className="hscroll" style={{ gap: 8, padding: pad }}>
        {Array.from({ length: 14 }, (_, i) => {
          const dd = addDays(today, i);
          const on = i === day;
          return (
            <button
              key={i}
              aria-pressed={on}
              className="tap"
              onClick={() => setDay(i)}
              style={{
                width: 60,
                height: 72,
                flex: 'none',
                borderRadius: 16,
                background: on ? C.brand : '#fff',
                border: `1px solid ${on ? C.brand : C.line}`,
                boxShadow: on ? shadow.brandSm : undefined,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
              }}
            >
              <span style={{ opacity: 0.85, ...t(12, { w: 500, c: on ? '#fff' : C.ink }) }}>{i === 0 ? 'Today' : dayName(dd)}</span>
              <span style={d(20, { c: on ? '#fff' : C.ink })}>{dd.getDate()}</span>
            </button>
          );
        })}
      </div>
      <Label style={{ padding: desktop ? '20px 0 10px' : undefined }}>Court</Label>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(courts.length, 4)}, 1fr)`, gap: 8, padding: pad }}>
        {courts.slice(0, 4).map((c, i) => (
          <Choice key={c.id} selected={i === courtIdx} height={60} onClick={() => setCourtIdx(i)} style={{ flexDirection: 'column', minWidth: 0 }}>
            <span style={t(14, { w: 700, c: i === courtIdx ? '#fff' : C.ink })}>{c.name}</span>
            <span className="clamp1" style={{ maxWidth: '100%', opacity: 0.85, ...t(11, { c: i === courtIdx ? '#fff' : C.ink }) }}>
              {c.meta ?? ''}
            </span>
          </Choice>
        ))}
      </div>
      {!isReschedule && (
        <>
          <Label style={{ padding: desktop ? '20px 0 10px' : undefined }}>Duration</Label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: pad }}>
            {[1, 2, 3, 4].map((n) => (
              <Choice key={n} selected={n === dur} height={44} radius={12} onClick={() => setDur(n)}>
                <span style={t(14, { w: 600, c: n === dur ? '#fff' : C.ink })}>
                  {n} {n === 1 ? 'hr' : 'hrs'}
                </span>
              </Choice>
            ))}
          </div>
        </>
      )}
    </>
  );

  const grid = (
    <div style={{ margin: desktop ? 0 : '24px 20px 0', padding: desktop ? 24 : 16, borderRadius: desktop ? 24 : 20, background: '#fff', border: `1px solid ${C.line}` }}>
      <div style={{ height: 6, margin: '0 24px 6px', borderRadius: 999, background: '#C9D4CC' }} />
      <div style={{ textAlign: 'center', ...t(11, { w: 600, c: C.muted, ls: 1.2 }) }}>PICK A START TIME</div>
      <div style={{ height: 14 }} />
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${desktop ? 6 : 4}, 1fr)`, gap: 8 }}>
          {Array.from({ length: 12 }, (_, i) => (
            <Sk key={i} h={desktop ? 58 : 52} r={12} />
          ))}
        </div>
      ) : (
        groupsDef.map(([name, a, b]) => {
          const hs = slots.filter((s) => s.hour >= a && s.hour <= b);
          if (!hs.length) return null;
          return (
            <div key={name} style={{ marginBottom: 16 }}>
              <div style={t(13, { w: 600 })}>
                {name}
                <span style={t(13, { c: C.muted })}>
                  {' '}
                  · {fmtHour(hs[0].hour)} – {fmtHour(hs[hs.length - 1].hour + 1)}
                </span>
              </div>
              <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: `repeat(${desktop ? 6 : 4}, 1fr)`, gap: 8 }}>
                {hs.map((s) => (
                  <SlotTile key={s.hour} s={s} start={start} dur={dur} valid={check.valid} isReschedule={isReschedule} onPick={setStart} />
                ))}
              </div>
            </div>
          );
        })
      )}
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.line}`, display: 'flex', flexWrap: 'wrap', gap: '8px 14px' }}>
        <Legend box={{ background: '#fff', border: `1.5px solid ${C.radioOff}` }} label="Available" />
        <Legend box={{ background: C.brand }} label="Selected" />
        <Legend box={{ background: C.limeSoft, border: `1.5px solid ${C.green700}` }} label="Open lobby" />
        <Legend box={{ background: '#E9ECE6' }} label="Booked" />
        <Legend box={{ width: 8, height: 8, borderRadius: 99, background: '#B45309' }} label="Peak price" />
      </div>
    </div>
  );

  const summary = (
    <>
      {!check.valid && !loading && (isReschedule || lobbiesAtStart === 0) && <WarnBox style={{ marginBottom: 12, padding: '10px 12px' }}>{check.error}</WarnBox>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={t(14, { w: 700 })}>
            {check.valid ? `${dateLabel} · ${fmtTime(start)} – ${fmtTime(start + dur)}` : `${dateLabel} · ${start == null ? '' : `${fmtHour(start)} start`}`}
          </div>
          <div style={{ marginTop: 2, ...t(12, { c: C.muted }) }}>
            {court?.name ?? ''} · {sport.name} · {hrs}
          </div>
        </div>
        {!isReschedule && (
          <div style={{ textAlign: 'right' }}>
            <div style={d(22)}>{check.valid ? inr(check.total) : '₹—'}</div>
            <div style={t(11, { c: C.muted })}>turf for the squad</div>
          </div>
        )}
      </div>
      <div style={{ height: 12 }} />
      {isReschedule ? (
        <PrimaryButton
          height={56}
          radius={16}
          shadowOn={false}
          loading={busy}
          trailing={check.valid ? <ArrowRight size={18} color="#fff" /> : undefined}
          onClick={check.valid && !loading ? doReschedule : undefined}
        >
          Confirm new slot
        </PrimaryButton>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: desktop ? '1fr' : '1fr 1fr', gap: 10 }}>
          {desktop && (
            <PrimaryButton
              height={56}
              radius={16}
              fontSize={15}
              trailing={check.valid ? <Users size={18} color="#fff" /> : undefined}
              onClick={check.valid && !loading ? createGroup : undefined}
            >
              Create a group
            </PrimaryButton>
          )}
          <GhostButton
            icon={UserPlus}
            height={56}
            bg={lobbiesAtStart > 0 ? C.limeSoft : C.chip}
            fg={lobbiesAtStart > 0 ? C.green900 : C.muted}
            border="transparent"
            onClick={lobbiesAtStart > 0 && !loading ? joinSolo : undefined}
            style={{ opacity: lobbiesAtStart > 0 ? 1 : 0.9 }}
          >
            {lobbiesAtStart > 0 ? `Join solo · ${lobbiesAtStart}` : 'Join solo'}
          </GhostButton>
          {!desktop && (
            <PrimaryButton
              height={56}
              radius={16}
              fontSize={15}
              shadowOn={false}
              trailing={check.valid ? <Users size={18} color="#fff" /> : undefined}
              onClick={check.valid && !loading ? createGroup : undefined}
            >
              Create a group
            </PrimaryButton>
          )}
        </div>
      )}
    </>
  );

  if (desktop) {
    return (
      <Shell>
        {header}
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 380px', gap: 36, alignItems: 'start' }}>
          <div style={{ minWidth: 0 }}>
            {selectors}
            <div style={{ height: 24 }} />
            {grid}
          </div>
          <aside style={{ position: 'sticky', top: 96 }}>
            <CardBox padding={24} radius={24} shadowCss={shadow.big}>
              <div style={{ ...t(12, { w: 700, c: C.muted, ls: 0.6 }), textTransform: 'uppercase', marginBottom: 12 }}>Your slot</div>
              {summary}
              {!isReschedule && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.line}`, ...t(12, { c: C.muted, h: 1.5 }) }}>
                  <b style={{ color: C.ink }}>Create a group</b> books the turf for your squad — pay it all or split it. <b style={{ color: C.ink }}>Join solo</b> joins a group
                  already playing at this time.
                </div>
              )}
            </CardBox>
          </aside>
        </div>
      </Shell>
    );
  }

  return (
    <div className="page" style={{ minHeight: '100dvh', paddingBottom: 200 }}>
      {header}
      {selectors}
      {grid}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 40,
          padding: '14px 20px calc(16px + var(--safe-bottom))',
          background: '#fff',
          borderRadius: '24px 24px 0 0',
          borderTop: `1px solid ${C.line}`,
        }}
      >
        {summary}
      </div>
    </div>
  );
}

const Legend = ({ box, label }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...t(12, { c: C.muted }) }}>
    <span style={{ width: 14, height: 14, borderRadius: 4, ...box }} />
    {label}
  </span>
);

function SlotTile({ s, start, dur, valid, isReschedule, onPick }) {
  const h = s.hour;
  const past = s.status === 'past',
    booked = s.status === 'booked';
  const lobbies = past ? 0 : (s.lobbies ?? 0);
  const picked = start != null && h >= start && h < start + dur;
  const sel = valid && picked;
  const lobbyPick = !valid && h === start && lobbies > 0 && !isReschedule;
  const clash = !valid && h === start && !lobbyPick;
  let bg = '#fff',
    fg = C.ink,
    border = `1.5px solid ${C.radioOff}`;
  if (past) [bg, fg, border] = [C.ground, '#57625A', '1px solid #C9D4CC'];
  else if (lobbyPick) [bg, fg, border] = [C.green700, '#fff', `1px solid ${C.green700}`];
  else if (booked && lobbies === 0) [bg, fg, border] = ['#E9ECE6', '#57625A', '1px solid #E9ECE6'];
  else if (sel) [bg, fg, border] = [C.brand, '#fff', `1px solid ${C.brand}`];
  else if (clash) [fg, border] = [C.warnInk, '2px solid #B45309'];
  else if (lobbies > 0) [bg, fg, border] = [C.limeSoft, C.green900, `1.5px solid ${C.green700}`];
  const tappable = !past && (!booked || (lobbies > 0 && !isReschedule));
  const spots = s.lobby_spots ?? 0;
  const peak = s.peak === true && !past && !booked && !sel && lobbies === 0;
  return (
    <button
      className={tappable ? 'tap' : undefined}
      disabled={!tappable}
      aria-pressed={sel || lobbyPick}
      onClick={() => onPick(h)}
      style={{
        position: 'relative',
        aspectRatio: '1.45',
        borderRadius: 12,
        background: bg,
        border,
        boxShadow: sel || lobbyPick ? '0 6px 14px rgba(20,61,43,.28)' : undefined,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 120ms',
      }}
    >
      <span style={{ textDecoration: booked && lobbies === 0 ? 'line-through' : undefined, ...t(13, { w: 700, c: fg }) }}>{s.label}</span>
      <span style={{ opacity: 0.85, ...t(10, { w: 500, c: fg }) }}>{past ? 'Past' : lobbies > 0 ? `${spots} left` : booked ? 'Booked' : inr(s.price)}</span>
      {peak && <span style={{ position: 'absolute', top: 5, right: 5, width: 6, height: 6, borderRadius: 99, background: '#B45309' }} />}
    </button>
  );
}
