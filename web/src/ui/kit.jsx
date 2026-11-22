/** Shared widgets — the web versions of mobile/lib/core/widgets/*. */

import { useNavigate } from 'react-router-dom';
import { ChevronLeft, WifiOff } from 'lucide-react';
import { avatarColors, C, d, hex, shadow, t } from '../theme';

// ------------------------------------------------------------ buttons

/** The 44px rounded-square icon buttons used in headers. */
export function SquareIconButton({ icon: I, onClick, translucent, size = 44, iconSize = 20, label, color = C.ink, badge }) {
  const nav = useNavigate();
  return (
    <button
      aria-label={label}
      className="tap"
      onClick={onClick ?? (() => nav(-1))}
      style={{
        position: 'relative',
        width: size,
        height: size,
        flex: 'none',
        borderRadius: 14,
        display: 'grid',
        placeItems: 'center',
        background: translucent ? 'rgba(255,255,255,0.95)' : '#fff',
        border: translucent ? 'none' : `1px solid ${C.line}`,
      }}
    >
      <I size={iconSize} color={color} />
      {badge && (
        <span
          style={{ position: 'absolute', top: 10, right: 11, width: 8, height: 8, borderRadius: 99, background: C.coral, border: '2px solid #fff', boxSizing: 'content-box' }}
        />
      )}
    </button>
  );
}

export const BackSquare = ({ translucent, onClick }) => <SquareIconButton icon={ChevronLeft} translucent={translucent} onClick={onClick} label="Back" />;

export function Spinner({ size = 22, color = '#fff', stroke = 2.4 }) {
  return (
    <span
      className="spin"
      aria-label="Loading"
      style={{ width: size, height: size, borderRadius: '50%', border: `${stroke}px solid ${color}`, borderRightColor: 'transparent', display: 'inline-block', flex: 'none' }}
    />
  );
}

export function PrimaryButton({
  children,
  onClick,
  height = 56,
  radius = 18,
  loading,
  trailing,
  shadowOn = true,
  fontSize = 16,
  color = C.brand,
  fg = '#fff',
  style,
  type = 'button',
}) {
  const disabled = !onClick && !loading && type !== 'submit';
  return (
    <button
      type={type}
      className="tap"
      disabled={disabled || loading}
      onClick={loading ? undefined : onClick}
      style={{
        height,
        width: '100%',
        borderRadius: radius,
        padding: '0 12px',
        background: disabled ? C.line : color,
        boxShadow: shadowOn && !disabled ? shadow.brand : undefined,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        ...t(fontSize, { w: 600, c: disabled ? '#57625A' : fg }),
        ...style,
      }}
    >
      {loading ? <Spinner /> : <span className="clamp1">{children}</span>}
      {!loading && trailing}
    </button>
  );
}

export function GhostButton({ children, onClick, height = 52, radius = 16, icon: I, fg = C.ink, bg = '#fff', border = C.line, fontSize = 14, style }) {
  return (
    <button
      className="tap"
      onClick={onClick}
      style={{
        height,
        borderRadius: radius,
        padding: '0 14px',
        background: bg,
        border: border === 'transparent' ? 'none' : `1px solid ${border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        ...t(fontSize, { w: 600, c: fg }),
        ...style,
      }}
    >
      {I && <I size={18} color={fg} />}
      <span className="clamp1">{children}</span>
    </button>
  );
}

export const TextButton = ({ children, onClick, color = C.brand, disabled }) => (
  <button className="tap" disabled={disabled} onClick={onClick} style={{ padding: '10px 12px', borderRadius: 12, opacity: disabled ? 0.5 : 1, ...t(14, { w: 600, c: color }) }}>
    {children}
  </button>
);

// ------------------------------------------------------------ controls

export const Toggle = ({ value, on = C.brand, off = C.dotOff }) => (
  <span
    style={{
      width: 48,
      height: 28,
      padding: 3,
      borderRadius: 999,
      background: value ? on : off,
      display: 'flex',
      justifyContent: value ? 'flex-end' : 'flex-start',
      transition: 'all 160ms',
      flex: 'none',
    }}
  >
    <span style={{ width: 22, height: 22, borderRadius: 99, background: '#fff' }} />
  </span>
);

export const RadioDot = ({ on }) => (
  <span
    style={{ width: 22, height: 22, borderRadius: 99, background: '#fff', border: `${on ? 7 : 2}px solid ${on ? C.brand : C.radioOff}`, flex: 'none', transition: 'border 140ms' }}
  />
);

/** Option tile with a border that turns green when selected (chips, pills, radios). */
export function Choice({ selected, children, onClick, radius = 14, height = 48, selBg = C.brand, selBorder = C.brand, selWidth = 1, padding = 0, style, disabled }) {
  return (
    <button
      aria-pressed={selected}
      className="tap"
      disabled={disabled}
      onClick={onClick}
      style={{
        height,
        padding,
        borderRadius: radius,
        background: selected ? selBg : '#fff',
        border: `${selected ? selWidth : 1}px solid ${selected ? selBorder : C.line}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 140ms',
        flex: 'none',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ------------------------------------------------------------ pills

export const Pill = ({ children, bg = C.mint, fg = C.green700, size = 11, padding = '4px 10px', style }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', padding, background: bg, borderRadius: 999, whiteSpace: 'nowrap', ...t(size, { w: 700, c: fg, h: 1.3 }), ...style }}>
    {children}
  </span>
);

/** Sport-coloured chip from an API sport map ({name, fg, bg}). */
export const SportPill = ({ sport, label, size = 11 }) => (
  <Pill bg={hex(sport?.bg, C.mint)} fg={hex(sport?.fg)} size={size} padding="3px 9px">
    {label ?? sport?.name ?? ''}
  </Pill>
);

// ------------------------------------------------------------ layout

export const Label = ({ children, style }) => (
  <div style={{ padding: '20px 20px 10px', textTransform: 'uppercase', ...t(13, { w: 600, c: C.muted, ls: 0.6 }), ...style }}>{children}</div>
);

export const H2 = ({ children, size = 18, color = C.ink, style }) => <h2 style={{ margin: 0, ...d(size, { c: color }), ...style }}>{children}</h2>;

export const CardBox = ({ children, padding = 16, radius = 20, color = '#fff', shadowCss = shadow.soft, border, style, onClick, className }) => (
  <div
    onClick={onClick}
    className={className ?? (onClick ? 'tap' : undefined)}
    role={onClick ? 'button' : undefined}
    style={{ padding, borderRadius: radius, background: color, boxShadow: shadowCss ?? undefined, border, cursor: onClick ? 'pointer' : undefined, ...style }}
  >
    {children}
  </div>
);

export const KV = ({ k, v, vColor, vSize = 14 }) => (
  <div style={{ minWidth: 0 }}>
    <div style={t(11, { c: C.muted })}>{k}</div>
    <div style={{ marginTop: 2, ...t(vSize, { w: 700, c: vColor ?? C.ink }) }}>{v}</div>
  </div>
);

export const PriceRow = ({ k, v, bold, top, color, size = 14 }) => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', paddingTop: top ? 12 : 0, borderTop: top ? `1px solid ${C.line}` : undefined }}>
    <div style={{ flex: 1, ...t(size, { w: bold ? 700 : 400, c: color ?? (bold ? C.ink : C.muted) }) }}>{k}</div>
    <div style={t(size, { w: bold ? 700 : 400, c: color ?? C.ink })}>{v}</div>
  </div>
);

export const Stat = ({ label, value, color }) => (
  <CardBox padding={12} radius={16}>
    <div style={t(11, { c: C.muted })}>{label}</div>
    <div className="clamp1" style={{ marginTop: 2, ...d(18, { c: color ?? C.ink }) }}>
      {value}
    </div>
  </CardBox>
);

export const Avatar = ({ initials, index = 0, size = 44, ring, square }) => (
  <span
    style={{
      width: size,
      height: size,
      flex: 'none',
      display: 'grid',
      placeItems: 'center',
      background: avatarColors[Math.abs(index) % avatarColors.length],
      borderRadius: square ? 12 : '50%',
      border: ring ? '2px solid #fff' : undefined,
      ...t(Math.round(size * 0.33), { w: 700, c: '#fff', h: 1 }),
    }}
  >
    {initials}
  </span>
);

/** Grey segmented tab bar (Upcoming / Completed / Cancelled, etc.). */
export function Segmented({ labels, index, onChange, counts, badges, bg = C.segment, height = 42 }) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 4, padding: 4, background: bg, borderRadius: 16 }}>
      {labels.map((l, i) => {
        const on = i === index;
        return (
          <button
            key={l}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(i)}
            style={{
              flex: 1,
              minWidth: 0,
              height,
              borderRadius: 12,
              background: on ? '#fff' : 'transparent',
              boxShadow: on ? '0 1px 3px rgba(12,36,25,.12)' : undefined,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 160ms',
            }}
          >
            <span className="clamp1" style={t(13, { w: 600, c: on ? C.ink : C.muted })}>
              {l}
            </span>
            {counts && (
              <span
                style={{
                  minWidth: 20,
                  height: 20,
                  padding: '0 6px',
                  borderRadius: 999,
                  display: 'grid',
                  placeItems: 'center',
                  background: on ? C.brand : '#D9E2D5',
                  ...t(11, { c: on ? '#fff' : C.mutedInk, h: 1 }),
                }}
              >
                {counts[i]}
              </span>
            )}
            {badges && badges[i] > 0 && (
              <span
                style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, display: 'grid', placeItems: 'center', background: C.coral, ...t(11, { c: '#fff', h: 1 }) }}
              >
                {badges[i]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Network image (Cloudinary / Django media) with the app's placeholder. */
export function Img({ url, fallback = 'turf', radius, style, className, alt = '' }) {
  const src = url || `/images/${fallback}.jpg`;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={className}
      onError={(e) => {
        const el = e.currentTarget;
        if (!el.dataset.fb) {
          el.dataset.fb = '1';
          el.src = `/images/${fallback}.jpg`;
        }
      }}
      style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#E8F0E4', borderRadius: radius, ...style }}
    />
  );
}

export function ErrorRetry({ message, onRetry }) {
  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      <WifiOff size={36} color={C.muted} />
      <div style={{ marginTop: 12, ...t(14, { c: C.muted, h: 1.5 }) }}>{message}</div>
      <GhostButton height={44} onClick={onRetry} style={{ marginTop: 16 }}>
        Try again
      </GhostButton>
    </div>
  );
}

/** Warm warning box used for form errors. */
export const WarnBox = ({ children, style }) => <div style={{ padding: 12, borderRadius: 12, background: C.warnBg, ...t(13, { c: C.warnInk, h: 1.4 }), ...style }}>{children}</div>;

/** Ticket perforation: dashed line with half-circle cut-outs on both sides. */
export const Perforation = ({ height = 22, notch = 22, bg = C.ground }) => (
  <div style={{ position: 'relative', height, display: 'flex', alignItems: 'center' }}>
    <span style={{ position: 'absolute', left: -notch / 2, width: notch, height: notch, borderRadius: 99, background: bg }} />
    <span style={{ position: 'absolute', right: -notch / 2, width: notch, height: notch, borderRadius: 99, background: bg }} />
    <span style={{ margin: '0 18px', flex: 1, borderTop: `2px dashed ${C.line}` }} />
  </div>
);

export const Empty = ({ icon: I, title, body, action }) => (
  <div style={{ padding: '48px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
    <span style={{ width: 88, height: 88, borderRadius: 28, background: C.mint, display: 'grid', placeItems: 'center' }}>
      <I size={36} color={C.green700} />
    </span>
    <div style={{ marginTop: 16, ...d(20) }}>{title}</div>
    {body && <div style={{ marginTop: 8, maxWidth: 360, ...t(14, { c: C.muted, h: 1.5 }) }}>{body}</div>}
    {action && <div style={{ marginTop: 20, width: '100%', maxWidth: 320 }}>{action}</div>}
  </div>
);

// ------------------------------------------------------------ skeletons

export const Sk = ({ w = '100%', h = 14, r = 8, style }) => <span className="sk" style={{ display: 'block', width: w, height: h, borderRadius: r, ...style }} />;

export const ListSkeleton = ({ rows = 4 }) => (
  <div style={{ padding: 20, display: 'grid', gap: 12 }}>
    {Array.from({ length: rows }, (_, i) => (
      <CardBox key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Sk w={52} h={52} r={14} />
        <div style={{ flex: 1, display: 'grid', gap: 8 }}>
          <Sk w="60%" h={14} />
          <Sk w="40%" h={12} />
        </div>
      </CardBox>
    ))}
  </div>
);
