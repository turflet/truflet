/** 11 · Saved venues (in Profile): tap a heart to remove (with undo), slot alerts toggle. */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Heart, Star } from 'lucide-react';
import { useSession } from '../../app/session';
import { routes } from '../../app/nav';
import { Shell } from '../../app/Shell';
import { SignInGate } from '../auth/SignInGate';
import { asList, errText } from '../../lib/api';
import { venueRepo } from '../../lib/repos';
import { inr } from '../../lib/format';
import { C, d, shadow, t } from '../../theme';
import { useIsDesktop } from '../../ui/hooks';
import { useOverlay } from '../../ui/overlay';
import { GhostButton, Img, PrimaryButton, Sk, SportPill, Toggle } from '../../ui/kit';

export default function SavedPage() {
  return (
    <Shell nav>
      <SignInGate>
        <Saved />
      </SignInGate>
    </Shell>
  );
}

function Saved() {
  const app = useSession();
  const nav = useNavigate();
  const desktop = useIsDesktop();
  const { toast } = useOverlay();
  const [items, setItems] = useState(null);
  const [removed, setRemoved] = useState([]);

  const load = async () => {
    try {
      const r = await venueRepo.saved(app.lat, app.lng);
      setItems(r);
      app.replaceSaved(r.map((v) => v.id));
    } catch (e) {
      toast(errText(e));
      setItems((x) => x ?? []);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = async (v) => {
    setItems((x) => (x ?? []).filter((y) => y.id !== v.id));
    setRemoved((r) => [...r, v]);
    app.markSaved(v.id, false);
    try {
      await venueRepo.toggleSaved(v.id);
    } catch (e) {
      toast(errText(e));
      load();
    }
  };
  const undo = async () => {
    const last = removed[removed.length - 1];
    if (!last) return;
    setRemoved((r) => r.slice(0, -1));
    try {
      await venueRepo.toggleSaved(last.id);
      load();
    } catch (e) {
      toast(errText(e));
    }
  };

  const alerts = app.user?.slot_alerts_on === true;
  const n = items?.length ?? 0;
  return (
    <div style={{ padding: desktop ? 0 : 'calc(var(--safe-top) + 8px) 0 20px' }}>
      <div style={{ padding: desktop ? 0 : '0 20px' }}>
        <button onClick={() => nav(routes.profile)} style={{ padding: '6px 0', display: 'flex', alignItems: 'center', ...t(13, { w: 600, c: C.brand }) }}>
          <ChevronLeft size={16} color={C.brand} /> Profile
        </button>
        <h1 style={{ margin: '4px 0 0', ...d(desktop ? 36 : 28, { ls: -0.5 }) }}>Saved venues</h1>
        <div style={{ marginTop: 4, ...t(13, { c: C.muted }) }}>
          {n} {n === 1 ? 'venue' : 'venues'} · tap a heart to remove
        </div>
      </div>
      {items == null && (
        <div style={{ padding: desktop ? '18px 0 0' : '18px 20px 0', display: 'grid', gridTemplateColumns: `repeat(${desktop ? 4 : 2}, 1fr)`, gap: 12 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <Sk key={i} h={260} r={20} />
          ))}
        </div>
      )}
      {items && items.length > 0 && (
        <>
          <div
            style={{
              padding: desktop ? '22px 0 0' : '18px 20px 0',
              display: 'grid',
              gridTemplateColumns: desktop ? 'repeat(auto-fill, minmax(240px, 1fr))' : 'repeat(2, 1fr)',
              gap: desktop ? 18 : 12,
            }}
          >
            {items.map((v) => (
              <div
                key={v.id}
                className="lift"
                style={{ position: 'relative', borderRadius: 20, background: '#fff', boxShadow: shadow.card, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
              >
                <button onClick={() => nav(routes.venue(v.id))} style={{ textAlign: 'left', flex: 1 }}>
                  <div style={{ position: 'relative', height: desktop ? 150 : 120, overflow: 'hidden' }}>
                    <Img url={v.image} className="zoom" />
                    <span
                      style={{
                        position: 'absolute',
                        left: 8,
                        bottom: 8,
                        padding: '3px 7px',
                        borderRadius: 8,
                        background: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                        ...t(11, { w: 700 }),
                      }}
                    >
                      <Star size={12} color={C.star} fill={C.star} /> {v.rating}
                    </span>
                  </div>
                  <div style={{ padding: '10px 12px 4px' }}>
                    <div className="clamp2" style={d(14, { h: 1.25 })}>
                      {v.name}
                    </div>
                    <div style={{ margin: '4px 0', ...t(12, { c: C.muted }) }}>
                      {v.area}
                      {v.distance_km != null ? ` · ${v.distance_km} km` : ''}
                    </div>
                    {asList(v.sports)[0] && <SportPill sport={asList(v.sports)[0]} />}
                  </div>
                </button>
                <div style={{ padding: '8px 12px 12px', display: 'flex', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <span style={d(15, { c: C.brand })}>{inr(v.price_from)}</span>
                    <span style={t(12, { c: C.muted })}>/hr</span>
                  </div>
                  <button
                    className="tap"
                    onClick={() => nav(`/book?venue=${v.id}`)}
                    style={{ height: 34, padding: '0 12px', borderRadius: 10, background: C.brand, ...t(12, { w: 600, c: '#fff' }) }}
                  >
                    Book
                  </button>
                </div>
                <button
                  aria-label={`Remove ${v.name} from saved`}
                  className="tap"
                  onClick={() => remove(v)}
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: 36,
                    height: 36,
                    borderRadius: 99,
                    background: 'rgba(255,255,255,.95)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <Heart size={17} color={C.rose} fill={C.rose} />
                </button>
              </div>
            ))}
          </div>
          <div
            style={{
              margin: desktop ? '24px 0 0' : '20px 20px 0',
              maxWidth: desktop ? 640 : undefined,
              padding: 16,
              borderRadius: 20,
              background: C.purpleSoft,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <img src="/images/racket.jpg" alt="" style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover' }} />
            <div style={{ flex: 1 }}>
              <div style={t(14, { w: 700, c: '#4C1D95' })}>Get slot alerts</div>
              <div style={{ marginTop: 2, ...t(12, { c: '#5B21B6', h: 1.4 }) }}>We'll ping you when evening slots open up at your saved venues.</div>
            </div>
            <button role="switch" aria-checked={alerts} aria-label="Slot alerts" onClick={() => app.updateMe({ slot_alerts_on: !alerts })}>
              <Toggle value={alerts} on={C.purple} off="#C4B5FD" />
            </button>
          </div>
        </>
      )}
      {items && items.length === 0 && (
        <div style={{ padding: '60px 32px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
          <span style={{ width: 88, height: 88, borderRadius: 28, background: C.roseSoft, display: 'grid', placeItems: 'center' }}>
            <Heart size={36} color={C.rose} />
          </span>
          <div style={{ marginTop: 12, ...d(20) }}>No saved venues yet</div>
          <div style={{ marginTop: 12, ...t(14, { c: C.muted, h: 1.5 }) }}>Tap the heart on any turf to keep it here for quick booking.</div>
          {removed.length > 0 && (
            <GhostButton height={44} radius={14} onClick={undo} style={{ marginTop: 12 }}>
              Undo
            </GhostButton>
          )}
          <div style={{ marginTop: 12, width: '100%' }}>
            <PrimaryButton height={52} radius={16} fontSize={15} onClick={() => nav(routes.home)}>
              Explore turfs
            </PrimaryButton>
          </div>
        </div>
      )}
    </div>
  );
}
