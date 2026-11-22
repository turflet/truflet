/** Create / edit any dashboard resource — fields, choices and validation come from the backend schema. */
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ApiError, errText } from '../../lib/api';
import { C, t } from '../../theme';
import { useIsDesktop } from '../../ui/hooks';
import { useOverlay } from '../../ui/overlay';
import { ErrorRetry, Sk, WarnBox } from '../../ui/kit';
import { adminRepo } from '../api';
import { Btn, FieldInput, PageHeader, Panel } from '../ui';

export default function ResourceForm() {
  const { slug = '', id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const desktop = useIsDesktop();
  const { toast } = useOverlay();
  const [schema, setSchema] = useState(null);
  const [values, setValues] = useState({});
  const [changed, setChanged] = useState(new Set());
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [busy, setBusy] = useState(false);
  const editing = id != null;

  useEffect(() => {
    (async () => {
      try {
        const s = await adminRepo.schema(slug);
        setSchema(s);
        if (editing) setValues((await adminRepo.get(slug, Number(id))).values ?? {});
        else {
          // prefill from ?venue=12 etc. (links from the venue page)
          const init = {};
          for (const f of s.fields) if (params.get(f.name)) init[f.name] = params.get(f.name);
          setValues(init);
          setChanged(new Set(Object.keys(init)));
        }
      } catch (e) {
        setLoadError(errText(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, id]);

  const set = (name, v) => {
    setValues((x) => ({ ...x, [name]: v }));
    setChanged((x) => new Set(x).add(name));
    setErrors((x) => ({ ...x, [name]: '' }));
  };

  const save = async () => {
    if (!schema) return;
    setBusy(true);
    setFormError(null);
    try {
      const payload = {};
      for (const f of schema.fields) {
        if (editing && !changed.has(f.name)) continue;
        const v = values[f.name];
        if (f.kind === 'image' && !(v instanceof File) && v !== null) continue; // untouched image
        payload[f.name] = v === undefined ? (f.kind === 'bool' ? false : '') : v;
      }
      const r = editing ? await adminRepo.update(slug, Number(id), payload) : await adminRepo.create(slug, payload);
      toast(r.message ?? 'Saved.');
      if (params.get('next')) nav(params.get('next'));
      else if (schema.detail === 'venue') nav(`/admin/venues/${r.id}`);
      else if (schema.detail === 'booking') nav(`/admin/bookings/${r.id}`);
      else if (schema.detail === 'user') nav(`/admin/users/${r.id}`);
      else nav(`/admin/r/${slug}`);
    } catch (e) {
      if (e instanceof ApiError && e.data?.errors && typeof e.data.errors === 'object') {
        const errs = {};
        for (const [k, v] of Object.entries(e.data.errors)) errs[k] = Array.isArray(v) ? v[0] : String(v);
        setErrors(errs);
        const known = new Set(schema.fields.map((f) => f.name));
        const other = Object.entries(errs).find(([k]) => !known.has(k));
        setFormError(other ? other[1] : 'Please fix the highlighted fields.');
      } else setFormError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  if (loadError) return <ErrorRetry message={loadError} onRetry={() => window.location.reload()} />;
  if (!schema)
    return (
      <div style={{ display: 'grid', gap: 12, maxWidth: 760 }}>
        <Sk h={36} w={260} />
        <Sk h={420} r={20} />
      </div>
    );

  const wide = new Set(['textarea', 'json', 'multi', 'image']);
  const bools = schema.fields.filter((f) => f.kind === 'bool');
  const rest = schema.fields.filter((f) => f.kind !== 'bool');

  return (
    <div style={{ maxWidth: 900 }}>
      <button onClick={() => nav(-1)} style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, ...t(13, { w: 600, c: C.brand }) }}>
        <ArrowLeft size={16} color={C.brand} /> Back
      </button>
      <PageHeader eyebrow={schema.title} title={editing ? `Edit ${schema.verbose}` : `New ${schema.verbose}`} sub={schema.help || undefined} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Panel>
          <div style={{ display: 'grid', gridTemplateColumns: desktop ? '1fr 1fr' : '1fr', gap: 18 }}>
            {rest.map((f) => (
              <div key={f.name} style={{ gridColumn: desktop && wide.has(f.kind) ? '1 / -1' : undefined }}>
                <FieldInput f={f} value={values[f.name]} error={errors[f.name]} onChange={(v) => set(f.name, v)} />
              </div>
            ))}
          </div>
          {bools.length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 18, borderTop: `1px solid ${C.divider}`, display: 'grid', gridTemplateColumns: desktop ? '1fr 1fr' : '1fr', gap: 14 }}>
              {bools.map((f) => (
                <FieldInput key={f.name} f={f} value={values[f.name]} error={errors[f.name]} onChange={(v) => set(f.name, v)} />
              ))}
            </div>
          )}
          {schema.fields.length === 0 && <div style={t(14, { c: C.muted })}>Nothing here can be edited.</div>}
        </Panel>
        {formError && <WarnBox style={{ marginTop: 14 }}>{formError}</WarnBox>}
        <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
          <Btn type="submit" kind="primary" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : `Create ${schema.verbose}`}
          </Btn>
          <Btn onClick={() => nav(-1)}>Cancel</Btn>
        </div>
      </form>
    </div>
  );
}
