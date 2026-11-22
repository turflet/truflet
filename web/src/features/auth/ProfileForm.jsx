/** Personal details: name and mobile are required, address optional, email read-only (it's the sign-in identity). */
import { useState } from 'react';
import { BadgeCheck } from 'lucide-react';
import { useSession } from '../../app/session';
import { ApiError } from '../../lib/api';
import { C, t } from '../../theme';
import { PrimaryButton, WarnBox } from '../../ui/kit';

const localPhone = (p) => {
  const digits = (p ?? '').replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
};

export function ProfileForm({ submitLabel, onSaved, showHandle }) {
  const { user, updateMe } = useSession();
  const u = user ?? {};
  const [name, setName] = useState(u.name ?? '');
  const [phone, setPhone] = useState(localPhone(u.phone));
  const [address, setAddress] = useState(u.address ?? '');
  const [handle, setHandle] = useState(u.handle ?? '');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const e = {};
    if (name.trim().length < 2) e.name = 'Please enter your name.';
    const digits = phone.replace(/\D/g, '');
    if (!digits) e.phone = 'Please enter your mobile number.';
    else if (digits.length !== 10) e.phone = 'Enter a 10-digit mobile number.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await updateMe({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        ...(showHandle ? { handle: handle.trim().replace(/@/g, '') } : {}),
      });
      onSaved();
    } catch (err) {
      setErrors({ form: err instanceof ApiError ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        save();
      }}
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      <Field label="Full name" error={errors.name}>
        <input
          value={name}
          autoComplete="name"
          placeholder="e.g. Arjun Mehta"
          onChange={(e) => (setName(e.target.value), setErrors((x) => ({ ...x, name: '' })))}
          style={inputStyle}
        />
      </Field>
      <div style={{ marginBottom: 14 }}>
        <FieldLabel text="Email" />
        <div style={{ height: 52, padding: '0 14px', borderRadius: 14, background: C.chip, border: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className="clamp1" style={{ flex: 1, ...t(15, { c: C.mutedInk }) }}>
            {u.email ?? ''}
          </span>
          <BadgeCheck size={18} color={C.green700} />
          <span style={t(12, { w: 600, c: C.green700 })}>Verified</span>
        </div>
      </div>
      <Field label="Mobile number" error={errors.phone} help="Shared only with the venue you book." prefix="+91">
        <input
          value={phone}
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="98765 43210"
          onChange={(e) => (setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)), setErrors((x) => ({ ...x, phone: '' })))}
          style={inputStyle}
        />
      </Field>
      <Field label="Address" optional>
        <textarea
          value={address}
          rows={2}
          autoComplete="street-address"
          placeholder="House, street, area, city"
          onChange={(e) => setAddress(e.target.value)}
          style={{ ...inputStyle, resize: 'none', padding: '15px 0' }}
        />
      </Field>
      {showHandle && (
        <Field label="Handle" optional prefix="@">
          <input value={handle} placeholder="arjun.plays" onChange={(e) => setHandle(e.target.value)} style={inputStyle} />
        </Field>
      )}
      {errors.form && <WarnBox style={{ marginBottom: 12 }}>{errors.form}</WarnBox>}
      <div style={{ height: 4 }} />
      <PrimaryButton type="submit" height={52} loading={busy}>
        {submitLabel}
      </PrimaryButton>
    </form>
  );
}

const inputStyle = { ...t(15), minHeight: 50 };

const FieldLabel = ({ text, optional }) => (
  <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', marginBottom: 6 }}>
    <span style={t(13, { w: 600 })}>{text}</span>
    {optional && <span style={t(12, { c: C.muted })}>Optional</span>}
  </div>
);

function Field({ label, error, help, prefix, optional, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <FieldLabel text={label} optional={optional} />
      <div
        style={{
          minHeight: 52,
          padding: '0 14px',
          borderRadius: 14,
          background: C.ground,
          border: `1px solid ${error ? C.redInk : C.line}`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {prefix && <span style={t(15, { w: 600 })}>{prefix}</span>}
        {children}
      </div>
      {error ? <div style={{ marginTop: 6, ...t(12, { c: C.redInk }) }}>{error}</div> : help && <div style={{ marginTop: 6, ...t(12, { c: C.muted }) }}>{help}</div>}
    </label>
  );
}
