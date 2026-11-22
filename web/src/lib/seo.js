/** Head tags for search engines and link previews. One source of truth for title, description,
 *  canonical URL, robots and Open Graph / Twitter tags, plus optional JSON-LD structured data. */
import { useEffect } from 'react';

export const SITE_URL = 'https://www.truflet.in';
export const SITE_NAME = 'Turflet';
export const DEFAULT_TITLE = 'Turflet — Book Turfs, Box Cricket & Sports Courts Near You';
export const DEFAULT_DESC =
  'Book football turfs, box cricket, badminton, pickleball and tennis courts near you. See live slots and prices, split the cost with your squad, and walk in with a QR pass.';
export const DEFAULT_IMAGE = `${SITE_URL}/images/og-image.jpg`;

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

export function applySeo({ title, description = DEFAULT_DESC, path = '/', image = DEFAULT_IMAGE, noindex = false, jsonLd = null }) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
  const url = SITE_URL + path;
  document.title = fullTitle;
  setMeta('name', 'description', description);
  setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');
  setCanonical(url);
  setMeta('property', 'og:title', fullTitle);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:url', url);
  setMeta('property', 'og:image', image);
  setMeta('name', 'twitter:title', fullTitle);
  setMeta('name', 'twitter:description', description);
  setMeta('name', 'twitter:image', image);
  setJsonLd(jsonLd);
}

/** Pass `null` to leave the head alone (e.g. while the page's data is still loading). */
export function useSeo(seo) {
  const key = seo ? JSON.stringify(seo) : null;
  useEffect(() => {
    if (key) applySeo(JSON.parse(key));
  }, [key]);
}

// Static per-route tags. Private / transactional screens are noindex so they never show in search.
const ROUTES = {
  '/': {},
  '/onboarding': { path: '/' },
  '/home': {
    title: 'Book Turfs & Sports Courts Near You',
    description: 'Find and book football turfs, box cricket grounds, badminton, pickleball and tennis courts near you with live slot availability and instant confirmation.',
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

/** Tags for the current path; venue pages set their own once the venue has loaded. */
export function routeSeo(pathname) {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (p.startsWith('/venues/')) return null;
  const hit = ROUTES[p];
  if (hit) return hit;
  return { title: 'Turflet', path: p, noindex: true };
}
