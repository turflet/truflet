import { lazy, Suspense, useCallback, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SessionProvider, useSession } from './app/session';
import { OverlayProvider } from './ui/overlay';
import { Spinner } from './ui/kit';
import { C } from './theme';
import Splash from './features/splash/Splash';
import Explore from './features/explore/Explore';

const Onboarding = lazy(() => import('./features/onboarding/Onboarding'));
const Location = lazy(() => import('./features/location/Location'));
const Login = lazy(() => import('./features/auth/Login'));
const Pages = lazy(() => import('./pages'));
const Admin = lazy(() => import('./admin/AdminApp'));
const Privacy = lazy(() => import('./features/legal/Privacy'));
const DeleteAccount = lazy(() => import('./features/legal/DeleteAccount'));

// Public pages opened straight from a link (Play Store listing, app) — no splash in front of them.
const NO_SPLASH = ['/privacy', '/delete-account'];

function Loading() {
  return (
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
      <Spinner size={28} color={C.brand} stroke={3} />
    </div>
  );
}

/** "/" — after the splash: onboarding on the first visit, then location if none picked, else home. */
function Start() {
  const s = useSession();
  if (!s.onboarded) return <Navigate to="/onboarding" replace />;
  if (s.areaId == null) return <Navigate to="/location?first=1" replace />;
  return <Navigate to="/home" replace />;
}

function Boot({ children }) {
  const { booted } = useSession();
  const [splash, setSplash] = useState(() => !NO_SPLASH.includes(window.location.pathname.replace(/\/$/, '')));
  const done = useCallback(() => setSplash(false), []);
  return (
    <>
      {!splash && children}
      {splash && <Splash ready={booted} onDone={done} />}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <OverlayProvider>
          <Boot>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/" element={<Start />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/location" element={<Location />} />
                <Route path="/login" element={<Login />} />
                <Route path="/home" element={<Explore />} />
                <Route path="/admin/*" element={<Admin />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/delete-account" element={<DeleteAccount />} />
                <Route path="/*" element={<Pages />} />
              </Routes>
            </Suspense>
          </Boot>
        </OverlayProvider>
      </SessionProvider>
    </BrowserRouter>
  );
}
