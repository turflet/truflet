/** Plain data + builders for search tags. No React / browser imports, so the build-time prerenderer
 *  (scripts/prerender.mjs) and the app share one source of truth for titles, descriptions and JSON-LD. */

export const SITE_URL = 'https://www.turflet.in';
export const SITE_NAME = 'Turflet';
export const DEFAULT_TITLE = 'Turflet — Book Turfs, Box Cricket & Sports Courts Near You';
export const DEFAULT_DESC =
  'Book football turfs, box cricket, badminton, pickleball and tennis courts near you. See live slots and prices, split the cost with your squad, and walk in with a QR pass.';
export const DEFAULT_IMAGE = `${SITE_URL}/images/og-image.jpg`;

export const DEFAULT_IMAGE_ALT = 'A floodlit football turf';

/** Link previews (WhatsApp, Facebook, X, LinkedIn) want a 1200×630 JPEG. Cloudinary images are cropped to
 *  exactly that on the fly; anything else is returned as-is. */
export const SHARE_W = 1200;
export const SHARE_H = 630;
export const shareImage = (url) =>
  url && url.includes('res.cloudinary.com') && url.includes('/upload/')
    ? url.replace(/\/upload\/(?:[a-z]_[^/]*\/)?/, `/upload/c_fill,g_auto,w_${SHARE_W},h_${SHARE_H},f_jpg,q_auto/`)
    : url;

export const fullTitle = (title) => (title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE);

// Static per-route tags. Private / transactional screens are noindex so they never show in search.
export const ROUTES = {
  '/': {},
  '/onboarding': { path: '/' },
  '/home': {
    title: 'Book Turfs & Sports Courts Near You',
    description:
      'Find and book football turfs, box cricket grounds, badminton, pickleball and tennis courts near you with live slot availability and instant confirmation.',
    path: '/home',
  },
  '/lobbies': {
    title: 'Join Open Games & Find Players',
    description: 'Short on players? Join open football, cricket and badminton games near you, or post your own match and split the turf cost.',
    path: '/lobbies',
  },
  '/help': { title: 'Help & Support', description: 'Answers about booking turfs, payments, cancellations and refunds on Turflet.', path: '/help' },
  '/policy': { title: 'Booking & Cancellation Policy', description: 'Turflet booking, cancellation and refund policy for turf and court bookings.', path: '/policy' },
  '/privacy': { title: 'Privacy Policy', description: 'How Turflet collects, uses and protects your personal data.', path: '/privacy' },
  '/delete-account': { title: 'Delete Your Account', description: 'How to delete your Turflet account and associated data.', path: '/delete-account' },
};

export const slugify = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** What people actually type into Google for each sport. */
const SPORT_PHRASES = {
  cricket: 'Box Cricket Grounds',
  football: 'Football Turfs',
  badminton: 'Badminton Courts',
  pickleball: 'Pickleball Courts',
  tennis: 'Tennis Courts',
  basketball: 'Basketball Courts',
  volleyball: 'Volleyball Courts',
  squash: 'Squash Courts',
};
export const sportPhrase = (slug, name) => SPORT_PHRASES[slug] ?? `${name} Venues`;

/** /turfs/:city or /turfs/:city/:sport */
export const landingPath = (city, sportSlug) => `/turfs/${slugify(city)}${sportSlug ? `/${sportSlug}` : ''}`;

/** Title, H1, intro and tags for a city (+ optional sport) landing page. `venues` = the venues listed on it. */
export function landingSeo({ city, sport, venues }) {
  const what = sport ? sportPhrase(sport.slug, sport.name) : 'Turfs & Sports Courts';
  const prices = venues.map((v) => v.price_from).filter((p) => p > 0);
  const from = prices.length ? Math.min(...prices) : null;
  const n = venues.length;
  const h1 = `${what} in ${city}`;
  const description =
    `Book ${what.toLowerCase()} in ${city}${from ? ` from ₹${from}/hr` : ''}. ` +
    `Compare ${n} venue${n === 1 ? '' : 's'}, see live slots and prices, split the cost with your squad and walk in with a QR pass.`;
  const path = landingPath(city, sport?.slug);
  return {
    h1,
    intro: description,
    seo: {
      title: `${h1} – Book Online`,
      description,
      path,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'ItemList',
            name: h1,
            itemListElement: venues.map((v, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/venues/${v.id}`, name: v.name })),
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Turflet', item: `${SITE_URL}/` },
              { '@type': 'ListItem', position: 2, name: city, item: SITE_URL + landingPath(city) },
              ...(sport ? [{ '@type': 'ListItem', position: 3, name: what, item: SITE_URL + path }] : []),
            ],
          },
        ],
      },
    },
  };
}

/** Search-engine tags + SportsActivityLocation structured data for a venue page.
 *  Accepts the venue detail payload (app) or the /seo/venues/ payload (prerender). */
export function venueSeo(v) {
  const sports = (v.venue_sports ?? []).map((s) => s.meta || s.name);
  const place = [v.area, v.city].filter(Boolean).join(', ');
  const what = sports.length ? sports.join(', ') : 'sports';
  const image = shareImage(v.photos?.[0] || v.image || v.venue_sports?.[0]?.image) || undefined;
  const path = `/venues/${v.id}`;
  const description =
    (v.about && v.about.slice(0, 155)) ||
    `Book ${what} at ${v.name}${place ? `, ${place}` : ''}${v.price_from ? ` from ₹${v.price_from}/hr` : ''}. Check live slot availability and book instantly on Turflet.`;
  const prices = (v.venue_sports ?? []).map((s) => s.price).filter((p) => p > 0);
  const lo = prices.length ? Math.min(...prices) : v.price_from;
  const hi = prices.length ? Math.max(...prices) : null;
  return {
    title: `${v.name}${place ? ` – ${place}` : ''} | Book ${sports[0] || 'Turf'} Online`,
    description,
    path,
    image,
    imageAlt: `${v.name}${place ? `, ${place}` : ''} on Turflet`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'SportsActivityLocation',
      name: v.name,
      url: SITE_URL + path,
      ...(image && { image }),
      ...(v.phone && { telephone: v.phone }),
      address: {
        '@type': 'PostalAddress',
        streetAddress: v.address,
        addressLocality: v.city,
        addressCountry: 'IN',
      },
      ...(v.lat != null && v.lng != null && { geo: { '@type': 'GeoCoordinates', latitude: v.lat, longitude: v.lng } }),
      ...(lo && { priceRange: hi && hi !== lo ? `₹${lo}–₹${hi}` : `₹${lo}+` }),
      ...(v.opens_at != null &&
        v.closes_at != null && {
          openingHoursSpecification: {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            opens: `${String(v.opens_at).padStart(2, '0')}:00`,
            closes: v.closes_at >= 24 ? '23:59' : `${String(v.closes_at).padStart(2, '0')}:00`,
          },
        }),
      ...(v.review_count > 0 && { aggregateRating: { '@type': 'AggregateRating', ratingValue: v.rating, reviewCount: v.review_count } }),
      ...(v.amenities?.length && {
        amenityFeature: v.amenities.map((a) => ({ '@type': 'LocationFeatureSpecification', name: a.label || a.name || a, value: true })),
      }),
    },
  };
}
