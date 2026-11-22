/** Auth gates and the "back to where I was" helpers — web versions of auth_guard.dart / app_navigation.dart. */
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSession } from './session';
import { useOverlay } from '../ui/overlay';
import { ProfileForm } from '../features/auth/ProfileForm';
import { C, d, t } from '../theme';

export const routes = {
  home: '/home',
  matches: '/matches',
  bookings: '/bookings',
  profile: '/profile',
  login: '/login',
  venue: (id) => `/venues/${id}`,
  ticket: (id) => `/tickets/${id}`,
  match: (id) => `/matches/${id}`,
  request: (id, rid) => `/matches/${id}/requests/${rid}`,
  payment: (bookingId) => `/payment/${bookingId}`,
  confirmed: (bookingId) => `/booking-confirmed/${bookingId}`,
};

/** Returns true when signed in; otherwise opens sign-in (which comes back here afterwards) and returns false. */
export function useRequireLogin() {
  const { loggedIn } = useSession();
  const nav = useNavigate();
  const loc = useLocation();
  return useCallback(() => {
    if (loggedIn) return true;
    nav(routes.login, { state: { back: loc.pathname + loc.search } });
    return false;
  }, [loggedIn, nav, loc]);
}

/** Signed in AND has name + mobile (needed before booking so the venue can reach the player). */
export function useRequireProfile() {
  const requireLogin = useRequireLogin();
  const { user } = useSession();
  const { sheet } = useOverlay();
  return useCallback(async () => {
    if (!requireLogin()) return false;
    if (user?.profile_complete === true) return true;
    const ok = await sheet((close) => (
      <div>
        <div style={d(22)}>Complete your profile</div>
        <div style={{ margin: '6px 0 16px', ...t(14, { c: C.muted, h: 1.5 }) }}>The venue needs your name and mobile number for this booking.</div>
        <ProfileForm submitLabel="Save & continue" onSaved={() => close(true)} />
      </div>
    ));
    return ok === true;
  }, [requireLogin, user, sheet]);
}

/** Goes back when there is history inside the app, else to [fallback]. */
export function useBack(fallback = routes.home) {
  const nav = useNavigate();
  return useCallback(() => {
    const idx = window.history.state?.idx ?? 0;
    if (idx > 0) nav(-1);
    else nav(fallback, { replace: true });
  }, [nav, fallback]);
}
