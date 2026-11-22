/** App settings (admins): fees, offer banner, support contacts… every AppConfig field, from the backend schema. */
import { useState } from 'react';
import { ApiError, errText } from '../../lib/api';
import { C } from '../../theme';
import { useData, useIsDesktop } from '../../ui/hooks';
import { useOverlay } from '../../ui/overlay';
import { ErrorRetry, Sk, WarnBox } from '../../ui/kit';
import { adminRepo } from '../api';
import { Btn, FieldInput, PageHeader, Panel } from '../ui';

export default function SettingsPage() {
  const desktop = useIsDesktop();
  const { toast } = useOverlay();
  const { data, error, retry, reload } = useData(() => adminRepo.settings());
  const [edits, setEdits] = useState({});
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (error) return <ErrorRetry message={error} onRetry={retry} />;
  if (!data)
    return (
      <div style={{ display: 'grid', gap: 14, maxWidth: 900 }}>
        <Sk h={36} w={220} />
        <Sk h={480} r={20} />
      </div>
    );

  const fields = data.fields;
  const values = { ...data.values, ...edits };
  const save = async () => {
    setBusy(true);
    setFormError(null);
    try {
      toast((await adminRepo.saveSettings(edits)).message);
      setEdits({});
      reload();
    } catch (e) {
      if (e instanceof ApiError && e.data?.errors) {
        const errs = {};
        for (const [k, v] of Object.entries(e.data.errors)) errs[k] = Array.isArray(v) ? v[0] : String(v);
        setErrors(errs);
      }
      setFormError(errText(e));
    } finally {
      setBusy(false);
    }
  };
  const dirty = Object.keys(edits).length > 0;
  const wide = new Set(['textarea', 'json', 'image']);

  return (
    <div style={{ maxWidth: 960 }}>
      <PageHeader eyebrow="Platform" title="App settings" sub="Fees, the Explore offer banner, support contacts and policy dates. Changes reach the app immediately." />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Panel>
          <div style={{ display: 'grid', gridTemplateColumns: desktop ? '1fr 1fr' : '1fr', gap: 18 }}>
            {fields.map((f) => (
              <div key={f.name} style={{ gridColumn: desktop && wide.has(f.kind) ? '1 / -1' : undefined }}>
                <FieldInput
                  f={f}
                  value={values[f.name]}
                  error={errors[f.name]}
                  onChange={(v) => (setEdits((x) => ({ ...x, [f.name]: v })), setErrors((x) => ({ ...x, [f.name]: '' })))}
                />
              </div>
            ))}
          </div>
        </Panel>
        {formError && <WarnBox style={{ marginTop: 14 }}>{formError}</WarnBox>}
        <div
          style={{
            position: 'sticky',
            bottom: 16,
            marginTop: 18,
            display: 'flex',
            gap: 10,
            padding: dirty ? 12 : 0,
            borderRadius: 16,
            background: dirty ? '#fff' : 'transparent',
            border: dirty ? `1px solid ${C.line}` : 'none',
            boxShadow: dirty ? '0 12px 30px rgba(12,36,25,.12)' : undefined,
          }}
        >
          <Btn type="submit" kind="primary" disabled={!dirty || busy}>
            {busy ? 'Saving…' : 'Save settings'}
          </Btn>
          {dirty && <Btn onClick={() => setEdits({})}>Discard changes</Btn>}
        </div>
      </form>
    </div>
  );
}
