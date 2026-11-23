/** Chat: system notes centred, payment cards, bubbles, composer — mobile/lib/features/lobby/widgets/chat.dart. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronsRight, CircleCheck, Send, Wallet } from 'lucide-react';
import { asMap } from '../../lib/api';
import { inr, mmss } from '../../lib/format';
import { C, t } from '../../theme';
import { useNow } from '../../ui/hooks';
import { Avatar, Pill, PrimaryButton, Spinner } from '../../ui/kit';

export function ChatList({ messages, onPay, emptyText = 'Say hi 👋' }) {
  const box = useRef(null);
  const stick = useRef(true);
  const lastId = messages[messages.length - 1]?.id;
  // keep pinned to the newest message unless the player scrolled up to read
  useLayoutEffect(() => {
    const el = box.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [lastId, messages.length]);
  if (!messages.length) return <div style={{ flex: 1, display: 'grid', placeItems: 'center', ...t(14, { c: C.muted }) }}>{emptyText}</div>;
  return (
    <div
      ref={box}
      onScroll={(e) => {
        const el = e.currentTarget;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
      style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 16px' }}
    >
      {messages.map((m, i) => {
        const prev = messages[i - 1];
        const grouped = prev && prev.kind === 'text' && prev.sender?.id === m.sender?.id;
        if (m.kind === 'system') return <SystemNote key={m.id} m={m} />;
        if (m.kind === 'payment') return <PaymentCard key={m.id} message={m} onPay={onPay} />;
        return <Bubble key={m.id} m={m} showName={!grouped} />;
      })}
    </div>
  );
}

const SystemNote = ({ m }) => (
  <div style={{ padding: '3px 0', display: 'flex', justifyContent: 'center' }}>
    <span className="clamp2" style={{ maxWidth: 280, padding: '4px 10px', borderRadius: 999, background: C.segment, textAlign: 'center', ...t(11, { c: C.mutedInk, h: 1.3 }) }}>
      {m.body ?? ''}
    </span>
  </div>
);

function Bubble({ m, showName }) {
  const sender = asMap(m.sender);
  const mine = sender.is_me === true;
  const [open, setOpen] = useState(false);
  const long = String(m.body ?? '').length > 360 || String(m.body ?? '').split('\n').length > 6;
  return (
    <div style={{ paddingTop: showName ? 10 : 3, display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8 }}>
      {!mine && (showName ? <Avatar initials={sender.initials ?? ''} size={28} index={sender.id ?? 0} /> : <span style={{ width: 28, flex: 'none' }} />)}
      <div
        style={{
          maxWidth: 'min(420px, 78%)',
          padding: '8px 12px',
          background: mine ? C.brand : '#fff',
          border: mine ? undefined : `1px solid ${C.line}`,
          borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        }}
      >
        {!mine && showName && <div style={{ marginBottom: 2, ...t(12, { w: 700, c: C.green700 }) }}>{sender.name ?? ''}</div>}
        <div
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            ...(long && !open ? { display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : {}),
            ...t(14, { c: mine ? '#fff' : C.ink, h: 1.4 }),
          }}
        >
          {m.body ?? ''}
        </div>
        {long && (
          <button onClick={() => setOpen(!open)} style={{ marginTop: 2, ...t(12, { w: 700, c: mine ? '#fff' : C.brand }) }}>
            {open ? 'Show less' : 'Read more'}
          </button>
        )}
        <div style={{ marginTop: 2, textAlign: 'right', ...t(10, { c: mine ? 'rgba(255,255,255,.7)' : C.muted }) }}>{m.at ?? ''}</div>
      </div>
    </div>
  );
}

/** In-chat UPI payment card. Solo joiners get a strict 15-minute countdown. */
export function PaymentCard({ message, onPay }) {
  const now = useNow();
  const card = asMap(message.card);
  const paid = card.status === 'confirmed';
  const open = card.status === 'pending';
  const mine = card.is_me === true;
  const until = card.pay_by ? new Date(card.pay_by).getTime() : null;
  const left = until == null ? null : Math.max(0, until - now);
  if (!(open && mine && onPay)) {
    return (
      <div style={{ padding: '3px 0' }}>
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 12,
            background: paid ? C.mint : open ? '#fff' : C.chip,
            border: `1px solid ${paid ? C.mint : C.line}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {paid ? <CircleCheck size={15} color={C.green700} /> : <Wallet size={15} color={C.muted} />}
          <span className="clamp1" style={{ flex: 1, ...t(13, { w: 600 }) }}>
            {mine ? 'You' : card.name} · {inr(card.amount)}
          </span>
          {paid ? (
            <span style={t(12, { w: 700, c: C.green700 })}>Paid</span>
          ) : open && left != null ? (
            <span style={t(12, { w: 600, c: left < 300000 ? C.redInk : C.amber })}>Due · {mmss(left)}</span>
          ) : open ? (
            <span style={t(12, { w: 600, c: C.amber })}>Due</span>
          ) : (
            <span style={t(12, { c: C.muted })}>Closed</span>
          )}
        </div>
      </div>
    );
  }
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ padding: 14, borderRadius: 18, background: '#fff', border: `2px solid ${C.brand}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ChevronsRight size={18} color={C.brand} />
          <span style={{ flex: 1, ...t(14, { w: 700 }) }}>Your share · {inr(card.amount)}</span>
          {left != null && (
            <Pill bg={left < 300000 ? C.redSoft : C.amberSoft} fg={left < 300000 ? C.redInk : C.amber}>
              {mmss(left)}
            </Pill>
          )}
        </div>
        <div style={{ marginTop: 6, ...t(12, { c: C.muted, h: 1.4 }) }}>{left != null ? 'The first players to pay get the open spots' : 'Paid into escrow, never to the host'}</div>
        <div style={{ height: 10 }} />
        <PrimaryButton height={46} radius={14} shadowOn={false} onClick={onPay}>
          Pay {inr(card.amount)} with UPI
        </PrimaryButton>
      </div>
    </div>
  );
}

/** Text field + send button. */
export function Composer({ onSend, hint = 'Message the squad' }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 110)}px`;
  }, [text]);
  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    const ok = await onSend(body);
    setBusy(false);
    if (ok) setText('');
  };
  return (
    <div style={{ padding: '8px 12px calc(8px + var(--safe-bottom))', background: '#fff', borderTop: `1px solid ${C.line}`, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
      <div style={{ flex: 1, minHeight: 44, padding: '11px 14px', borderRadius: 22, background: C.ground, border: `1px solid ${C.line}`, display: 'flex' }}>
        <textarea
          ref={ref}
          rows={1}
          maxLength={500}
          value={text}
          placeholder={hint}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          style={{ ...t(14, { h: 1.4 }), resize: 'none' }}
        />
      </div>
      <button
        aria-label="Send"
        className="tap"
        onClick={send}
        style={{ width: 44, height: 44, flex: 'none', borderRadius: 99, background: C.brand, display: 'grid', placeItems: 'center' }}
      >
        {busy ? <Spinner size={18} stroke={2} /> : <Send size={18} color="#fff" />}
      </button>
    </div>
  );
}
