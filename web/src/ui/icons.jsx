/** The redesign's own icon set (24×24 line icons, some with a coral accent), drawn from the same SVG paths as the
 *  design canvas. Each export takes lucide-style props (size, color, strokeWidth, fill, style) so it can stand in
 *  for the lucide icon of the same name. Mirrors mobile/lib/core/widgets/design_icons.dart. */

export const PATHS = {
  back: { d: 'M15 5l-7 7 7 7' },
  chevR: { d: 'M10 7l5 5-5 5' },
  chevD: { d: 'M7 10l5 5 5-5' },
  pin: { d: 'M12 21c-4-4.2-7-7.9-7-11.2A7 7 0 0 1 19 9.8c0 3.3-3 7-7 11.2zM12 7.3a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5z' },
  search: { d: 'M10.5 4a6.5 6.5 0 1 1 0 13a6.5 6.5 0 1 1 0-13zM20 20l-4.6-4.6' },
  star: { d: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z', solid: true },
  sliders: { d: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.8a2.2 2.2 0 1 1 0 4.4a2.2 2.2 0 1 1 0-4.4zM9 14.8a2.2 2.2 0 1 1 0 4.4a2.2 2.2 0 1 1 0-4.4z' },
  heart: { d: 'M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z' },
  bolt: { d: 'M13.5 2.5L5.5 13.5H11l-1 8 8-11h-5.5z', solid: true },
  ticket: {
    d: 'M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V14a2 2 0 0 0 0-4zM14.5 6v2M14.5 11v2M14.5 16v2',
    a: 'M8 10.5h3v3H8z',
  },
  clock: { d: 'M12 3.5a8.5 8.5 0 1 1 0 17a8.5 8.5 0 1 1 0-17zM12 7.5V12l3 2' },
  share: { d: 'M8.5 10.7l7-4.2M8.5 13.3l7 4.2M6 9.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5zM18 3.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5zM18 15.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5z' },
  floodlights: { d: 'M7 21V11M17 21V11M4.5 4h5v6h-5zM14.5 4h5v6h-5z' },
  parking: { d: 'M6.5 3.5h11a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2zM10 16.5v-9h3a2.5 2.5 0 0 1 0 5h-3' },
  changing: { d: 'M8 4.5l4 2 4-2 3.5 3-2 3-1.5-1V19.5h-8V9.5l-1.5 1-2-3z' },
  cafe: { d: 'M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v3M11.5 3.5v3' },
  upi: { d: 'M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5zM10.5 17.5h3M12.8 7l-3 4.5h2.4l-1 3.5 3-4.5h-2.4z' },
  wallet: { d: 'M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3M4 7.5v10A2.5 2.5 0 0 0 6.5 20H20V8H6.5A2.5 2.5 0 0 1 4 7.5zM16 12.3a1.7 1.7 0 1 1 0 3.4a1.7 1.7 0 1 1 0-3.4z' },
  card: { d: 'M4.5 6h15A1.5 1.5 0 0 1 21 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5v-9A1.5 1.5 0 0 1 4.5 6zM3 10h18M6 14.5h4' },
  calendar: { d: 'M5 5.5h14a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1zM4 10h16M8.5 3.5v4M15.5 3.5v4' },
  calendarAdd: { d: 'M5 5.5h14a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1zM4 10h16M8.5 3.5v4M15.5 3.5v4M12 12.5v5M9.5 15h5' },
  directions: { d: 'M12 2.8l9.2 9.2-9.2 9.2L2.8 12zM9.5 14.5v-3h4M12 9l2.5 2.5L12 14' },
  phone: { d: 'M5 4.5h3.5l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5V19a1.5 1.5 0 0 1-1.5 1.5A16 16 0 0 1 3.5 6 1.5 1.5 0 0 1 5 4.5z' },
  check: { d: 'M5 12.5l4.5 4.5L19 7.5' },
  shield: { d: 'M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6zM9 12l2 2 4-4' },
  bell: { d: 'M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0' },
  help: { d: 'M4.5 5.5h15a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1H10l-4.5 3.5V17h-1a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1z' },
  policy: { d: 'M7 3.5h7l4.5 4.5v12.5H7a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 7 3.5zM14 3.5V8h4.5M9 13h6M9 16.5h4' },
  logout: { d: 'M14 4.5H6.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1H14M10 12h10M17 8.5l3.5 3.5-3.5 3.5' },
  tag: { d: 'M4 12.5V5h7.5l8.5 8.5-7.5 7.5zM8 8.5a.5.5 0 1 1 0 .1' },
  grid: { d: 'M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z' },
  indoor: { d: 'M4 10.5L12 4l8 6.5V20H4zM9.5 20v-5h5v5' },
  image: { d: 'M4.5 5h15a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3.5 16l5-5 4 4 2.5-2.5 5.5 5.5M15.5 9.5a1 1 0 1 1 0 .1' },
};

/** One design icon. Solid icons (star, bolt) fill with [color]; line icons take [fill] for their inside (a saved heart). */
export function Ico({ name, size = 24, color = 'currentColor', strokeWidth = 1.8, fill, accent = '#F2552C', style, className }) {
  const p = PATHS[name];
  const solid = p.solid === true && fill !== 'none'; // a solid icon with fill="none" draws as an outline (empty star)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={solid ? (fill ?? color) : (fill ?? 'none')}
      stroke={solid ? 'none' : color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: 'none', ...style }}
      className={className}
    >
      <path d={p.d} />
      {p.a && <path d={p.a} fill={accent} stroke="none" />}
    </svg>
  );
}

const as = (name, defaults = {}) => {
  const C = (props) => <Ico name={name} {...defaults} {...props} />;
  C.displayName = name;
  return C;
};

// Drop-in stand-ins for the lucide icons the redesigned screens used.
export const ChevronLeft = as('back', { strokeWidth: 2.2 });
export const ChevronRight = as('chevR', { strokeWidth: 2.6 });
export const ChevronDown = as('chevD', { strokeWidth: 2.4 });
export const MapPin = as('pin');
export const Search = as('search', { strokeWidth: 2 });
export const Star = as('star');
export const SlidersHorizontal = as('sliders', { strokeWidth: 2 });
export const Heart = as('heart');
export const Zap = as('bolt');
export const Ticket = as('ticket');
export const Clock = as('clock');
export const Share2 = as('share');
export const Lightbulb = as('floodlights', { strokeWidth: 1.7 });
export const SquareParking = as('parking', { strokeWidth: 1.7 });
export const Shirt = as('changing', { strokeWidth: 1.7 });
export const Coffee = as('cafe', { strokeWidth: 1.7 });
export const Smartphone = as('upi');
export const Wallet = as('wallet');
export const CreditCard = as('card');
export const CalendarDays = as('calendar');
export const CalendarPlus = as('calendarAdd');
export const MapPinned = as('directions');
export const Phone = as('phone');
export const Check = as('check', { strokeWidth: 2.4 });
export const ShieldCheck = as('shield');
export const Bell = as('bell');
export const CircleHelp = as('help');
export const FileText = as('policy');
export const LogOut = as('logout', { strokeWidth: 2 });
export const Tag = as('tag');
export const LayoutGrid = as('grid');
export const House = as('indoor');
