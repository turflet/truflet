# Turflet web

React + JavaScript (Vite) version of the Flutter app, plus the venue/admin dashboard.

- **Player app** — every Flutter screen: splash (same logo animation), onboarding, city, email-code sign-in,
  Explore, venue, slot matrix, squad builder, payment (YOUPI UPI checkout in a new tab), ticket, bookings,
  matches / lobbies / Match Room / request threads, profile, saved, help, policies.
- **Public pages** — `/privacy` and `/delete-account` (the Play Store links; no sign-in, no splash).
  Under 960px it is the Flutter phone layout; on desktop it switches to a top bar, sidebars and grids.
- **Admin dashboard** at `/admin` — the backend's old `/admin-panel/` URLs redirect here. Admins see everything;
  turf owners only their grounds. Same email-code sign-in (JWT). API: `backend/dashboard/api.py`.

```bash
npm install
npm run dev          # http://localhost:5173, talks to http://127.0.0.1:8000/api/v1
npm run build        # dist/  (set VITE_API_BASE for the target backend)
```

Design tokens mirror `mobile/lib/core/theme` one-to-one (`src/theme.js`). Images in `public/images`
are copied from `mobile/assets/images`.
