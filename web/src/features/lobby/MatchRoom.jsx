/** 5 + 6 · Match Room: pinned header (Turf Locked / Unbooked, Paid 8/10, Booking QR / PIN), in-chat 15-minute
 *  UPI payment cards, group chat, players, and the host's Requests tab. Polls every 4 s while open.
 *  Phone = the Flutter screen with tabs. Desktop = match panel on the left, live chat on the right. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CalendarClock,
  CircleCheck,
  Ellipsis,
  EyeOff,
  Flag,
  Inbox,
  LockOpen,
  LogOut,
  MapPin,
  MapPinCheck,
  QrCode,
  ShieldCheck,
  Ticket,
  Timer,
  TriangleAlert,
  UserPlus,
  Users,
  UserX,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { routes, useBack } from '../../app/nav';
import { Shell } from '../../app/Shell';
import { asList, asMap, errText } from '../../lib/api';
import { lobbyRepo, venueRepo } from '../../lib/repos';
import { addDays, eeeD, inr, mmss, ymd } from '../../lib/format';
import { C, d, shadow, t } from '../../theme';
import { useIsDesktop, useNow } from '../../ui/hooks';
import { useOverlay } from '../../ui/overlay';
import { Avatar, BackSquare, Choice, ErrorRetry, GhostButton, ListSkeleton, Pill, PrimaryButton, Segmented, Sk, SquareIconButton } from '../../ui/kit';
import { ChatList, Composer } from './chat';
import { showPayBalance, showSplitCheckout } from './SplitCheckout';
import { EmptyNote, FillBar, LobbyCard, SlotStatePill, useOpenLobby } from './widgets';

/** "12 games · 92% attendance · 1 drop-off" / "New player". */
export function attendanceLine(p) {
  if (p.score == null) return p.played === 0 ? 'New player · no games yet' : `${p.played} games played`;
  const drops = p.drop_offs ?? 0;
  return `${p.played} games · ${p.score}% attendance${drops > 0 ? ` · ${drops} drop-off${drops === 1 ? '' : 's'}` : ''}`;
}

export default function MatchRoom() {
  const lobbyId = Number(useParams().lobbyId);
  const nav = useNavigate();
  const back = useBack(routes.matches);
  const desktop = useIsDesktop();
  const { toast, sheet } = useOverlay();
  const openLobby = useOpenLobby();
  const now = useNow();

  const [lobby, setLobby] = useState(null);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [requests, setRequests] = useState(null);
  const [tab, setTab] = useState(0);
  const tick = useRef(0);
  const busy = useRef(false);
  const msgsRef = useRef([]);
  msgsRef.current = messages;

  const loadRequests = useCallback(async () => {
    try {
      setRequests(await lobbyRepo.requests(lobbyId));
    } catch {
      /* keep the last list */
    }
  }, [lobbyId]);

  const load = useCallback(async () => {
    try {
      const l = await lobbyRepo.lobby(lobbyId);
      setLobby(l);
      setError(null);
      if (l.members != null) {
        setMessages(await lobbyRepo.messages(lobbyId));
        if (l.my_role === 'host' && l.is_public === true) await loadRequests();
      }
    } catch (e) {
      setError(errText(e));
    }
  }, [lobbyId, loadRequests]);

  // every poll refreshes the lobby and new chat; payment cards change in place, so re-read all chat every 3rd poll
  useEffect(() => {
    load();
    const id = setInterval(async () => {
      if (busy.current || document.visibilityState !== 'visible') return;
      busy.current = true;
      tick.current++;
      try {
        const l = await lobbyRepo.lobby(lobbyId);
        setLobby(l);
        if (l.members == null) return;
        const cur = msgsRef.current;
        const last = cur.length ? cur[cur.length - 1].id : undefined;
        const full = last == null || tick.current % 3 === 0;
        setMessages(full ? await lobbyRepo.messages(lobbyId) : [...cur, ...(await lobbyRepo.messages(lobbyId, last))]);
        if (l.my_role === 'host' && l.is_public === true) await loadRequests();
      } catch {
        /* next tick */
      } finally {
        busy.current = false;
      }
    }, 4000);
    return () => clearInterval(id);
  }, [lobbyId, load, loadRequests]);

  const applied = async (l) => {
    setLobby(l);
    if (l.members != null) lobbyRepo.messages(lobbyId).then(setMessages, () => undefined);
  };

  const run = async (action, body = {}) => {
    try {
      const r = await lobbyRepo.action(lobbyId, action, body);
      await applied(r);
      toast(r.message ?? 'Done');
      return true;
    } catch (e) {
      toast(errText(e));
      return false;
    }
  };

  const confirm = (title, body, cta, color = C.orange) =>
    sheet((close) => (
      <div>
        <div style={d(22)}>{title}</div>
        <div style={{ margin: '8px 0 16px', ...t(14, { c: C.muted, h: 1.5 }) }}>{body}</div>
        <PrimaryButton height={52} color={color} shadowOn={false} onClick={() => close(true)}>
          {cta}
        </PrimaryButton>
      </div>
    )).then((x) => x === true);

  const pay = async () => {
    const l = await showSplitCheckout(sheet, lobbyId);
    if (l) {
      await applied(l);
      toast(l.status === 'locked' ? 'Paid — the turf is locked!' : 'Paid into escrow ✓');
    }
  };
  const payBalance = async (amount) => {
    const l = await showPayBalance(sheet, lobbyId, amount);
    if (l) {
      await applied(l);
      toast('Balance paid — the turf is locked.');
    }
  };
  const lockTurf = async () => {
    try {
      const r = await lobbyRepo.action(lobbyId, 'lock');
      await applied(r);
      nav(routes.payment(asMap(r.checkout_booking).id));
    } catch (e) {
      toast(errText(e));
    }
  };
  const checkin = () => {
    if (!navigator.geolocation) return toast('Turn on location to check in — or show your booking QR at the counter.');
    navigator.geolocation.getCurrentPosition(
      (pos) => run('checkin', { lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => toast('Turn on location to check in — or show your booking QR at the counter.'),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };
  const report = async () => {
    const reason = await sheet((close) => <ReportSheet close={close} />);
    if (reason != null) run('report', { reason });
  };
  const leave = async (l) => {
    const mins = (new Date(l.starts_at).getTime() - Date.now()) / 60000;
    const paid = l.me?.status === 'confirmed' && (l.per_head ?? 0) > 0;
    const body = !paid
      ? 'Your spot opens up for someone else.'
      : l.status === 'crowdfunding'
        ? "The turf isn't booked yet, so your share is refunded right away."
        : mins >= 30
          ? 'Your share is refunded once a replacement player joins (or the slot is released).'
          : 'Kickoff is less than 30 minutes away — your share is not refundable.';
    if (!(await confirm('Leave this match?', body, 'Leave match'))) return;
    if (await run('leave')) back();
  };
  const cancelMatch = async () => {
    if (
      await confirm(
        'Cancel the match?',
        "Everyone who paid a share is refunded in full. If the turf is booked, your own refund follows the venue's cancellation policy.",
        'Cancel match',
        C.red,
      )
    )
      run('cancel');
  };
  const unpublish = async () => {
    if (
      await confirm(
        'Stop recruiting?',
        'Open spots are removed from the public list, pending requests are closed and solo players who paid are refunded. Your squad and chat stay as they are.',
        'Unpublish lobby',
      )
    )
      run('unpublish');
  };
  const switchSlot = async (l) => {
    const pick = await sheet((close) => <SwitchSlotSheet lobby={l} close={close} />);
    if (pick) run('switch-slot', pick);
  };
  const showPass = (b) =>
    sheet(() => (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={d(22)}>Booking pass</div>
        <div style={{ marginTop: 4, ...t(13, { c: C.muted }) }}>Show the QR at the counter, or tell the manager the PIN</div>
        <div style={{ marginTop: 16, padding: 12, borderRadius: 20, background: '#fff', border: `1px solid ${C.line}` }}>
          <QRCodeSVG value={String(b.qr_payload ?? '')} size={200} fgColor={C.ink} />
        </div>
        <div style={{ marginTop: 16, ...t(11, { w: 600, c: C.muted, ls: 1.2 }) }}>CHECK-IN PIN</div>
        <div style={{ marginTop: 4, ...d(36, { ls: 4, c: C.brand }) }}>
          {String(b.pin ?? '----')
            .split('')
            .join(' ')}
        </div>
        <div style={{ marginTop: 6, ...t(13, { c: C.muted }) }}>{b.code ?? ''}</div>
        <div style={{ marginTop: 12, padding: 12, borderRadius: 14, background: C.limeSoft, ...t(12, { c: C.green900, h: 1.4 }) }}>
          When the venue scans this, the match goes Live and the recovered shares are released to the host.
        </div>
      </div>
    ));
  const menu = (l) => {
    const host = asMap(l.host_actions),
      me = asMap(l.me),
      b = l.booking;
    const item = (I, label, onClick, color = C.ink) => ({ I, label, onClick, color });
    const items = [
      item(MapPin, 'Venue details', () => nav(routes.venue(l.venue.id))),
      b && item(Ticket, 'Booking ticket', () => nav(routes.ticket(b.id))),
      host.can_switch === true && item(CalendarClock, 'Switch to another slot', () => switchSlot(l)),
      host.can_unpublish === true && item(EyeOff, 'Unpublish lobby', unpublish),
      host.can_cancel === true && item(X, 'Cancel match', cancelMatch, C.redInk),
      me.can_leave === true && item(LogOut, 'Leave match', () => leave(l), C.orangeInk),
    ].filter(Boolean);
    sheet((close) => (
      <div>
        {items.map((x) => (
          <button
            key={x.label}
            className="tap"
            onClick={() => (close(), x.onClick())}
            style={{ width: '100%', padding: '14px 4px', display: 'flex', alignItems: 'center', gap: 16, textAlign: 'left', ...t(15, { w: 600, c: x.color }) }}
          >
            <x.I size={20} color={x.color} /> {x.label}
          </button>
        ))}
      </div>
    ));
  };
  const removeMember = async (m) => {
    if (!(await confirm(`Remove ${m.name}?`, 'Anything they paid is refunded in full and the spot opens again.', 'Remove player'))) return;
    try {
      await applied(await lobbyRepo.removeMember(lobbyId, m.id));
    } catch (e) {
      toast(errText(e));
    }
  };
  const send = async (body) => {
    try {
      const m = await lobbyRepo.send(lobbyId, body);
      setMessages((x) => [...x, m]);
      return true;
    } catch (e) {
      toast(errText(e));
      return false;
    }
  };

  if (!lobby) {
    return (
      <Shell>
        <div style={{ padding: desktop ? 0 : 20 }}>
          <BackSquare onClick={back} />
          {error ? <ErrorRetry message={error} onRetry={load} /> : <ListSkeleton rows={5} />}
        </div>
      </Shell>
    );
  }

  const isHost = lobby.my_role === 'host';
  if (lobby.members == null) {
    return (
      <Shell>
        <div style={{ padding: desktop ? 0 : 20, maxWidth: 640, margin: '0 auto' }}>
          <BackSquare onClick={back} />
          <div style={{ marginTop: 16, ...d(24) }}>Match</div>
          <div style={{ margin: '4px 0 16px', ...t(14, { c: C.muted }) }}>Only approved players can see the squad chat.</div>
          <LobbyCard lobby={lobby} onAction={() => openLobby(lobby, load)} />
        </div>
      </Shell>
    );
  }

  const me = asMap(lobby.me),
    host = asMap(lobby.host_actions),
    pool = asMap(lobby.pool),
    payout = asMap(lobby.payout);
  const booking = lobby.booking;
  const live = ['draft', 'crowdfunding', 'locked'].includes(lobby.status);
  const paidCount = lobby.paid_count ?? 0,
    cap = lobby.capacity ?? 0;
  const payoutText = {
    held: 'Shares held in escrow · released to the host at check-in',
    released: `Shares released to the host · ${payout.at ?? ''}`,
    settled: 'Pool paid to the venue',
    disputed: 'No-show reported · payout on hold',
    refunded: 'Refunded',
  };

  const header = (
    <div style={{ padding: desktop ? '0 0 16px' : 'calc(var(--safe-top) + 8px) 16px 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <BackSquare onClick={back} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="clamp1" style={d(desktop ? 26 : 18)}>
          {lobby.venue?.name}
        </div>
        <div className="clamp1" style={t(12, { c: C.muted })}>
          {lobby.sport?.name} · {lobby.date_label} · {lobby.time_label} · {lobby.court?.name}
        </div>
      </div>
      <SquareIconButton icon={Ellipsis} label="Match options" onClick={() => menu(lobby)} />
    </div>
  );

  const pinned = (
    <div style={{ margin: desktop ? 0 : '0 16px', padding: 14, borderRadius: 20, background: '#fff', boxShadow: shadow.card }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <SlotStatePill lobby={lobby} />
        {lobby.is_public === true && lobby.status !== 'completed' && (
          <Pill bg={C.limeSoft} fg={C.green700}>
            {lobby.spots_left} open
          </Pill>
        )}
        <span style={{ flex: 1 }} />
        {lobby.own_squad === true ? (
          <span style={t(13, { w: 700 })}>Private · squad of {cap}</span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, ...t(13, { w: 700 }) }}>
            <CircleCheck size={15} color={C.green700} /> Paid {paidCount}/{cap}
          </span>
        )}
      </div>
      {lobby.status === 'crowdfunding' && (
        <>
          <div style={{ marginTop: 10, display: 'flex', ...t(12, { c: C.muted }) }}>
            <span style={{ flex: 1 }}>Pool for the turf</span>
            <b style={{ color: C.ink }}>
              {inr(pool.pooled)} of {inr(pool.target)}
            </b>
          </div>
          <div style={{ marginTop: 6 }}>
            <FillBar taken={pool.pooled ?? 0} capacity={pool.target ?? 1} />
          </div>
        </>
      )}
      {payoutText[payout.status] && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, ...t(12, { c: C.mutedInk }) }}>
          <ShieldCheck size={14} color={C.green700} /> {payoutText[payout.status]}
        </div>
      )}
      {(booking || me.can_checkin === true || me.can_report === true) && (
        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          {booking && (
            <GhostButton icon={QrCode} height={40} radius={12} fontSize={13} onClick={() => showPass(asMap(booking))} style={{ flex: 1 }}>
              Booking QR / PIN
            </GhostButton>
          )}
          {me.can_checkin === true && (
            <GhostButton icon={MapPinCheck} height={40} radius={12} fontSize={13} bg={C.mint} fg={C.green700} border="transparent" onClick={checkin} style={{ flex: 1 }}>
              Check in here
            </GhostButton>
          )}
          {me.can_report === true && (
            <GhostButton icon={Flag} height={40} radius={12} fontSize={13} fg={C.redInk} border={C.redSoft} onClick={report} style={{ flex: 1 }}>
              Report no-show
            </GhostButton>
          )}
        </div>
      )}
    </div>
  );

  const act = (label, onClick, primary = false) => (
    <GhostButton
      key={label}
      height={38}
      radius={12}
      fontSize={12}
      bg={primary ? C.brand : '#fff'}
      fg={primary ? '#fff' : C.ink}
      border="transparent"
      onClick={onClick}
      style={{ flex: 1 }}
    >
      {label}
    </GhostButton>
  );
  const banner = (key, I, bg, fg, title, body, actions = []) => (
    <div key={key} style={{ margin: desktop ? '10px 0 0' : '10px 16px 0', padding: 12, borderRadius: 16, background: bg }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <I size={18} color={fg} style={{ flex: 'none' }} />
        <div>
          <div style={t(14, { w: 700, c: fg })}>{title}</div>
          <div style={{ marginTop: 2, ...t(12, { c: fg, h: 1.4 }) }}>{body}</div>
        </div>
      </div>
      {actions.length > 0 && <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  );
  const banners = [];
  if (isHost && lobby.alert === 'slot_taken')
    banners.push(
      banner(
        'taken',
        TriangleAlert,
        C.redSoft,
        C.redInk,
        'Another group booked this slot',
        'Move your squad to another slot, or cancel — everyone who paid is refunded automatically.',
        [act('Switch slot', () => switchSlot(lobby), true), act('Cancel match', cancelMatch)],
      ),
    );
  else if (isHost && lobby.alert === 'unfilled')
    banners.push(
      banner(
        'unfilled',
        Timer,
        C.amberSoft,
        C.amber,
        'Kickoff soon — the pool is short',
        `Pay the remaining ${inr(host.pay_balance)} to lock the turf now, switch slot, or unpublish (solo players are refunded, your squad chat stays).`,
        [
          host.pay_balance != null && act(`Pay ${inr(host.pay_balance)}`, () => payBalance(host.pay_balance), true),
          act('Switch slot', () => switchSlot(lobby)),
          host.can_unpublish === true && act('Unpublish', unpublish),
        ].filter(Boolean),
      ),
    );
  if (isHost && lobby.held_booking != null)
    banners.push(
      banner('held', LockOpen, C.orangeBg, C.orangeInk, 'Turf not locked yet', "Pay for the turf within 15 minutes of creating the match, or it's cancelled and the slot is released.", [
        act('Pay & lock turf', () => nav(routes.payment(lobby.held_booking)), true),
      ]),
    );
  else if (isHost && host.can_lock === true && lobby.alert !== 'slot_taken')
    banners.push(
      banner(
        'lock',
        LockOpen,
        C.coralSoft,
        C.orangeInk,
        'Turf not booked yet',
        `Get your squad together first. Pay ${inr(host.lock_amount)} to lock the slot when you're ready — until then another group can still book it.`,
        [act('Lock turf', lockTurf, true), host.can_switch === true && act('Switch slot', () => switchSlot(lobby))].filter(Boolean),
      ),
    );
  if (me.can_pay === true) {
    const until = me.pay_by ? new Date(me.pay_by).getTime() : null;
    const left = until == null ? null : Math.max(0, until - now);
    banners.push(
      <div
        key="pay"
        style={{
          margin: desktop ? '10px 0 0' : '10px 16px 0',
          padding: '10px 10px 10px 14px',
          borderRadius: 16,
          background: '#fff',
          border: `2px solid ${C.brand}`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={t(14, { w: 700 })}>Your share · {inr(me.amount_due)}</div>
          <div style={t(12, { c: left != null && left < 300000 ? C.redInk : C.muted })}>
            {left != null ? `Pay within ${mmss(left)} or the spot reopens` : 'Paid into escrow, not to the host'}
          </div>
        </div>
        <div style={{ width: 110 }}>
          <PrimaryButton height={42} radius={12} fontSize={14} shadowOn={false} onClick={pay}>
            Pay now
          </PrimaryButton>
        </div>
      </div>,
    );
  }

  const members = asList(lobby.members);
  const open = lobby.spots_left ?? 0;
  const tagPill = (tag) => {
    const m = { host: ['Host', C.mint, C.green700], known: ['Known', C.blueSoft, C.blue], guest: ['Guest', C.amberSoft, C.amber] };
    const [l, bg, fg] = m[tag ?? ''] ?? ['Solo', C.purpleSoft, C.purple];
    return (
      <Pill bg={bg} fg={fg} size={10} padding="2px 7px">
        {l}
      </Pill>
    );
  };
  const players = (
    <div style={{ display: 'grid', gap: 8 }}>
      {members.map((m, i) => (
        <div key={m.id ?? i} style={{ padding: 12, borderRadius: 16, background: '#fff', border: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar initials={m.initials ?? ''} size={36} index={i} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="clamp1" style={t(14, { w: 600 })}>
              {m.name}
              {m.is_me === true ? ' (you)' : ''}
            </div>
            <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              {tagPill(m.tag)}
              {m.checked_in === true && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 2, ...t(11, { c: C.green700 }) }}>
                  <MapPinCheck size={12} color={C.green700} /> Checked in
                </span>
              )}
            </div>
          </div>
          {m.status === 'invited' ? (
            <Pill bg={C.chip} fg={C.muted}>
              Invited
            </Pill>
          ) : m.paid === true ? (
            <Pill>Paid</Pill>
          ) : (
            <Pill bg={C.amberSoft} fg={C.amber}>
              Due {inr(m.amount_due)}
            </Pill>
          )}
          {isHost && m.tag !== 'host' && (
            <button aria-label="Remove" className="tap" onClick={() => removeMember(m)} style={{ width: 32, height: 32, borderRadius: 10, display: 'grid', placeItems: 'center' }}>
              <UserX size={18} color={C.muted} />
            </button>
          )}
        </div>
      ))}
      {lobby.own_squad === true && cap > members.length && (
        <div style={{ padding: 14, borderRadius: 16, background: C.limeSoft, display: 'flex', alignItems: 'center', gap: 10, ...t(13, { c: C.mutedInk }) }}>
          <Users size={18} color={C.green700} /> +{cap - members.length} of your own players · private squad
        </div>
      )}
      {open > 0 && (
        <div style={{ padding: 14, borderRadius: 16, border: `2px dashed #B9C8BC`, display: 'flex', alignItems: 'center', gap: 10, ...t(13, { c: C.mutedInk }) }}>
          <UserPlus size={18} color={C.muted} />
          {lobby.is_public === true ? `${open} open spot${open === 1 ? '' : 's'} — listed for solo players` : `${open} open spot${open === 1 ? '' : 's'}`}
        </div>
      )}
    </div>
  );

  const requestsList =
    requests == null ? (
      <ListSkeleton rows={3} />
    ) : requests.length === 0 ? (
      <EmptyNote icon={Inbox} title="No requests yet" body="Solo players who ask to join show up here. You chat 1-on-1 before letting them into the squad chat." />
    ) : (
      <div style={{ display: 'grid', gap: 8 }}>
        {requests.map((r) => (
          <button
            key={r.id}
            className="tap"
            onClick={() => nav(routes.request(lobbyId, r.id))}
            style={{
              padding: 12,
              borderRadius: 16,
              background: '#fff',
              border: `1px solid ${r.status === 'pending' ? C.brand : C.line}`,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              textAlign: 'left',
            }}
          >
            <Avatar initials={r.player?.initials ?? ''} size={40} index={r.player?.id ?? 0} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={t(14, { w: 700 })}>{r.player?.name ?? ''}</div>
              <div style={t(12, { c: C.green700 })}>{attendanceLine(asMap(r.player))}</div>
              {String(r.last_message ?? '') && (
                <div className="clamp1" style={t(12, { c: C.muted })}>
                  {r.last_message}
                </div>
              )}
            </div>
            {r.status === 'pending' ? (
              <Pill bg={C.brand} fg="#fff">
                Review
              </Pill>
            ) : r.status === 'approved' ? (
              <Pill>Approved</Pill>
            ) : (
              <Pill bg={C.chip} fg={C.muted}>
                Declined
              </Pill>
            )}
          </button>
        ))}
      </div>
    );

  const chat = (
    <>
      <ChatList messages={messages} onPay={me.can_pay === true ? pay : undefined} />
      {live && <Composer onSend={send} />}
    </>
  );

  if (desktop) {
    const sideTabs = ['Players · ' + lobby.taken, ...(isHost ? ['Requests'] : [])];
    const sideTab = Math.min(tab, sideTabs.length - 1);
    return (
      <Shell>
        {header}
        <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 24, alignItems: 'start' }}>
          <div style={{ minWidth: 0 }}>
            {pinned}
            {banners}
            <div style={{ marginTop: 18 }}>
              <Segmented
                labels={sideTabs}
                index={sideTab}
                height={36}
                badges={[0, isHost ? (lobby.pending_requests ?? 0) : 0]}
                onChange={(i) => (setTab(i), i === 1 && loadRequests())}
              />
            </div>
            <div style={{ marginTop: 12 }}>{sideTab === 0 ? players : requestsList}</div>
          </div>
          <div
            style={{
              position: 'sticky',
              top: 96,
              height: 'calc(100vh - 130px)',
              minHeight: 480,
              borderRadius: 24,
              background: C.ground,
              border: `1px solid ${C.line}`,
              boxShadow: shadow.soft,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ padding: '14px 18px', background: '#fff', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: 99, background: live ? '#22C55E' : C.dotOff }} />
              <span style={{ flex: 1, ...t(15, { w: 700 }) }}>Squad chat</span>
              <span style={t(12, { c: C.muted })}>{members.length} in the room</span>
            </div>
            {chat}
          </div>
        </div>
      </Shell>
    );
  }

  const tabs = ['Chat', `Players · ${lobby.taken}`, ...(isHost ? ['Requests'] : [])];
  const current = Math.min(tab, tabs.length - 1);
  return (
    <div className="page" style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {header}
      {pinned}
      {banners}
      <div style={{ padding: '10px 16px 0' }}>
        <Segmented labels={tabs} index={current} height={36} badges={[0, 0, isHost ? (lobby.pending_requests ?? 0) : 0]} onChange={(i) => (setTab(i), i === 2 && loadRequests())} />
      </div>
      {current === 0 ? chat : <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>{current === 1 ? players : requestsList}</div>}
    </div>
  );
}

function ReportSheet({ close }) {
  const [reason, setReason] = useState('');
  return (
    <div>
      <div style={d(22)}>Report a no-show</div>
      <div style={{ margin: '8px 0 12px', ...t(14, { c: C.muted, h: 1.5 }) }}>
        The host's payout stays in escrow while our support team reviews it. Use this only if the host or the turf didn't show up.
      </div>
      <div style={{ padding: '10px 14px', borderRadius: 14, background: C.ground, border: `1px solid ${C.line}` }}>
        <textarea rows={4} value={reason} placeholder="What happened?" onChange={(e) => setReason(e.target.value)} style={{ ...t(14), resize: 'none' }} />
      </div>
      <div style={{ height: 14 }} />
      <PrimaryButton height={52} color={C.red} shadowOn={false} onClick={() => close(reason.trim())}>
        Report no-show
      </PrimaryButton>
    </div>
  );
}

/** Host: move the match to another free slot on the same court. */
function SwitchSlotSheet({ lobby, close }) {
  const today = new Date();
  const [day, setDay] = useState(() => {
    if (!lobby.date) return 0;
    const [y, m, dd] = String(lobby.date).split('-').map(Number);
    const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.min(13, Math.max(0, Math.round((new Date(y, m - 1, dd).getTime() - base.getTime()) / 86400000)));
  });
  const [slots, setSlots] = useState(null);
  const [error, setError] = useState(null);
  const date = ymd(addDays(today, day));
  useEffect(() => {
    setSlots(null);
    venueRepo.availability(lobby.venue.id, date, lobby.sport.id, lobby.court.id).then(
      (r) => setSlots(asList(r.slots)),
      (e) => setError(errText(e)),
    );
  }, [date, lobby]);
  const dur = lobby.duration ?? 1;
  const fits = (start) => {
    for (let h = start; h < start + dur; h++) {
      const s = slots.find((x) => x.hour === h);
      const mine = date === lobby.date && h >= lobby.start_hour && h < lobby.start_hour + dur;
      if (!s || (s.status !== 'free' && !mine)) return false;
    }
    return true;
  };
  return (
    <div>
      <div style={d(22)}>Switch slot</div>
      <div style={{ margin: '4px 0 14px', ...t(13, { c: C.muted }) }}>
        {lobby.court?.name} · {dur} hr · everyone is notified
      </div>
      <div className="hscroll" style={{ gap: 8 }}>
        {Array.from({ length: 14 }, (_, i) => (
          <Choice key={i} selected={i === day} height={40} radius={12} padding="0 12px" onClick={() => setDay(i)}>
            <span style={{ whiteSpace: 'nowrap', ...t(13, { w: 600, c: i === day ? '#fff' : C.ink }) }}>{i === 0 ? 'Today' : eeeD(addDays(today, i))}</span>
          </Choice>
        ))}
      </div>
      <div style={{ height: 14 }} />
      {error ? (
        <div style={t(13, { c: C.redInk })}>{error}</div>
      ) : !slots ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {Array.from({ length: 8 }, (_, i) => (
            <Sk key={i} h={52} r={12} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {slots
            .filter((s) => s.status !== 'past' && fits(s.hour))
            .map((s) => (
              <button
                key={s.hour}
                className="tap"
                onClick={() => close({ date, start_hour: s.hour })}
                style={{ width: 78, padding: '10px 0', borderRadius: 12, background: '#fff', border: `1.5px solid ${C.radioOff}` }}
              >
                <div style={t(13, { w: 700 })}>{s.label}</div>
                <div style={t(10, { c: C.muted })}>{inr(s.price)}</div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
