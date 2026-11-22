/** Broadcast (admins): send an in-app + push notification to every player, or only those who've booked. */
import { useState } from 'react';
import { Megaphone } from 'lucide-react';
import { errText } from '../../lib/api';
import { C, d, t } from '../../theme';
import { useIsDesktop } from '../../ui/hooks';
import { useOverlay } from '../../ui/overlay';
import { Choice, PrimaryButton } from '../../ui/kit';
import { adminRepo } from '../api';
import { PageHeader, Panel, inputStyle } from '../ui';

export default function Broadcast() {
  const desktop = useIsDesktop();
  const { toast, sheet } = useOverlay();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('all');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!title.trim()) return toast('Title is required.');
    const ok = await sheet((close) => (
      <div>
        <div style={d(22)}>Send to {audience === 'all' ? 'all players' : 'players who booked'}?</div>
        <div style={{ margin: '8px 0 18px', ...t(14, { c: C.muted, h: 1.5 }) }}>Players with notifications turned on get it right away. This can't be unsent.</div>
        <PrimaryButton height={50} shadowOn={false} onClick={() => close(true)}>
          Send now
        </PrimaryButton>
      </div>
    ));
    if (!ok) return;
    setBusy(true);
    try {
      toast((await adminRepo.broadcast(title.trim(), body.trim(), audience)).message);
      setTitle('');
      setBody('');
    } catch (e) {
      toast(errText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 1000 }}>
      <PageHeader eyebrow="Platform" title="Broadcast" sub="Announce an offer or news. It lands in every player's notifications and as a push on their phone." />
      <div style={{ display: 'grid', gridTemplateColumns: desktop ? '1.2fr 1fr' : '1fr', gap: 18, alignItems: 'start' }}>
        <Panel>
          <div style={{ display: 'grid', gap: 16 }}>
            <label>
              <div style={{ marginBottom: 6, ...t(13, { w: 600 }) }}>Title</div>
              <input value={title} maxLength={80} placeholder="₹100 off this weekend" onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
            </label>
            <label>
              <div style={{ marginBottom: 6, ...t(13, { w: 600 }) }}>Message</div>
              <textarea
                rows={4}
                value={body}
                maxLength={240}
                placeholder="Use code PLAY100 on any booking till Sunday."
                onChange={(e) => setBody(e.target.value)}
                style={{ ...inputStyle, padding: '12px 14px', resize: 'vertical' }}
              />
            </label>
            <div>
              <div style={{ marginBottom: 8, ...t(13, { w: 600 }) }}>Audience</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  ['all', 'All players', 'Everyone with notifications on'],
                  ['bookers', 'Players who booked', 'At least one paid booking'],
                ].map(([k, l, s]) => (
                  <Choice
                    key={k}
                    selected={audience === k}
                    selBg={C.mint}
                    selWidth={2}
                    height={72}
                    padding={12}
                    onClick={() => setAudience(k)}
                    style={{ flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left' }}
                  >
                    <span style={t(14, { w: 700 })}>{l}</span>
                    <span style={t(12, { c: C.muted })}>{s}</span>
                  </Choice>
                ))}
              </div>
            </div>
            <PrimaryButton loading={busy} onClick={send} trailing={<Megaphone size={18} color="#fff" />}>
              Send broadcast
            </PrimaryButton>
          </div>
        </Panel>
        <div>
          <div style={{ marginBottom: 10, ...t(12, { w: 700, c: C.muted, ls: 0.6 }), textTransform: 'uppercase' }}>Preview</div>
          <div style={{ padding: 14, borderRadius: 18, background: '#fff', border: '1px solid rgba(20,61,43,.35)', display: 'flex', gap: 12 }}>
            <span style={{ width: 40, height: 40, flex: 'none', borderRadius: 12, background: C.limeSoft, display: 'grid', placeItems: 'center' }}>
              <Megaphone size={18} color={C.green700} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={t(14, { w: 700 })}>{title || 'Your title'}</div>
              <div style={{ marginTop: 2, ...t(13, { c: C.muted, h: 1.4 }) }}>{body || 'Your message shows here.'}</div>
              <div style={{ marginTop: 4, ...t(11, { c: C.muted }) }}>Just now</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
