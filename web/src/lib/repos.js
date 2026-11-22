/** All API calls, grouped like mobile/lib/data/repositories/*. */
import { api, asList, asMap } from './api';

export const authRepo = {
  /** `{email, sent, dev_code?}` — `dev_code` only in dev mode. */
  requestCode: async (email) => asMap(await api.post('/auth/otp/request/', { email })),
  /** `{access, refresh, is_new, user}` */
  verifyCode: async (email, code) => asMap(await api.post('/auth/otp/verify/', { email, code })),
};

export const configRepo = {
  config: async () => asMap(await api.get('/config/')),
  sports: async () => asList(await api.get('/sports/')),
};

export const userRepo = {
  me: async () => asMap(await api.get('/me/')),
  updateMe: async (patch) => asMap(await api.patch('/me/', patch)),
  setSports: async (sports) => asMap(await api.put('/me/sports/', sports)),
  deleteRequest: async (body = {}) => asMap(await api.post('/me/delete/', body)),
};

export const locationRepo = {
  cities: async () => asList(await api.get('/cities/')),
  /** Nearest area for a GPS fix: `{city_id, city, area_id, area}`. */
  locate: async (lat, lng) => asMap(await api.get('/locate/', { lat, lng })),
};

export const venueRepo = {
  /** `{items, radius_km, radius_label, notice}` */
  search: async (q) => asMap(await api.get('/venues/', q)),
  amenities: async () => asList(await api.get('/amenities/')),
  details: async (id) => asMap(await api.get(`/venues/${id}/`)),
  toggleSaved: async (id) => asMap(await api.post(`/venues/${id}/save/`)),
  saved: async (lat, lng) => asList(await api.get('/venues/saved/', { lat, lng })),
  availability: async (id, date, sportId, courtId) => asMap(await api.get(`/venues/${id}/availability/`, { date, sport: sportId, court: courtId })),
  review: (id, rating, bookingId) => api.post(`/venues/${id}/review/`, { rating, booking: bookingId }),
};

export const bookingRepo = {
  /** tab: upcoming | completed | cancelled → `{items, counts}` */
  list: async (tab) => asMap(await api.get('/bookings/', { tab })),
  details: async (id) => asMap(await api.get(`/bookings/${id}/`)),
  hold: async (body) => asMap(await api.post('/bookings/', body)),
  reschedule: (id, date, startHour, courtId) => api.post(`/bookings/${id}/reschedule/`, { date, start_hour: startHour, court: courtId }),
  applyCoupon: async (id, code) => asMap(await api.post(`/bookings/${id}/coupon/`, { code })),
  pay: async (id, method, upiId) => asMap(await api.post(`/bookings/${id}/pay/`, { method, upi_id: upiId })),
  paymentStatus: async (id) => asMap(await api.get(`/bookings/${id}/payment/`)),
  cancelQuote: async (id) => asMap(await api.get(`/bookings/${id}/cancel/`)),
  cancel: async (id) => asMap(await api.post(`/bookings/${id}/cancel/`, {})),
};

export const lobbyRepo = {
  cityLobbies: async (areaId, sportId) => asList(await api.get('/lobbies/', { area: areaId, sport: sportId })),
  venueLobbies: async (venueId, q = {}) => asList(await api.get(`/venues/${venueId}/lobbies/`, q)),
  mine: async () => asMap(await api.get('/lobbies/mine/')),
  recentPlayers: async () => asMap(await api.get('/lobbies/players/')),
  lookup: async (contact) => asMap(await api.get('/lobbies/players/', { contact })),
  create: async (body) => asMap(await api.post('/lobbies/', body)),
  lobby: async (id) => asMap(await api.get(`/lobbies/${id}/`)),
  requestToJoin: async (id, message) => asMap(await api.post(`/lobbies/${id}/request/`, { message })),
  messages: async (id, after) => asList(await api.get(`/lobbies/${id}/messages/`, { after })),
  send: async (id, body) => asMap(await api.post(`/lobbies/${id}/messages/`, { body })),
  requests: async (id) => asList(await api.get(`/lobbies/${id}/requests/`)),
  request: async (id, rid) => asMap(await api.get(`/lobbies/${id}/requests/${rid}/`)),
  threadMessages: async (id, rid, after) => asList(await api.get(`/lobbies/${id}/requests/${rid}/messages/`, { after })),
  sendThread: async (id, rid, body) => asMap(await api.post(`/lobbies/${id}/requests/${rid}/messages/`, { body })),
  decide: async (id, rid, action) => asMap(await api.post(`/lobbies/${id}/requests/${rid}/${action}/`)),
  checkout: async (id) => asMap(await api.get(`/lobbies/${id}/pay/`)),
  pay: async (id, method, upiId = '') => asMap(await api.post(`/lobbies/${id}/pay/`, { method, upi_id: upiId })),
  paymentStatus: async (id) => asMap(await api.get(`/lobbies/${id}/payment/`)),
  action: async (id, action, body = {}) => asMap(await api.post(`/lobbies/${id}/${action}/`, body)),
  removeMember: async (id, memberId) => asMap(await api.post(`/lobbies/${id}/members/${memberId}/remove/`)),
};

export const notificationRepo = {
  list: async () => asMap(await api.get('/notifications/')),
  markAllRead: () => api.post('/notifications/read/'),
};

export const supportRepo = {
  faqs: async (q) => asList(await api.get('/faqs/', q ? { q } : undefined)),
  createTicket: (subject, message, bookingId) => api.post('/support/tickets/', { subject, message, booking: bookingId ?? undefined }),
  policies: async () => asMap(await api.get('/policies/')),
};
