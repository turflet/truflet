/** Indian-grouped rupees: 125000 → ₹1,25,000. */
export function inr(n) {
  const v = Math.round(Number(n ?? 0) || 0);
  const s = Math.abs(v).toString();
  const sign = v < 0 ? '-' : '';
  if (s.length <= 3) return `${sign}₹${s}`;
  const last3 = s.slice(-3);
  let rest = s.slice(0, -3);
  const parts = [];
  while (rest.length > 2) {
    parts.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) parts.unshift(rest);
  return `${sign}₹${parts.join(',')},${last3}`;
}

export const fmtHour = (h) => `${h % 12 === 0 ? 12 : h % 12} ${h % 24 < 12 ? 'AM' : 'PM'}`;
export const fmtTime = (h) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h % 24 < 12 ? 'AM' : 'PM'}`;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** yyyy-MM-dd in local time. */
export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const dayName = (d) => DAYS[d.getDay()];
export const monthName = (d) => MONTHS[d.getMonth()];
/** "Sat 15" */
export const eeeD = (d) => `${DAYS[d.getDay()]} ${d.getDate()}`;
/** "Sat, 15 Nov" */
export const eeeDMmm = (d) => `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;

/** 0:00 countdown text. */
export const mmss = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const count = (n) => {
  const v = Number(n ?? 0);
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`;
};

export const initials = (name) =>
  String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('') || '?';
