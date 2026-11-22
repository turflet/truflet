/** Public account-deletion page (/delete-account) — the Play Store "Delete account URL".
 *  1) enter the sign-in email → we email a 6-digit code; 2) enter the code (+ optional reason) → a deletion
 *  request is recorded for the team (backend: POST /account-deletion/code/ and /account-deletion/confirm/). */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errText } from '../../lib/api';
import { C, t } from '../../theme';
import { Spinner } from '../../ui/kit';
import { LegalLayout } from './LegalLayout';

const field = { width: '100%', font: 'inherit', color: C.ink, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 12, padding: '12px 14px', outline: 'none' };
const label = { display: 'block', margin: '14px 0 6px', ...t(14, { w: 600 }) };

function Alert({ ok, children }) {
  return <div style={{ borderRadius: 12, padding: '12px 14px', margin: '12px 0', background: ok ? '#E7F5EC' : C.redSoft, ...t(15, { c: ok ? '#1E7A4C' : C.redInk, h: 1.5 }) }}>{children}</div>;
}

function Submit({ busy, children }) {
  return (
    <button type="submit" disabled={busy} className="tap" style={{ marginTop: 18, minWidth: 160, height: 46, padding: '0 22px', borderRadius: 12, background: C.coral, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...t(15, { w: 600, c: '#fff' }) }}>
      {busy ? <Spinner size={18} /> : children}
    </button>
  );
}

export default function DeleteAccount() {
  const [step, setStep] = useState('email'); // email → code → done
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [support, setSupport] = useState('support@turflet.app');

  const run = (fn) => async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };
  const send = run(async () => {
    const r = await api.post('/account-deletion/code/', { email: email.trim() });
    setEmail(r.email);
    setCode('');
    setStep('code');
  });
  const confirm = run(async () => {
    const r = await api.post('/account-deletion/confirm/', { email, code: code.trim(), reason });
    if (r.support_email) setSupport(r.support_email);
    setStep('done');
  });
  const mail = `mailto:${support}?subject=${encodeURIComponent('Delete my Turflet account')}`;

  return (
    <LegalLayout title="Delete your account" docTitle="Delete your account" sub="Ask us to delete your Turflet account and the personal data linked to it.">
      {step === 'done' ? (
        <>
          <h2>Request received</h2>
          <Alert ok>
            We’ve received your request to delete the Turflet account for <strong>{email}</strong>.
          </Alert>
          <p>
            We’ll delete your account and personal data within <strong>30 days</strong> and email you when it’s done. If you change your mind before then, email <a href={`mailto:${support}`}>{support}</a>.
          </p>
        </>
      ) : (
        <>
          <h2>How to request deletion</h2>
          <ol>
            <li>Enter the email address you use to sign in to Turflet.</li>
            <li>We’ll email you a 6-digit code to confirm the account is yours.</li>
            <li>Enter the code below and submit your request.</li>
          </ol>
          <p className="muted">
            You can also email <a href={mail}>{support}</a> from your sign-in email address with the subject “Delete my Turflet account”.
          </p>
          {error && <Alert>{error}</Alert>}
          {step === 'code' ? (
            <form onSubmit={confirm}>
              <p>
                We sent a code to <strong>{email}</strong>. It expires in 10 minutes.
              </p>
              <label htmlFor="code" style={label}>
                6-digit code
              </label>
              <input id="code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" required autoFocus pattern="[0-9]{6}" style={{ ...field, maxWidth: 220, letterSpacing: 6, ...t(20, { w: 600 }) }} />
              <label htmlFor="reason" style={label}>
                Why are you leaving? <span style={t(13, { c: C.muted, w: 400 })}>(optional)</span>
              </label>
              <textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} style={{ ...field, minHeight: 90, resize: 'vertical' }} />
              <Submit busy={busy}>Request account deletion</Submit>
              <p className="muted">
                <button type="button" onClick={() => (setStep('email'), setError(''))} style={{ color: C.coral, textDecoration: 'underline', font: 'inherit' }}>
                  Use a different email
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={send}>
              <label htmlFor="email" style={label}>
                Email address
              </label>
              <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus style={field} />
              <Submit busy={busy}>Send code</Submit>
            </form>
          )}
        </>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
        <div>
          <h2>What we delete</h2>
          <ul>
            <li>Your account and sign-in email</li>
            <li>Profile: name, mobile number, address, handle and photo</li>
            <li>Your sports and skill levels</li>
            <li>Saved location, city and area</li>
            <li>Saved venues, reviews and notifications</li>
            <li>Push notification tokens for your devices</li>
            <li>Your wallet balance and referral code</li>
          </ul>
        </div>
        <div>
          <h2>What we keep</h2>
          <ul>
            <li><strong>Booking, payment and refund records</strong>, kept only as long as tax and accounting laws require (up to 8 years), then deleted.</li>
            <li><strong>Messages in match chats</strong> are anonymised, so other players see “Deleted user” instead of your name.</li>
            <li><strong>Server logs</strong> are kept for up to 90 days for security, then deleted.</li>
          </ul>
        </div>
      </div>
      <p className="muted">
        Deleting your account can’t be undone. Any unused wallet balance is lost. Read our <Link to="/privacy">Privacy Policy</Link> for more.
      </p>
    </LegalLayout>
  );
}
