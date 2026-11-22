/** Admin dashboard API (backend/dashboard/api.py). */
import { api, asMap } from '../lib/api';

/** Turns a values object into FormData when it carries files, else plain JSON. */
function body(values) {
  const hasFile = Object.values(values).some((v) => v instanceof File);
  if (!hasFile) return values;
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => fd.append(k, String(x)));
    else if (v instanceof File) fd.append(k, v);
    else if (typeof v === 'boolean') fd.append(k, v ? 'true' : 'false');
    else fd.append(k, v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  return fd;
}

export const adminRepo = {
  meta: async () => asMap(await api.get('/admin/meta/')),
  home: async () => asMap(await api.get('/admin/home/')),
  search: async (q) => asMap(await api.get('/admin/search/', { q })),
  list: async (slug, params) => asMap(await api.get(`/admin/r/${slug}/`, params)),
  schema: async (slug) => await api.get(`/admin/r/${slug}/schema/`),
  get: async (slug, id) => asMap(await api.get(`/admin/r/${slug}/${id}/`)),
  create: async (slug, values) => asMap(await api.post(`/admin/r/${slug}/`, body(values))),
  update: async (slug, id, values) => asMap(await api.patch(`/admin/r/${slug}/${id}/`, body(values))),
  remove: (slug, id) => api.delete(`/admin/r/${slug}/${id}/`),
  toggle: async (slug, id, field) => asMap(await api.post(`/admin/r/${slug}/${id}/toggle/${field}/`)),
  venue: async (id) => asMap(await api.get(`/admin/venues/${id}/`)),
  uploadPhotos: async (id, files) => {
    const fd = new FormData();
    files.forEach((f) => fd.append('images', f));
    return asMap(await api.post(`/admin/venues/${id}/photos/`, fd));
  },
  deletePhoto: (id, photoId) => api.delete(`/admin/venues/${id}/photos/${photoId}/`),
  board: async (id, date) => asMap(await api.get(`/admin/venues/${id}/board/`, { date })),
  booking: async (id) => asMap(await api.get(`/admin/bookings/${id}/`)),
  bookingAction: async (id, action, data = {}) => asMap(await api.post(`/admin/bookings/${id}/${action}/`, data)),
  checkin: async (code) => asMap(await api.get('/admin/checkin/', { code })),
  user: async (id) => asMap(await api.get(`/admin/users/${id}/`)),
  wallet: async (id, amount) => asMap(await api.post(`/admin/users/${id}/wallet/`, { amount })),
  settings: async () => asMap(await api.get('/admin/settings/')),
  saveSettings: async (values) => asMap(await api.patch('/admin/settings/', body(values))),
  broadcast: async (title, bodyText, audience) => asMap(await api.post('/admin/broadcast/', { title, body: bodyText, audience })),
};
