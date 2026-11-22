/** 13 · Refund, privacy and terms (content managed from the admin panel). `?tab=0|1|2` */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Clock, CloudRain, ExternalLink, Info, Receipt, RefreshCw, Shield, ShieldCheck } from 'lucide-react';
import { useSession } from '../../app/session';
import { useBack } from '../../app/nav';
import { Shell } from '../../app/Shell';
import { asList } from '../../lib/api';
import { supportRepo } from '../../lib/repos';
import { C, d, t } from '../../theme';
import { useData, useIsDesktop } from '../../ui/hooks';
import { BackSquare, CardBox, ErrorRetry, GhostButton, H2, ListSkeleton, Segmented } from '../../ui/kit';

const NOTE_ICONS = { clock: Clock, refresh: RefreshCw, cloud: CloudRain, receipt: Receipt, shield: Shield, info: Info };
const NOTE_COLORS = {
  blue: [C.blueSoft, C.blue],
  purple: [C.purpleSoft, C.purple],
  teal: [C.tealSoft, C.teal],
  gray: [C.chip, C.muted],
  green: [C.mint, C.green700],
  amber: [C.amberSoft, C.amber],
  orange: [C.orangeSoft, C.orange],
};
const TIERS = [
  [C.mint, C.green700, C.green900, '#166534'],
  [C.amberSoft, C.amber, '#713F12', C.amber],
  [C.orangeSoft, C.orange, C.orangeDeep, C.orangeInk],
];

export default function Policy() {
  const app = useSession();
  const nav = useNavigate();
  const back = useBack();
  const desktop = useIsDesktop();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(Math.min(2, Math.max(0, Number(params.get('tab') ?? 0) || 0)));
  const { data: p, error, retry } = useData(() => supportRepo.policies());
  const updated = app.config.policy_updated_on;

  const refund = (p) => {
    const rules = asList(p.refund_rules);
    return (
      <>
        <CardBox>
          <H2 size={17}>Refund when you cancel</H2>
          <div style={{ margin: '12px 0', ...t(13, { c: C.muted }) }}>Based on time left before your slot starts. Applies to slot charges.</div>
          {rules.map((r, i) => {
            const tier = TIERS[Math.min(i, 2)];
            return (
              <div key={i} style={{ marginBottom: 8, padding: 12, borderRadius: 14, background: tier[0], display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 56, ...d(20, { c: tier[1] }) }}>{r.percent}%</span>
                <span>
                  <span style={{ display: 'block', ...t(14, { w: 700, c: tier[2] }) }}>{r.title}</span>
                  <span style={{ display: 'block', ...t(12, { c: tier[3] }) }}>{r.subtitle}</span>
                </span>
              </div>
            );
          })}
        </CardBox>
        <CardBox style={{ marginTop: 14 }}>
          <H2 size={17} style={{ marginBottom: 12 }}>
            Good to know
          </H2>
          {asList(p.refund_notes).map((n, i) => {
            const [bg, fg] = NOTE_COLORS[n.color] ?? NOTE_COLORS.gray;
            const I = NOTE_ICONS[n.icon] ?? Info;
            return (
              <div key={i} style={{ marginBottom: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ width: 32, height: 32, flex: 'none', borderRadius: 10, background: bg, display: 'grid', placeItems: 'center' }}>
                  <I size={16} color={fg} />
                </span>
                <span style={t(13, { c: C.mutedInk, h: 1.55 })}>
                  <b style={{ color: C.ink }}>{n.heading}: </b>
                  {n.body}
                </span>
              </div>
            );
          })}
        </CardBox>
      </>
    );
  };

  const sections = (list, privacy) => (
    <>
      {privacy && (
        <div style={{ marginBottom: 14, padding: 16, borderRadius: 20, background: C.tealSoft, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 44, height: 44, flex: 'none', borderRadius: 14, background: '#fff', display: 'grid', placeItems: 'center' }}>
            <ShieldCheck size={22} color={C.teal} />
          </span>
          <span style={t(13, { c: '#164E63', h: 1.5 })}>
            <b>We never sell your data. </b>We use it to run your bookings and matches, and share only what venues and your squad need.
          </span>
        </div>
      )}
      {list.map((s, i) => (
        <CardBox key={i} style={{ marginBottom: 14 }}>
          <H2 size={16}>{s.heading}</H2>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20, ...t(13, { c: C.mutedInk, h: 1.7 }) }}>
            {(s.items ?? []).map((x, k) => (
              <li key={k}>{String(x)}</li>
            ))}
          </ul>
        </CardBox>
      ))}
      {privacy && app.config.privacy_url && (
        <GhostButton icon={ExternalLink} height={48} onClick={() => window.open(app.config.privacy_url, '_blank', 'noopener')} style={{ width: '100%' }}>
          Read the full privacy policy
        </GhostButton>
      )}
    </>
  );

  return (
    <Shell>
      <div style={{ maxWidth: desktop ? 820 : undefined, margin: '0 auto' }}>
        <div style={{ padding: desktop ? '0 0 18px' : 'calc(var(--safe-top) + 8px) 20px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <BackSquare onClick={back} />
          <div>
            <div style={d(desktop ? 30 : 20)}>Policies</div>
            {updated && <div style={t(12, { c: C.muted })}>Last updated {updated}</div>}
          </div>
        </div>
        <div style={{ padding: desktop ? 0 : '0 20px' }}>
          <Segmented labels={['Refund & cancellation', 'Privacy', 'Terms']} index={tab} onChange={setTab} />
        </div>
        {error && <ErrorRetry message={error} onRetry={retry} />}
        {!p && !error && <ListSkeleton rows={3} />}
        {p && (
          <div style={{ padding: desktop ? '18px 0 0' : '16px 20px 32px' }}>
            {tab === 0 && refund(p)}
            {tab === 1 && sections(asList(p.privacy), true)}
            {tab === 2 && sections(asList(p.terms), false)}
            <div style={{ marginTop: 14, padding: '14px 16px', borderRadius: 16, border: `2px dashed ${C.dotOff}`, ...t(12, { c: C.muted, h: 1.5 }) }}>
              Questions?{' '}
              <button onClick={() => nav('/help')} style={{ textDecoration: 'underline', ...t(12, { w: 600, c: C.brand }) }}>
                Contact support
              </button>{' '}
              · We are happy to help with anything about your bookings or data.
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
