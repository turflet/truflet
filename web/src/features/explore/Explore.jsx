/** 1 · Home / Discovery: auto-expanding radius, sport pills, search, sort & filter (date + time window, price,
 *  amenities), venue cards with open-lobby counts, the city lobby board and the unread badge.
 *  Phone = the Flutter screen. Desktop = hero + sticky filter sidebar + venue grid. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpDown, Bell, ChevronDown, Heart, LocateFixed, MapPin, Radar, Search, SlidersHorizontal, Star } from 'lucide-react';
import { useSession } from '../../app/session';
import { routes, useRequireLogin } from '../../app/nav';
import { Shell } from '../../app/Shell';
import { asList, asMap, errText } from '../../lib/api';
import { lobbyRepo, notificationRepo, venueRepo } from '../../lib/repos';
import { addDays, count, eeeD, fmtHour, inr, ymd } from '../../lib/format';
import { C, d, hex, shadow, t } from '../../theme';
import { useIsDesktop } from '../../ui/hooks';
import { useOverlay } from '../../ui/overlay';
import { CardBox, Choice, ErrorRetry, H2, Img, Pill, PrimaryButton, Sk, SportPill, SquareIconButton } from '../../ui/kit';

const sortOrder = ['near', 'price', 'rating'];
const sortLabels = { near: 'Nearest', price: 'Lowest price', rating: 'Top rated' };
const timeWindows = [
  ['Morning', 6, 12],
  ['Afternoon', 12, 16],
  ['Evening', 16, 20],
  ['Night', 20, 24],
];
const PRICE_FLOOR = 0,
  PRICE_CEIL = 3000;

const noFilters = { amenities: [], priceMin: null, priceMax: null, dayOffset: null, window: null };
const filterCount = (f) => f.amenities.length + (f.priceMin != null || f.priceMax != null ? 1 : 0) + (f.dayOffset != null || f.window != null ? 1 : 0);

export default function Explore() {
  const app = useSession();
  const nav = useNavigate();
  const desktop = useIsDesktop();
  const { toast, sheet } = useOverlay();
  const requireLogin = useRequireLogin();

  const [venues, setVenues] = useState(null);
  const [error, setError] = useState(null);
  const [unread, setUnread] = useState(0);
  const [sportId, setSportId] = useState(null);
  const [sort, setSort] = useState('near');
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState(noFilters);
  const [radius, setRadius] = useState({ label: '', notice: '' });
  const [cityLobbies, setCityLobbies] = useState([]);
  const [amenities, setAmenities] = useState([]);
  const debounce = useRef(undefined);
  const latest = useRef(0);

  const load = useCallback(
    async (o = {}) => {
      const sp = o.sportId !== undefined ? o.sportId : sportId;
      const so = o.sort ?? sort;
      const qq = o.q ?? q;
      const f = o.filters ?? filters;
      const call = ++latest.current;
      const w = f.window == null ? null : timeWindows[f.window];
      const day = f.dayOffset ?? (w ? 0 : null);
      try {
        await app.ensureBasics();
        const r = await venueRepo.search({
          area: app.areaId,
          sport: sp,
          q: qq || undefined,
          lat: app.lat,
          lng: app.lng,
          sort: so,
          amenities: f.amenities.length ? f.amenities.join(',') : undefined,
          price_min: f.priceMin,
          price_max: f.priceMax,
          date: day != null ? ymd(addDays(new Date(), day)) : undefined,
          from_hour: w?.[1],
          to_hour: w?.[2],
        });
        if (call !== latest.current) return;
        const items = asList(r.items);
        app.replaceSaved(items.filter((v) => v.is_saved === true).map((v) => v.id));
        setVenues(items);
        setError(null);
        setRadius({ label: r.radius_label ?? '', notice: r.notice ?? '' });
      } catch (e) {
        if (call === latest.current) setError(errText(e));
      }
      if (app.areaId != null) lobbyRepo.cityLobbies(app.areaId, sp).then(setCityLobbies, () => undefined);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [app.areaId, app.lat, app.lng, sportId, sort, q, filters],
  );

  useEffect(() => {
    if (app.areaId == null) {
      nav('/location?first=1', { replace: true });
      return;
    }
    load();
    venueRepo.amenities().then(setAmenities, () => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.areaId]);

  useEffect(() => {
    if (app.loggedIn)
      notificationRepo.list().then(
        (n) => setUnread(n.unread ?? 0),
        () => undefined,
      );
  }, [app.loggedIn]);

  const pickSport = (id) => {
    setSportId(id);
    load({ sportId: id });
  };
  const cycleSort = () => {
    const next = sortOrder[(sortOrder.indexOf(sort) + 1) % 3];
    setSort(next);
    load({ sort: next });
  };
  const onSearch = (v) => {
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => {
      setQ(v.trim());
      load({ q: v.trim() });
    }, 350);
  };
  const applyFilters = (f, s) => {
    setFilters(f);
    setSort(s);
    load({ filters: f, sort: s });
  };
  const clearFilters = () => applyFilters(noFilters, sort);

  const toggleFav = async (v) => {
    if (!requireLogin()) return;
    const id = v.id;
    app.markSaved(id, !app.saved.has(id));
    try {
      const r = await venueRepo.toggleSaved(id);
      app.markSaved(id, r.is_saved === true);
    } catch (e) {
      toast(errText(e));
    }
  };

  const openFilters = () =>
    sheet((close) => <FilterPanel initial={filters} initialSort={sort} amenities={amenities} onApply={(f, s) => close({ f, s })} />).then((r) => r && applyFilters(r.f, r.s));

  const offer = asMap(app.config.offer);
  const fc = filterCount(filters);
  const openBoard = () => nav(`/lobbies?area=${app.areaId}&city=${encodeURIComponent(app.cityName)}`);
  const city = app.cityName || app.areaName;

  const sportChips = (
    <div className="hscroll" style={{ gap: 12, padding: desktop ? '2px 0 8px' : '0 20px' }}>
      <SportChip label="All" on={sportId == null} fg={C.brand} onClick={() => pickSport(null)} />
      {app.sports.map((sp) => (
        <SportChip key={sp.id} label={sp.name} img={sp.image} on={sportId === sp.id} fg={hex(sp.fg)} onClick={() => pickSport(sp.id)} />
      ))}
    </div>
  );

  const listHeader = (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, padding: desktop ? '0 0 14px' : '20px 20px 10px' }}>
      <div style={{ flex: 1 }}>
        <H2 size={desktop ? 22 : 18}>{venues == null ? 'Arenas near you' : `${venues.length} arena${venues.length === 1 ? '' : 's'} near you`}</H2>
        {radius.label && (
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, ...t(12, { w: 600, c: C.green700 }) }}>
            <Radar size={13} color={C.green700} /> {radius.label}
          </div>
        )}
      </div>
      <button
        className="tap"
        onClick={cycleSort}
        style={{
          height: 36,
          padding: '0 12px',
          borderRadius: 999,
          background: '#fff',
          border: `1px solid ${C.line}`,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          ...t(12, { w: 600 }),
        }}
      >
        <ArrowUpDown size={14} color={C.brand} /> {sortLabels[sort]}
      </button>
    </div>
  );

  const notices = (
    <>
      {radius.notice && venues && (
        <div
          style={{
            margin: desktop ? '0 0 12px' : '0 20px 12px',
            padding: '10px 12px',
            borderRadius: 12,
            background: C.blueSoft,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            ...t(13, { c: C.blueInk }),
          }}
        >
          <LocateFixed size={16} color={C.blue} /> {radius.notice}
        </div>
      )}
      {fc > 0 && venues && (
        <div style={{ padding: desktop ? '0 0 12px' : '0 20px 12px', display: 'flex', gap: 8, ...t(13, { c: C.muted }) }}>
          {fc} filter{fc === 1 ? '' : 's'} on
          <button onClick={clearFilters} style={t(13, { w: 700, c: C.brand })}>
            Clear
          </button>
        </div>
      )}
    </>
  );

  const list = (
    <>
      {error && <ErrorRetry message={error} onRetry={() => load()} />}
      {venues == null && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: desktop ? 'repeat(auto-fill, minmax(300px, 1fr))' : '1fr', gap: desktop ? 22 : 16, padding: desktop ? 0 : '0 20px' }}>
          {Array.from({ length: desktop ? 6 : 3 }, (_, i) => (
            <CardBox key={i} padding={0} radius={24} shadowCss={shadow.card} style={{ overflow: 'hidden' }}>
              <Sk h={170} r={0} />
              <div style={{ padding: 16, display: 'grid', gap: 8 }}>
                <Sk w="55%" h={18} />
                <Sk w="35%" h={12} />
              </div>
            </CardBox>
          ))}
        </div>
      )}
      {venues && venues.length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', ...t(14, { c: C.muted }) }}>No arenas match. Try another sport, time or fewer filters.</div>
      )}
      {venues && venues.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: desktop ? 'repeat(auto-fill, minmax(300px, 1fr))' : '1fr', gap: desktop ? 22 : 16, padding: desktop ? 0 : '0 20px' }}>
          {venues.map((v) => (
            <VenueCard key={v.id} v={v} fav={app.saved.has(v.id)} onOpen={() => nav(routes.venue(v.id))} onFav={() => toggleFav(v)} />
          ))}
        </div>
      )}
    </>
  );

  if (desktop) {
    return (
      <Shell nav>
        {/* hero */}
        <section style={{ position: 'relative', borderRadius: 32, overflow: 'hidden', minHeight: 300, display: 'flex', alignItems: 'flex-end' }}>
          <img src="/images/turf.jpg" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(100deg, rgba(11,42,29,.94) 0%, rgba(11,42,29,.78) 45%, rgba(11,42,29,.15) 100%)' }} />
          <div style={{ position: 'relative', padding: '44px 48px', width: '100%' }}>
            <button
              className="tap"
              onClick={() => nav('/location')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 999,
                background: 'rgba(255,255,255,.14)',
                ...t(13, { w: 600, c: '#fff' }),
              }}
            >
              <MapPin size={15} color="#fff" /> Playing in {city} <ChevronDown size={14} color="#fff" />
            </button>
            <h1 style={{ margin: '18px 0 0', maxWidth: 620, ...d(48, { c: '#fff', h: 1.05, ls: -1.2 }) }}>
              Ready for your next game<span style={{ color: C.coral }}>?</span>
            </h1>
            <p style={{ margin: '12px 0 26px', maxWidth: 520, ...t(16, { c: 'rgba(255,255,255,.8)', h: 1.5 }) }}>
              Live availability at turfs and courts near you. Book a slot, or join an open lobby and split the cost.
            </p>
            <div style={{ display: 'flex', gap: 10, maxWidth: 640 }}>
              <div style={{ flex: 1, height: 56, padding: '0 18px', borderRadius: 18, background: '#fff', display: 'flex', alignItems: 'center', gap: 10, boxShadow: shadow.big }}>
                <Search size={19} color={C.muted} />
                <input placeholder="Search turfs, courts, venues" onChange={(e) => onSearch(e.target.value)} style={t(15)} />
              </div>
            </div>
          </div>
        </section>

        <div style={{ marginTop: 32 }}>
          <H2 size={22} style={{ marginBottom: 14 }}>
            Choose your sport
          </H2>
          {sportChips}
        </div>

        {(offer.enabled === true || cityLobbies.length > 0) && (
          <div
            style={{ marginTop: 28, display: 'grid', gridTemplateColumns: offer.enabled === true && cityLobbies.length > 0 ? '380px 1fr' : '1fr', gap: 22, alignItems: 'stretch' }}
          >
            {offer.enabled === true && <OfferBanner o={offer} />}
            {cityLobbies.length > 0 && (
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                  <H2 size={20} style={{ flex: 1 }}>
                    Open lobbies in {app.cityName}
                  </H2>
                  <button onClick={openBoard} style={t(13, { w: 700, c: C.brand })}>
                    See all
                  </button>
                </div>
                <div className="hscroll" style={{ gap: 12 }}>
                  {cityLobbies.slice(0, 8).map((g) => (
                    <LobbyCard key={g.id} g={g} onClick={openBoard} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 36, display: 'grid', gridTemplateColumns: '290px 1fr', gap: 32, alignItems: 'start' }}>
          <aside style={{ position: 'sticky', top: 96 }}>
            <CardBox padding={22} radius={24} shadowCss={shadow.card}>
              <FilterPanel key={JSON.stringify(filters) + sort} initial={filters} initialSort={sort} amenities={amenities} onApply={applyFilters} compact />
            </CardBox>
          </aside>
          <div style={{ minWidth: 0 }}>
            {listHeader}
            {notices}
            {list}
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell nav>
      <div style={{ paddingTop: 'calc(var(--safe-top) + 8px)', paddingBottom: 20 }}>
        <div style={{ padding: '0 20px', display: 'flex', alignItems: 'center' }}>
          <button onClick={() => nav('/location')} style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
            <div style={t(12, { c: C.muted })}>Playing in</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={16} color={C.brand} fill={C.brand} strokeWidth={0} />
              <span className="clamp1" style={t(16, { w: 700 })}>
                {city}
              </span>
              <ChevronDown size={16} />
            </div>
          </button>
          <SquareIconButton
            icon={Bell}
            label="Notifications"
            badge={unread > 0}
            onClick={() => {
              if (!requireLogin()) return;
              setUnread(0);
              nav('/notifications');
            }}
          />
        </div>
        <div style={{ padding: '16px 20px 0', whiteSpace: 'pre-line', ...d(26, { h: 1.15, ls: -0.5 }) }}>{'Ready for your\nnext game?'}</div>
        <div style={{ padding: '16px 20px 0', display: 'flex', gap: 10 }}>
          <div
            style={{
              flex: 1,
              height: 50,
              padding: '0 14px',
              borderRadius: 16,
              background: '#fff',
              border: `1px solid ${C.line}`,
              boxShadow: shadow.soft,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Search size={18} color={C.muted} />
            <input type="search" placeholder="Search turfs, courts, venues" onChange={(e) => onSearch(e.target.value)} style={t(15)} />
          </div>
          <button
            aria-label="More filters"
            className="tap"
            onClick={openFilters}
            style={{ position: 'relative', width: 50, height: 50, borderRadius: 16, background: C.brand, boxShadow: shadow.brandSm, display: 'grid', placeItems: 'center' }}
          >
            <SlidersHorizontal size={20} color="#fff" />
            {fc > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  width: 16,
                  height: 16,
                  borderRadius: 99,
                  background: C.lime,
                  display: 'grid',
                  placeItems: 'center',
                  ...t(10, { w: 700, h: 1 }),
                }}
              >
                {fc}
              </span>
            )}
          </button>
        </div>
        <H2 style={{ padding: '22px 20px 12px' }}>Choose your sport</H2>
        {sportChips}
        {offer.enabled === true && (
          <div style={{ margin: '20px 20px 0' }}>
            <OfferBanner o={offer} />
          </div>
        )}
        {cityLobbies.length > 0 && (
          <>
            <div style={{ padding: '22px 20px 10px', display: 'flex', alignItems: 'center' }}>
              <H2 style={{ flex: 1 }}>Open lobbies in {app.cityName}</H2>
              <button onClick={openBoard} style={t(13, { w: 700, c: C.brand })}>
                See all
              </button>
            </div>
            <div className="hscroll" style={{ gap: 10, padding: '0 20px' }}>
              {cityLobbies.slice(0, 8).map((g) => (
                <LobbyCard key={g.id} g={g} onClick={openBoard} />
              ))}
            </div>
          </>
        )}
        {listHeader}
        {notices}
        {list}
      </div>
    </Shell>
  );
}

function SportChip({ label, img, on, fg, onClick }) {
  return (
    <button aria-pressed={on} onClick={onClick} style={{ width: 72, flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <span
        className="tap"
        style={{
          width: 68,
          height: 68,
          padding: 3,
          borderRadius: 22,
          background: on ? fg : '#fff',
          border: on ? 'none' : `1px solid ${C.line}`,
          boxShadow: on ? '0 8px 18px rgba(12,36,25,.18)' : undefined,
          transition: 'all 150ms',
        }}
      >
        <Img url={img} radius={18} />
      </span>
      <span style={{ marginTop: 6, ...t(12, { w: on ? 700 : 500, c: on ? fg : C.ink }) }}>{label}</span>
    </button>
  );
}

function OfferBanner({ o }) {
  return (
    <div style={{ position: 'relative', minHeight: 128, height: '100%', borderRadius: 22, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <Img url={o.image} fallback="stumps" />
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(10,40,22,.88) 0%, rgba(10,40,22,.55) 55%, rgba(10,40,22,0) 100%)' }} />
      <div style={{ position: 'relative', padding: 18 }}>
        <Pill bg={C.lime} fg={C.ink}>
          {o.tag ?? ''}
        </Pill>
        <div style={{ marginTop: 6, whiteSpace: 'pre-line', ...d(20, { c: '#fff', h: 1.15 }) }}>{o.title ?? ''}</div>
        <div style={{ marginTop: 6, ...t(12, { c: C.limeSoft }) }}>{o.subtitle ?? ''}</div>
      </div>
    </div>
  );
}

function LobbyCard({ g, onClick }) {
  const locked = g.slot_state === 'turf_locked';
  return (
    <button
      className="tap lift"
      onClick={onClick}
      style={{
        width: 236,
        height: 132,
        flex: 'none',
        padding: 12,
        borderRadius: 18,
        background: '#fff',
        border: `1px solid ${C.line}`,
        display: 'flex',
        flexDirection: 'column',
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
        <SportPill sport={asMap(g.sport)} />
        <Pill bg={locked ? C.mint : C.amberSoft} fg={locked ? C.green700 : C.amber} padding="3px 8px">
          {locked ? 'Turf locked' : 'Crowdfunding'}
        </Pill>
        <span style={{ flex: 1 }} />
        <span style={t(12, { w: 700, c: C.brand })}>{(g.per_head ?? 0) > 0 ? inr(g.per_head) : 'Free'}</span>
      </div>
      <div style={{ marginTop: 8, ...t(14, { w: 700 }) }}>
        {g.date_label} · {g.time_label}
      </div>
      <div className="clamp1" style={{ width: '100%', ...t(12, { c: C.muted }) }}>
        {g.venue?.name ?? ''}
      </div>
      <div style={{ flex: 1 }} />
      <div style={t(12, { w: 600, c: C.green700 })}>
        {g.spots_left} spot{g.spots_left === 1 ? '' : 's'} left · {g.taken}/{g.capacity} in
      </div>
    </button>
  );
}

export function VenueCard({ v, fav, onOpen, onFav }) {
  const km = v.distance_km;
  return (
    <div className="lift" style={{ position: 'relative', borderRadius: 24, background: '#fff', boxShadow: shadow.card, overflow: 'hidden' }}>
      <button onClick={onOpen} style={{ display: 'block', width: '100%', textAlign: 'left' }}>
        <div style={{ position: 'relative', height: 170, overflow: 'hidden' }}>
          <Img url={v.image} className="zoom" alt={v.name} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,.5) 100%)' }} />
          <div style={{ position: 'absolute', left: 12, top: 12, display: 'flex', gap: 6 }}>
            {v.is_fast_filling === true && (
              <Pill bg={C.lime} fg={C.ink}>
                Fast filling
              </Pill>
            )}
            {(v.open_lobbies ?? 0) > 0 && (
              <Pill bg="#fff" fg={C.green700}>
                {v.open_lobbies} open {v.open_lobbies === 1 ? 'lobby' : 'lobbies'}
              </Pill>
            )}
          </div>
          {km != null && (
            <div style={{ position: 'absolute', left: 12, bottom: 12, display: 'flex', alignItems: 'center', gap: 4, ...t(12, { w: 600, c: '#fff' }) }}>
              <MapPin size={14} color="#fff" /> {Number(km).toFixed(1)} km
            </div>
          )}
          <div
            style={{
              position: 'absolute',
              right: 12,
              bottom: 12,
              padding: '4px 8px',
              borderRadius: 8,
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              ...t(12, { w: 700 }),
            }}
          >
            <Star size={14} color={C.star} fill={C.star} /> {v.rating}
          </div>
        </div>
        <div style={{ padding: '14px 16px 16px' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={d(18, { h: 1.2 })}>{v.name}</div>
              <div style={{ marginTop: 2, ...t(13, { c: C.muted }) }}>
                {v.area} · {count(v.review_count)} reviews
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={t(12, { c: C.muted, h: 1.2 })}>from</div>
              <div>
                <span style={d(18, { c: C.brand })}>{inr(v.price_from)}</span>
                <span style={t(12, { c: C.muted })}>/hr</span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {asList(v.sports).map((sp) => (
              <SportPill key={sp.id ?? sp.name} sport={sp} size={12} />
            ))}
            {String(v.highlight ?? '') && (
              <Pill bg={C.chip} fg={C.muted} size={12}>
                {v.highlight}
              </Pill>
            )}
          </div>
        </div>
      </button>
      <button
        aria-label={fav ? 'Remove from favourites' : 'Save to favourites'}
        className="tap"
        onClick={onFav}
        style={{ position: 'absolute', top: 10, right: 10, width: 40, height: 40, borderRadius: 99, background: 'rgba(255,255,255,.95)', display: 'grid', placeItems: 'center' }}
      >
        <Heart size={19} color={C.rose} fill={fav ? C.rose : 'none'} />
      </button>
    </div>
  );
}

/** Sort & filter — the Flutter filter sheet. Also the sticky sidebar on desktop ([compact]). */
function FilterPanel({ initial, initialSort, amenities, onApply, compact }) {
  const [f, setF] = useState(initial);
  const [sort, setSort] = useState(initialSort);
  const lo = f.priceMin ?? PRICE_FLOOR,
    hi = f.priceMax ?? PRICE_CEIL;
  const today = new Date();
  const chip = (label, on, onClick) => (
    <Choice key={label} selected={on} height={compact ? 36 : 40} radius={12} padding="0 14px" onClick={onClick}>
      <span style={{ whiteSpace: 'nowrap', ...t(13, { w: 600, c: on ? '#fff' : C.ink }) }}>{label}</span>
    </Choice>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1, ...d(compact ? 19 : 22) }}>Sort & filter</div>
        {filterCount(f) > 0 && (
          <button onClick={() => setF(noFilters)} style={t(13, { w: 700, c: C.brand })}>
            Clear all
          </button>
        )}
      </div>
      <div style={{ margin: '14px 0 8px', ...t(13, { w: 600 }) }}>Sort by</div>
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(3, 1fr)', gap: 8 }}>
        {sortOrder.map((k) => (
          <Choice key={k} selected={sort === k} height={compact ? 40 : 48} onClick={() => setSort(k)}>
            <span style={t(13, { w: 700, c: sort === k ? '#fff' : C.ink })}>{sortLabels[k]}</span>
          </Choice>
        ))}
      </div>
      <div style={{ margin: '18px 0 8px', ...t(13, { w: 600 }) }}>Free slot on</div>
      <div className={compact ? undefined : 'hscroll'} style={{ display: 'flex', flexWrap: compact ? 'wrap' : undefined, gap: 8 }}>
        {Array.from({ length: 7 }, (_, i) =>
          chip(i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : eeeD(addDays(today, i)), f.dayOffset === i, () => setF({ ...f, dayOffset: f.dayOffset === i ? null : i })),
        )}
      </div>
      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {timeWindows.map((w, i) => chip(compact ? w[0] : `${w[0]} · ${fmtHour(w[1])}–${fmtHour(w[2])}`, f.window === i, () => setF({ ...f, window: f.window === i ? null : i })))}
      </div>
      <div style={{ marginTop: 18, display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1, ...t(13, { w: 600 }) }}>Price per hour</div>
        <div style={t(13, { w: 700, c: C.brand })}>
          {inr(lo)} – {hi >= PRICE_CEIL ? `${inr(PRICE_CEIL)}+` : inr(hi)}
        </div>
      </div>
      <DualRange lo={lo} hi={hi} onChange={(a, b) => setF({ ...f, priceMin: a <= PRICE_FLOOR ? null : a, priceMax: b >= PRICE_CEIL ? null : b })} />
      {amenities.length > 0 && (
        <>
          <div style={{ margin: '6px 0 8px', ...t(13, { w: 600 }) }}>Amenities</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {amenities.map((a) =>
              chip(a.name, f.amenities.includes(a.icon), () =>
                setF({ ...f, amenities: f.amenities.includes(a.icon) ? f.amenities.filter((x) => x !== a.icon) : [...f.amenities, a.icon] }),
              ),
            )}
          </div>
        </>
      )}
      <div style={{ height: 22 }} />
      <PrimaryButton height={compact ? 50 : 56} onClick={() => onApply(f, sort)}>
        Show results
      </PrimaryButton>
    </div>
  );
}

/** Two-thumb price slider (RangeSlider in Flutter), ₹100 steps. */
function DualRange({ lo, hi, onChange }) {
  const pct = (v) => ((v - PRICE_FLOOR) / (PRICE_CEIL - PRICE_FLOOR)) * 100;
  const thumb = { position: 'absolute', inset: 0, width: '100%', background: 'transparent', pointerEvents: 'none', appearance: 'none', WebkitAppearance: 'none', height: 36 };
  return (
    <div style={{ position: 'relative', height: 36, margin: '4px 0 8px' }}>
      <style>{`.dr::-webkit-slider-thumb{pointer-events:auto;-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:${C.brand};border:3px solid #fff;box-shadow:0 2px 6px rgba(12,36,25,.3);cursor:pointer}.dr::-moz-range-thumb{pointer-events:auto;width:18px;height:18px;border-radius:50%;background:${C.brand};border:3px solid #fff;box-shadow:0 2px 6px rgba(12,36,25,.3);cursor:pointer}.dr::-webkit-slider-runnable-track{background:transparent}.dr::-moz-range-track{background:transparent}`}</style>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 16, height: 4, borderRadius: 4, background: C.segment }} />
      <div style={{ position: 'absolute', top: 16, height: 4, borderRadius: 4, background: C.brand, left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
      <input
        className="dr"
        aria-label="Minimum price"
        type="range"
        min={PRICE_FLOOR}
        max={PRICE_CEIL}
        step={100}
        value={lo}
        onChange={(e) => onChange(Math.min(Number(e.target.value), hi - 100), hi)}
        style={thumb}
      />
      <input
        className="dr"
        aria-label="Maximum price"
        type="range"
        min={PRICE_FLOOR}
        max={PRICE_CEIL}
        step={100}
        value={hi}
        onChange={(e) => onChange(lo, Math.max(Number(e.target.value), lo + 100))}
        style={thumb}
      />
    </div>
  );
}
