/** Shared match/lobby widgets — mobile/lib/features/lobby/widgets/lobby_widgets.dart + openLobby(). */
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleAlert, CircleCheck, Hourglass, Lock, MessageCircle, PiggyBank, Sparkles, Timer, UserCheck, X } from 'lucide-react';
import { ShieldCheck } from '../../ui/icons';
import { routes, useRequireProfile } from '../../app/nav';
import { asMap, errText } from '../../lib/api';
import { lobbyRepo } from '../../lib/repos';
import { sportScene } from '../../lib/art';
import { inr } from '../../lib/format';
import { C, d, t } from '../../theme';
import { useOverlay } from '../../ui/overlay';
import { Avatar, CardBox, GhostButton, Img, PrimaryButton } from '../../ui/kit';

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
  <div style={{ height, borderRadius: 999, background: C.chip, overflow: 'hidden' }}>
    <div style={{ width: `${capacity ? Math.min(1, taken / capacity) * 100 : 0}%`, height: '100%', borderRadius: 999, background: C.green700, transition: 'width 300ms' }} />
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

/** Lobby card (redesign): sport photo header with the slot state, host + reliability, fill bar, per-head share and a
 *  role-aware action. */
export function LobbyCard({ lobby: g, onAction, onClick, showVenue = true }) {
  const host = asMap(g.host);
  const sport = asMap(g.sport);
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
  const photo = sportScene(sport.name);
  const locked = g.status === 'locked';
  const where = showVenue ? `${g.venue?.name ?? ''}` : g.court?.name;
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      className="lift"
      style={{ borderRadius: 22, background: '#fff', border: '1px solid #F0EEE8', boxShadow: '0 1px 2px rgba(12,36,25,.05), 0 6px 20px rgba(12,36,25,.07)', overflow: 'hidden', cursor: 'pointer' }}
    >
      <div style={{ position: 'relative', height: 120 }}>
        <Img url={photo} alt={sport.name ?? ''} />
        <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(12,36,25,0) 30%, rgba(12,36,25,.85) 100%)' }} />
        <span
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '5px 9px',
            borderRadius: 999,
            background: locked ? C.mint : C.coralSoft,
            ...t(11, { w: 800, c: locked ? C.brand : C.orangeInk, h: 1.2 }),
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: locked ? C.green700 : C.coral }} />
          {locked ? 'Turf locked' : g.status === 'crowdfunding' ? 'Crowdfunding' : (g.status_label ?? g.status)}
        </span>
        <span style={{ position: 'absolute', left: 14, right: 14, bottom: 10, display: 'flex', flexDirection: 'column' }}>
          <span className="clamp1" style={d(17, { c: '#fff', ls: -0.3 })}>
            {sport.name}
            {where ? ` · ${where}` : ''}
          </span>
          <span className="clamp1" style={t(12.5, { w: 600, c: C.mint })}>
            {g.date_label} · {g.time_label}
            {showVenue && g.venue?.area ? ` · ${g.venue.area}` : ''}
          </span>
        </span>
      </div>
      <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar initials={host.initials ?? ''} size={38} index={0} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="clamp1" style={t(14, { w: 800, c: role === 'invited' ? C.orangeInk : C.ink })}>
              {role === 'invited' ? `${host.name ?? ''} invited you` : `${host.name ?? ''} is hosting`}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, ...t(12, { w: 600, c: C.muted }) }}>
              {host.reliability == null ? <Sparkles size={12} color={C.green700} /> : <ShieldCheck size={12} color={C.green700} />}
              {reliability(host)}
            </div>
          </div>
          <AvatarStack initials={g.avatars ?? []} size={24} max={4} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', ...t(12.5, { w: 700 }) }}>
            <span>
              {taken} of {capacity} joined
            </span>
            <span style={{ color: left === 0 ? C.muted : C.orangeInk }}>{left === 0 ? 'Full' : `${left} spot${left === 1 ? '' : 's'} left`}</span>
          </div>
          <FillBar taken={taken} capacity={capacity} height={8} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 12, borderTop: `1px dashed ${C.chipLine}` }}>
          {(g.per_head ?? 0) > 0 ? (
            <span style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={d(18, { ls: -0.4 })}>{inr(g.per_head)}</span>
              <span style={t(11.5, { w: 600, c: C.muted })}>per player · held in escrow</span>
            </span>
          ) : (
            <span style={t(13, { w: 800, c: C.brand })}>Free · host pays</span>
          )}
          {onAction && (
            <span onClick={(e) => e.stopPropagation()}>
              <GhostButton
                height={44}
                radius={14}
                fontSize={14}
                bg={bg}
                fg={fg}
                border="transparent"
                onClick={disabled ? undefined : onAction}
                style={{ opacity: disabled ? 0.7 : 1, fontWeight: 800, padding: '0 16px' }}
              >
                {label}
              </GhostButton>
            </span>
          )}
        </div>
      </div>
    </article>
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
