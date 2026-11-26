/** 2 · Venue & Slot Matrix: date strip + slot grid tagged Available / Open lobby / Booked. After picking a slot:
 *  Join solo (open lobbies on that slot) or Create a group (Squad Builder). Also reschedules a booking.
 *  URL: /book?venue=ID[&sport=][&date=yyyy-mm-dd][&start=H][&reschedule=bookingId] */
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CalendarCheck, Flame, Mountain, Trophy, UserPlus, Users } from 'lucide-react';
import { Check, ChevronRight, Clock, Zap } from '../../ui/icons';
import { useBack, useRequireProfile } from '../../app/nav';
import { Shell } from '../../app/Shell';
import { asList, errText } from '../../lib/api';
import { bookingRepo, venueRepo } from '../../lib/repos';
import { addDays, dayName, eeeD, eeeDMmm, fmtHour, fmtTime, inr, ymd } from '../../lib/format';
import { C, d, shadow, t } from '../../theme';
import { useIsDesktop } from '../../ui/hooks';
import { useOverlay } from '../../ui/overlay';
import { BackSquare, CardBox, Choice, ErrorRetry, GhostButton, Img, Label, PrimaryButton, Segmented, Sk, Spinner, WarnBox } from '../../ui/kit';
import { BandButton, Panel, Rule } from '../../ui/brand';

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
  // Step 1: date, court & duration · Step 2: start time. Step 2 is a history entry (?step=2) so browser Back returns to step 1.
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const step = params.get('step') === '2' ? 2 : 1;
  const goStep = (n) => {
    if (n === step) return;
    if (n === 1 && location.state?.fromStep1) return nav(-1); // pop the entry we pushed
    const next = new URLSearchParams(params);
    if (n === 2) next.set('step', '2');
    else next.delete('step');
    setParams(next, n === 2 ? { state: { fromStep1: true } } : { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
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
  const freePrices = slots.filter((s) => s.status === 'free' && typeof s.price === 'number').map((s) => s.price);
  const fromHour = freePrices.length ? Math.min(...freePrices) : null;

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
      <BackSquare onClick={step === 2 ? () => goStep(1) : back} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={d(desktop ? 28 : 20)}>{step === 2 ? 'Pick a start time' : isReschedule ? 'Reschedule slot' : 'Pick a slot'}</div>
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
      <Label style={desktop ? { padding: '20px 0 10px' } : undefined}>
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
      <Label style={desktop ? { padding: '20px 0 10px' } : undefined}>Court</Label>
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
          <Label style={desktop ? { padding: '20px 0 10px' } : undefined}>How long do you want to play?</Label>
          <DurationPicker dur={dur} onPick={setDur} fromHour={fromHour} pad={pad} />
        </>
      )}
    </>
  );

  const stepper = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: desktop ? '4px 0 8px' : '0 20px 4px' }}>
      <StepDot n={1} step={step} label="Date, court & duration" onClick={step === 2 ? () => goStep(1) : undefined} />
      <div style={{ flex: 1, height: 2, borderRadius: 2, background: step === 2 ? C.brand : C.line, transition: 'background 200ms' }} />
      <StepDot n={2} step={step} label="Start time" />
    </div>
  );

  const picked = (
    <div style={{ margin: desktop ? '0 0 16px' : '10px 20px 0', padding: '12px 8px 12px 14px', borderRadius: 16, background: C.mint, display: 'flex', alignItems: 'center', gap: 10 }}>
      <CalendarCheck size={20} color={C.brand} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={t(14, { w: 700, c: C.brand })}>
          {dateLabel} · {court?.name ?? ''}
        </div>
        <div style={t(12, { c: C.green700 })}>{isReschedule ? sport.name : `${sport.name} · ${hrs}`}</div>
      </div>
      <button className="tap" onClick={() => goStep(1)} style={{ padding: '8px 12px', borderRadius: 10, background: 'transparent', ...t(13, { w: 700, c: C.brand }) }}>
        Change
      </button>
    </div>
  );

  const grid = (
    <div style={{ margin: desktop ? 0 : '16px 20px 0', padding: desktop ? 24 : 16, borderRadius: desktop ? 24 : 20, background: '#fff', border: `1px solid ${C.line}` }}>
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

  const step1Summary = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={t(14, { w: 700 })}>
            {dateLabel} · {court?.name ?? ''}
          </div>
          <div style={{ marginTop: 2, ...t(12, { c: C.muted }) }}>
            {sport.name} · {hrs}
          </div>
        </div>
        {!isReschedule && fromHour != null && (
          <div style={{ textAlign: 'right' }}>
            <div style={t(11, { c: C.muted })}>from</div>
            <div style={d(22)}>{inr(fromHour * dur)}</div>
          </div>
        )}
      </div>
      <div style={{ height: 12 }} />
      <PrimaryButton height={56} radius={16} shadowOn={false} trailing={<ArrowRight size={18} color="#fff" />} onClick={loading ? undefined : () => goStep(2)}>
        Next: pick a start time
      </PrimaryButton>
    </>
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
        {stepper}
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 380px', gap: 36, alignItems: 'start' }}>
          <div key={step} style={{ minWidth: 0, animation: 'rise 260ms ease' }}>
            {step === 1 ? (
              selectors
            ) : (
              <>
                {picked}
                {grid}
              </>
            )}
          </div>
          <aside style={{ position: 'sticky', top: 96 }}>
            <CardBox padding={24} radius={24} shadowCss={shadow.big}>
              <div style={{ ...t(12, { w: 700, c: C.muted, ls: 0.6 }), textTransform: 'uppercase', marginBottom: 12 }}>Your slot</div>
              {step === 1 ? step1Summary : summary}
              {!isReschedule && step === 2 && (
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

  // Phone (redesign): one screen — green panel with sport, day, court and duration, then the slot grid and a cart bar.
  const maxDur = 4;
  const panelChip = (on) => ({
    height: 38,
    padding: '0 14px',
    flex: 'none',
    borderRadius: 12,
    border: `1px solid ${on ? '#fff' : 'rgba(255,255,255,.12)'}`,
    background: on ? '#fff' : 'rgba(255,255,255,.06)',
    ...t(13, { w: 800, c: on ? C.brand : '#fff' }),
  });
  const total = check.valid ? inr(check.total) : '₹—';
  const cartLine = start == null ? dateLabel : `${day === 0 ? 'Today' : eeeD(date)} · ${fmtTime(start)} · ${hrs}`;
  return (
    <div className="page" style={{ minHeight: '100dvh', paddingBottom: 'calc(120px + var(--safe-bottom))' }}>
      <header style={{ background: C.brandDark, paddingTop: 'var(--safe-top)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 16px 16px' }}>
          <BandButton onClick={back} />
          <span style={{ width: 44, height: 44, borderRadius: 12, overflow: 'hidden', flex: 'none' }}>
            <Img url={venue.image} />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span className="clamp1" style={d(18, { c: '#fff', ls: -0.4 })}>
              {isReschedule ? 'Reschedule · ' : ''}
              {venue.name}
            </span>
            <span className="clamp1" style={t(12.5, { w: 600, c: C.bandInk })}>
              {court?.name ?? ''} · {sport.name}
            </span>
          </div>
        </div>
        <Panel padding="18px 16px 20px" gap={16}>
          {sports.length > 1 && !isReschedule && (
            <div className="hscroll" style={{ gap: 8 }}>
              {sports.map((x, i) => (
                <button key={x.sport_id} className="tap" aria-pressed={i === sportIdx} onClick={() => (setSportIdx(i), setCourtIdx(0))} style={panelChip(i === sportIdx)}>
                  {x.name}
                </button>
              ))}
            </div>
          )}
          <div style={t(12, { w: 800, c: C.panelInk, ls: 1.4 })}>
            PICK A DAY · {MONTHS_LONG[date.getMonth()].toUpperCase()}
          </div>
          <div className="hscroll" style={{ gap: 8, margin: '0 -16px', padding: '0 16px' }}>
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
                    width: 52,
                    height: 72,
                    flex: 'none',
                    borderRadius: 18,
                    border: `1px solid ${on ? '#fff' : 'rgba(255,255,255,.12)'}`,
                    background: on ? '#fff' : 'rgba(255,255,255,.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                  }}
                >
                  <span style={t(10.5, { w: 800, c: on ? C.green700 : C.bandInk, ls: 0.6 })}>{i === 0 ? 'TODAY' : dayName(dd).toUpperCase()}</span>
                  <span style={d(21, { c: on ? C.brand : '#fff', ls: -0.5 })}>{dd.getDate()}</span>
                </button>
              );
            })}
          </div>
          {courts.length > 1 && (
            <div className="hscroll" style={{ gap: 8 }}>
              {courts.map((c, i) => (
                <button key={c.id} className="tap" aria-pressed={i === courtIdx} onClick={() => setCourtIdx(i)} style={panelChip(i === courtIdx)}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
          {!isReschedule && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 10px 10px 14px', borderRadius: 18, background: C.green900 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, ...t(14, { w: 800, c: '#fff' }) }}>
                <Clock size={22} color={C.sun} strokeWidth={1.8} /> Duration
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 3, borderRadius: 12, background: 'rgba(255,255,255,.08)' }}>
                <button
                  aria-label="Shorter"
                  disabled={dur <= 1}
                  onClick={() => setDur(Math.max(1, dur - 1))}
                  style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.12)', opacity: dur <= 1 ? 0.5 : 1, ...t(18, { w: 800, c: '#fff', h: 1 }) }}
                >
                  −
                </button>
                <span style={{ minWidth: 62, textAlign: 'center', ...t(14, { w: 800, c: '#fff' }) }}>{hrs}</span>
                <button
                  aria-label="Longer"
                  disabled={dur >= maxDur}
                  onClick={() => setDur(Math.min(maxDur, dur + 1))}
                  style={{ width: 36, height: 36, borderRadius: 10, background: '#fff', opacity: dur >= maxDur ? 0.5 : 1, ...t(18, { w: 800, c: C.brand, h: 1 }) }}
                >
                  +
                </button>
              </span>
            </div>
          )}
        </Panel>
      </header>

      <main style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '20px 16px 0' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, ...t(12, { w: 700, c: C.mutedInk }) }}>
          <LegendItem box={{ background: '#fff', border: `1.5px solid ${C.chipLine}` }} label="Free" />
          <LegendItem box={{ width: 8, height: 8, borderRadius: '50%', background: C.coral }} label="Peak" />
          <LegendItem box={{ background: C.mint, border: `1.5px solid ${C.green700}` }} label="Open lobby" />
          <LegendItem box={{ background: C.chip }} label="Booked" />
        </div>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {Array.from({ length: 9 }, (_, i) => (
              <Sk key={i} h={56} r={14} />
            ))}
          </div>
        ) : (
          groupsDef.map(([name, a, b]) => {
            const hs = slots.filter((x) => x.hour >= a && x.hour <= b);
            if (!hs.length) return null;
            const free = hs.filter((x) => x.status === 'free').length;
            return (
              <section key={name} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Rule extra={`${free} of ${hs.length} free${hs.some((x) => x.peak) ? ' · peak' : ''}`}>{name}</Rule>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                  {hs.map((x) => (
                    <SlotTile key={x.hour} s={x} start={start} dur={dur} valid={check.valid} isReschedule={isReschedule} onPick={setStart} />
                  ))}
                </div>
              </section>
            );
          })
        )}
        {!check.valid && !loading && start != null && (isReschedule || lobbiesAtStart === 0) && <WarnBox>{check.error}</WarnBox>}
      </main>

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40, padding: '12px 16px calc(20px + var(--safe-bottom))', background: '#fff', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!isReschedule && lobbiesAtStart > 0 && (
          <button
            className="tap"
            onClick={loading ? undefined : joinSolo}
            style={{ height: 44, borderRadius: 14, background: C.mint, border: `1.5px solid ${C.green700}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, ...t(14, { w: 800, c: C.brand }) }}
          >
            <UserPlus size={17} color={C.brand} /> Join solo · {lobbiesAtStart} open {lobbiesAtStart === 1 ? 'lobby' : 'lobbies'}
          </button>
        )}
        <button
          className="tap"
          disabled={!check.valid || loading || busy}
          onClick={isReschedule ? doReschedule : createGroup}
          style={{
            height: 62,
            padding: '0 18px',
            borderRadius: 20,
            background: check.valid ? C.brand : C.line,
            boxShadow: check.valid ? '0 10px 24px rgba(20,61,43,.3)' : undefined,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            textAlign: 'left',
          }}
        >
          <span style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <span className="clamp1" style={t(12, { w: 700, c: check.valid ? C.panelInk : C.muted })}>
              {cartLine}
            </span>
            {isReschedule ? (
              <span style={d(18, { c: check.valid ? '#fff' : '#57625A', ls: -0.3 })}>New slot</span>
            ) : (
              <span className="clamp1" style={d(18, { c: check.valid ? '#fff' : '#57625A', ls: -0.3 })}>
                {total} <span style={t(12, { w: 600, c: check.valid ? C.panelInk : C.muted })}>turf for the squad</span>
              </span>
            )}
          </span>
          {busy ? (
            <Spinner />
          ) : (
            <span style={{ flex: 'none', marginLeft: 12, display: 'flex', alignItems: 'center', gap: 6, ...t(16, { w: 800, c: check.valid ? '#fff' : '#57625A' }) }}>
              {isReschedule ? 'Confirm' : 'Continue'}
              {check.valid && <ChevronRight size={18} color={C.sun} strokeWidth={2.6} />}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

const LegendItem = ({ box, label }) => (
  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <span style={{ width: 12, height: 12, borderRadius: 4, ...box }} />
    {label}
  </span>
);

const DURATIONS = [
  { hours: 1, tag: 'Quick game', Icon: Zap, hint: 'A quick knock — perfect after work.' },
  { hours: 2, tag: 'Full match', Icon: Flame, hint: 'Most squads pick this: warm-up plus a full match.' },
  { hours: 3, tag: 'Extended', Icon: Trophy, hint: 'Room for a mini tournament — rotate teams.' },
  { hours: 4, tag: 'Marathon', Icon: Mountain, hint: 'Make a day of it — play till you drop.' },
];

/** Duration cards: hours, a vibe tag, a "from" price for the day, and a Popular badge on 2 hrs. */
function DurationPicker({ dur, onPick, fromHour, pad }) {
  const picked = DURATIONS.find((o) => o.hours === dur) ?? DURATIONS[1];
  return (
    <div style={{ padding: pad }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, paddingTop: 10 }}>
        {DURATIONS.map(({ hours, tag, Icon }) => {
          const on = hours === dur;
          const popular = hours === 2;
          return (
            <button
              key={hours}
              aria-pressed={on}
              aria-label={`${hours} ${hours === 1 ? 'hour' : 'hours'}, ${tag}${popular ? ', most popular' : ''}`}
              className="tap"
              onClick={() => onPick(hours)}
              style={{
                position: 'relative',
                minWidth: 0,
                padding: '16px 4px 10px',
                borderRadius: 18,
                background: on ? `linear-gradient(135deg, ${C.green700}, ${C.brandDark})` : '#fff',
                border: `1.2px solid ${on ? C.brand : popular ? 'rgba(242,85,44,.45)' : C.line}`,
                boxShadow: on ? shadow.brandSm : undefined,
                transform: on ? 'scale(1)' : 'scale(0.96)',
                transition: 'transform 180ms cubic-bezier(.34,1.56,.64,1), background 180ms, box-shadow 180ms',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }}
            >
              {popular && (
                <span
                  style={{
                    position: 'absolute',
                    top: -10,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    padding: '3px 7px',
                    borderRadius: 20,
                    background: C.coral,
                    boxShadow: '0 3px 8px rgba(242,85,44,.25)',
                    whiteSpace: 'nowrap',
                    ...t(9, { w: 800, c: '#fff', ls: 0.6 }),
                  }}
                >
                  POPULAR
                </span>
              )}
              <Icon size={18} color={on ? C.coral : C.muted} />
              <span style={{ marginTop: 4 }}>
                <span style={d(26, { c: on ? '#fff' : C.ink })}>{hours}</span>
                <span style={{ opacity: 0.8, ...t(12, { w: 600, c: on ? '#fff' : C.ink }) }}>{hours === 1 ? ' hr' : ' hrs'}</span>
              </span>
              <span className="clamp1" style={{ maxWidth: '100%', ...t(11, { w: 600, c: on ? 'rgba(255,255,255,.85)' : C.muted }) }}>
                {tag}
              </span>
              {fromHour != null && (
                <span style={{ marginTop: 4, padding: '2px 6px', borderRadius: 8, background: on ? 'rgba(255,255,255,.14)' : C.chip, ...t(11, { w: 700, c: on ? '#fff' : C.mutedInk }) }}>
                  {inr(fromHour * hours)}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div
        key={picked.hours}
        style={{ marginTop: 12, padding: '10px 14px', borderRadius: 14, background: C.mint, display: 'flex', alignItems: 'center', gap: 8, animation: 'rise 220ms ease' }}
      >
        <picked.Icon size={16} color={C.brand} />
        <span style={t(13, { w: 500, c: C.brand })}>{picked.hint}</span>
      </div>
    </div>
  );
}

function StepDot({ n, step, label, onClick }) {
  const on = step === n,
    done = step > n;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', padding: 0, cursor: onClick ? 'pointer' : 'default', flex: 'none' }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 99,
          display: 'grid',
          placeItems: 'center',
          background: on || done ? C.brand : C.chip,
          transition: 'background 200ms',
          ...t(11, { w: 800, c: on ? '#fff' : C.muted }),
        }}
      >
        {done ? <Check size={13} color="#fff" /> : n}
      </span>
      <span style={t(12, { w: on ? 700 : 500, c: on || done ? C.ink : C.muted })}>{label}</span>
    </button>
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
    border = `1.5px solid ${C.hair}`;
  if (past) [bg, fg, border] = ['#fff', '#8A948D', `1.5px dashed ${C.hair}`];
  else if (lobbyPick) [bg, fg, border] = [C.green700, '#fff', `1.5px solid ${C.green700}`];
  else if (booked && lobbies === 0) [bg, fg, border] = [C.chip, C.muted, `1.5px solid ${C.chip}`];
  else if (sel) [bg, fg, border] = [C.brand, '#fff', `1.5px solid ${C.brand}`];
  else if (clash) [fg, border] = [C.warnInk, '2px solid #B45309'];
  else if (lobbies > 0) [bg, fg, border] = [C.mint, C.brand, `1.5px solid ${C.green700}`];
  const tappable = !past && (!booked || (lobbies > 0 && !isReschedule));
  const spots = s.lobby_spots ?? 0;
  const peak = s.peak === true && !past && !booked && lobbies === 0;
  const note = past ? 'Past' : sel ? 'Selected' : lobbies > 0 ? `${spots} spot${spots === 1 ? '' : 's'} left` : booked ? 'Booked' : inr(s.price);
  return (
    <button
      className={tappable ? 'tap' : undefined}
      disabled={!tappable}
      aria-pressed={sel || lobbyPick}
      onClick={() => onPick(h)}
      style={{
        position: 'relative',
        height: 56,
        borderRadius: 14,
        background: bg,
        border,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        transition: 'all 120ms',
      }}
    >
      <span style={{ textDecoration: booked && lobbies === 0 ? 'line-through' : undefined, ...t(14, { w: 800, c: fg, h: 1.2 }) }}>{s.label}</span>
      <span style={{ opacity: 0.85, ...t(10.5, { w: 700, c: fg, h: 1.2 }) }}>{note}</span>
      {peak && <span style={{ position: 'absolute', top: 7, right: 8, width: 7, height: 7, borderRadius: '50%', background: sel ? C.sun : C.coral }} />}
    </button>
  );
}
