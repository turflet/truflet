/** 5 · Request screening: a private 1-on-1 thread between a solo player and the host (polls every 4 s). */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, X } from 'lucide-react';
import { routes, useBack } from '../../app/nav';
import { Shell } from '../../app/Shell';
import { asList, asMap, errText } from '../../lib/api';
import { lobbyRepo } from '../../lib/repos';
import { C, d, shadow, t } from '../../theme';
import { useIsDesktop } from '../../ui/hooks';
import { useOverlay } from '../../ui/overlay';
import { Avatar, BackSquare, ErrorRetry, GhostButton, ListSkeleton, Pill, PrimaryButton, SportPill, Stat } from '../../ui/kit';
import { ChatList, Composer } from './chat';
import { attendanceLine } from './MatchRoom';
import { reliability } from './widgets';

export default function RequestThread() {
  const lobbyId = Number(useParams().lobbyId);
  const requestId = Number(useParams().requestId);
  const nav = useNavigate();
  const back = useBack(`${routes.matches}?tab=mine`);
  const desktop = useIsDesktop();
  const { toast } = useOverlay();
  const [request, setRequest] = useState(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const msgsRef = useRef([]);
  msgsRef.current = messages;

  const load = useCallback(async () => {
    try {
      const [r, m] = await Promise.all([lobbyRepo.request(lobbyId, requestId), lobbyRepo.threadMessages(lobbyId, requestId)]);
      setRequest(r);
      setMessages(m);
      setError(null);
    } catch (e) {
      setError(errText(e));
    }
  }, [lobbyId, requestId]);

  useEffect(() => {
    load();
    let busyPoll = false;
    const id = setInterval(async () => {
      if (busyPoll || document.visibilityState !== 'visible') return;
      busyPoll = true;
      try {
        const cur = msgsRef.current;
        const last = cur.length ? cur[cur.length - 1].id : undefined;
        const [fresh, r] = await Promise.all([lobbyRepo.threadMessages(lobbyId, requestId, last), lobbyRepo.request(lobbyId, requestId)]);
        setMessages([...cur, ...fresh]);
        setRequest(r);
      } catch {
        /* next tick */
      } finally {
        busyPoll = false;
      }
    }, 4000);
    return () => clearInterval(id);
  }, [lobbyId, requestId, load]);

  const decide = async (action) => {
    setBusy(true);
    try {
      const r = await lobbyRepo.decide(lobbyId, requestId, action);
      setRequest(r);
      setMessages(await lobbyRepo.threadMessages(lobbyId, requestId));
      toast(action === 'approve' ? "Approved — they're in the Match Room now." : action === 'decline' ? 'Request declined.' : 'Request withdrawn.');
    } catch (e) {
      toast(errText(e));
    } finally {
      setBusy(false);
    }
  };
  const send = async (body) => {
    try {
      const m = await lobbyRepo.sendThread(lobbyId, requestId, body);
      setMessages((x) => [...x, m]);
      return true;
    } catch (e) {
      toast(errText(e));
      return false;
    }
  };

  if (!request) {
    return (
      <Shell>
        <div style={{ padding: desktop ? 0 : 20 }}>
          <BackSquare onClick={back} />
          {error ? <ErrorRetry message={error} onRetry={load} /> : <ListSkeleton rows={5} />}
        </div>
      </Shell>
    );
  }

  const isHost = request.is_host === true;
  const status = request.status ?? 'pending';
  const pending = status === 'pending';
  const lobby = asMap(request.lobby),
    player = asMap(request.player);
  const statusMap = {
    approved: ['Approved', C.mint, C.green700],
    declined: ['Declined', C.redSoft, C.redInk],
    withdrawn: ['Withdrawn', C.chip, C.muted],
  };
  const [label, bg, fg] = statusMap[status] ?? ['Waiting for host', C.amberSoft, C.amber];
  const sports = asList(player.sports);

  const header = (
    <div
      style={{
        padding: desktop ? '14px 18px' : 'calc(var(--safe-top) + 8px) 16px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: desktop ? '#fff' : undefined,
        borderBottom: desktop ? `1px solid ${C.line}` : undefined,
      }}
    >
      <BackSquare onClick={back} />
      {isHost && <Avatar initials={player.initials ?? ''} size={40} index={player.id ?? 0} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="clamp1" style={d(18)}>
          {isHost ? (player.name ?? '') : `Chat with ${lobby.host?.name}`}
        </div>
        <div style={t(12, { c: C.green700 })}>{isHost ? attendanceLine(player) : `Private request · ${reliability(asMap(lobby.host))}`}</div>
      </div>
    </div>
  );

  const context = (
    <div style={{ margin: desktop ? 16 : '0 16px 4px', padding: 12, borderRadius: 16, background: '#fff', boxShadow: shadow.soft }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <SportPill sport={asMap(lobby.sport)} />
        <span className="clamp1" style={{ flex: 1, ...t(13, { w: 600 }) }}>
          {lobby.date_label} · {lobby.time_label}
        </span>
        <Pill bg={bg} fg={fg}>
          {label}
        </Pill>
      </div>
      {isHost ? (
        <>
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <Stat label="Games" value={player.played ?? 0} />
            <Stat label="Attendance" value={player.score == null ? 'New' : `${player.score}%`} />
            <Stat label="Drop-offs" value={player.drop_offs ?? 0} />
          </div>
          {sports.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {sports.map((s) => (
                <Pill key={s.name} bg={C.chip} fg={C.mutedInk}>
                  {s.name} · {s.level}
                </Pill>
              ))}
            </div>
          )}
        </>
      ) : (
        <div style={{ marginTop: 6, ...t(12, { c: C.muted }) }}>
          {lobby.venue?.name} · {lobby.taken}/{lobby.capacity} joined · {(lobby.per_head ?? 0) > 0 ? `your share ₹${lobby.per_head}` : 'free (host pays)'}
        </div>
      )}
    </div>
  );

  const bar = (children) => (
    <div style={{ padding: '10px 16px calc(10px + var(--safe-bottom))', background: '#fff', borderTop: `1px solid ${C.line}`, display: 'flex', gap: 10 }}>{children}</div>
  );
  let actions = null;
  if (isHost && pending)
    actions = bar(
      <>
        <GhostButton icon={X} height={50} fg={C.redInk} border={C.redSoft} onClick={busy ? undefined : () => decide('decline')} style={{ flex: 1 }}>
          Decline
        </GhostButton>
        <div style={{ flex: 2 }}>
          <PrimaryButton height={50} radius={16} fontSize={14} shadowOn={false} loading={busy} onClick={() => decide('approve')}>
            Approve to match chat
          </PrimaryButton>
        </div>
      </>,
    );
  else if (!isHost && pending)
    actions = bar(
      <GhostButton height={46} onClick={busy ? undefined : () => decide('withdraw')} style={{ flex: 1 }}>
        Withdraw request
      </GhostButton>,
    );
  else if (!isHost && status === 'approved')
    actions = bar(
      <div style={{ flex: 1 }}>
        <PrimaryButton height={52} radius={16} shadowOn={false} trailing={<ArrowRight size={18} color="#fff" />} onClick={() => nav(routes.match(lobby.id), { replace: true })}>
          {(lobby.per_head ?? 0) > 0 ? 'Open Match Room & pay' : 'Open Match Room'}
        </PrimaryButton>
      </div>,
    );

  const thread = (
    <>
      <ChatList messages={messages} emptyText={isHost ? 'Ask them anything before approving' : 'Introduce yourself to the host'} />
      {pending && <Composer hint={isHost ? 'Reply privately…' : 'Message the host privately…'} onSend={send} />}
      {actions}
    </>
  );

  if (desktop) {
    return (
      <Shell>
        <div
          style={{
            maxWidth: 820,
            margin: '0 auto',
            height: 'calc(100vh - 130px)',
            minHeight: 520,
            borderRadius: 24,
            overflow: 'hidden',
            background: C.ground,
            border: `1px solid ${C.line}`,
            boxShadow: shadow.soft,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {header}
          {context}
          {thread}
        </div>
      </Shell>
    );
  }
  return (
    <div className="page" style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {header}
      {context}
      {thread}
    </div>
  );
}
