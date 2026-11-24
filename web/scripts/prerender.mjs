// Runs after `vite build`. Turns the SPA into crawlable HTML for every public page:
//   /, /home, /lobbies, /help, /policy, /privacy, /delete-account   static pages
//   /venues/:id                                                     every active venue
//   /turfs/:city, /turfs/:city/:sport                               search landing pages ("box cricket in Gurgaon")
// Each file gets its own title, description, canonical, Open Graph tags, JSON-LD and real body content
// (H1, H2s, venue lists, links) inside #root; React replaces that content when the app boots.
// Also writes dist/app.html (the bare shell that vercel.json rewrites every other path to) and
// dist/sitemap.xml with real lastmod dates taken from each venue's updated_at.
// If the API is unreachable the static pages and sitemap are still written, and the build doesn't fail.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_DESC,
  DEFAULT_IMAGE,
  ROUTES,
  SITE_URL,
  fullTitle,
  landingPath,
  landingSeo,
  slugify,
  sportPhrase,
  venueSeo,
} from '../src/lib/seoData.js';

const API = process.env.VITE_API_BASE || 'https://turflet.vercel.app/api/v1';
const DIST = new URL('../dist/', import.meta.url);
const template = readFileSync(new URL('index.html', DIST), 'utf8');
if (!template.includes('<!--prerender-->')) throw new Error('prerender: dist/index.html was already prerendered — run `npm run build`');

// ------------------------------------------------------------------ data

async function get(path) {
  const res = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(20000), headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json();
}

async function loadVenues() {
  try {
    return (await get('/seo/venues/')).venues;
  } catch (e) {
    // Older backend without /seo/venues/: fall back to the public list + detail endpoints.
    console.warn(`prerender: /seo/venues/ unavailable (${e.message}), using /venues/`);
    const list = await get('/venues/?radius=city');
    const items = Array.isArray(list) ? list : (list.items ?? []);
    return Promise.all(
      items.map(async (v) => {
        const full = await get(`/venues/${v.id}/`);
        return {
          ...full,
          city_live: true,
          image: full.photos?.[0] ?? full.image,
          amenities: (full.amenities ?? []).map((a) => a.name),
          venue_sports: (full.venue_sports ?? []).map((s) => ({ ...s, slug: slugify(s.name) })),
          updated_at: null,
        };
      }),
    );
  }
}

let venues = [];
let sports = [];
let faqs = [];
try {
  [venues, sports] = await Promise.all([loadVenues(), get('/sports/')]);
  faqs = await get('/faqs/').catch(() => []);
} catch (e) {
  console.warn(`prerender: API unreachable (${e.message}) — writing static pages only`);
}
venues.sort((a, b) => a.name.localeCompare(b.name));

// ------------------------------------------------------------------ html helpers

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const ld = (data) => JSON.stringify(data).replace(/</g, '\\u003c');
const day = (iso) => (iso ? iso.slice(0, 10) : null);
const maxDay = (list) => list.map((v) => day(v.updated_at)).filter(Boolean).sort().at(-1) ?? null;
const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

function setTag(html, re, replacement) {
  if (!re.test(html)) throw new Error(`prerender: template is missing ${re}`);
  return html.replace(re, replacement);
}

/** Fill the template's head + #root for one page. */
function page({ title, description = DEFAULT_DESC, path, image = DEFAULT_IMAGE, jsonLd, body }) {
  const t = esc(fullTitle(title));
  const dsc = esc(description);
  const url = esc(SITE_URL + path);
  const img = esc(image || DEFAULT_IMAGE);
  let html = template;
  html = setTag(html, /<title>[^<]*<\/title>/, `<title>${t}</title>`);
  html = setTag(html, /<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${dsc}" />`);
  html = setTag(html, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${url}" />`);
  html = setTag(html, /<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${url}" />`);
  html = setTag(html, /<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${t}" />`);
  html = setTag(html, /<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${dsc}" />`);
  html = setTag(html, /<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${img}" />`);
  html = setTag(html, /<meta name="twitter:title" content="[^"]*" \/>/, `<meta name="twitter:title" content="${t}" />`);
  html = setTag(html, /<meta name="twitter:description" content="[^"]*" \/>/, `<meta name="twitter:description" content="${dsc}" />`);
  html = setTag(html, /<meta name="twitter:image" content="[^"]*" \/>/, `<meta name="twitter:image" content="${img}" />`);
  if (image && image !== DEFAULT_IMAGE) {
    // Venue photos aren't 1200×630 — drop the fixed dimensions that describe the default image.
    html = html.replace(/\s*<meta property="og:image:(width|height|alt)" content="[^"]*" \/>/g, '');
  }
  if (jsonLd) {
    // data-seo="page" lets the app swap it out (lib/seo.js) instead of adding a second copy.
    html = html.replace('</head>', `    <script type="application/ld+json" data-seo="page">${ld(jsonLd)}</script>\n  </head>`);
  }
  return html.replace('<!--prerender-->', `<div class="pr">${header()}${body}${footer()}</div>`);
}

const header = () =>
  `<nav><a href="/"><strong>Turflet</strong></a> <a href="/home">Book a venue</a> <a href="/lobbies">Open games</a> <a href="/help">Help</a></nav>`;

const liveVenues = venues.filter((v) => v.city_live !== false);
const cities = [...new Set(liveVenues.map((v) => v.city))].sort();
const venuesIn = (city, sportSlug) =>
  liveVenues.filter((v) => v.city === city && (!sportSlug || (v.venue_sports ?? []).some((s) => s.slug === sportSlug)));
const sportsIn = (city) => sports.filter((s) => venuesIn(city, s.slug).length > 0);

function footer() {
  const cityLinks = cities
    .map(
      (c) =>
        `<li><a href="${landingPath(c)}">Turfs &amp; courts in ${esc(c)}</a>` +
        sportsIn(c)
          .map((s) => ` · <a href="${landingPath(c, s.slug)}">${esc(sportPhrase(s.slug, s.name))}</a>`)
          .join('') +
        `</li>`,
    )
    .join('');
  return (
    `<footer>` +
    (cityLinks ? `<h2>Book by city</h2><ul>${cityLinks}</ul>` : '') +
    `<p class="muted"><a href="/policy">Booking &amp; cancellation policy</a> · <a href="/privacy">Privacy policy</a> · <a href="/help">Help</a></p>` +
    `</footer>`
  );
}

const sportLabel = (v) => (v.venue_sports ?? []).map((s) => s.meta || s.name).join(', ');

function venueItem(v) {
  const facts = [
    [v.area, v.city].filter(Boolean).join(', '),
    sportLabel(v),
    v.price_from ? `from ${inr(v.price_from)}/hr` : '',
    v.review_count > 0 ? `${v.rating}★ (${v.review_count})` : '',
  ].filter(Boolean);
  return `<li><h3><a href="/venues/${v.id}">${esc(v.name)}</a></h3><span class="muted">${esc(facts.join(' · '))}</span></li>`;
}

const howItWorks = `<h2>How Turflet works</h2><ol>
<li>Pick your sport and see turfs and courts near you with live slot availability and prices.</li>
<li>Book a slot and pay online — or split the cost with your squad, everyone pays their share.</li>
<li>Walk in with your QR pass. No calls, no cash, no double bookings.</li></ol>
<h2>Short on players?</h2><p>Post your game or <a href="/lobbies">join an open game near you</a> and split the turf cost with other players.</p>`;

// ------------------------------------------------------------------ pages

const out = []; // { path, html, lastmod }

function homeBody() {
  const sportList = sports.length
    ? `<h2>Sports you can book</h2><ul>${sports.map((s) => `<li>${esc(sportPhrase(s.slug, s.name))}</li>`).join('')}</ul>`
    : '';
  const venueList = liveVenues.length ? `<h2>Venues on Turflet</h2><ul>${liveVenues.map(venueItem).join('')}</ul>` : '';
  return (
    `<main><h1>Book turfs and sports courts near you</h1>` +
    `<p>Find and book football turfs, box cricket grounds, badminton, pickleball, tennis and basketball courts. See live slots and prices, split the cost with your squad, and walk in with a QR pass.</p>` +
    `<p><a href="/home"><strong>Find a venue near you →</strong></a></p>` +
    sportList +
    venueList +
    howItWorks +
    `</main>`
  );
}
const allLastmod = maxDay(liveVenues);
out.push({ path: '/', lastmod: allLastmod, html: page({ path: '/', body: homeBody() }) });
out.push({ path: '/home', lastmod: allLastmod, html: page({ ...ROUTES['/home'], body: homeBody() }) });

const simple = (route, h1, extra = '') => {
  const r = ROUTES[route];
  out.push({ path: route, lastmod: null, html: page({ ...r, body: `<main><h1>${esc(h1)}</h1><p>${esc(r.description)}</p>${extra}</main>` }) });
};
simple('/lobbies', 'Join open games and find players', howItWorks.split('<h2>Short on players?</h2>')[1]);
simple('/policy', 'Booking and cancellation policy');
simple('/privacy', 'Privacy policy');
simple('/delete-account', 'Delete your Turflet account');

// Help: FAQs as text + FAQPage structured data (when the API has any).
{
  const qa = (Array.isArray(faqs) ? faqs : (faqs.items ?? [])).filter((f) => (f.question || f.q) && (f.answer || f.a));
  const list = qa.map((f) => ({ q: f.question || f.q, a: f.answer || f.a }));
  out.push({
    path: '/help',
    lastmod: null,
    html: page({
      ...ROUTES['/help'],
      jsonLd: list.length
        ? {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: list.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
          }
        : null,
      body:
        `<main><h1>Help and support</h1><p>${esc(ROUTES['/help'].description)}</p>` +
        (list.length ? `<h2>Frequently asked questions</h2>${list.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')}` : '') +
        `</main>`,
    }),
  });
}

// Venues
for (const v of venues) {
  const seo = venueSeo(v);
  const crumbs = [
    { name: 'Turflet', path: '/' },
    ...(v.city_live !== false ? [{ name: v.city, path: landingPath(v.city) }] : []),
    { name: v.name, path: seo.path },
  ];
  const map = v.lat != null && v.lng != null ? `https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lng}` : null;
  const nearby = liveVenues.filter((o) => o.city === v.city && o.id !== v.id).slice(0, 8);
  const body =
    `<main><p class="muted">${crumbs.map((c, i) => (i < crumbs.length - 1 ? `<a href="${c.path}">${esc(c.name)}</a>` : esc(c.name))).join(' › ')}</p>` +
    `<h1>${esc(v.name)}</h1>` +
    `<p>${esc([v.area, v.city].filter(Boolean).join(', '))}${v.review_count > 0 ? ` · ${v.rating}★ from ${v.review_count} reviews` : ''}</p>` +
    (v.image ? `<p><img src="${esc(v.image)}" alt="${esc(v.name)}" width="640" style="max-width:100%;height:auto;border-radius:16px" /></p>` : '') +
    (v.about ? `<p>${esc(v.about)}</p>` : `<p>${esc(seo.description)}</p>`) +
    ((v.venue_sports ?? []).length
      ? `<h2>Sports and prices</h2><ul>${v.venue_sports.map((s) => `<li>${esc(s.meta || s.name)}${s.price ? ` — from ${inr(s.price)} per hour` : ''}</li>`).join('')}</ul>`
      : '') +
    `<h2>Timings</h2><p>Open ${esc(v.hours_label || '')}, every day. Pick a date to see live slot availability and book instantly.</p>` +
    (v.surface || v.amenities?.length
      ? `<h2>Facilities</h2><ul>${v.surface ? `<li>Surface: ${esc(v.surface)}</li>` : ''}${(v.amenities ?? []).map((a) => `<li>${esc(a.name || a)}</li>`).join('')}</ul>`
      : '') +
    `<h2>Location</h2><p>${esc(v.address)}${map ? ` · <a href="${map}" rel="noopener">Open in Google Maps</a>` : ''}</p>` +
    (nearby.length ? `<h2>More venues in ${esc(v.city)}</h2><ul>${nearby.map(venueItem).join('')}</ul>` : '') +
    `</main>`;
  out.push({
    path: seo.path,
    lastmod: day(v.updated_at),
    html: page({
      ...seo,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          { ...seo.jsonLd, '@context': undefined },
          {
            '@type': 'BreadcrumbList',
            itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: SITE_URL + c.path })),
          },
        ],
      },
      body,
    }),
  });
}

// City and city + sport landing pages
for (const city of cities) {
  const citySports = sportsIn(city);
  for (const sport of [null, ...citySports]) {
    const list = venuesIn(city, sport?.slug);
    const { h1, intro, seo } = landingSeo({ city, sport, venues: list });
    const links = [
      sport ? `<a href="${landingPath(city)}">All sports in ${esc(city)}</a>` : '',
      ...citySports.filter((s) => s.slug !== sport?.slug).map((s) => `<a href="${landingPath(city, s.slug)}">${esc(sportPhrase(s.slug, s.name))} in ${esc(city)}</a>`),
    ].filter(Boolean);
    const body =
      `<main><h1>${esc(h1)}</h1><p>${esc(intro)}</p>` +
      `<h2>${list.length} venue${list.length === 1 ? '' : 's'} to book in ${esc(city)}</h2><ul>${list.map(venueItem).join('')}</ul>` +
      (links.length ? `<h2>Also in ${esc(city)}</h2><p>${links.join(' · ')}</p>` : '') +
      howItWorks +
      `</main>`;
    out.push({ path: seo.path, lastmod: maxDay(list), html: page({ ...seo, body }) });
  }
}

// ------------------------------------------------------------------ write

for (const p of out) {
  // vercel.json has cleanUrls: /venues/19 is served from venues/19.html; "/" from index.html.
  const file = new URL(p.path === '/' ? 'index.html' : `.${p.path}.html`, DIST);
  mkdirSync(dirname(fileURLToPath(file)), { recursive: true });
  writeFileSync(file, p.html);
}

// The SPA shell for every other path (private screens, venues added since this build). No canonical here:
// the app sets the right one per route, and a hard-coded "/" would point every such URL at the homepage.
const shell = template
  .replace(/\s*<link rel="canonical" href="[^"]*" \/>/, '')
  .replace('<!--prerender-->', '<noscript>Turflet needs JavaScript. <a href="/">Go to the homepage</a>.</noscript>');
writeFileSync(new URL('app.html', DIST), shell);

const urls = out
  .filter((p) => p.path !== '/delete-account')
  .map((p) => `  <url><loc>${SITE_URL}${p.path === '/' ? '/' : p.path}</loc>${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : ''}</url>`);
writeFileSync(
  new URL('sitemap.xml', DIST),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
);

// llms.txt (https://llmstxt.org): a plain-Markdown summary for AI assistants and AI search crawlers.
// Generated from the same live data as the pages so it never drifts out of date.
{
  const lines = [
    '# Turflet',
    '',
    `> ${DEFAULT_DESC}`,
    '',
    'Turflet is an online booking platform for sports venues in India. Players can see live slot availability and hourly prices, book and pay online, split the cost with their squad (each player pays their own share), and enter with a QR pass. Players who are short of people can join or post open games.',
    '',
    sports.length ? `Sports: ${sports.map((s) => s.name).join(', ')}.` : '',
    cities.length ? `Cities: ${cities.join(', ')}.` : '',
    '',
    '## Main pages',
    '',
    `- [Book a venue](${SITE_URL}/home): find turfs and courts near you with live slots and prices`,
    `- [Open games](${SITE_URL}/lobbies): join a game or find players and split the turf cost`,
    `- [Help and FAQs](${SITE_URL}/help): booking, payments, cancellations and refunds`,
    `- [Booking and cancellation policy](${SITE_URL}/policy)`,
    '',
  ];
  for (const city of cities) {
    lines.push(`## Venues in ${city}`, '');
    lines.push(`- [All turfs and courts in ${city}](${SITE_URL}${landingPath(city)})`);
    for (const s of sportsIn(city)) lines.push(`- [${sportPhrase(s.slug, s.name)} in ${city}](${SITE_URL}${landingPath(city, s.slug)})`);
    for (const v of venuesIn(city)) {
      const facts = [[v.area, v.city].filter(Boolean).join(', '), sportLabel(v), v.price_from ? `from ${inr(v.price_from)}/hr` : '']
        .filter(Boolean)
        .join(' · ');
      lines.push(`- [${v.name}](${SITE_URL}/venues/${v.id}): ${facts}`);
    }
    lines.push('');
  }
  lines.push('## Optional', '', `- [Privacy policy](${SITE_URL}/privacy)`, `- [Sitemap](${SITE_URL}/sitemap.xml)`, '');
  writeFileSync(new URL('llms.txt', DIST), lines.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n'));
}

console.log(`prerender: ${out.length} pages (${venues.length} venues, ${cities.length} cities), sitemap ${urls.length} URLs`);
