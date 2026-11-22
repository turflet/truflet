/** Generic table for any dashboard resource: search, filters, pagination, quick toggles, edit / delete. */
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { errText } from '../../lib/api';
import { C, d, t } from '../../theme';
import { useOverlay } from '../../ui/overlay';
import { ErrorRetry, PrimaryButton, Sk } from '../../ui/kit';
import { adminRepo } from '../api';
import { Btn, Cell, PageHeader, inputStyle } from '../ui';

export default function ResourceList() {
  const { slug = '' } = useParams();
  const nav = useNavigate();
  const { toast, sheet } = useOverlay();
  const [params, setParams] = useSearchParams();
  const [schema, setSchema] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState(params.get('q') ?? '');

  const load = async () => {
    setError(null);
    try {
      const r = await adminRepo.list(slug, { ...Object.fromEntries(params), schema: schema?.slug === slug ? undefined : 1 });
      if (r.schema) setSchema(r.schema);
      setData(r);
    } catch (e) {
      setError(errText(e));
    }
  };
  useEffect(() => {
    setData(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, params.toString()]);
  useEffect(() => setQ(params.get('q') ?? ''), [slug, params]);

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== 'page') next.delete('page');
    setParams(next);
  };

  const open = (row) => {
    if (!schema) return;
    if (schema.detail) nav(`/admin/${schema.detail === 'venue' ? 'venues' : schema.detail === 'booking' ? 'bookings' : 'users'}/${row.id}`);
    else if (schema.can_edit) nav(`/admin/r/${slug}/${row.id}/edit`);
  };
  const toggle = async (row, field) => {
    try {
      const r = await adminRepo.toggle(slug, row.id, field);
      setData((x) => x && { ...x, rows: x.rows.map((y) => (y.id === row.id ? { ...y, toggles: { ...y.toggles, [field]: r.value } } : y)) });
    } catch (e) {
      toast(errText(e));
    }
  };
  const remove = async (row) => {
    const ok = await sheet((close) => (
      <div>
        <div style={d(22)}>Delete {row.label}?</div>
        <div style={{ margin: '8px 0 18px', ...t(14, { c: C.muted, h: 1.5 }) }}>This can't be undone.</div>
        <PrimaryButton color={C.red} shadowOn={false} height={50} onClick={() => close(true)}>
          Delete
        </PrimaryButton>
      </div>
    ));
    if (!ok) return;
    try {
      await adminRepo.remove(slug, row.id);
      toast('Deleted.');
      load();
    } catch (e) {
      toast(errText(e));
    }
  };

  if (error && !schema) return <ErrorRetry message={error} onRetry={load} />;
  const toggleLabel = (f) => schema?.fields.find((x) => x.name === f)?.label ?? f.replace(/_/g, ' ').replace(/^is /, '');

  return (
    <>
      <PageHeader
        eyebrow={schema?.section}
        title={schema?.title ?? <Sk w={200} h={30} />}
        sub={schema?.help || (data ? `${data.total} ${data.total === 1 ? schema?.verbose : `${schema?.verbose}s`}` : undefined)}
        actions={
          schema?.can_create && (
            <Btn kind="primary" icon={Plus} onClick={() => nav(`/admin/r/${slug}/new`)}>
              Add {schema.verbose}
            </Btn>
          )
        }
      />
      {schema && (schema.search || schema.filters.length > 0) && (
        <div style={{ marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {schema.search && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setParam('q', q.trim());
              }}
              style={{ flex: '1 1 260px', maxWidth: 420, ...inputStyle, display: 'flex', alignItems: 'center', gap: 10 }}
            >
              <Search size={17} color={C.muted} />
              <input
                value={q}
                placeholder={`Search ${schema.title.toLowerCase()}`}
                onChange={(e) => setQ(e.target.value)}
                onBlur={() => q !== (params.get('q') ?? '') && setParam('q', q.trim())}
                style={t(14)}
              />
            </form>
          )}
          {schema.filters.map((f) => (
            <select
              key={f.name}
              aria-label={f.label}
              value={params.get(f.name) ?? ''}
              onChange={(e) => setParam(f.name, e.target.value)}
              style={{ ...inputStyle, width: 'auto', minWidth: 150, appearance: 'auto' }}
            >
              <option value="">All {f.label.toLowerCase()}</option>
              {f.choices.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          ))}
        </div>
      )}
      <div style={{ background: '#fff', borderRadius: 20, border: `1px solid ${C.line}`, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr style={{ background: C.ground }}>
                {schema?.columns.map((c) => (
                  <th
                    key={c.path}
                    style={{
                      padding: '12px 16px',
                      textAlign: c.kind === 'money' ? 'right' : 'left',
                      whiteSpace: 'nowrap',
                      ...t(12, { w: 700, c: C.muted, ls: 0.3 }),
                      textTransform: 'uppercase',
                    }}
                  >
                    {c.label}
                  </th>
                ))}
                {schema && schema.toggles.length > 0 && (
                  <th style={{ padding: '12px 16px', textAlign: 'left', ...t(12, { w: 700, c: C.muted }), textTransform: 'uppercase' }}>Quick</th>
                )}
                <th style={{ width: 90 }} />
              </tr>
            </thead>
            <tbody>
              {!data &&
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={20} style={{ padding: '12px 16px', borderTop: `1px solid ${C.divider}` }}>
                      <Sk h={22} />
                    </td>
                  </tr>
                ))}
              {data?.rows.length === 0 && (
                <tr>
                  <td colSpan={20} style={{ padding: 40, textAlign: 'center', ...t(14, { c: C.muted }) }}>
                    Nothing here{params.toString() ? ' for these filters' : ' yet'}.
                  </td>
                </tr>
              )}
              {data?.rows.map((row) => (
                <tr key={row.id} className="tap" onClick={() => open(row)} style={{ cursor: schema?.detail || schema?.can_edit ? 'pointer' : 'default' }}>
                  {schema?.columns.map((c, i) => (
                    <td
                      key={c.path}
                      style={{
                        padding: '10px 16px',
                        borderTop: `1px solid ${C.divider}`,
                        textAlign: c.kind === 'money' ? 'right' : 'left',
                        maxWidth: 320,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        verticalAlign: 'middle',
                      }}
                    >
                      <Cell col={c} v={row.cells[i]} />
                    </td>
                  ))}
                  {schema && schema.toggles.length > 0 && (
                    <td style={{ padding: '10px 16px', borderTop: `1px solid ${C.divider}` }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {schema.toggles.map((f) => (
                          <button
                            key={f}
                            className="tap"
                            title={toggleLabel(f)}
                            onClick={() => toggle(row, f)}
                            style={{
                              height: 28,
                              padding: '0 10px',
                              borderRadius: 999,
                              background: row.toggles[f] ? C.mint : C.chip,
                              whiteSpace: 'nowrap',
                              ...t(12, { w: 700, c: row.toggles[f] ? C.green700 : C.muted }),
                            }}
                          >
                            {toggleLabel(f)}
                          </button>
                        ))}
                      </div>
                    </td>
                  )}
                  <td style={{ padding: '10px 12px', borderTop: `1px solid ${C.divider}`, textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                    {schema?.can_edit && (
                      <button
                        aria-label="Edit"
                        className="tap"
                        onClick={() => nav(`/admin/r/${slug}/${row.id}/edit`)}
                        style={{ width: 32, height: 32, borderRadius: 10, display: 'inline-grid', placeItems: 'center' }}
                      >
                        <Pencil size={16} color={C.mutedInk} />
                      </button>
                    )}
                    {schema?.can_delete && (
                      <button
                        aria-label="Delete"
                        className="tap"
                        onClick={() => remove(row)}
                        style={{ width: 32, height: 32, borderRadius: 10, display: 'inline-grid', placeItems: 'center' }}
                      >
                        <Trash2 size={16} color={C.redInk} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && data.pages > 1 && (
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.divider}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1, ...t(13, { c: C.muted }) }}>
              Page {data.page} of {data.pages} · {data.total} total
            </span>
            <Btn small icon={ChevronLeft} disabled={data.page <= 1} onClick={() => setParam('page', String(data.page - 1))}>
              Prev
            </Btn>
            <Btn small disabled={data.page >= data.pages} onClick={() => setParam('page', String(data.page + 1))}>
              Next <ChevronRight size={15} />
            </Btn>
          </div>
        )}
      </div>
    </>
  );
}
