/** Matches section (redesign): Open lobbies in the city, and My matches (hosting / playing, requests, past).
 *  /matches = open lobbies, /matches?tab=mine = my matches. */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { History, MessagesSquare, TriangleAlert, UserPlus, UsersRound } from 'lucide-react';
import { ChevronRight } from '../../ui/icons';
import { useSession } from '../../app/session';
import { routes } from '../../app/nav';
import { Shell } from '../../app/Shell';
import { SignInGate } from '../auth/SignInGate';
import { asList } from '../../lib/api';
import { lobbyRepo } from '../../lib/repos';
import { ART } from '../../lib/art';
import { C, d, t } from '../../theme';
import { useData, useIsDesktop } from '../../ui/hooks';
import { useOverlay } from '../../ui/overlay';
import { ErrorRetry, Img, ListSkeleton, Pill, PrimaryButton, Segmented } from '../../ui/kit';
import { Band, BookingsButton, Panel, PanelHeadline, PanelSwitch, ProfileButton, Rule, Script, SectionTabs, UnderlineTabs } from '../../ui/brand';
import { EmptyNote, FillBar, LobbyCard, SlotStatePill, useOpenLobby } from './widgets';

export default function Matches() {
  const app = useSession();
  const nav = useNavigate();
  const desktop = useIsDesktop();
  const { toast } = useOverlay();
  const openLobby = useOpenLobby();
  const [p, setP] = useSearchParams();
  const mine = p.get('tab') === 'mine';
  const [sportIdx, setSportIdx] = useState(0);
  const [mineTab, setMineTab] = useState(0);

  const sports = app.sports;
  const sportId = sportIdx === 0 ? undefined : sports[sportIdx - 1]?.id;
  const open = useData(async () => (app.areaId == null ? [] : lobbyRepo.cityLobbies(app.areaId, sportId)), [app.areaId, sportId]);
  const my = useData(async () => (app.loggedIn ? lobbyRepo.mine() : null), [app.loggedIn]);
  const lists = [asList(my.data?.upcoming), asList(my.data?.requests), asList(my.data?.past)];
  const myCount = lists[0].length + lists[1].length;
  const live = asList(open.data).length;

  const setMine = (on) => setP(on ? { tab: 'mine' } : {}, { replace: true });
  const createLobby = () => {
    toast('Pick a venue and a slot, then choose “Create a group”');
    nav(routes.home);
  };

  const openList = (
    <>
      {open.error && <ErrorRetry message={open.error} onRetry={open.retry} />}
      {!open.data && !open.error && <ListSkeleton rows={3} />}
      {open.data && open.data.length === 0 && (
        <EmptyNote
          icon={UserPlus}
          title={app.areaId == null ? 'Pick your area first' : 'No open lobbies right now'}
          body={
            app.areaId == null
              ? 'Choose where you play to see groups looking for players nearby.'
              : 'Check back soon, or book a slot and open it to solo players.'
          }
          action={
            app.areaId == null ? (
              <PrimaryButton height={48} onClick={() => nav('/location')}>
                Choose area
              </PrimaryButton>
            ) : null
          }
        />
      )}
      {open.data && open.data.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: desktop ? 'repeat(auto-fill, minmax(380px, 1fr))' : 'minmax(0, 1fr)', gap: 18 }}>
          {open.data.map((g) => (
            <LobbyCard key={g.id} lobby={g} onClick={() => openLobby(g, open.reload)} onAction={() => openLobby(g, open.reload)} />
          ))}
        </div>
      )}
    </>
  );

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
  ][mineTab];

  const mineList = (
    <SignInGate>
      {my.error && <ErrorRetry message={my.error} onRetry={my.retry} />}
      {!my.data && !my.error && <ListSkeleton rows={3} />}
      {my.data && lists[mineTab].length === 0 && empty}
      <div style={{ display: 'grid', gridTemplateColumns: desktop ? 'repeat(auto-fill, minmax(380px, 1fr))' : 'minmax(0, 1fr)', gap: 14 }}>
        {my.data && lists[mineTab].map((g) => <MatchTile key={g.id} lobby={g} onClick={() => openLobby(g, my.reload)} />)}
      </div>
    </SignInGate>
  );

  const mineTabs = [`Upcoming · ${lists[0].length}`, `Requests · ${lists[1].length}`, 'Past'];
  const sportTabs = ['ALL', ...sports.map((s) => String(s.name).toUpperCase())];

  if (desktop) {
    return (
      <Shell>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, ...d(36, { ls: -0.5 }) }}>Matches</h1>
            <div style={{ marginTop: 4, ...t(14, { c: C.muted }) }}>{app.cityName ? `Near ${app.cityName} · ${live} lobbies live` : 'Lobbies near you'}</div>
          </div>
          <div style={{ width: 380 }}>
            <Segmented labels={['Open lobbies', `My matches${myCount ? ` · ${myCount}` : ''}`]} index={mine ? 1 : 0} onChange={(i) => setMine(i === 1)} />
          </div>
        </div>
        <div style={{ marginTop: 20, maxWidth: 640 }}>
          {mine ? (
            <Segmented labels={mineTabs} index={mineTab} onChange={setMineTab} />
          ) : (
            <div className="hscroll" style={{ gap: 8 }}>
              {sportTabs.map((l, i) => (
                <button
                  key={l}
                  className="tap"
                  onClick={() => setSportIdx(i)}
                  style={{
                    flex: 'none',
                    height: 38,
                    padding: '0 14px',
                    borderRadius: 12,
                    border: `1px solid ${i === sportIdx ? C.brand : C.chipLine}`,
                    background: i === sportIdx ? C.brand : '#fff',
                    ...t(13, { w: 800, c: i === sportIdx ? '#fff' : C.ink }),
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ marginTop: 22 }}>{mine ? mineList : openList}</div>
      </Shell>
    );
  }

  return (
    <Shell>
      <Band
        title="Matches"
        subtitle={app.cityName ? `Near ${app.cityName} · ${live} ${live === 1 ? 'lobby' : 'lobbies'} live` : 'Lobbies near you'}
        right={
          <>
            {app.loggedIn && <BookingsButton />}
            <ProfileButton />
          </>
        }
      >
        <SectionTabs active={1} badge={live > 0 ? `${live} LIVE` : null} />
        <Panel flat>
          <PanelSwitch labels={['Open lobbies', `My matches${myCount ? ` · ${myCount}` : ''}`]} index={mine ? 1 : 0} onChange={(i) => setMine(i === 1)} />
          {mine ? (
            <>
              <PanelHeadline>
                Your <Script>games</Script>
              </PanelHeadline>
              <UnderlineTabs items={mineTabs.map((x) => x.toUpperCase())} index={mineTab} onChange={setMineTab} />
            </>
          ) : (
            <>
              <PanelHeadline>
                Short a few <Script>players?</Script>
              </PanelHeadline>
              <button
                className="tap"
                onClick={createLobby}
                style={{ position: 'relative', minHeight: 170, padding: 16, borderRadius: 22, background: C.green900, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'left' }}
              >
                <span style={{ position: 'relative', zIndex: 1, ...t(11, { w: 800, c: C.panelInk, ls: 1.2 }) }}>SQUAD BUILDER</span>
                <span style={{ maxWidth: '54%', position: 'relative', zIndex: 1, ...d(22, { c: C.sun, h: 1.1, ls: -0.6 }) }}>Got friends? Fill the rest.</span>
                <span
                  style={{
                    marginTop: 'auto',
                    alignSelf: 'flex-start',
                    height: 36,
                    padding: '0 14px',
                    borderRadius: 999,
                    background: '#fff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    position: 'relative',
                    zIndex: 1,
                    ...t(12.5, { w: 800, c: C.brand }),
                  }}
                >
                  CREATE LOBBY <ChevronRight size={14} color={C.brand} strokeWidth={2.8} />
                </span>
                <span style={{ position: 'absolute', right: -10, bottom: -10, width: 'min(180px, 44%)', height: 160, borderRadius: '22px 0 0 0', overflow: 'hidden' }}>
                  <Img url={ART.training} alt="Training cones and bibs on turf" />
                </span>
              </button>
              {sports.length > 0 && <UnderlineTabs items={sportTabs} index={sportIdx} onChange={setSportIdx} />}
            </>
          )}
        </Panel>
      </Band>
      <main style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '24px 16px 32px' }}>
        {!mine && open.data && open.data.length > 0 && (
          <Rule>
            {live} {live === 1 ? 'lobby needs' : 'lobbies need'} players
          </Rule>
        )}
        {mine ? mineList : openList}
      </main>
    </Shell>
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
      style={{ width: '100%', padding: 16, borderRadius: 22, background: '#fff', border: `${alert ? 1.5 : 1}px solid ${alert ? C.orange : C.hair}`, textAlign: 'left' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {r && (
          <Pill bg={r[1]} fg={r[2]}>
            {r[0]}
          </Pill>
        )}
        <SlotStatePill lobby={g} />
        <span style={{ flex: 1 }} />
        <span style={t(12, { w: 800 })}>{g.own_squad === true ? `Squad of ${g.capacity}` : `${g.paid_count}/${g.capacity} paid`}</span>
      </div>
      <div style={{ marginTop: 10, ...d(17) }}>
        {g.date_label} · {g.time_label}
      </div>
      <div className="clamp1" style={t(13, { w: 600, c: C.muted })}>
        {g.sport?.name} · {g.venue?.name} · {g.court?.name}
      </div>
      <div style={{ marginTop: 12 }}>
        <FillBar taken={g.taken ?? 0} capacity={g.capacity ?? 1} height={8} />
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
