/** Venue page: status, photos (upload / delete), courts, sport pricing, upcoming blocks and recent bookings. */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, ImagePlus, MapPin, Pencil, Phone, Plus, Star, Trash2 } from 'lucide-react';
import { asList, errText } from '../../lib/api';
import { fmtHour, inr } from '../../lib/format';
import { C, d, t } from '../../theme';
import { useData, useIsDesktop } from '../../ui/hooks';
import { useOverlay } from '../../ui/overlay';
import { ErrorRetry, Sk, Spinner } from '../../ui/kit';
import { adminRepo } from '../api';
import { Badge, Btn, PageHeader, Panel, YesNo } from '../ui';
import { BookingRows } from './Home';

export default function VenueDetail() {
  const id = Number(useParams().id);
  const nav = useNavigate();
  const desktop = useIsDesktop();
  const { toast } = useOverlay();
  const { data: v, error, retry, setData } = useData(() => adminRepo.venue(id), [id]);
  const [uploading, setUploading] = useState(false);

  if (error) return <ErrorRetry message={error} onRetry={retry} />;
  if (!v)
    return (
      <div style={{ display: 'grid', gap: 14 }}>
        <Sk h={40} w={320} />
        <Sk h={220} r={20} />
        <Sk h={220} r={20} />
      </div>
    );

  const upload = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const r = await adminRepo.uploadPhotos(id, [...files]);
      setData({ ...v, photos: [...asList(v.photos), ...asList(r.photos)] });
      toast(`${files.length} photo${files.length === 1 ? '' : 's'} added.`);
    } catch (e) {
      toast(errText(e));
    } finally {
      setUploading(false);
    }
  };
  const delPhoto = async (pid) => {
    try {
      await adminRepo.deletePhoto(id, pid);
      setData({ ...v, photos: asList(v.photos).filter((p) => p.id !== pid) });
    } catch (e) {
      toast(errText(e));
    }
  };
  const add = (slug) => nav(`/admin/r/${slug}/new?venue=${id}&next=/admin/venues/${id}`);

  return (
    <>
      <PageHeader
        eyebrow="Venue"
        title={v.name}
        sub={
          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <MapPin size={14} /> {v.area}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Star size={14} color={C.star} fill={C.star} /> {v.rating} ({v.review_count})
            </span>
            {v.phone && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Phone size={14} /> {v.phone}
              </span>
            )}
            <span>Open {v.hours}</span>
          </span>
        }
        actions={
          <>
            <Btn icon={CalendarDays} onClick={() => nav(`/admin/venues/${id}/board`)}>
              Day board
            </Btn>
            <Btn kind="primary" icon={Pencil} onClick={() => nav(`/admin/r/venues/${id}/edit`)}>
              Edit venue
            </Btn>
          </>
        }
      />
      {!v.is_active && (
        <div style={{ marginBottom: 18, padding: '14px 16px', borderRadius: 16, background: C.amberSoft, ...t(14, { c: C.amber, h: 1.5 }) }}>
          <b>Hidden in the app.</b> Add courts, sport pricing and photos — the Turflet team approves new grounds before they go live.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: desktop ? '1.4fr 1fr' : '1fr', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <Panel
            title={`Photos · ${asList(v.photos).length}`}
            actions={
              <label
                className="tap"
                style={{
                  height: 34,
                  padding: '0 12px',
                  borderRadius: 12,
                  background: C.mint,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  ...t(13, { w: 600, c: C.green700 }),
                }}
              >
                {uploading ? <Spinner size={15} stroke={2} color={C.green700} /> : <ImagePlus size={15} color={C.green700} />} Add photos
                <input type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
              </label>
            }
          >
            {asList(v.photos).length === 0 && !v.cover ? (
              <div style={t(14, { c: C.muted })}>No photos yet. Good photos get far more bookings.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                {v.cover && (
                  <div style={{ position: 'relative', aspectRatio: '4/3', borderRadius: 14, overflow: 'hidden' }}>
                    <img src={v.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <span style={{ position: 'absolute', left: 8, top: 8 }}>
                      <Badge value="active" label="Cover" />
                    </span>
                  </div>
                )}
                {asList(v.photos).map((p) => (
                  <div key={p.id} style={{ position: 'relative', aspectRatio: '4/3', borderRadius: 14, overflow: 'hidden' }}>
                    <img src={p.url} alt={p.caption ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      aria-label="Delete photo"
                      className="tap"
                      onClick={() => delPhoto(p.id)}
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: 8,
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        background: 'rgba(255,255,255,.92)',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <Trash2 size={15} color={C.redInk} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel
            title="Recent bookings"
            pad={0}
            actions={
              <Btn small onClick={() => nav(`/admin/r/bookings?venue=${id}`)}>
                All bookings
              </Btn>
            }
          >
            <BookingRows rows={asList(v.bookings)} empty="No bookings yet." />
          </Panel>
        </div>
        <div style={{ display: 'grid', gap: 18 }}>
          <Panel title="Status" pad={16}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 10, alignItems: 'center', ...t(14) }}>
              <span>Live in the app</span>
              <YesNo on={v.is_active} />
              <span>Fast filling badge</span>
              <YesNo on={v.is_fast_filling} />
              {v.owner && (
                <>
                  <span>Owner</span>
                  <span style={t(13, { c: C.mutedInk })}>{v.owner}</span>
                </>
              )}
            </div>
          </Panel>
          <Panel
            title="Courts"
            actions={
              <Btn small icon={Plus} onClick={() => add('courts')}>
                Add
              </Btn>
            }
            pad={8}
          >
            {asList(v.courts).length === 0 && <div style={{ padding: 12, ...t(14, { c: C.muted }) }}>Add at least one court so players can book.</div>}
            {asList(v.courts).map((c) => (
              <button
                key={c.id}
                className="tap"
                onClick={() => nav(`/admin/r/courts/${c.id}/edit?next=/admin/venues/${id}`)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}
              >
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', ...t(14, { w: 700 }) }}>{c.name}</span>
                  <span style={{ display: 'block', ...t(12, { c: C.muted }) }}>{[c.meta, ...(c.sports ?? [])].filter(Boolean).join(' · ')}</span>
                </span>
                {!c.is_active && <Badge value="none" label="Off" />}
              </button>
            ))}
          </Panel>
          <Panel
            title="Sport pricing"
            actions={
              <Btn small icon={Plus} onClick={() => add('venue-sports')}>
                Add
              </Btn>
            }
            pad={8}
          >
            {asList(v.sports).length === 0 && <div style={{ padding: 12, ...t(14, { c: C.muted }) }}>Set an hourly price for each sport you offer.</div>}
            {asList(v.sports).map((s) => (
              <button
                key={s.id}
                className="tap"
                onClick={() => nav(`/admin/r/venue-sports/${s.id}/edit?next=/admin/venues/${id}`)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}
              >
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', ...t(14, { w: 700 }) }}>{s.sport}</span>
                  <span style={{ display: 'block', ...t(12, { c: C.muted }) }}>
                    Up to {s.max_players} players · peak +{inr(s.peak_surcharge)}
                  </span>
                </span>
                <span style={d(16)}>{inr(s.base_price)}</span>
                <span style={t(12, { c: C.muted })}>/hr</span>
              </button>
            ))}
          </Panel>
          <Panel
            title="Blocked slots"
            actions={
              <Btn small icon={Plus} onClick={() => add('blocked-slots')}>
                Block
              </Btn>
            }
            pad={8}
          >
            {asList(v.blocked).length === 0 && (
              <div style={{ padding: 12, ...t(14, { c: C.muted }) }}>Nothing blocked ahead. Block maintenance or offline bookings so the app shows them as booked.</div>
            )}
            {asList(v.blocked).map((b) => (
              <div key={b.id} style={{ padding: '10px 12px', display: 'flex', gap: 10, ...t(13) }}>
                <span style={{ width: 92, ...t(13, { w: 700 }) }}>{b.date}</span>
                <span style={{ flex: 1, color: C.mutedInk }}>
                  {b.court} · {fmtHour(b.from)}–{fmtHour(b.to)}
                  {b.reason ? ` · ${b.reason}` : ''}
                </span>
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </>
  );
}
