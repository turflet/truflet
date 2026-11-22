// Writes dist/sitemap.xml after `vite build`: the public static pages plus every venue page
// fetched from the API. If the API is unreachable the static pages are still written.
import { writeFileSync } from 'node:fs';

const SITE = 'https://www.truflet.in';
const API = process.env.VITE_API_BASE || 'https://truflet-u8t9.vercel.app/api/v1';
const today = new Date().toISOString().slice(0, 10);

const pages = [
  { loc: '/', priority: '1.0', changefreq: 'daily' },
  { loc: '/home', priority: '0.9', changefreq: 'daily' },
  { loc: '/lobbies', priority: '0.7', changefreq: 'daily' },
  { loc: '/help', priority: '0.4', changefreq: 'monthly' },
  { loc: '/policy', priority: '0.3', changefreq: 'yearly' },
  { loc: '/privacy', priority: '0.3', changefreq: 'yearly' },
];

try {
  const res = await fetch(`${API}/venues/?page_size=1000`, { signal: AbortSignal.timeout(15000) });
  const body = await res.json();
  const venues = Array.isArray(body) ? body : (body.items ?? body.results ?? []);
  for (const v of venues) pages.push({ loc: `/venues/${v.id}`, priority: '0.8', changefreq: 'weekly' });
  console.log(`sitemap: ${venues.length} venues`);
} catch (e) {
  console.warn(`sitemap: venues skipped (${e.message})`);
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>${SITE}${p.loc}</loc><lastmod>${today}</lastmod><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`).join('\n')}
</urlset>
`;
writeFileSync(new URL('../dist/sitemap.xml', import.meta.url), xml);
