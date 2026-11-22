/** 1 · Splash — the same logo story as the Flutter app (mobile/lib/features/splash): the "t" runs in,
 *  kicks the ball, the ball bounces twice into place, the "t" runs back in; then the wordmark rises.
 *  Same timeline, curves and positions, driven by requestAnimationFrame. */
import { useEffect, useRef, useState } from 'react';
import { C } from '../../theme';

const TOTAL = 2500;
// final (icon) layout, as fractions of the mark size
const tX = 0.3057,
  tY = 0.2395,
  tW = 0.3554,
  tH = 0.6205;
const bX = 0.631,
  bY = 0.1039,
  bD = 0.2651;
const hitTX = 0.03;
const ballX0 = 0.425,
  ballY0 = tY + tH - bD;
const landings = [1150, 1450, 1660];

const iv = (ms, a, b) => Math.min(1, Math.max(0, (ms - a) / (b - a)));
const lerp = (a, b, p) => a + (b - a) * p;
// Flutter curves
const easeOut = (x) => 1 - (1 - x) * (1 - x);
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const easeInCubic = (x) => x * x * x;
const easeOutBack = (x) => {
  const c1 = 1.70158,
    c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const elasticOut = (x) => (x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin(((x - 0.1) * 2 * Math.PI) / 0.4) + 1);

function tPose(ms) {
  let x, angle;
  if (ms < 420) {
    const p = easeOutCubic(iv(ms, 0, 420));
    x = lerp(-1.3, hitTX, p);
    angle = lerp(8, 26, p);
  } else if (ms < 620) {
    const p = easeInCubic(iv(ms, 420, 620));
    x = hitTX;
    angle = lerp(26, -20, p);
  } else if (ms < 1000) {
    const p = iv(ms, 620, 1000);
    x = lerp(hitTX, -1.3, easeInCubic(p));
    angle = lerp(-20, 10, easeOut(p));
  } else if (ms < 1600) {
    x = -1.3;
    angle = 10;
  } else {
    const p = iv(ms, 1600, 2150);
    x = lerp(-1.3, tX, easeOutBack(p));
    angle = lerp(14, 0, elasticOut(iv(ms, 1600, 2300)));
  }
  return { x, angle };
}

function ballPose(ms) {
  let x,
    y,
    sx = 1,
    sy = 1;
  const hitAt = 590;
  if (ms < hitAt) {
    x = ballX0;
    y = ballY0;
  } else if (ms < landings[0]) {
    const p = iv(ms, hitAt, landings[0]);
    x = lerp(ballX0, bX, easeOut(p));
    y = lerp(ballY0, bY, p) - 0.5 * 4 * p * (1 - p);
  } else {
    x = bX;
    if (ms < landings[1]) {
      const q = iv(ms, landings[0], landings[1]);
      y = bY - 0.16 * 4 * q * (1 - q);
    } else if (ms < landings[2]) {
      const q = iv(ms, landings[1], landings[2]);
      y = bY - 0.06 * 4 * q * (1 - q);
    } else y = bY;
  }
  landings.forEach((l, i) => {
    const dd = Math.abs(ms - l);
    if (dd < 70) {
      const k = (1 - dd / 70) * [1, 0.6, 0.3][i];
      sy = 1 - 0.2 * k;
      sx = 1 + 0.14 * k;
    }
  });
  const appear = easeOut(iv(ms, 0, 220));
  return { x, y, sx: sx * lerp(0.6, 1, appear), sy: sy * lerp(0.6, 1, appear), opacity: appear };
}

export function SplashMark({ ms, size }) {
  const tp = tPose(ms);
  const bp = ballPose(ms);
  const ip = iv(ms, 590, 820);
  const id = bD * size * lerp(0.6, 1.8, easeOut(ip));
  const cx = (ballX0 + bD * 0.3) * size,
    cy = (ballY0 + bD * 0.7) * size;
  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `translateX(${-0.1 * size}px)` }}>
        {ip > 0 && ip < 1 && (
          <span
            style={{
              position: 'absolute',
              left: cx - id / 2,
              top: cy - id / 2,
              width: id,
              height: id,
              borderRadius: '50%',
              border: `${3 * (1 - ip) + 1}px solid ${C.brand}`,
              opacity: 1 - ip,
            }}
          />
        )}
        <img
          src="/images/mark_ball.png"
          alt=""
          style={{
            position: 'absolute',
            left: bp.x * size,
            top: bp.y * size,
            width: bD * size,
            height: bD * size,
            opacity: bp.opacity,
            transformOrigin: 'bottom center',
            transform: `scale(${bp.sx}, ${bp.sy})`,
          }}
        />
        <img
          src="/images/mark_t.png"
          alt=""
          style={{
            position: 'absolute',
            left: tp.x * size,
            top: tY * size,
            width: tW * size,
            height: tH * size,
            transformOrigin: 'top center',
            transform: `rotate(${tp.angle}deg)`,
          }}
        />
      </div>
    </div>
  );
}

/** Full-screen splash. Calls [onDone] once the intro (plus a short hold) has played. */
export default function Splash({ onDone, ready }) {
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [ms, setMs] = useState(reduce ? TOTAL : 0);
  const [played, setPlayed] = useState(reduce);
  const start = useRef(null);

  useEffect(() => {
    if (reduce) {
      const id = setTimeout(() => setPlayed(true), 900);
      return () => clearTimeout(id);
    }
    let raf = 0;
    const tick = (now) => {
      start.current ??= now;
      const e = now - start.current;
      setMs(Math.min(TOTAL, e));
      if (e < TOTAL + 450) raf = requestAnimationFrame(tick);
      else setPlayed(true);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

  // leave only once the intro has played AND the session has booted
  useEffect(() => {
    if (played && ready) onDone();
  }, [played, ready, onDone]);

  const size = Math.min(240, Math.min(window.innerWidth, window.innerHeight) * 0.6);
  const logo = easeOut(iv(ms, 2000, 2500));
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ flex: 3 }} />
      <SplashMark ms={ms} size={size} />
      <img src="/images/logo.png" alt="Turflet" style={{ height: 60, marginTop: 32, opacity: logo, transform: `translateY(${14 * (1 - logo)}px)` }} />
      <div style={{ flex: 4 }} />
      <div style={{ width: 96, height: 4, borderRadius: 999, background: C.line, overflow: 'hidden', marginBottom: 48 }}>
        <div style={{ width: '40%', height: '100%', borderRadius: 999, background: C.brand, animation: 'splashLoad 1.4s ease-in-out infinite' }} />
      </div>
    </div>
  );
}
