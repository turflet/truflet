/** Calendar, share and maps helpers — mobile/lib/core/utils/external_actions.dart. */

export function addToCalendar(b) {
  const [y, m, d] = String(b.date).split('-').map(Number);
  const s = new Date(y, m - 1, d, b.start_hour);
  const e = new Date(s.getTime() + b.duration * 3600000);
  const f = (x) => `${x.getFullYear()}${String(x.getMonth() + 1).padStart(2, '0')}${String(x.getDate()).padStart(2, '0')}T${String(x.getHours()).padStart(2, '0')}0000`;
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${b.sport?.name} at ${b.venue?.name}`,
    dates: `${f(s)}/${f(e)}`,
    details: `Turflet booking ${b.code} · ${b.court?.name}`,
    location: b.venue?.address ?? '',
  });
  window.open(`https://calendar.google.com/calendar/render?${q}`, '_blank', 'noopener');
}

/** Web Share where available, else copies to the clipboard. Returns 'shared' | 'copied' | 'cancelled'. */
export async function share(text, url) {
  try {
    if (navigator.share) {
      await navigator.share({ text, url });
      return 'shared';
    }
    await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
    return 'copied';
  } catch {
    return 'cancelled';
  }
}

export const inviteText = (b) => `I've booked ${b.sport?.name} at ${b.venue?.name} on ${b.date_label}, ${b.time_short} (${b.court?.name}). Join me! Booking ${b.code}`;
