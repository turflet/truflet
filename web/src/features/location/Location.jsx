/** 3 · Choose location: city grid, search and "use my location". `?first=1` = part of onboarding. */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, LocateFixed, Search } from 'lucide-react';
import { useSession } from '../../app/session';
import { useBack } from '../../app/nav';
import { asList, errText } from '../../lib/api';
import { locationRepo } from '../../lib/repos';
import { C, d, shadow, t } from '../../theme';
import { useIsDesktop } from '../../ui/hooks';
import { useOverlay } from '../../ui/overlay';
import { BackSquare, ErrorRetry, Label, PrimaryButton, Sk, Spinner } from '../../ui/kit';

const isLive = (c) => c.is_live !== false;

export default function Location() {
  const app = useSession();
  const nav = useNavigate();
  const back = useBack();
  const desktop = useIsDesktop();
  const { toast } = useOverlay();
  const [params] = useSearchParams();
  const first = params.get('first') === '1';
  const [cities, setCities] = useState(null);
  const [error, setError] = useState(null);
  const [city, setCity] = useState(0);
  const [areaId, setAreaId] = useState(null);
  const [query, setQuery] = useState('');
  const [gps, setGps] = useState({ busy: false });

  const load = async () => {
    setError(null);
    try {
      const data = await locationRepo.cities();
      let ci = data.findIndex((c) => isLive(c) && asList(c.areas).some((a) => a.id === app.areaId));
      const keep = ci >= 0;
      if (!keep) ci = Math.max(0, data.findIndex(isLive));
      const areas = data.length ? asList(data[ci].areas) : [];
      setCities(data);
      setCity(ci);
      setAreaId(keep ? app.areaId : (areas[0]?.id ?? null));
    } catch (e) {
      setError(errText(e));
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => (cities ?? []).map((c, i) => [c, i]).filter(([c]) => !query || String(c.name).toLowerCase().includes(query.toLowerCase())), [cities, query]);
  const cur = cities?.[city];
  const area = cur ? asList(cur.areas).find((a) => a.id === areaId) : undefined;

  const useGps = () => {
    if (!navigator.geolocation) return toast('Location is not available in this browser. Pick your city below.');
    setGps({ busy: true });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await locationRepo.locate(pos.coords.latitude, pos.coords.longitude);
          const ci = (cities ?? []).findIndex((c) => c.id === r.city_id);
          if (ci >= 0) setCity(ci);
          setAreaId(r.area_id);
          setGps({ busy: false, label: `Located: ${r.city}`, lat: pos.coords.latitude, lng: pos.coords.longitude });
        } catch (e) {
          setGps({ busy: false });
          toast(errText(e));
        }
      },
      () => {
        setGps({ busy: false });
        toast('Location permission is off. Pick your city below.');
      },
      { enableHighAccuracy: false, timeout: 15000 },
    );
  };

  const select = (i) => {
    if (!cities || !isLive(cities[i])) return;
    if (i === city && areaId != null) return;
    setCity(i);
    setAreaId(asList(cities[i].areas)[0]?.id ?? null);
    setGps({ busy: false });
  };

  const confirm = async () => {
    if (!area || !cur) return;
    await app.setArea({ id: area.id, area: cur.name, city: cur.name, lat: gps.lat ?? area.lat ?? null, lng: gps.lng ?? area.lng ?? null });
    if (first) nav('/home', { replace: true });
    else back();
  };

  const body = (
    <>
      <h1 style={{ margin: 0, ...d(desktop ? 36 : 28, { ls: -0.5 }) }}>Where do you play?</h1>
      <p style={{ margin: '6px 0 18px', ...t(15, { c: C.muted }) }}>We'll show turfs and courts near you.</p>
      <div
        style={{
          height: 52,
          padding: '0 16px',
          borderRadius: 16,
          background: '#fff',
          border: `1px solid ${C.line}`,
          boxShadow: shadow.soft,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Search size={20} color={C.muted} />
        <input placeholder="Search city" value={query} onChange={(e) => setQuery(e.target.value.trim())} style={t(15)} />
      </div>
      <button
        className="tap"
        disabled={gps.busy}
        onClick={useGps}
        style={{
          marginTop: 10,
          width: '100%',
          height: 52,
          borderRadius: 16,
          background: C.mint,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          ...t(15, { w: 600, c: C.green700 }),
        }}
      >
        {gps.busy ? <Spinner size={18} stroke={2} color={C.green700} /> : <LocateFixed size={20} color={C.green700} />}
        {gps.label ?? 'Use my current location'}
      </button>
      {error && <ErrorRetry message={error} onRetry={load} />}
      {!cities && !error && (
        <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: `repeat(${desktop ? 4 : 3}, 1fr)`, gap: 10 }}>
          {Array.from({ length: 6 }, (_, i) => (
            <Sk key={i} h={desktop ? 110 : 88} r={18} />
          ))}
        </div>
      )}
      {cities && cities.length > 0 && (
        <>
          <Label style={{ padding: '22px 0 12px' }}>{query ? 'Matching cities' : 'Cities'}</Label>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${desktop ? 4 : 3}, 1fr)`, gap: 10 }}>
            {visible.map(([c, i]) => {
              const on = i === city;
              const live = isLive(c);
              return (
                <button
                  key={c.id}
                  className="tap"
                  disabled={!live}
                  aria-pressed={on}
                  onClick={() => select(i)}
                  style={{
                    aspectRatio: '1.25',
                    borderRadius: 18,
                    background: on ? C.brand : live ? '#fff' : C.chip,
                    border: `1px solid ${on ? C.brand : C.line}`,
                    boxShadow: on ? shadow.brandSm : undefined,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: 8,
                  }}
                >
                  <Building2 size={22} color={on ? '#fff' : live ? C.ink : C.radioOff} />
                  <span className="clamp1" style={{ maxWidth: '100%', ...t(13, { w: 600, c: on ? '#fff' : live ? C.ink : C.muted }) }}>
                    {c.name}
                  </span>
                  {!live && <span style={t(10, { w: 600, c: C.muted })}>Coming soon</span>}
                </button>
              );
            })}
          </div>
          {visible.length === 0 && <div style={{ padding: '8px 0', ...t(14, { c: C.muted }) }}>No cities match "{query}"</div>}
        </>
      )}
    </>
  );

  const cta = <PrimaryButton onClick={area ? confirm : undefined}>Show turfs in {area ? cur?.name : '…'}</PrimaryButton>;

  if (desktop) {
    return (
      <div className="page" style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1.15fr' }}>
        <div style={{ position: 'relative', overflow: 'hidden' }}>
          <img src="/images/turf.jpg" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,.25), rgba(11,42,29,.7))' }} />
          <div style={{ position: 'absolute', top: 32, left: 32 }}>
            <BackSquare translucent onClick={first ? () => nav('/onboarding') : back} />
          </div>
          <div style={{ position: 'absolute', left: 48, bottom: 48, right: 48, ...d(38, { c: '#fff', h: 1.1 }) }}>Turfs and courts, sorted by how close they are.</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', padding: '64px 64px 40px', maxWidth: 720 }}>
          <div style={{ flex: 1 }}>{body}</div>
          <div style={{ marginTop: 28 }}>{cta}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ position: 'relative', height: 210 }}>
          <img src="/images/turf.jpg" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(0,0,0,.25) 0%, rgba(245,248,243,0) 45%, ${C.ground} 100%)` }} />
          <div style={{ position: 'absolute', top: 'calc(var(--safe-top) + 8px)', left: 20 }}>
            <BackSquare translucent onClick={back} />
          </div>
        </div>
        <div style={{ marginTop: -36, position: 'relative', padding: '0 24px 24px' }}>{body}</div>
      </div>
      <div style={{ padding: '14px 24px calc(24px + var(--safe-bottom) / 2)', background: '#fff', borderTop: `1px solid ${C.line}` }}>{cta}</div>
    </div>
  );
}
