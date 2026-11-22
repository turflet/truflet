/** 2 · Onboarding (3 slides). Shown once; Skip / Get started saves that it was seen.
 *  Desktop: photo on the left, copy and controls on the right. */
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useSession } from '../../app/session';
import { C, d, t } from '../../theme';
import { useIsDesktop } from '../../ui/hooks';
import { GhostButton, PrimaryButton, SquareIconButton } from '../../ui/kit';

const slides = [
  { img: 'cricket', title: 'Find the best turfs near you', body: 'Box cricket, football pitches, badminton and pickleball courts — all in one place, sorted by distance.' },
  { img: 'badminton_court', title: 'Pick your slot like a movie seat', body: 'Live availability by date, court and time. Choose a start time and duration in two taps.' },
  { img: 'football', title: 'Pay securely, show up & play', body: 'UPI, cards or wallets. Get instant confirmation and a QR pass for check-in.' },
];

export default function Onboarding() {
  const { finishOnboarding } = useSession();
  const nav = useNavigate();
  const desktop = useIsDesktop();
  const [i, setI] = useState(0);
  const touch = useRef(null);
  const s = slides[i];

  const done = () => {
    finishOnboarding();
    nav('/location?first=1', { replace: true });
  };

  const dots = (
    <div style={{ display: 'flex', gap: 6 }}>
      {slides.map((_, k) => (
        <span key={k} style={{ width: k === i ? 28 : 6, height: 6, borderRadius: 999, background: k === i ? C.brand : C.dotOff, transition: 'all 200ms' }} />
      ))}
    </div>
  );

  const controls = (
    <div style={{ display: 'flex', gap: 12 }}>
      {i > 0 && <SquareIconButton icon={ChevronLeft} size={56} iconSize={22} label="Previous" onClick={() => setI(i - 1)} />}
      <PrimaryButton onClick={i < 2 ? () => setI(i + 1) : done}>{i < 2 ? 'Next' : 'Get started'}</PrimaryButton>
    </div>
  );

  const photo = (
    <div
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current == null) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        if (dx < -40 && i < 2) setI(i + 1);
        if (dx > 40 && i > 0) setI(i - 1);
        touch.current = null;
      }}
      style={{ position: 'relative', overflow: 'hidden', borderRadius: 32, boxShadow: '0 20px 44px rgba(12,36,25,.16)', height: '100%' }}
    >
      <div style={{ display: 'flex', height: '100%', transform: `translateX(-${i * 100}%)`, transition: 'transform 280ms ease-out' }}>
        {slides.map((sl) => (
          <img key={sl.img} src={`/images/${sl.img}.jpg`} alt="" style={{ flex: '0 0 100%', width: '100%', height: '100%', objectFit: 'cover' }} />
        ))}
      </div>
    </div>
  );

  if (desktop) {
    return (
      <div
        className="page"
        style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 56, padding: 40, maxWidth: 1320, margin: '0 auto', alignItems: 'center' }}
      >
        <div style={{ height: 'min(78vh, 720px)' }}>{photo}</div>
        <div style={{ maxWidth: 480 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <img src="/images/logo.png" alt="Turflet" style={{ height: 32 }} />
            <div style={{ flex: 1 }} />
            <GhostButton height={40} radius={999} fg={C.muted} onClick={done}>
              Skip
            </GhostButton>
          </div>
          <div style={{ marginTop: 72 }}>{dots}</div>
          <h1 key={i} className="rise" style={{ margin: '18px 0 0', ...d(46, { h: 1.08, ls: -1 }) }}>
            {s.title}
          </h1>
          <p key={`b${i}`} className="rise" style={{ margin: '16px 0 40px', ...t(17, { c: C.muted, h: 1.6 }) }}>
            {s.body}
          </p>
          {controls}
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', paddingTop: 'var(--safe-top)' }}>
      <div style={{ padding: '8px 24px 0', display: 'flex', alignItems: 'center' }}>
        <img src="/images/logo.png" alt="Turflet" style={{ height: 28 }} />
        <div style={{ flex: 1 }} />
        <GhostButton height={40} radius={999} fg={C.muted} onClick={done}>
          Skip
        </GhostButton>
      </div>
      <div style={{ flex: 1, minHeight: 0, padding: '20px 24px 0', display: 'flex' }}>
        <div style={{ width: '100%', maxHeight: 420, height: '100%' }}>{photo}</div>
      </div>
      <div style={{ padding: '24px 28px 0' }}>
        {dots}
        <div style={{ height: 66, marginTop: 14, display: 'flex', alignItems: 'flex-end' }}>
          <div style={d(28, { h: 1.15, ls: -0.5 })}>{s.title}</div>
        </div>
        <div style={{ marginTop: 10, ...t(15, { c: C.muted, h: 1.55 }) }}>{s.body}</div>
      </div>
      <div style={{ padding: '20px 24px calc(20px + var(--safe-bottom) / 2)' }}>{controls}</div>
    </div>
  );
}
