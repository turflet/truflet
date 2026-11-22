import { useCallback, useEffect, useRef, useState } from 'react';
import { DESKTOP_MIN } from '../theme';
import { errText } from '../lib/api';

/** True on wide screens, where pages switch to the desktop layout. */
export function useIsDesktop() {
  const q = `(min-width: ${DESKTOP_MIN}px)`;
  const [on, setOn] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const f = () => setOn(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, [q]);
  return on;
}

/** Loading / loaded / failed for one request — the web version of DataCubit + Loader. */
export function useData(load, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const loadRef = useRef(load);
  loadRef.current = load;
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    try {
      const r = await loadRef.current();
      if (alive.current) {
        setData(r);
        setError(null);
      }
    } catch (e) {
      if (alive.current) setError(errText(e));
    }
  }, []);

  const retry = useCallback(() => {
    setError(null);
    reload();
  }, [reload]);

  /** Fresh fetch that shows the skeleton again. */
  const refetch = useCallback(() => {
    setData(null);
    setError(null);
    return reload();
  }, [reload]);

  useEffect(() => {
    setData(null);
    setError(null);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, reload, retry, refetch, setData };
}

/** Re-renders every [ms] (countdowns). */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
