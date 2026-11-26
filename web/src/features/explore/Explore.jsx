/** 1 · Home / Discovery: auto-expanding radius, sport pills, search, sort & filter (date + time window, price,
 *  amenities), venue cards with open-lobby counts and the city lobby board.
 *  Phone = dark band + Turfs/Matches tabs + green panel (redesign). Desktop = hero + sticky filter sidebar + venue grid. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpDown, LocateFixed, Radar } from 'lucide-react';
import { ChevronDown, Heart, MapPin, Search, SlidersHorizontal, Star, Tag, Zap } from '../../ui/icons';
import { useSession } from '../../app/session';
import { routes, useRequireLogin } from '../../app/nav';
import { Shell } from '../../app/Shell';
import { asList, asMap, errText } from '../../lib/api';
import { lobbyRepo, venueRepo } from '../../lib/repos';
import { ART, sportThumb } from '../../lib/art';
import { addDays, count, eeeD, fmtHour, inr, ymd } from '../../lib/format';
import { C, d, shadow, t } from '../../theme';
import { useIsDesktop } from '../../ui/hooks';
import { useOverlay } from '../../ui/overlay';
import { CardBox, Choice, ErrorRetry, H2, Img, Pill, PrimaryButton, Sk, SportPill } from '../../ui/kit';
import { Band, BookingsButton, Panel, PanelHeadline, ProfileButton, RatingBadge, Rule, Script, SectionTabs, UnderlineTabs } from '../../ui/brand';

const sortOrder = ['near', 'price', 'rating'];
const sortLabels = { near: 'Nearest', price: 'Lowest price', rating: 'Top rated' };
const sortTabs = { near: ['NEARBY', MapPin], price: ['BUDGET', Tag], rating: ['TOP RATED', Star] };
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

  // No area picked yet (a first visit straight to /home, or a search-engine crawler): list every venue
  // instead of bouncing to /location, so the page has real content and can be indexed.
  useEffect(() => {
    load();
    venueRepo.amenities().then(setAmenities, () => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.areaId]);

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
  const city = app.cityName || app.areaName || 'Choose your location';

  const sportChips = (
    <div className="hscroll" style={{ gap: 16, padding: '2px 0 8px' }}>
      {app.sports.map((sp) => (
        <span key={sp.id} style={{ width: 84, flex: 'none' }}>
          <SportDisc label={sp.name} img={sportThumb(sp.name, sp.image)} on={sportId === sp.id} onClick={() => pickSport(sportId === sp.id ? null : sp.id)} />
        </span>
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
        <div style={{ display: 'grid', gridTemplateColumns: desktop ? 'repeat(auto-fill, minmax(300px, 1fr))' : '1fr', gap: desktop ? 22 : 18, padding: desktop ? 0 : '0 16px' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: desktop ? 'repeat(auto-fill, minmax(300px, 1fr))' : '1fr', gap: desktop ? 22 : 18, padding: desktop ? 0 : '0 16px' }}>
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

  const firstName = String(app.user?.name ?? '').trim().split(' ')[0];
  const night = filters.amenities.includes('floodlights');
  const toggleNight = () =>
    applyFilters({ ...filters, amenities: night ? filters.amenities.filter((x) => x !== 'floodlights') : [...filters.amenities, 'floodlights'] }, sort);
  const topRated = venues && venues.length >= 3 ? [...venues].sort((x, y) => (y.rating ?? 0) - (x.rating ?? 0)).slice(0, 6) : [];
  const live = cityLobbies.length;

  return (
    <Shell>
      <Band
        title={app.areaName || app.cityName || 'Choose location'}
        subtitle={app.areaName && app.cityName ? app.cityName : 'Tap to pick your area'}
        onTitle={() => nav('/location')}
        right={
          <>
            {app.loggedIn && <BookingsButton />}
            <ProfileButton />
          </>
        }
      >
        <SectionTabs active={0} badge={live > 0 ? `${live} LIVE` : null} />
        <Panel flat>
          <div style={{ display: 'flex', gap: 10 }}>
            <label style={{ flex: 1, minWidth: 0, height: 56, padding: '0 14px', borderRadius: 18, background: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Search size={22} color={C.mutedInk} />
              <input type="search" aria-label="Search" placeholder="Search turfs, courts, venues" onChange={(e) => onSearch(e.target.value)} style={t(15)} />
            </label>
            <button
              aria-pressed={night}
              aria-label="Floodlit venues only"
              className="tap"
              onClick={toggleNight}
              style={{ flex: 'none', width: 66, height: 56, borderRadius: 18, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}
            >
              <span style={t(11, { w: 800, c: C.mutedInk, ls: 0.6, h: 1 })}>NIGHT</span>
              <span style={{ position: 'relative', width: 34, height: 18, borderRadius: 999, background: night ? C.green700 : C.dotOff, transition: 'background 160ms' }}>
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: night ? 18 : 2,
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: '#fff',
                    border: `2px solid ${night ? C.green700 : C.dotOff}`,
                    transition: 'left 160ms',
                  }}
                />
              </span>
            </button>
          </div>
          <UnderlineTabs items={sortOrder.map((k) => ({ label: sortTabs[k][0], icon: sortTabs[k][1] }))} index={sortOrder.indexOf(sort)} onChange={(i) => { setSort(sortOrder[i]); load({ sort: sortOrder[i] }); }} />
          <PanelHeadline size={34}>
            {firstName ? (
              <>
                Game on, <Script>{firstName}!</Script>
              </>
            ) : (
              <>
                Ready to <Script>play?</Script>
              </>
            )}
          </PanelHeadline>
          <PromoGrid offer={offer.enabled === true ? offer : null} live={live} onLobbies={() => nav(routes.matches)} onSquad={() => nav(routes.matches)} />
        </Panel>
      </Band>

      <main style={{ display: 'flex', flexDirection: 'column', gap: 28, padding: '24px 0 0' }}>
        {app.sports.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Rule style={{ padding: '0 16px' }}>{firstName ? `${firstName}, what are we playing?` : 'What are we playing?'}</Rule>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '16px 8px', padding: '0 16px' }}>
              {app.sports.map((sp) => (
                <SportDisc key={sp.id} label={sp.name} img={sportThumb(sp.name, sp.image)} on={sportId === sp.id} onClick={() => pickSport(sportId === sp.id ? null : sp.id)} />
              ))}
            </div>
          </section>
        )}

        {topRated.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: '0 16px', ...d(19, { ls: -0.4 }) }}>Top rated near you</div>
            <div className="hscroll" style={{ gap: 12, padding: '0 16px' }}>
              {topRated.map((v) => (
                <RailCard key={v.id} v={v} onClick={() => nav(routes.venue(v.id))} />
              ))}
            </div>
          </section>
        )}

        <section id="venues" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Rule style={{ padding: '0 16px' }}>{venues == null ? 'All venues around you' : `${venues.length} venue${venues.length === 1 ? '' : 's'} around you`}</Rule>
          <div className="hscroll" style={{ gap: 8, padding: '0 16px' }}>
            <ChipButton onClick={openFilters} on={fc > 0}>
              <SlidersHorizontal size={16} color={C.brand} /> Filters{fc > 0 ? ` · ${fc}` : ''}
            </ChipButton>
            <ChipButton onClick={cycleSort}>
              {sortLabels[sort]} <ChevronDown size={16} />
            </ChipButton>
            {fc > 0 && <ChipButton onClick={clearFilters}>Clear filters</ChipButton>}
            {radius.label && (
              <ChipButton on>
                <Radar size={15} color={C.brand} /> {radius.label}
              </ChipButton>
            )}
          </div>
          {radius.notice && venues && (
            <div style={{ margin: '0 16px', padding: '10px 12px', borderRadius: 12, background: C.blueSoft, display: 'flex', gap: 8, alignItems: 'center', ...t(13, { c: C.blueInk }) }}>
              <LocateFixed size={16} color={C.blue} /> {radius.notice}
            </div>
          )}
          <div style={{ padding: '4px 0 0' }}>{list}</div>
        </section>

        <footer style={{ padding: '28px 20px 40px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={d(40, { c: '#D9DED8', h: 1, ls: -1.6 })}>
            Play more,
            <br />
            wait less.
          </div>
          <div style={t(12.5, { w: 600, c: C.muted })}>Made for weekend warriors{app.cityName ? ` in ${app.cityName}` : ''}</div>
        </footer>
      </main>
    </Shell>
  );
}

const ChipButton = ({ children, onClick, on }) => (
  <button
    className={onClick ? 'tap' : undefined}
    onClick={onClick}
    style={{
      flex: 'none',
      height: 38,
      padding: '0 12px',
      borderRadius: 12,
      border: `1px solid ${on ? C.brand : C.chipLine}`,
      background: on ? C.mint : '#fff',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      ...t(13, { w: 700, c: on ? C.brand : C.ink }),
    }}
  >
    {children}
  </button>
);

/** Dark-green promo tiles in the panel: the admin offer (big), live lobbies and squad split. */
function PromoGrid({ offer, live, onLobbies, onSquad }) {
  const tile = { position: 'relative', borderRadius: 22, background: C.green900, overflow: 'hidden', padding: 14, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2 };
  const round = (src) => (
    <span style={{ position: 'absolute', right: -8, bottom: -8, width: 74, height: 74, borderRadius: '50%', overflow: 'hidden', border: `3px solid ${C.brand}` }}>
      <Img url={src} />
    </span>
  );
  const lobbies = (
    <button className="tap" onClick={onLobbies} style={{ ...tile, minHeight: 138 }}>
      <span style={{ maxWidth: 110, ...d(16, { c: C.sun, h: 1.1, ls: -0.3 }) }}>{live > 0 ? `${live} open lobbies` : 'Open lobbies'}</span>
      <span style={{ maxWidth: 90, ...t(12, { w: 600, c: C.panelInk }) }}>Join solo, pay your share</span>
      {round(ART.indoor)}
    </button>
  );
  const squad = (
    <button className="tap" onClick={onSquad} style={{ ...tile, minHeight: 138 }}>
      <span style={{ maxWidth: 100, ...d(16, { c: C.sun, h: 1.1, ls: -0.3 }) }}>Split with squad</span>
      <span style={{ maxWidth: 90, ...t(12, { w: 600, c: C.panelInk }) }}>Pay only your share</span>
      {round(ART.training)}
    </button>
  );
  if (!offer) return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>{lobbies}{squad}</div>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gridTemplateRows: '138px 138px', gap: 10 }}>
      <div style={{ ...tile, gridRow: 'span 2', padding: 16, gap: 4 }}>
        {offer.tag && <span style={t(11, { w: 800, c: C.panelInk, ls: 1.2 })}>{String(offer.tag).toUpperCase()}</span>}
        <span style={{ whiteSpace: 'pre-line', ...d(22, { c: C.sun, h: 1.05, ls: -0.6 }) }}>{offer.title ?? ''}</span>
        <span style={t(13, { w: 600, c: C.panelInk })}>{offer.subtitle ?? ''}</span>
        <span style={{ position: 'absolute', left: 34, right: -10, bottom: -10, height: 150, borderRadius: '22px 0 0 0', overflow: 'hidden' }}>
          <Img url={offer.image || ART.floodlit} fallback="turf-night" />
        </span>
      </div>
      {lobbies}
      {squad}
    </div>
  );
}

/** Round sport photo with a forest ring when picked. */
function SportDisc({ label, img, on, onClick }) {
  return (
    <button aria-pressed={on} onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <span className="tap" style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', boxShadow: on ? `0 0 0 3px ${C.brand}` : undefined, transition: 'box-shadow 150ms' }}>
        <Img url={img} />
      </span>
      <span className="clamp1" style={{ maxWidth: '100%', ...t(12.5, { w: on ? 800 : 700, c: on ? C.ink : C.mutedInk }) }}>
        {label}
      </span>
    </button>
  );
}

function RailCard({ v, onClick }) {
  return (
    <button onClick={onClick} style={{ flex: 'none', width: 152, display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
      <span className="tap" style={{ position: 'relative', height: 152, borderRadius: 18, overflow: 'hidden' }}>
        <Img url={v.image} alt={v.name} />
        {(v.highlight || v.is_fast_filling) && (
          <span
            className="clamp1"
            style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '22px 10px 8px', background: 'linear-gradient(180deg, rgba(12,36,25,0) 0%, rgba(12,36,25,.88) 100%)', ...t(13, { w: 800, c: '#fff' }) }}
          >
            {v.highlight || 'Fast filling'}
          </span>
        )}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 2px' }}>
        <span className="clamp1" style={t(15, { w: 800 })}>
          {v.name}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, ...t(13, { w: 700 }) }}>
          <span style={{ width: 17, height: 17, borderRadius: '50%', background: C.green700, display: 'grid', placeItems: 'center' }}>
            <Star size={10} color="#fff" fill="#fff" />
          </span>
          {v.rating}
          {v.distance_km != null ? ` · ${Number(v.distance_km).toFixed(1)} km` : ''}
        </span>
        <span className="clamp1" style={t(12.5, { c: C.muted })}>
          {asList(v.sports)
            .map((x) => x.name)
            .join(' · ')}
        </span>
      </span>
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
  const lobbies = v.open_lobbies ?? 0;
  const sports = asList(v.sports)
    .map((x) => x.name)
    .join(' · ');
  return (
    <article className="lift" style={{ position: 'relative', borderRadius: 22, background: '#fff', border: '1px solid #F0EEE8', boxShadow: '0 1px 2px rgba(12,36,25,.05), 0 6px 20px rgba(12,36,25,.07)', overflow: 'hidden' }}>
      <button onClick={onOpen} style={{ display: 'block', width: '100%', textAlign: 'left' }}>
        <div style={{ position: 'relative', height: 190, overflow: 'hidden' }}>
          <Img url={v.image} className="zoom" alt={v.name} />
          {(lobbies > 0 || v.is_fast_filling === true) && (
            <span
              style={{ position: 'absolute', top: 12, left: 12, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: '#fff', ...t(11.5, { w: 800, h: 1.2 }) }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.coral, filter: 'drop-shadow(0 0 5px rgba(242,85,44,.6))' }} />
              {lobbies > 0 ? `${lobbies} open ${lobbies === 1 ? 'lobby' : 'lobbies'}` : 'Fast filling'}
            </span>
          )}
          {String(v.highlight ?? '') && (
            <span
              className="clamp1"
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '30px 16px 12px', background: 'linear-gradient(180deg, rgba(12,36,25,0) 0%, rgba(12,36,25,.88) 100%)', ...d(20, { c: '#fff', ls: -0.5 }) }}
            >
              {v.highlight}
            </span>
          )}
        </div>
        <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span className="clamp1" style={d(18, { ls: -0.4 })}>
              {v.name}
            </span>
            <RatingBadge value={v.rating} />
          </div>
          {sports && <div style={t(13.5, { w: 600, c: C.mutedInk })}>{sports}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, ...t(13, { c: C.muted }) }}>
            <MapPin size={15} color={C.muted} />
            {km != null ? `${Number(km).toFixed(1)} km · ` : ''}
            {v.area}
          </div>
          <div style={{ margin: '6px 0 4px', borderTop: `1.5px dashed ${C.hair}` }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, ...t(13, { w: 700, c: C.green700 }) }}>
              <Zap size={16} color={C.coral} fill={C.coral} strokeWidth={0} />
              {count(v.review_count)} ratings
            </span>
            <span style={t(14, { w: 800 })}>
              from {inr(v.price_from)}
              <span style={t(12, { w: 600, c: C.muted })}>/hr</span>
            </span>
          </div>
        </div>
      </button>
      <button
        aria-label={fav ? `Remove ${v.name} from saved` : `Save ${v.name}`}
        className="tap"
        onClick={onFav}
        style={{ position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,.95)', display: 'grid', placeItems: 'center' }}
      >
        <Heart size={19} color={fav ? C.coral : C.brand} fill={fav ? C.coral : 'none'} strokeWidth={1.8} />
      </button>
    </article>
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
