/** Notifications inbox — loads and marks everything read in the background. */
import { Bell, Calendar, Tag, UsersRound } from 'lucide-react';
import { useBack } from '../../app/nav';
import { Shell } from '../../app/Shell';
import { SignInGate } from '../auth/SignInGate';
import { asList } from '../../lib/api';
import { notificationRepo } from '../../lib/repos';
import { C, d, t } from '../../theme';
import { useData, useIsDesktop } from '../../ui/hooks';
import { BackSquare, CardBox, ErrorRetry, ListSkeleton } from '../../ui/kit';

const KIND = {
  booking: [Calendar, C.mint, C.green700],
  match: [UsersRound, C.blueSoft, C.blue],
  offer: [Tag, C.limeSoft, C.green700],
  system: [Bell, C.chip, C.muted],
};

const ago = (iso) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.floor(m / 60)} hr ago`;
  return `${Math.floor(m / 1440)} d ago`;
};

export default function NotificationsPage() {
  return (
    <Shell>
      <SignInGate>
        <Notifications />
      </SignInGate>
    </Shell>
  );
}

function Notifications() {
  const back = useBack();
  const desktop = useIsDesktop();
  const { data, error, retry } = useData(async () => {
    const r = await notificationRepo.list();
    notificationRepo.markAllRead().catch(() => undefined);
    return r;
  });
  const items = asList(data?.items);
  return (
    <div style={{ maxWidth: desktop ? 720 : undefined, margin: '0 auto' }}>
      <div style={{ padding: desktop ? '0 0 18px' : 'calc(var(--safe-top) + 8px) 20px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <BackSquare onClick={back} />
        <div style={d(desktop ? 30 : 20)}>Notifications</div>
      </div>
      {error && <ErrorRetry message={error} onRetry={retry} />}
      {!data && !error && <ListSkeleton rows={6} />}
      {data && items.length === 0 && <div style={{ padding: 60, textAlign: 'center', ...t(14, { c: C.muted }) }}>You're all caught up.</div>}
      <div style={{ padding: desktop ? 0 : '4px 20px 24px', display: 'grid', gap: 10 }}>
        {items.map((n) => {
          const [I, bg, fg] = KIND[n.kind] ?? KIND.system;
          return (
            <CardBox
              key={n.id}
              padding={14}
              radius={18}
              border={n.is_read === true ? undefined : '1px solid rgba(20,61,43,.35)'}
              style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}
            >
              <span style={{ width: 40, height: 40, flex: 'none', borderRadius: 12, background: bg, display: 'grid', placeItems: 'center' }}>
                <I size={18} color={fg} />
              </span>
              <div style={{ flex: 1 }}>
                <div style={t(14, { w: 700 })}>{n.title}</div>
                {String(n.body ?? '') && <div style={{ marginTop: 2, ...t(13, { c: C.muted, h: 1.4 }) }}>{n.body}</div>}
                <div style={{ marginTop: 4, ...t(11, { c: C.muted }) }}>{ago(n.created_at)}</div>
              </div>
            </CardBox>
          );
        })}
      </div>
    </div>
  );
}
