/** Toasts and sheets. A sheet is a bottom sheet on phones (handle + rounded top, like the Flutter app)
 *  and a centred dialog on desktop. `sheet(render)` resolves with the value passed to `close`. */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { C, t } from '../theme';
import { useIsDesktop } from './hooks';

const Ctx = createContext(null);
let seq = 0;

export function OverlayProvider({ children }) {
  const [sheets, setSheets] = useState([]);
  const [msg, setMsg] = useState(null);
  const timer = useRef(undefined);

  const toast = useCallback((text) => {
    window.clearTimeout(timer.current);
    setMsg({ id: ++seq, text });
    timer.current = window.setTimeout(() => setMsg(null), 2600);
  }, []);

  const sheet = useCallback(
    (render, opts = {}) =>
      new Promise((resolve) => {
        const id = ++seq;
        setSheets((s) => [...s, { id, render: render, resolve: resolve, opts }]);
      }),
    [],
  );

  const close = (id, v) =>
    setSheets((s) => {
      const e = s.find((x) => x.id === id);
      e?.resolve(v);
      return s.filter((x) => x.id !== id);
    });

  return (
    <Ctx.Provider value={{ toast, sheet }}>
      {children}
      {sheets.map((e) => (
        <SheetFrame key={e.id} opts={e.opts} onDismiss={() => close(e.id)}>
          {e.render((v) => close(e.id, v))}
        </SheetFrame>
      ))}
      {msg &&
        createPortal(
          <div
            key={msg.id}
            role="status"
            style={{
              position: 'fixed',
              left: '50%',
              bottom: 'calc(88px + var(--safe-bottom))',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              maxWidth: 'min(92vw, 520px)',
              background: C.ink,
              color: '#fff',
              padding: '14px 18px',
              borderRadius: 14,
              boxShadow: '0 12px 32px rgba(12,36,25,.25)',
              animation: 'toastIn 200ms ease',
              ...t(14, { w: 500, c: '#fff', h: 1.4 }),
            }}
          >
            {msg.text}
          </div>,
          document.body,
        )}
    </Ctx.Provider>
  );
}

function SheetFrame({ children, opts, onDismiss }) {
  const desktop = useIsDesktop();
  const dismissible = opts.dismissible !== false;
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && dismissible && onDismiss();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [dismissible, onDismiss]);

  return createPortal(
    <div
      onClick={dismissible ? onDismiss : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 900,
        background: 'rgba(12,36,25,0.45)',
        display: 'flex',
        alignItems: desktop ? 'center' : 'flex-end',
        justifyContent: 'center',
        animation: 'fadeIn 160ms ease',
        padding: desktop ? 24 : 0,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          background: '#fff',
          width: desktop ? `min(${opts.width ?? 520}px, 100%)` : '100%',
          maxHeight: desktop ? 'min(88vh, 900px)' : '92vh',
          overflowY: 'auto',
          borderRadius: desktop ? 28 : '28px 28px 0 0',
          padding: desktop ? '28px 28px 28px' : '12px 20px calc(32px + var(--safe-bottom))',
          animation: desktop ? 'pop 220ms cubic-bezier(.2,.8,.2,1)' : 'sheetUp 260ms cubic-bezier(.2,.8,.2,1)',
          boxShadow: desktop ? '0 30px 80px rgba(12,36,25,.25)' : undefined,
        }}
      >
        {desktop ? (
          dismissible && (
            <button
              aria-label="Close"
              onClick={onDismiss}
              className="tap"
              style={{ position: 'absolute', top: 18, right: 18, width: 36, height: 36, borderRadius: 12, display: 'grid', placeItems: 'center', background: C.chip }}
            >
              <X size={18} />
            </button>
          )
        ) : (
          <div style={{ width: 44, height: 5, borderRadius: 999, background: C.dashed, margin: '0 auto 14px' }} />
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function useOverlay() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useOverlay outside OverlayProvider');
  return v;
}
