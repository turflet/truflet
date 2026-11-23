/** /turfs/:city and /turfs/:city/:sport — search landing pages ("box cricket in Gurgaon").
 *  The build prerenders the same content (scripts/prerender.mjs) so crawlers get it without JS. */
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { useSession } from '../../app/session';
import { routes, useRequireLogin } from '../../app/nav';
import { Shell } from '../../app/Shell';
import { errText } from '../../lib/api';
import { configRepo, locationRepo, venueRepo } from '../../lib/repos';
import { useSeo } from '../../lib/seo';
import { landingPath, landingSeo, slugify } from '../../lib/seoData';
import { C, d, t } from '../../theme';
import { useData, useIsDesktop } from '../../ui/hooks';
import { useOverlay } from '../../ui/overlay';
import { Empty, ErrorRetry, H2, PrimaryButton, Sk } from '../../ui/kit';
import { VenueCard } from '../explore/Explore';

export default function TurfsLanding() {
  const { city: citySlug, sport: sportSlug } = useParams();
  const app = useSession();
  const nav = useNavigate();
  const desktop = useIsDesktop();
  const { toast } = useOverlay();
  const requireLogin = useRequireLogin();

  const { data, error, retry } = useData(async () => {
    const [cities, sports] = await Promise.all([locationRepo.cities(), configRepo.sports()]);
    const city = cities.find((c) => slugify(c.name) === citySlug);
    const sport = sportSlug ? sports.find((s) => s.slug === sportSlug) : null;
    if (!city || (sportSlug && !sport)) return { missing: true };
    const res = await venueRepo.search({ city: city.id, radius: 'city', ...(sport && { sport: sport.id }) });
    return { city, sport, sports, venues: res.items ?? [] };
  }, [citySlug, sportSlug]);

  const page = data && !data.missing ? landingSeo({ city: data.city.name, sport: data.sport, venues: data.venues }) : null;
  useSeo(data?.missing ? { title: 'Page not found', path: `/turfs/${citySlug}`, noindex: true } : page?.seo ?? null);

  const toggleFav = async (v) => {
    if (!requireLogin()) return;
    app.markSaved(v.id, !app.saved.has(v.id));
    try {
      const r = await venueRepo.toggleSaved(v.id);
      app.markSaved(v.id, r.is_saved === true);
    } catch (e) {
      toast(errText(e));
    }
  };

  const pad = desktop ? 0 : '0 20px';
  let body;
  if (error) body = <ErrorRetry message={error} onRetry={retry} />;
  else if (!data)
    body = (
      <div style={{ padding: pad }}>
        <Sk w="60%" h={34} />
        <Sk w="90%" h={16} style={{ marginTop: 14 }} />
        <Sk h={170} r={24} style={{ marginTop: 24 }} />
      </div>
    );
  else if (data.missing)
    body = <Empty icon={MapPin} title="We're not here yet" body="Turflet isn't live in this city yet." action={<PrimaryButton onClick={() => nav(routes.home)}>Browse venues</PrimaryButton>} />;
  else {
    const { city, sport, sports, venues } = data;
    const chip = (to, label, on) => (
      <Link
        key={to}
        to={to}
        style={{ padding: '8px 14px', borderRadius: 999, background: on ? C.brand : '#fff', border: `1px solid ${on ? C.brand : C.line}`, ...t(13, { w: 600, c: on ? '#fff' : C.ink }) }}
      >
        {label}
      </Link>
    );
    body = (
      <div style={{ padding: pad }}>
        <h1 style={{ margin: desktop ? 0 : '16px 0 0', ...d(desktop ? 40 : 28, { ls: -0.5, h: 1.1 }) }}>{page.h1}</h1>
        <p style={{ margin: '10px 0 0', maxWidth: 680, ...t(15, { c: C.mutedInk, h: 1.5 }) }}>{page.intro}</p>
        <div style={{ marginTop: 18, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {chip(landingPath(city.name), `All sports`, !sport)}
          {sports.map((s) => chip(landingPath(city.name, s.slug), s.name, sport?.slug === s.slug))}
        </div>
        <H2 size={desktop ? 22 : 18} style={{ margin: '28px 0 14px' }}>
          {venues.length} venue{venues.length === 1 ? '' : 's'} to book in {city.name}
        </H2>
        {venues.length === 0 ? (
          <Empty icon={MapPin} title="No venues yet" body={`We're onboarding venues in ${city.name}. Check back soon.`} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: desktop ? 'repeat(3, 1fr)' : '1fr', gap: 18 }}>
            {venues.map((v) => (
              <VenueCard key={v.id} v={v} fav={app.saved.has(v.id)} onOpen={() => nav(routes.venue(v.id))} onFav={() => toggleFav(v)} />
            ))}
          </div>
        )}
      </div>
    );
  }
  return <Shell nav>{body}</Shell>;
}
