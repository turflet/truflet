/** Head tags for search engines and link previews. One source of truth for title, description,
 *  canonical URL, robots and Open Graph / Twitter tags, plus optional JSON-LD structured data. */
import { useEffect } from 'react';

import { DEFAULT_DESC, DEFAULT_IMAGE, DEFAULT_IMAGE_ALT, ROUTES, fullTitle, SITE_URL } from './seoData.js';

export { DEFAULT_DESC, DEFAULT_IMAGE, DEFAULT_TITLE, SITE_NAME, SITE_URL } from './seoData.js';

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function setJsonLd(data) {
  document.head.querySelectorAll('script[data-seo="page"]').forEach((n) => n.remove());
  if (!data) return;
  const el = document.createElement('script');
  el.type = 'application/ld+json';
  el.dataset.seo = 'page';
  el.textContent = JSON.stringify(data);
  document.head.appendChild(el);
}

export function applySeo({ title, description = DEFAULT_DESC, path = '/', image = DEFAULT_IMAGE, imageAlt, noindex = false, jsonLd = null }) {
  const t = fullTitle(title);
  const url = SITE_URL + path;
  document.title = t;
  setMeta('name', 'description', description);
  setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');
  setCanonical(url);
  setMeta('property', 'og:title', t);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:url', url);
  const alt = imageAlt || (image === DEFAULT_IMAGE ? DEFAULT_IMAGE_ALT : t);
  setMeta('property', 'og:image', image);
  setMeta('property', 'og:image:secure_url', image);
  setMeta('property', 'og:image:alt', alt);
  setMeta('name', 'twitter:title', t);
  setMeta('name', 'twitter:description', description);
  setMeta('name', 'twitter:image', image);
  setMeta('name', 'twitter:image:alt', alt);
  setJsonLd(jsonLd);
}

/** Pass `null` to leave the head alone (e.g. while the page's data is still loading). */
export function useSeo(seo) {
  const key = seo ? JSON.stringify(seo) : null;
  useEffect(() => {
    if (key) applySeo(JSON.parse(key));
  }, [key]);
}

/** Tags for the current path; venue and city/sport landing pages set their own. */
export function routeSeo(pathname) {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p.startsWith('/venues/') || p.startsWith('/turfs/')) return null;
  const hit = ROUTES[p];
  if (hit) return hit;
  return { title: 'Turflet', path: p, noindex: true };
}
