/** 3 · Open Lobbies (Solo view): compare groups looking for players and request to join one.
 *  URL: /lobbies?venue=ID[&sport&court&date&start][&subtitle]  or  /lobbies?area=ID&city=Name (city board) */
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, UserPlus } from 'lucide-react';
import { useSession } from '../../app/session';
import { useBack } from '../../app/nav';
import { Shell } from '../../app/Shell';
import { lobbyRepo, venueRepo } from '../../lib/repos';
import { C, d, t } from '../../theme';
import { useData, useIsDesktop } from '../../ui/hooks';
import { BackSquare, ErrorRetry, ListSkeleton } from '../../ui/kit';
import { EmptyNote, LobbyCard, useOpenLobby } from './widgets';

export default function Lobbies() {
  const app = useSession();
  const back = useBack();
  const desktop = useIsDesktop();
  const openLobby = useOpenLobby();
  const [p] = useSearchParams();
  const venueId = p.get('venue') ? Number(p.get('venue')) : null;
  const isCity = venueId == null;
  const date = p.get('date');
  const num = (k) => (p.get(k) ? Number(p.get(k)) : undefined);

  const { data, error, retry, reload } = useData(async () => {
    if (venueId != null) {
      const [lobbies, venue] = await Promise.all([
        lobbyRepo.venueLobbies(venueId, { date: date ?? undefined, start_hour: num('start'), court: num('court'), sport: num('sport') }),
        p.get('subtitle') ? Promise.resolve(null) : venueRepo.details(venueId),
      ]);
      return { lobbies, venue };
    }
    const area = num('area') ?? app.areaId;
    return { lobbies: area == null ? [] : await lobbyRepo.cityLobbies(area, num('sport')), venue: null };
  }, [p.toString()]);

  const city = p.get('city') || app.cityName;
  const subtitle = p.get('subtitle') || (isCity ? 'Groups looking for players' : data?.venue ? `${data.venue.name} · ${data.venue.area}` : '');

  return (
    <Shell>
      <div style={{ maxWidth: desktop ? 1100 : undefined, margin: '0 auto' }}>
        <div style={{ padding: desktop ? '0 0 18px' : 'calc(var(--safe-top) + 8px) 20px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <BackSquare onClick={back} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={d(desktop ? 30 : 20)}>{isCity ? `Open lobbies in ${city}` : 'Join solo'}</div>
            <div className="clamp1" style={t(13, { c: C.muted })}>
              {subtitle}
            </div>
          </div>
        </div>
        <div style={{ padding: desktop ? 0 : '4px 20px 24px' }}>
          <div style={{ padding: 14, borderRadius: 16, background: C.limeSoft, display: 'flex', gap: 10, alignItems: 'flex-start', maxWidth: desktop ? 760 : undefined }}>
            <ShieldCheck size={18} color={C.green700} style={{ flex: 'none' }} />
            <span style={t(13, { c: C.green900, h: 1.5 })}>
              Request a spot and chat 1-on-1 with the host. Once approved you enter the Match Room and pay your share into escrow — never to the host directly.
            </span>
          </div>
          <div style={{ height: 14 }} />
          {error && <ErrorRetry message={error} onRetry={retry} />}
          {!data && !error && <ListSkeleton rows={4} />}
          {data && data.lobbies.length === 0 && (
            <EmptyNote
              icon={UserPlus}
              title="No open lobbies here yet"
              body={
                isCity
                  ? 'Check back soon, or create a group from any venue and open it to solo players.'
                  : 'Go back and tap “Create a group” to start one — solo players nearby can join.'
              }
            />
          )}
          <div style={{ display: 'grid', gridTemplateColumns: desktop ? 'repeat(auto-fill, minmax(420px, 1fr))' : 'minmax(0, 1fr)', gap: desktop ? 18 : 12 }}>
            {data?.lobbies.map((g) => (
              <LobbyCard key={g.id} lobby={g} showVenue={isCity || date == null} onClick={() => openLobby(g, reload)} onAction={() => openLobby(g, reload)} />
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}
