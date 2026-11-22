/** Admin building blocks: page header, panels, status badges, cells and the schema-driven form field. */

import {
  Activity,
  Bell,
  Calendar,
  CircleHelp,
  CreditCard,
  Globe,
  Image as ImageIcon,
  Inbox,
  LayoutGrid,
  MapPin,
  MessageSquare,
  Navigation,
  Percent,
  RotateCcw,
  Shield,
  Slash,
  Star,
  Table,
  Tag,
  User,
  UserPlus,
  Users,
} from 'lucide-react';
import { C, d, t } from '../theme';
import { inr } from '../lib/format';

export const ICONS = {
  'map-pin': MapPin,
  'layout-grid': LayoutGrid,
  tag: Tag,
  image: ImageIcon,
  slash: Slash,
  activity: Activity,
  star: Star,
  globe: Globe,
  navigation: Navigation,
  calendar: Calendar,
  percent: Percent,
  'message-square': MessageSquare,
  users: Users,
  user: User,
  'user-plus': UserPlus,
  'circle-help': CircleHelp,
  'rotate-ccw': RotateCcw,
  shield: Shield,
  inbox: Inbox,
  bell: Bell,
  'credit-card': CreditCard,
  table: Table,
};

const BADGE = {
  confirmed: [C.mint, C.green700],
  paid: [C.mint, C.green700],
  success: [C.mint, C.green700],
  approved: [C.mint, C.green700],
  replied: [C.mint, C.green700],
  released: [C.mint, C.green700],
  locked: [C.mint, C.green700],
  active: [C.mint, C.green700],
  done: [C.chip, C.mutedInk],
  completed: [C.chip, C.mutedInk],
  closed: [C.chip, C.mutedInk],
  settled: [C.chip, C.mutedInk],
  held: [C.amberSoft, C.amber],
  pending: [C.amberSoft, C.amber],
  crowdfunding: [C.amberSoft, C.amber],
  open: [C.blueSoft, C.blue],
  draft: [C.chip, C.muted],
  expired: [C.chip, C.muted],
  none: [C.chip, C.muted],
  cancelled: [C.orangeSoft, C.orangeInk],
  refunded: [C.orangeSoft, C.orangeInk],
  disputed: [C.redSoft, C.redInk],
  failed: [C.redSoft, C.redInk],
  declined: [C.redSoft, C.redInk],
};

export const Badge = ({ value, label }) => {
  if (!value && !label) return <span style={t(13, { c: C.muted })}>—</span>;
  const [bg, fg] = BADGE[String(value)] ?? [C.chip, C.mutedInk];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 24,
        padding: '0 9px',
        borderRadius: 999,
        background: bg,
        whiteSpace: 'nowrap',
        ...t(12, { w: 700, c: fg, h: 1 }),
      }}
    >
      {label || value}
    </span>
  );
};

export const YesNo = ({ on }) => <Badge value={on ? 'active' : 'none'} label={on ? 'Yes' : 'No'} />;

export function Cell({ col, v }) {
  switch (col.kind) {
    case 'image':
      return v ? (
        <img src={String(v)} alt="" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover' }} />
      ) : (
        <span style={{ display: 'block', width: 40, height: 40, borderRadius: 10, background: C.chip }} />
      );
    case 'bool':
      return <YesNo on={!!v} />;
    case 'money':
      return <span style={{ fontVariantNumeric: 'tabular-nums', ...t(14, { w: 600 }) }}>{inr(v)}</span>;
    case 'badge': {
      const b = v ?? {};
      return <Badge value={b.value} label={b.label} />;
    }
    case 'color':
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, ...t(13, { c: C.mutedInk }) }}>
          <span style={{ width: 16, height: 16, borderRadius: 5, background: String(v ?? '#fff'), border: `1px solid ${C.line}` }} />
          {String(v ?? '')}
        </span>
      );
    default:
      return v == null || v === '' ? <span style={t(13, { c: C.muted })}>—</span> : <span style={t(14)}>{String(v)}</span>;
  }
}

export const PageHeader = ({ title, sub, actions, eyebrow }) => (
  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
    <div style={{ flex: 1, minWidth: 240 }}>
      {eyebrow && <div style={{ marginBottom: 6, ...t(12, { w: 700, c: C.muted, ls: 0.6 }), textTransform: 'uppercase' }}>{eyebrow}</div>}
      <h1 style={{ margin: 0, ...d(30, { ls: -0.8 }) }}>{title}</h1>
      {sub && <div style={{ marginTop: 6, ...t(14, { c: C.muted, h: 1.5 }) }}>{sub}</div>}
    </div>
    {actions && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{actions}</div>}
  </div>
);

export const Panel = ({ title, actions, children, pad = 20, style }) => (
  <section style={{ background: '#fff', borderRadius: 20, border: `1px solid ${C.line}`, boxShadow: '0 1px 2px rgba(12,36,25,.04)', overflow: 'hidden', ...style }}>
    {title && (
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.divider}`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, ...t(15, { w: 700 }) }}>{title}</div>
        {actions}
      </div>
    )}
    <div style={{ padding: pad }}>{children}</div>
  </section>
);

export const StatTile = ({ label, value, sub, accent }) => (
  <div style={{ padding: '18px 20px', borderRadius: 20, background: '#fff', border: `1px solid ${C.line}`, position: 'relative', overflow: 'hidden' }}>
    {accent && <span style={{ position: 'absolute', left: 0, top: 18, bottom: 18, width: 4, borderRadius: '0 4px 4px 0', background: accent }} />}
    <div style={t(13, { w: 600, c: C.muted })}>{label}</div>
    <div style={{ marginTop: 6, fontVariantNumeric: 'tabular-nums', ...d(28, { ls: -0.6 }) }}>{value}</div>
    {sub && <div style={{ marginTop: 4, ...t(12, { c: C.muted }) }}>{sub}</div>}
  </div>
);

export const Btn = ({ children, onClick, kind = 'ghost', icon: I, disabled, type = 'button', small }) => {
  const s = { primary: [C.brand, '#fff', C.brand], ghost: ['#fff', C.ink, C.line], danger: ['#fff', C.redInk, '#FECACA'], soft: [C.mint, C.green700, C.mint] };
  const [bg, fg, bd] = s[kind];
  return (
    <button
      type={type}
      className="tap"
      disabled={disabled}
      onClick={onClick}
      style={{
        height: small ? 34 : 40,
        padding: small ? '0 12px' : '0 16px',
        borderRadius: 12,
        background: bg,
        border: `1px solid ${bd}`,
        opacity: disabled ? 0.55 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        whiteSpace: 'nowrap',
        ...t(small ? 13 : 14, { w: 600, c: fg }),
      }}
    >
      {I && <I size={small ? 15 : 17} color={fg} />}
      {children}
    </button>
  );
};

export const inputStyle = { width: '100%', minHeight: 44, padding: '0 14px', borderRadius: 12, background: '#fff', border: `1px solid ${C.line}`, outline: 'none', ...t(14) };

/** One form control generated from the backend schema. */
export function FieldInput({ f, value, onChange, error }) {
  const border = error ? `1px solid ${C.redInk}` : `1px solid ${C.line}`;
  let control;
  switch (f.kind) {
    case 'bool':
      control = (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} style={{ width: 20, height: 20, accentColor: C.brand }} />
          <span style={t(14, { w: 600 })}>{f.label}</span>
        </label>
      );
      break;
    case 'select':
      control = (
        <select value={value == null ? '' : String(value)} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, border, appearance: 'auto' }}>
          <option value="">{f.required ? 'Choose…' : '— None —'}</option>
          {f.choices?.map((c) => (
            <option key={String(c.value)} value={String(c.value)}>
              {c.label}
            </option>
          ))}
        </select>
      );
      break;
    case 'multi': {
      const set = new Set((value ?? []).map(String));
      control = (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {f.choices?.map((c) => {
            const on = set.has(String(c.value));
            return (
              <button
                key={String(c.value)}
                type="button"
                className="tap"
                onClick={() => {
                  const next = new Set(set);
                  if (on) next.delete(String(c.value));
                  else next.add(String(c.value));
                  onChange([...next]);
                }}
                style={{
                  height: 34,
                  padding: '0 12px',
                  borderRadius: 999,
                  background: on ? C.brand : '#fff',
                  border: `1px solid ${on ? C.brand : C.line}`,
                  ...t(13, { w: 600, c: on ? '#fff' : C.ink }),
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      );
      break;
    }
    case 'image':
      control = (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {value instanceof File ? (
            <img src={URL.createObjectURL(value)} alt="" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover' }} />
          ) : value ? (
            <img src={String(value)} alt="" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover' }} />
          ) : (
            <span style={{ width: 64, height: 64, borderRadius: 12, background: C.chip, display: 'grid', placeItems: 'center' }}>
              <ImageIcon size={22} color={C.muted} />
            </span>
          )}
          <label
            className="tap"
            style={{
              height: 38,
              padding: '0 14px',
              borderRadius: 12,
              background: C.mint,
              display: 'inline-flex',
              alignItems: 'center',
              cursor: 'pointer',
              ...t(13, { w: 600, c: C.green700 }),
            }}
          >
            {value ? 'Replace image' : 'Upload image'}
            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onChange(e.target.files[0])} />
          </label>
          {value != null && value !== '' && !f.required && (
            <button type="button" onClick={() => onChange(null)} style={t(13, { w: 600, c: C.redInk })}>
              Remove
            </button>
          )}
        </div>
      );
      break;
    case 'textarea':
    case 'json':
      control = (
        <textarea
          rows={f.kind === 'json' ? 6 : 4}
          value={value == null ? '' : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle, border, padding: '12px 14px', resize: 'vertical', fontFamily: f.kind === 'json' ? 'ui-monospace, monospace' : undefined }}
        />
      );
      break;
    case 'color':
      control = (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="color"
            value={String(value || '#143d2b')}
            onChange={(e) => onChange(e.target.value)}
            style={{ width: 52, height: 44, padding: 4, borderRadius: 12, border, background: '#fff' }}
          />
          <input value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, border, maxWidth: 160 }} />
        </div>
      );
      break;
    default: {
      const type = f.kind === 'number' ? 'number' : f.kind === 'date' ? 'date' : f.kind === 'datetime' ? 'datetime-local' : f.kind === 'email' ? 'email' : 'text';
      let v = value == null ? '' : String(value);
      if (f.kind === 'datetime' && v) v = v.slice(0, 16);
      control = <input type={type} step={f.kind === 'number' ? 'any' : undefined} value={v} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, border }} />;
    }
  }
  return (
    <div>
      {f.kind !== 'bool' && (
        <div style={{ marginBottom: 6, display: 'flex', gap: 6, alignItems: 'baseline' }}>
          <span style={t(13, { w: 600 })}>{f.label}</span>
          {!f.required && <span style={t(12, { c: C.muted })}>Optional</span>}
        </div>
      )}
      {control}
      {error ? <div style={{ marginTop: 6, ...t(12, { c: C.redInk }) }}>{error}</div> : f.help && <div style={{ marginTop: 6, ...t(12, { c: C.muted, h: 1.4 }) }}>{f.help}</div>}
    </div>
  );
}
