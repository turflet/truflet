/** Matches tab: the matches I host or play in, my pending requests, and past matches. */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, MessagesSquare, Search, TriangleAlert, UsersRound } from 'lucide-react';
import { useSession } from '../../app/session';
import { routes } from '../../app/nav';
import { Shell } from '../../app/Shell';
import { SignInGate } from '../auth/SignInGate';
import { asList } from '../../lib/api';
import { lobbyRepo } from '../../lib/repos';
import { C, d, shadow, t } from '../../theme';
import { useData, useIsDesktop } from '../../ui/hooks';
import { ErrorRetry, GhostButton, ListSkeleton, Pill, PrimaryButton, Segmented } from '../../ui/kit';
import { EmptyNote, FillBar, SlotStatePill, useOpenLobby } from './widgets';

export default function MyMatchesPage() {
  return (
    <Shell nav>
      <SignInGate>
        <MyMatches />
      </SignInGate>
    </Shell>
  );
}

function MyMatches() {
  const app = useSession();
  const nav = useNavigate();
  const desktop = useIsDesktop();
  const openLobby = useOpenLobby();
  const [tab, setTab] = useState(0);
  const { data, error, retry, reload } = useData(() => lobbyRepo.mine());
  const lists = [asList(data?.upcoming), asList(data?.requests), asList(data?.past)];
  const items = lists[tab];

  const empty = [
    <EmptyNote
      key="u"
      icon={UsersRound}
      title="No matches yet"
      body="Pick a slot at any venue, then create a group or join a lobby solo."
      action={
        <PrimaryButton height={48} onClick={() => nav(routes.home)}>
          Explore venues
        </PrimaryButton>
      }
    />,
    <EmptyNote key="r" icon={MessagesSquare} title="No invites or requests" body="Friends' invites to their matches, and your requests to join open lobbies, show up here." />,
    <EmptyNote key="p" icon={History} title="No past matches" body="Matches you played show up here." />,
  ][tab];

  return (
    <div style={{ padding: desktop ? 0 : 'calc(var(--safe-top) + 12px) 0 24px' }}>
      <div style={{ padding: desktop ? 0 : '0 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 style={{ margin: 0, flex: 1, ...d(desktop ? 36 : 26, { ls: -0.4 }) }}>Matches</h1>
        <GhostButton icon={Search} height={40} radius={12} fontSize={13} onClick={() => nav(`/lobbies?area=${app.areaId ?? ''}&city=${encodeURIComponent(app.cityName)}`)}>
          Find lobbies
        </GhostButton>
      </div>
      {error && <ErrorRetry message={error} onRetry={retry} />}
      {!data && !error && <ListSkeleton rows={3} />}
      {data && (
        <>
          <div style={{ padding: desktop ? '20px 0 8px' : '14px 20px 6px', maxWidth: desktop ? 560 : undefined }}>
            <Segmented labels={['Upcoming', 'Requests', 'Past']} counts={lists.map((l) => l.length)} index={tab} onChange={setTab} />
          </div>
          {items.length === 0 && empty}
          <div
            style={{
              padding: desktop ? '14px 0 0' : '8px 20px 0',
              display: 'grid',
              gridTemplateColumns: desktop ? 'repeat(auto-fill, minmax(380px, 1fr))' : '1fr',
              gap: desktop ? 18 : 12,
            }}
          >
            {items.map((g) => (
              <MatchTile key={g.id} lobby={g} onClick={() => openLobby(g, reload)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MatchTile({ lobby: g, onClick }) {
  const role = g.my_role;
  const roles = {
    host: ['Hosting', C.mint, C.green700],
    member: ['Playing', C.blueSoft, C.blue],
    requested: ['Requested', C.amberSoft, C.amber],
    invited: ['Invited you', C.coralSoft, C.orangeInk],
  };
  const r = roles[role];
  const alert = role === 'host' && String(g.alert ?? '');
  return (
    <button
      className="tap lift"
      onClick={onClick}
      style={{ width: '100%', padding: 14, borderRadius: 20, background: '#fff', boxShadow: shadow.soft, border: alert ? `1.5px solid ${C.orange}` : undefined, textAlign: 'left' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {r && (
          <Pill bg={r[1]} fg={r[2]}>
            {r[0]}
          </Pill>
        )}
        <SlotStatePill lobby={g} />
        <span style={{ flex: 1 }} />
        <span style={t(12, { w: 700 })}>{g.own_squad === true ? `Squad of ${g.capacity}` : `${g.paid_count}/${g.capacity} paid`}</span>
      </div>
      <div style={{ marginTop: 10, ...d(17) }}>
        {g.date_label} · {g.time_label}
      </div>
      <div className="clamp1" style={t(13, { c: C.muted })}>
        {g.sport?.name} · {g.venue?.name} · {g.court?.name}
      </div>
      <div style={{ marginTop: 10 }}>
        <FillBar taken={g.taken ?? 0} capacity={g.capacity ?? 1} />
      </div>
      {alert && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, ...t(12, { w: 600, c: C.orangeInk }) }}>
          <TriangleAlert size={14} color={C.orange} />
          {g.alert === 'slot_taken' ? 'Your slot was booked by another group — action needed' : 'Kickoff soon and the pool is short — action needed'}
        </div>
      )}
    </button>
  );
}
