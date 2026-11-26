/** Day board for the venue desk: every court × every hour, bookings and blocks at a glance. */
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { asList } from '../../lib/api';
import { addDays, ymd } from '../../lib/format';
import { C, t } from '../../theme';
import { useData } from '../../ui/hooks';
import { ErrorRetry, Sk } from '../../ui/kit';
import { adminRepo } from '../api';
import { Btn, PageHeader } from '../ui';

const STATUS = { confirmed: [C.brand, '#fff'], completed: [C.mutedInk, '#fff'], held: [C.amberSoft, C.amber] };

export default function Board() {
  const id = Number(useParams().id);
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const date = params.get('date') ?? ymd(new Date());
  const { data, error, retry } = useData(() => adminRepo.board(id, date), [id, date]);
  const shift = (n) => {
    const [y, m, d] = date.split('-').map(Number);
    setParams({ date: ymd(addDays(new Date(y, m - 1, d), n)) });
  };

  return (
    <>
      <button onClick={() => nav(`/admin/venues/${id}`)} style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, ...t(13, { w: 600, c: C.brand }) }}>
        <ArrowLeft size={16} color={C.brand} /> {data?.venue?.name ?? 'Venue'}
      </button>
      <PageHeader
        eyebrow="Day board"
        title={data?.date_label ?? <Sk w={260} h={30} />}
        actions={
          <>
            <Btn icon={ChevronLeft} onClick={() => shift(-1)}>
              Prev
            </Btn>
            <Btn onClick={() => setParams({})}>Today</Btn>
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setParams({ date: e.target.value })}
              style={{ height: 40, padding: '0 10px', borderRadius: 12, border: `1px solid ${C.line}`, ...t(14) }}
            />
            <Btn onClick={() => shift(1)}>
              Next <ChevronRight size={16} />
            </Btn>
          </>
        }
      />
      {error && <ErrorRetry message={error} onRetry={retry} />}
      {!data && !error && <Sk h={320} r={20} />}
      {data && (
        <div style={{ background: '#fff', borderRadius: 20, border: `1px solid ${C.line}`, overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 4, padding: 10, minWidth: '100%' }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: '#fff', minWidth: 120 }} />
                {asList(data.hours).map((h) => (
                  <th key={h.hour} style={{ minWidth: 76, padding: '4px 0', ...t(11, { w: 700, c: C.muted }) }}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {asList(data.rows).map((r) => (
                <tr key={r.court.id}>
                  <td style={{ position: 'sticky', left: 0, background: '#fff', padding: '0 10px 0 4px', whiteSpace: 'nowrap', ...t(14, { w: 700 }) }}>{r.court.name}</td>
                  {asList(r.cells).map((c) => {
                    const b = c.booking;
                    const [bg, fg] = b ? (STATUS[b.status] ?? [C.chip, C.ink]) : c.blocked ? ['#E9ECE6', C.muted] : [C.paper, C.muted];
                    return (
                      <td key={c.hour} style={{ padding: 0 }}>
                        <button
                          disabled={!b}
                          title={b ? `${b.code} · ${b.player}` : c.blocked ? 'Blocked' : 'Free'}
                          onClick={() => b && nav(`/admin/bookings/${b.id}`)}
                          className={b ? 'tap' : undefined}
                          style={{
                            width: '100%',
                            height: 54,
                            padding: '4px 6px',
                            borderRadius: 10,
                            background: bg,
                            border: b || c.blocked ? 'none' : `1px dashed ${C.line}`,
                            textAlign: 'left',
                            overflow: 'hidden',
                          }}
                        >
                          {b && b.start && (
                            <>
                              <span className="clamp1" style={{ display: 'block', ...t(11, { w: 700, c: fg }) }}>
                                {b.player}
                              </span>
                              <span className="clamp1" style={{ display: 'block', ...t(10, { c: fg }), opacity: 0.8 }}>
                                {b.code}
                              </span>
                            </>
                          )}
                          {!b && c.blocked && <span style={t(10, { w: 600, c: fg })}>Blocked</span>}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {asList(data.rows).length === 0 && <div style={{ padding: 24, ...t(14, { c: C.muted }) }}>No active courts. Add a court from the venue page.</div>}
          <div style={{ padding: '10px 16px 14px', display: 'flex', flexWrap: 'wrap', gap: 16, ...t(12, { c: C.muted }) }}>
            {[
              [C.brand, 'Confirmed'],
              [C.amberSoft, 'Awaiting payment'],
              [C.mutedInk, 'Completed'],
              ['#E9ECE6', 'Blocked'],
              [C.paper, 'Free'],
            ].map(([c, l]) => (
              <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 14, height: 14, borderRadius: 4, background: c, border: `1px solid ${C.line}` }} />
                {l}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
