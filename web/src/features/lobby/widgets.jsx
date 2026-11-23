/** Shared match/lobby widgets — mobile/lib/features/lobby/widgets/lobby_widgets.dart + openLobby(). */
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleAlert, CircleCheck, Hourglass, Lock, MessageCircle, PiggyBank, ShieldCheck, Sparkles, Timer, UserCheck, X } from 'lucide-react';
import { routes, useRequireProfile } from '../../app/nav';
import { asMap, errText } from '../../lib/api';
import { lobbyRepo } from '../../lib/repos';
import { inr } from '../../lib/format';
import { C, d, shadow, t } from '../../theme';
import { useOverlay } from '../../ui/overlay';
import { Avatar, CardBox, GhostButton, PrimaryButton, SportPill } from '../../ui/kit';

export function SlotStatePill({ lobby, size = 11 }) {
  const map = {
    locked: ['Turf locked', C.mint, C.green700, Lock],
    crowdfunding: ['Crowdfunding', C.amberSoft, C.amber, PiggyBank],
    draft: ['Awaiting payment', C.chip, C.mutedInk, Hourglass],
    completed: ['Played', C.chip, C.mutedInk, CircleCheck],
    cancelled: ['Cancelled', C.redSoft, C.redInk, X],
  };
  const [label, bg, fg, I] = map[lobby.status] ?? ['Expired', C.chip, C.muted, X];
  return (
    <span
      style={{
        padding: '4px 9px',
        borderRadius: 999,
        background: bg,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        whiteSpace: 'nowrap',
        ...t(size, { w: 700, c: fg, h: 1.2 }),
      }}
    >
      <I size={size + 1} color={fg} /> {label}
    </span>
  );
}

export const FillBar = ({ taken, capacity, height = 6 }) => (
  <div style={{ height, borderRadius: 999, background: C.segment, overflow: 'hidden' }}>
    <div style={{ width: `${capacity ? Math.min(1, taken / capacity) * 100 : 0}%`, height: '100%', background: C.brand, transition: 'width 300ms' }} />
  </div>
);

export function AvatarStack({ initials, size = 26, max = 5 }) {
  const n = Math.min(initials.length, max);
  if (!n) return null;
  const step = size * 0.62;
  return (
    <span style={{ position: 'relative', width: size + step * (n - 1), height: size, flex: 'none' }}>
      {initials.slice(0, n).map((x, k) => (
        <span key={k} style={{ position: 'absolute', left: k * step }}>
          <Avatar initials={x} index={k} size={size} ring />
        </span>
      ))}
    </span>
  );
}

/** "96% reliable · 12 hosted" or "New host". */
export const reliability = (host) => (host.reliability == null ? 'New host' : `${host.reliability}% reliable · ${host.hosted} hosted`);

export function PerHead({ lobby, size = 18 }) {
  const amount = lobby.per_head ?? 0;
  if (!amount) return <span style={t(13, { w: 700, c: C.brand })}>Free · host pays</span>;
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      <span style={d(size, { c: C.brand })}>{inr(amount)}</span>
      <span style={t(12, { c: C.muted })}> /player</span>
    </span>
  );
}

/** Screen 3 card: host reliability, Turf Locked vs Crowdfunding, filled vs open spots, per-head cost and a role-aware action. */
export function LobbyCard({ lobby: g, onAction, onClick, showVenue = true }) {
  const host = asMap(g.host);
  const taken = g.taken ?? 0,
    capacity = g.capacity ?? 0,
    left = g.spots_left ?? 0;
  const role = g.my_role;
  const roles = {
    host: ['Your match', C.chip, C.mutedInk],
    member: ['Open room', C.mint, C.green700],
    requested: ['Requested', C.amberSoft, C.amber],
    invited: ['Accept invite', C.coral, '#fff'],
  };
  const [label, bg, fg] = roles[role] ?? (left === 0 ? ['Full', C.chip, C.muted] : [role === 'declined' ? 'Request again' : 'Request to join', C.brand, '#fff']);
  const disabled = (role == null || role === 'declined') && left === 0;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      className="tap lift"
      style={{ padding: 14, borderRadius: 20, background: '#fff', boxShadow: shadow.card, cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <SportPill sport={asMap(g.sport)} />
        <SlotStatePill lobby={g} />
        <span style={{ flex: 1 }} />
        <PerHead lobby={g} />
      </div>
      <div style={{ marginTop: 10, ...d(17) }}>
        {g.date_label} · {g.time_label}
      </div>
      <div className="clamp1" style={{ marginTop: 2, ...t(13, { c: C.muted }) }}>
        {showVenue ? `${g.venue?.name}, ${g.venue?.area} · ${g.court?.name}` : g.court?.name}
      </div>
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar initials={host.initials ?? ''} size={28} index={1} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={t(13, { w: 600, c: role === 'invited' ? C.orangeInk : C.ink })}>{role === 'invited' ? `${host.name ?? ''} invited you` : `Hosted by ${host.name ?? ''}`}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, ...t(11, { c: C.green700 }) }}>
            {host.reliability == null ? <Sparkles size={12} color={C.green700} /> : <ShieldCheck size={12} color={C.green700} />}
            {reliability(host)}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <FillBar taken={taken} capacity={capacity} />
      </div>
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <AvatarStack initials={g.avatars ?? []} />
        <div style={{ flex: 1, ...t(12, { c: C.muted }) }}>
          {taken}/{capacity} joined · {left === 0 ? 'full' : `${left} spot${left === 1 ? '' : 's'} open`}
        </div>
        {onAction && (
          <span onClick={(e) => e.stopPropagation()}>
            <GhostButton
              height={38}
              radius={12}
              fontSize={13}
              bg={bg}
              fg={fg}
              border="transparent"
              onClick={disabled ? undefined : onAction}
              style={{ opacity: disabled ? 0.7 : 1 }}
            >
              {label}
            </GhostButton>
          </span>
        )}
      </div>
    </div>
  );
}

export const EmptyNote = ({ icon: I, title, body, action }) => (
  <div style={{ padding: '36px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
    <I size={40} color={C.muted} />
    <div style={{ marginTop: 12, ...d(18) }}>{title}</div>
    <div style={{ marginTop: 6, maxWidth: 420, ...t(14, { c: C.muted, h: 1.5 }) }}>{body}</div>
    {action && <div style={{ marginTop: 16, width: '100%', maxWidth: 280 }}>{action}</div>}
  </div>
);

export const SheetError = ({ message }) => (
  <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: C.redSoft, display: 'flex', gap: 8, alignItems: 'flex-start', ...t(13, { c: C.redInk, h: 1.4 }) }}>
    <CircleAlert size={16} color={C.redInk} style={{ flex: 'none', marginTop: 1 }} /> {message}
  </div>
);

/** Opens the right place for a lobby: the Match Room, my request thread, the invite sheet or the request sheet. */
export function useOpenLobby() {
  const nav = useNavigate();
  const { sheet } = useOverlay();
  const requireProfile = useRequireProfile();
  return useCallback(
    async (lobby, onChanged) => {
      const role = lobby.my_role;
      if (role === 'host' || role === 'member') return nav(routes.match(lobby.id));
      if (role === 'invited') {
        const accepted = await sheet((close) => <InviteSheet lobby={lobby} close={close} />);
        onChanged?.();
        if (accepted) nav(routes.match(lobby.id));
        return;
      }
      if (role === 'requested' && lobby.my_request_id != null) return nav(routes.request(lobby.id, lobby.my_request_id));
      if ((lobby.spots_left ?? 0) <= 0) return;
      if (!(await requireProfile())) return;
      const req = await sheet((close) => <RequestSheet lobby={lobby} close={close} />);
      onChanged?.();
      if (req) nav(routes.request(lobby.id, req.id));
    },
    [nav, sheet, requireProfile],
  );
}

function InviteSheet({ lobby: g, close }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const answer = async (action) => {
    setBusy(action);
    setError(null);
    try {
      await lobbyRepo.action(g.id, action);
      close(action === 'accept-invite');
    } catch (e) {
      setError(errText(e));
      setBusy(null);
    }
  };
  const split = (g.per_head ?? 0) > 0;
  return (
    <div>
      <div style={d(22)}>{g.host?.name} invited you</div>
      <div style={{ marginTop: 6, ...t(14, { w: 600 }) }}>
        {g.sport?.name} at {g.venue?.name}
      </div>
      <div style={t(13, { c: C.muted })}>
        {g.date_label} · {g.time_label} · {g.taken}/{g.capacity} in
      </div>
      <CardBox shadowCss={null} border={`1px solid ${C.line}`} padding={14} style={{ marginTop: 14, ...t(13, { h: 1.4 }) }}>
        {split ? `Your share is ${inr(g.per_head)}. You pay it into escrow from the Match Room — never to the host.` : `${g.host?.name} is covering the slot — you play free.`}
      </CardBox>
      {error && <SheetError message={error} />}
      <div style={{ height: 14 }} />
      <PrimaryButton loading={busy === 'accept-invite'} onClick={busy == null ? () => answer('accept-invite') : undefined}>
        Accept & join
      </PrimaryButton>
      <div style={{ height: 8 }} />
      <GhostButton onClick={busy == null ? () => answer('decline-invite') : undefined} style={{ width: '100%' }}>
        Decline
      </GhostButton>
    </div>
  );
}

function RequestSheet({ lobby: g, close }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const split = (g.per_head ?? 0) > 0;
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      close(await lobbyRepo.requestToJoin(g.id, note.trim()));
    } catch (e) {
      setError(errText(e));
      setBusy(false);
    }
  };
  return (
    <div>
      <div style={d(22)}>{g.my_role === 'declined' ? 'Request again' : 'Request to join'}</div>
      {g.my_role === 'declined' && <div style={{ marginTop: 4, ...t(13, { c: C.muted }) }}>The host declined you last time — you can ask once more.</div>}
      <div style={{ marginTop: 6, ...t(14, { c: C.muted }) }}>
        {g.sport?.name} · {g.date_label} · {g.time_label}
      </div>
      <CardBox shadowCss={null} border={`1px solid ${C.line}`} padding={14} style={{ marginTop: 14 }}>
        <Step icon={MessageCircle} text={`A private chat opens with ${g.host?.name}. The squad chat stays hidden.`} />
        <Step icon={UserCheck} text="The host approves or declines after checking your attendance score. No answer in 2 hours and the request expires." />
        <Step
          icon={split ? Timer : CircleCheck}
          text={split ? `Once approved, pay your ${inr(g.per_head)} share. Spots go to the first players who pay.` : 'The host covers the slot — you play free once approved.'}
        />
      </CardBox>
      <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 14, background: C.ground, border: `1px solid ${C.line}` }}>
        <textarea
          rows={3}
          maxLength={300}
          value={note}
          placeholder="Say hi — position, skill level… (optional)"
          onChange={(e) => setNote(e.target.value)}
          style={{ ...t(14), resize: 'none' }}
        />
        <div style={{ textAlign: 'right', ...t(11, { c: C.muted }) }}>{note.length}/300</div>
      </div>
      {error && <SheetError message={error} />}
      <div style={{ height: 12 }} />
      <PrimaryButton loading={busy} onClick={send}>
        Send request
      </PrimaryButton>
    </div>
  );
}

const Step = ({ icon: I, text }) => (
  <div style={{ padding: '5px 0', display: 'flex', gap: 10, alignItems: 'flex-start', ...t(13, { h: 1.4 }) }}>
    <I size={16} color={C.green700} style={{ flex: 'none', marginTop: 1 }} /> {text}
  </div>
);
