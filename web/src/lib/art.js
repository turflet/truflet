/** The redesign's photography, bundled in /public/images. Sport discs use the square sport renders; wide cards
 *  (lobbies, a venue's sports) use the scene photos. Real venue photos from the API are never replaced. */

const THUMBS = ['football', 'cricket', 'badminton', 'tennis', 'pickleball', 'basketball', 'swimming', 'volleyball'];
const SCENES = { football: 'pitch-7v7', cricket: 'box-cricket', badminton: 'indoor-court', tennis: 'clay-court', pickleball: 'clay-court' };

const kind = (name) => {
  const n = String(name ?? '').toLowerCase();
  return THUMBS.find((k) => n.includes(k)) ?? (n.includes('soccer') || n.includes('futsal') ? 'football' : null);
};

/** Round sport render for [name], else the API image. */
export const sportThumb = (name, apiImage) => {
  const k = kind(name);
  return k ? `/images/sport-${k}.jpg` : apiImage;
};

/** Wide scene photo for a sport (lobby cards, a venue's sport rows). */
export const sportScene = (name) => `/images/${SCENES[kind(name)] ?? 'training'}.jpg`;

export const ART = {
  floodlit: '/images/turf-night.jpg',
  training: '/images/training.jpg',
  indoor: '/images/indoor-court.jpg',
};
