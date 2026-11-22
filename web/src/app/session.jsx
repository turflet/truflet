/** Session, location, config, sports and favourites — everything more than one screen needs.
 *  Mirrors mobile/lib/app/session/app_cubit.dart. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, asMap, tokens } from '../lib/api';
import { configRepo, userRepo } from '../lib/repos';

const P = { onboarded: 'onboarded', area: 'area', user: 'user' };

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function initial() {
  const area = readJson(P.area);
  return {
    user: tokens.access ? readJson(P.user) : null,
    config: {},
    sports: [],
    onboarded: localStorage.getItem(P.onboarded) === '1',
    areaId: area?.id ?? null,
    areaName: area?.area ?? '',
    cityName: area?.city ?? '',
    lat: area?.lat ?? null,
    lng: area?.lng ?? null,
    saved: new Set(),
    booted: false,
  };
}

const Ctx = createContext(null);

export function SessionProvider({ children }) {
  const [s, setS] = useState(initial);
  const ref = useRef(s);
  ref.current = s;
  const patch = useCallback((p) => setS((prev) => ({ ...prev, ...p })), []);

  // keep the cached profile in step with the session, so a reload shows the player signed in at once
  useEffect(() => {
    if (s.user) localStorage.setItem(P.user, JSON.stringify(s.user));
    else localStorage.removeItem(P.user);
  }, [s.user]);

  const logout = useCallback(() => {
    tokens.clear();
    patch({ user: null, saved: new Set() });
  }, [patch]);

  const refreshMe = useCallback(async () => {
    try {
      patch({ user: await userRepo.me() });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401 && !tokens.access) logout();
    }
  }, [patch, logout]);

  // the session ended underneath us (refresh token expired) → show the signed-out state
  useEffect(() => {
    tokens.onCleared = () => setS((prev) => (prev.user ? { ...prev, user: null, saved: new Set() } : prev));
    return () => {
      tokens.onCleared = undefined;
    };
  }, []);

  // boot: config, sports and the profile. Network failures are swallowed so the app still opens offline.
  useEffect(() => {
    const quietly = (f) => f().catch(() => undefined);
    Promise.all([
      quietly(async () => patch({ config: await configRepo.config() })),
      quietly(async () => patch({ sports: await configRepo.sports() })),
      tokens.access ? quietly(refreshMe) : Promise.resolve(),
    ]).finally(() => patch({ booted: true }));
  }, [patch, refreshMe]);

  const ensureBasics = useCallback(async () => {
    const cur = ref.current;
    if (cur.sports.length && Object.keys(cur.config).length) return;
    const [sports, config] = await Promise.all([configRepo.sports(), configRepo.config()]);
    patch({ sports, config });
  }, [patch]);

  const updateMe = useCallback(async (p) => patch({ user: await userRepo.updateMe(p) }), [patch]);

  const setLoggedIn = useCallback(
    async (data) => {
      tokens.save(data.access, data.refresh);
      let user = asMap(data.user);
      patch({ user });
      const cur = ref.current;
      // a first-time player inherits the area they picked before signing in
      if (user.home_area == null && cur.areaId != null) {
        try {
          user = await userRepo.updateMe({ home_area_id: cur.areaId, lat: cur.lat ?? undefined, lng: cur.lng ?? undefined });
        } catch {
          /* keep going */
        }
      }
      patch({ user });
    },
    [patch],
  );

  const setArea = useCallback(
    async (a) => {
      patch({ areaId: a.id, areaName: a.area, cityName: a.city, lat: a.lat ?? null, lng: a.lng ?? null });
      localStorage.setItem(P.area, JSON.stringify(a));
      if (tokens.access) {
        try {
          await updateMe({ home_area_id: a.id, lat: a.lat ?? undefined, lng: a.lng ?? undefined });
        } catch {
          /* local choice still stands */
        }
      }
    },
    [patch, updateMe],
  );

  const value = useMemo(
    () => ({
      ...s,
      loggedIn: !!tokens.access && !!s.user,
      ensureBasics,
      refreshMe,
      setLoggedIn,
      setUser: (u) => patch({ user: u }),
      updateMe,
      logout,
      finishOnboarding: () => {
        localStorage.setItem(P.onboarded, '1');
        patch({ onboarded: true });
      },
      setArea,
      replaceSaved: (ids) => patch({ saved: new Set(ids) }),
      markSaved: (id, on) =>
        setS((prev) => {
          const next = new Set(prev.saved);
          if (on) next.add(id);
          else next.delete(id);
          return { ...prev, saved: next };
        }),
    }),
    [s, ensureBasics, refreshMe, setLoggedIn, updateMe, logout, setArea, patch],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}

export const isStaffOrOwner = (u) => !!u && (u.is_staff === true || u.is_venue_owner === true);
