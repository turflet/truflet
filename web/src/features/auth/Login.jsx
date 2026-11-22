/** Email + one-time code sign-in: email → 6-digit code → (first time only) profile details.
 *  Phone: the Flutter screen as is. Desktop: the same form beside a photo panel. */
import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Mail, MailOpen, ShieldCheck, User } from 'lucide-react';
import { useSession } from '../../app/session';
import { routes } from '../../app/nav';
import { authRepo } from '../../lib/repos';
import { errText } from '../../lib/api';
import { C, d, t } from '../../theme';
import { useIsDesktop } from '../../ui/hooks';
import { BackSquare, PrimaryButton, TextButton, WarnBox } from '../../ui/kit';
import { ProfileForm } from './ProfileForm';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export default function Login() {
  const { setLoggedIn } = useSession();
  const nav = useNavigate();
  const loc = useLocation();
  const desktop = useIsDesktop();
  const back = loc.state?.back ?? routes.home;
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const codeRef = useRef(null);

  const done = () => nav(back, { replace: true });

  const send = async () => {
    const e = email.trim();
    if (!EMAIL.test(e)) return setError('Enter a valid email address.');
    setBusy(true);
    setError(null);
    try {
      const r = await authRepo.requestCode(e);
      const dev = r.dev_code ?? null;
      setDevCode(dev);
      if (dev) setCode(dev);
      setStep(1);
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await authRepo.verifyCode(email.trim(), code);
      await setLoggedIn(r);
      if (r.is_new === true) setStep(2);
      else done();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  const titles = ['Sign in with email', 'Check your inbox', 'Complete your profile'];
  const subs = [
    "We'll email you a 6-digit code. No password needed — your bookings and QR pass stay linked to this email.",
    `We sent a 6-digit code to ${email.trim()}. It expires in 10 minutes. Check spam if you don't see it.`,
    'Your name appears on your bookings. The venue gets your mobile number so they can reach you.',
  ];
  const Icon = step === 2 ? User : step === 1 ? MailOpen : Mail;

  const form = (
    <div style={{ width: '100%', maxWidth: 440 }}>
      <BackSquare onClick={() => (step === 1 ? setStep(0) : nav(back, { replace: true }))} />
      <div style={{ height: 28 }} />
      <span style={{ width: 64, height: 64, borderRadius: 20, background: C.mint, display: 'grid', placeItems: 'center' }}>
        <Icon size={28} color={C.green700} />
      </span>
      <h1 style={{ margin: '20px 0 0', ...d(28, { ls: -0.5 }) }}>{titles[step]}</h1>
      <p style={{ margin: '8px 0 24px', ...t(15, { c: C.muted, h: 1.5 }) }}>{subs[step]}</p>
      {step < 2 ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (step === 0) send();
            else verify();
          }}
        >
          <div style={t(13, { w: 600 })}>{step === 0 ? 'Email address' : '6-digit code'}</div>
          <div style={{ marginTop: 8, height: 56, padding: '0 16px', borderRadius: 16, background: '#fff', border: `1px solid ${C.line}`, display: 'flex', alignItems: 'center' }}>
            {step === 0 ? (
              <input autoFocus type="email" autoComplete="email" value={email} placeholder="you@example.com" onChange={(e) => setEmail(e.target.value)} style={t(16)} />
            ) : (
              <input
                ref={codeRef}
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                placeholder="••••••"
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={d(22, { ls: 8 })}
              />
            )}
          </div>
          {devCode && step === 1 && (
            <div style={{ marginTop: 10, ...t(12, { c: C.muted }) }}>Dev mode: code {devCode} was filled in for you (the server also prints the email).</div>
          )}
          {error && <WarnBox style={{ marginTop: 14 }}>{error}</WarnBox>}
          <div style={{ height: 24 }} />
          <PrimaryButton type="submit" loading={busy}>
            {step === 0 ? 'Send code' : 'Verify & continue'}
          </PrimaryButton>
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 6 }}>
              <TextButton disabled={busy} onClick={send}>
                Resend code
              </TextButton>
              <TextButton
                disabled={busy}
                color={C.muted}
                onClick={() => {
                  setCode('');
                  setError(null);
                  setStep(0);
                }}
              >
                Use a different email
              </TextButton>
            </div>
          )}
        </form>
      ) : (
        <ProfileForm submitLabel="Save & continue" onSaved={done} />
      )}
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, ...t(12, { c: C.muted }) }}>
        <ShieldCheck size={14} color={C.muted} /> We never share your email with advertisers
      </div>
    </div>
  );

  if (!desktop)
    return (
      <div className="page" style={{ padding: 'calc(8px + var(--safe-top)) 24px 24px' }}>
        {form}
      </div>
    );

  return (
    <div className="page" style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1.05fr 1fr' }}>
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <img src="/images/football.jpg" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, rgba(11,42,29,.35) 0%, rgba(11,42,29,.88) 75%)' }} />
        <div style={{ position: 'absolute', left: 56, right: 56, bottom: 56, color: '#fff' }}>
          <div style={{ display: 'inline-flex', padding: '10px 14px', borderRadius: 16, background: '#fff' }}>
            <img src="/images/logo.png" alt="Turflet" style={{ height: 26 }} />
          </div>
          <div style={{ marginTop: 28, ...d(44, { c: '#fff', h: 1.08 }) }}>
            Your next game
            <br />
            is two taps away.
          </div>
          <div style={{ marginTop: 14, maxWidth: 440, ...t(16, { c: 'rgba(255,255,255,.82)', h: 1.55 }) }}>
            Live slots at turfs and courts near you, split the cost with your squad, and walk in with a QR pass.
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, background: C.ground }}>{form}</div>
    </div>
  );
}
