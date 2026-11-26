/** 2 · Venue profile: photos, facts, sports, amenities, rules, cancellation policy, location → slot matrix.
 *  Phone = photo hero + green info panel + sticky "See free slots" (redesign). Desktop = photo mosaic + content with a sticky booking card. */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Armchair, Bath, CalendarClock, Cross, Droplet, Dumbbell, Umbrella, UserPlus, Wifi } from 'lucide-react';
import { Check, ChevronLeft, Clock, Coffee, Heart, Lightbulb, MapPin, Share2, Shirt, SquareParking, Star } from '../../ui/icons';
import { useSession } from '../../app/session';
import { useBack, useRequireLogin } from '../../app/nav';
import { Shell } from '../../app/Shell';
import { asList, errText } from '../../lib/api';
import { venueRepo } from '../../lib/repos';
import { sportScene } from '../../lib/art';
import { count, inr } from '../../lib/format';
import { useSeo } from '../../lib/seo';
import { venueSeo } from '../../lib/seoData';
import { C, d, hex, shadow, t } from '../../theme';
import { useData, useIsDesktop } from '../../ui/hooks';
import { useOverlay } from '../../ui/overlay';
import { BackSquare, CardBox, ErrorRetry, GhostButton, H2, Img, Pill, PrimaryButton, Sk, SquareIconButton } from '../../ui/kit';
import { Disc, GoButton, Panel, PanelTile, Rule, StickyBar } from '../../ui/brand';

export const amenityIcons = {
  parking: SquareParking,
  floodlights: Lightbulb,
  covered: Umbrella,
  washroom: Bath,
  water: Droplet,
  changing: Shirt,
  equipment: Dumbbell,
  wifi: Wifi,
  cafe: Coffee,
  first_aid: Cross,
  seating: Armchair,
};

export const openMaps = (v) => {
  const q = v.lat != null && v.lng != null ? `${v.lat},${v.lng}` : encodeURIComponent(`${v.name} ${v.address}`);
  window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank', 'noopener');
};

export default function VenueDetails() {
  const id = Number(useParams().venueId);
  const app = useSession();
  const nav = useNavigate();
  const back = useBack();
  const desktop = useIsDesktop();
  const { toast } = useOverlay();
  const requireLogin = useRequireLogin();
  const {
    data: v,
    error,
    retry,
  } = useData(async () => {
    const r = await venueRepo.details(id);
    app.markSaved(id, r.is_saved === true);
    return r;
  }, [id]);
  const [photo, setPhoto] = useState(0);
  const [sportIdx, setSportIdx] = useState(0);
  useSeo(v ? venueSeo(v) : null);

  if (error)
    return (
      <Shell>
        <ErrorRetry message={error} onRetry={retry} />
      </Shell>
    );
  if (!v)
    return (
      <Shell>
        <VenueSkeleton desktop={desktop} />
      </Shell>
    );

  const photos = asList(v.photos).map(String).filter(Boolean);
  const allPhotos = photos.length ? photos : [v.image];
  const sports = asList(v.venue_sports);
  const cur = sports.length ? sports[Math.min(sportIdx, sports.length - 1)] : null;
  const fav = app.saved.has(v.id);
  const hero = allPhotos[Math.min(photo, allPhotos.length - 1)];

  const toggleFav = async () => {
    if (!requireLogin()) return;
    app.markSaved(v.id, !fav);
    try {
      const r = await venueRepo.toggleSaved(v.id);
      app.markSaved(v.id, r.is_saved === true);
    } catch (e) {
      toast(errText(e));
    }
  };
  const share = async () => {
    const text = `${v.name} on Turflet — ${v.address}`;
    try {
      if (navigator.share) await navigator.share({ title: v.name, text, url: window.location.href });
      else {
        await navigator.clipboard.writeText(`${text}\n${window.location.href}`);
        toast('Link copied');
      }
    } catch {
      /* cancelled */
    }
  };
  const lobbies = v.open_lobbies ?? 0;
  const openLobbies = () => nav(`/lobbies?venue=${v.id}&subtitle=${encodeURIComponent(`${v.name} · ${v.area}`)}`);
  const checkSlots = cur ? () => nav(`/book?venue=${v.id}&sport=${cur.sport_id}`) : undefined;

  const favBtn = (
    <button
      aria-label="Save to favourites"
      className="tap"
      onClick={toggleFav}
      style={{
        width: 44,
        height: 44,
        borderRadius: 14,
        background: 'rgba(255,255,255,.95)',
        border: desktop ? `1px solid ${C.line}` : 'none',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <Heart size={18} color={C.rose} fill={fav ? C.rose : 'none'} />
    </button>
  );

  const titleBlock = (
    <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {v.is_fast_filling === true && (
          <Pill bg={C.lime} fg={C.ink}>
            Fast filling
          </Pill>
        )}
        <Pill>Open · {v.hours_label}</Pill>
      </div>
      <h1 style={{ margin: '8px 0 0', ...d(desktop ? 36 : 26, { h: 1.15, ls: desktop ? -0.8 : -0.4 }) }}>{v.name}</h1>
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, ...t(14, { c: C.muted }) }}>
        <Star size={16} color={C.star} fill={C.star} />
        <span>
          <b style={{ color: C.ink }}>{v.rating}</b> ({v.review_count} reviews) · {v.area}
          {v.distance_km != null ? ` · ${v.distance_km} km` : ''}
        </span>
      </div>
    </>
  );

  const content = (
    <>
      <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <Fact k="Surface" v={v.surface} />
        <Fact k="Size" v={v.size} />
        <Fact k="Courts" v={`${v.court_count} ${v.court_count === 1 ? 'court' : 'courts'}`} />
      </div>
      <H2 style={{ margin: '20px 0 10px' }}>Sports available</H2>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${desktop ? Math.min(Math.max(sports.length, 1), 3) : Math.min(Math.max(sports.length, 1), 3)}, 1fr)`, gap: 10 }}>
        {sports.slice(0, desktop ? 6 : 3).map((sp, i) => (
          <SportTile key={sp.sport_id ?? i} sp={sp} on={i === sportIdx} onClick={() => setSportIdx(i)} />
        ))}
      </div>
      <H2 style={{ margin: '20px 0 10px' }}>Amenities</H2>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${desktop ? 5 : 3}, 1fr)`, gap: 10 }}>
        {asList(v.amenities).map((a) => {
          const I = amenityIcons[a.icon] ?? Check;
          return (
            <CardBox key={a.name} padding={0} radius={16} style={{ aspectRatio: '1.35', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ width: 34, height: 34, borderRadius: 10, background: hex(a.bg), display: 'grid', placeItems: 'center' }}>
                <I size={18} color={hex(a.fg)} />
              </span>
              <span style={{ marginTop: 6, ...t(12, { w: 500 }) }}>{a.name}</span>
            </CardBox>
          );
        })}
      </div>
      {String(v.about ?? '') && (
        <>
          <H2 style={{ margin: '20px 0 8px' }}>About</H2>
          <p style={{ margin: 0, ...t(14, { c: C.muted, h: 1.6 }) }}>{v.about}</p>
        </>
      )}
      {asList(v.rules).length > 0 && (
        <div style={{ marginTop: 20, padding: 16, borderRadius: 18, background: C.orangeBg, border: `1px solid ${C.orangeSoft}` }}>
          <H2 size={16} color={C.orangeInk}>
            Venue rules
          </H2>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, ...t(14, { c: C.orangeDeep, h: 1.7 }) }}>
            {v.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      {asList(v.cancellation_policy).length > 0 && (
        <>
          <H2 style={{ margin: '20px 0 10px' }}>Cancellation policy</H2>
          <CardBox padding="6px 14px" radius={18}>
            {asList(v.cancellation_policy).map((r, i) => {
              const ok = (r.percent ?? 0) > 0;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                  <span
                    style={{
                      width: 46,
                      padding: '6px 0',
                      borderRadius: 10,
                      textAlign: 'center',
                      background: ok ? C.mint : C.redSoft,
                      ...t(13, { w: 700, c: ok ? C.green700 : C.redInk }),
                    }}
                  >
                    {r.percent}%
                  </span>
                  <div>
                    <div style={t(14, { w: 600 })}>{r.title ?? ''}</div>
                    <div style={t(12, { c: C.muted })}>{r.subtitle ?? ''}</div>
                  </div>
                </div>
              );
            })}
            <div style={{ padding: '4px 0 8px', ...t(12, { c: C.muted, h: 1.4 }) }}>Rain or venue cancellation: 100% refund to everyone who paid.</div>
          </CardBox>
        </>
      )}
      <H2 style={{ margin: '20px 0 10px' }}>Location</H2>
      <CardBox padding={0} radius={18} style={{ overflow: 'hidden' }}>
        <div
          style={{
            height: desktop ? 180 : 120,
            display: 'grid',
            placeItems: 'center',
            backgroundColor: '#E8F0E4',
            backgroundImage: 'linear-gradient(#D7E2D2 1px, transparent 1px), linear-gradient(90deg, #D7E2D2 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        >
          <MapPin size={40} color={C.brand} fill={C.brand} stroke="#E8F0E4" />
        </div>
        <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, ...t(13, { c: C.muted, h: 1.4 }) }}>{v.address ?? ''}</div>
          <GhostButton height={40} radius={12} bg={C.mint} fg={C.green700} border="transparent" fontSize={13} onClick={() => openMaps(v)}>
            Directions
          </GhostButton>
        </div>
      </CardBox>
    </>
  );

  const priceLine = (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
      <span className="clamp1" style={t(13, { c: C.muted })}>
        {cur?.name ?? ''} from&nbsp;
      </span>
      <span style={d(22)}>{inr(cur?.price ?? v.price_from)}</span>
      <span style={t(13, { c: C.muted })}>&nbsp;/hr</span>
    </div>
  );
  const lobbyBtn = lobbies > 0 && (
    <GhostButton icon={UserPlus} height={52} bg={C.limeSoft} fg={C.green900} border="transparent" onClick={openLobbies} style={{ flex: 1 }}>
      {lobbies} open {lobbies === 1 ? 'lobby' : 'lobbies'}
    </GhostButton>
  );
  const slotsBtn = (
    <PrimaryButton height={52} radius={16} fontSize={15} trailing={<CalendarClock size={18} color="#fff" />} onClick={checkSlots}>
      Check slots
    </PrimaryButton>
  );

  if (desktop) {
    const thumbs = allPhotos.slice(1, 5);
    return (
      <Shell>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <BackSquare onClick={back} />
          <div style={{ flex: 1 }} />
          <SquareIconButton icon={Share2} iconSize={18} label="Share" onClick={share} />
          {favBtn}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: thumbs.length ? '2fr 1fr' : '1fr', gap: 10, height: 440, borderRadius: 28, overflow: 'hidden' }}>
          <button onClick={() => setPhoto(0)} style={{ overflow: 'hidden' }}>
            <Img url={hero} alt={v.name} />
          </button>
          {thumbs.length > 0 && (
            <div style={{ display: 'grid', gridTemplateRows: `repeat(${Math.min(thumbs.length, 2)}, 1fr)`, gridTemplateColumns: thumbs.length > 2 ? '1fr 1fr' : '1fr', gap: 10 }}>
              {thumbs.map((p, i) => (
                <button
                  key={p + i}
                  className="tap"
                  onClick={() => setPhoto(i + 1)}
                  style={{ overflow: 'hidden', outline: photo === i + 1 ? `3px solid ${C.coral}` : undefined, outlineOffset: -3 }}
                >
                  <Img url={p} />
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: '1fr 380px', gap: 40, alignItems: 'start' }}>
          <div style={{ minWidth: 0 }}>
            {titleBlock}
            {content}
          </div>
          <aside style={{ position: 'sticky', top: 96 }}>
            <CardBox padding={24} radius={24} shadowCss={shadow.big}>
              {priceLine}
              <div style={{ marginTop: 6, ...t(13, { c: C.muted }) }}>Live slots by court and hour. Pay securely, get a QR pass.</div>
              <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
                {slotsBtn}
                {lobbyBtn}
              </div>
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.line}`, display: 'grid', gap: 10 }}>
                {sports.map((sp, i) => (
                  <button key={sp.sport_id ?? i} onClick={() => setSportIdx(i)} style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 99, background: i === sportIdx ? hex(sp.fg) : C.dotOff }} />
                    <span style={{ flex: 1, ...t(14, { w: i === sportIdx ? 700 : 500 }) }}>{sp.name}</span>
                    <span style={t(14, { w: 700 })}>{inr(sp.price)}</span>
                    <span style={t(12, { c: C.muted })}>/hr</span>
                  </button>
                ))}
              </div>
            </CardBox>
          </aside>
        </div>
      </Shell>
    );
  }

  const round = { width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,.95)', display: 'grid', placeItems: 'center' };
  const policy = asList(v.cancellation_policy);
  return (
    <div className="page" style={{ minHeight: '100dvh', paddingBottom: 'calc(110px + var(--safe-bottom))' }}>
      <div style={{ position: 'relative', height: 'calc(300px + var(--safe-top))', background: C.brandDark }}>
        <Img key={hero} url={hero} alt={v.name} style={{ animation: 'fadeIn 250ms' }} />
        <span
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(11,42,29,.55) 0%, rgba(11,42,29,0) 34%, rgba(11,42,29,0) 60%, rgba(11,42,29,.9) 100%)',
          }}
        />
        <div style={{ position: 'absolute', top: 'calc(var(--safe-top) + 18px)', left: 16, right: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button aria-label="Back" className="tap" onClick={back} style={round}>
            <ChevronLeft size={22} color={C.ink} strokeWidth={2.2} />
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button aria-label="Share venue" className="tap" onClick={share} style={round}>
              <Share2 size={20} color={C.ink} strokeWidth={1.9} />
            </button>
            <button aria-label={fav ? 'Remove from saved' : 'Save venue'} className="tap" onClick={toggleFav} style={round}>
              <Heart size={20} color={fav ? C.coral : C.ink} fill={fav ? C.coral : 'none'} strokeWidth={1.9} />
            </button>
          </div>
        </div>
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
          {lobbies > 0 ? (
            <button
              className="tap"
              onClick={openLobbies}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: '#fff', ...t(11.5, { w: 800, h: 1.2 }) }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.coral }} />
              {lobbies} open {lobbies === 1 ? 'lobby' : 'lobbies'}
            </button>
          ) : v.is_fast_filling === true ? (
            <span style={{ padding: '6px 10px', borderRadius: 999, background: '#fff', ...t(11.5, { w: 800, h: 1.2 }) }}>Fast filling</span>
          ) : (
            <span />
          )}
          {allPhotos.length > 1 && (
            <button
              onClick={() => setPhoto((photo + 1) % allPhotos.length)}
              style={{ padding: '5px 10px', borderRadius: 999, background: 'rgba(12,36,25,.75)', ...t(12, { w: 700, c: '#fff', h: 1.2 }) }}
            >
              {photo + 1} / {allPhotos.length} photos
            </button>
          )}
        </div>
      </div>

      <div style={{ position: 'relative', marginTop: -28 }}>
        <Panel padding="22px 18px 20px" gap={14}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              <h1 style={{ margin: 0, ...d(28, { c: '#fff', ls: -0.9, h: 1.1 }) }}>{v.name}</h1>
              <div style={t(13.5, { w: 600, c: C.panelInk })}>{sports.map((x) => x.name).join(' · ')}</div>
            </div>
            <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '5px 10px', background: C.green700, ...t(14, { w: 800, c: '#fff', h: 1.2 }) }}>
                {v.rating} <Star size={12} color="#fff" fill="#fff" />
              </span>
              <span style={{ padding: '4px 8px', ...t(10.5, { w: 700, c: C.mutedInk, h: 1.2 }) }}>{count(v.review_count)} ratings</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.14)' }}>
            <button onClick={() => openMaps(v)} style={{ display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', ...t(13.5, { c: '#fff' }) }}>
              <MapPin size={18} color={C.sun} style={{ flex: 'none' }} />
              {v.distance_km != null && <b style={{ fontWeight: 800, flex: 'none', whiteSpace: 'nowrap' }}>{v.distance_km} km</b>}
              <span className="clamp1" style={{ color: C.panelInk }}>
                {v.distance_km != null ? '· ' : ''}
                {v.address || v.area}
              </span>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...t(13.5, { c: '#fff' }) }}>
              <Clock size={18} color={C.sun} style={{ flex: 'none' }} />
              <b style={{ fontWeight: 800 }}>Open</b>
              <span style={{ color: C.panelInk }}>· {v.hours_label}</span>
            </div>
          </div>
          {(v.surface || v.size || v.court_count) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              {[
                [v.surface, 'SURFACE'],
                [v.size || `${v.court_count} ${v.court_count === 1 ? 'court' : 'courts'}`, v.size ? 'SIZE' : 'COURTS'],
              ]
                .filter((x) => x[0])
                .map(([val, k]) => (
                  <PanelTile key={k} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className="clamp1" style={d(16, { c: C.sun, ls: -0.3 })}>
                      {val}
                    </span>
                    <span style={t(11.5, { w: 700, c: C.panelInk, ls: 0.3 })}>{k}</span>
                  </PanelTile>
                ))}
            </div>
          )}
        </Panel>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 26, padding: '24px 16px' }}>
        {asList(v.amenities).length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Rule>Amenities</Rule>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '14px 10px' }}>
              {asList(v.amenities).map((a) => (
                <div key={a.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <Disc icon={amenityIcons[a.icon] ?? Check} size={60} iconSize={26} />
                  <span style={{ textAlign: 'center', ...t(12, { w: 700, c: C.mutedInk }) }}>{a.name}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {sports.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column' }}>
            <Rule style={{ marginBottom: 4 }}>Pick a sport</Rule>
            {sports.map((sp, i) => (
              <div key={sp.sport_id ?? i} style={{ display: 'flex', gap: 14, padding: '18px 0', borderBottom: `1px solid ${C.hair}` }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {i === sportIdx && (
                    <span style={{ alignSelf: 'flex-start', padding: '3px 8px', borderRadius: 6, background: C.mint, ...t(11, { w: 800, c: C.brand, h: 1.2 }) }}>SELECTED</span>
                  )}
                  <span style={d(17, { ls: -0.3 })}>{sp.name}</span>
                  <span style={t(15, { w: 800 })}>
                    {inr(sp.price)}/hr{' '}
                    {(sp.peak_surcharge ?? 0) > 0 && <span style={t(12.5, { w: 600, c: C.muted })}>+{inr(sp.peak_surcharge)} peak</span>}
                  </span>
                  {sp.meta && <span style={t(13, { c: C.muted, h: 1.45 })}>{sp.meta}</span>}
                  {sp.max_players ? <span style={t(12.5, { w: 600, c: C.mutedInk })}>Up to {sp.max_players} players</span> : null}
                </div>
                <div style={{ position: 'relative', width: 128, flex: 'none', paddingBottom: 18 }}>
                  <span style={{ display: 'block', width: 128, height: 122, borderRadius: 18, overflow: 'hidden' }}>
                    <Img url={sportScene(sp.name)} alt={sp.name} />
                  </span>
                  <button
                    className="tap"
                    onClick={() => {
                      setSportIdx(i);
                      nav(`/book?venue=${v.id}&sport=${sp.sport_id}`);
                    }}
                    style={{
                      position: 'absolute',
                      left: 12,
                      right: 12,
                      bottom: 0,
                      height: 38,
                      borderRadius: 12,
                      background: '#fff',
                      border: `1px solid ${C.hair}`,
                      boxShadow: '0 1px 2px rgba(12,36,25,.05), 0 6px 20px rgba(12,36,25,.07)',
                      ...t(14, { w: 800, c: C.brand, ls: 0.5 }),
                    }}
                  >
                    SELECT
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        {String(v.about ?? '') && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Rule>About</Rule>
            <p style={{ margin: 0, ...t(14, { c: C.muted, h: 1.6 }) }}>{v.about}</p>
          </section>
        )}

        {asList(v.rules).length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Rule>Venue rules</Rule>
            <ul style={{ margin: 0, paddingLeft: 18, ...t(14, { c: C.mutedInk, h: 1.7 }) }}>
              {v.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </section>
        )}

        {policy.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Rule>Cancellation</Rule>
            <div style={{ borderRadius: 20, border: `1px solid ${C.hair}`, padding: '6px 14px' }}>
              {policy.map((r, i) => {
                const ok = (r.percent ?? 0) > 0;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < policy.length - 1 ? `1px solid ${C.hair}` : undefined }}>
                    <span style={{ width: 48, padding: '6px 0', borderRadius: 10, textAlign: 'center', background: ok ? C.mint : C.redSoft, ...t(13, { w: 800, c: ok ? C.brand : C.redInk }) }}>
                      {r.percent}%
                    </span>
                    <div>
                      <div style={t(14, { w: 700 })}>{r.title ?? ''}</div>
                      <div style={t(12, { c: C.muted })}>{r.subtitle ?? ''}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <StickyBar>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 'none' }}>
          <span style={t(12, { w: 600, c: C.muted })}>{cur ? `${cur.name} from` : 'Starts at'}</span>
          <span style={d(19, { ls: -0.4 })}>
            {inr(cur?.price ?? v.price_from)}
            <span style={t(13, { w: 600, c: C.muted })}>/hr</span>
          </span>
        </div>
        <GoButton onClick={checkSlots} disabled={!checkSlots}>
          See free slots
        </GoButton>
      </StickyBar>
    </div>
  );
}

const Fact = ({ k, v }) => (
  <CardBox padding={12} radius={16}>
    <div style={t(11, { c: C.muted })}>{k}</div>
    <div className="clamp2" style={{ marginTop: 2, ...t(14, { w: 600 }) }}>
      {v || '—'}
    </div>
  </CardBox>
);

function SportTile({ sp, on, onClick }) {
  const fg = hex(sp.fg);
  return (
    <button
      aria-pressed={on}
      className="tap"
      onClick={onClick}
      style={{
        height: 68,
        padding: '0 10px',
        borderRadius: 18,
        background: on ? hex(sp.bg) : '#fff',
        border: `2px solid ${on ? fg : C.line}`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        textAlign: 'left',
        minWidth: 0,
      }}
    >
      <span style={{ width: 44, height: 44, flex: 'none' }}>
        <Img url={sp.image} radius={12} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', ...t(15, { w: 700, c: on ? fg : C.ink }) }}>{sp.name}</span>
        <span className="clamp1" style={{ display: 'block', opacity: 0.85, ...t(12, { c: on ? fg : C.ink }) }}>
          {sp.meta ?? ''}
        </span>
      </span>
    </button>
  );
}

function VenueSkeleton({ desktop }) {
  return (
    <div style={{ padding: desktop ? 0 : 0 }}>
      <Sk h={desktop ? 440 : 330} r={desktop ? 28 : 0} />
      <div style={{ padding: desktop ? '32px 0' : 20, display: 'grid', gap: 12, maxWidth: 720 }}>
        <Sk w={140} h={20} r={99} />
        <Sk w="70%" h={30} />
        <Sk w="45%" h={14} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 8 }}>
          <Sk h={64} r={16} />
          <Sk h={64} r={16} />
          <Sk h={64} r={16} />
        </div>
      </div>
    </div>
  );
}
