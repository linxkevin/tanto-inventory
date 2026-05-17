const BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  getItems:           (all)      => req('GET',   all ? '/api/items?all=true' : '/api/items'),
  postItem:           (data)     => req('POST',  '/api/items', data),
  patchItem:          (id, data) => req('PATCH',  `/api/items/${id}`, data),
  deleteItem:         (id)       => req('DELETE', `/api/items/${id}`),
  getSessions:        (location) => req('GET',   '/api/sessions' + (location ? `?location=${encodeURIComponent(location)}` : '')),
  getSession:         (id)       => req('GET',   `/api/sessions/${id}`),
  postSession:        (data)     => req('POST',  '/api/sessions', data),
  getSettings:        ()         => req('GET',   '/api/settings'),
  postSetting:        (key, val) => req('POST',  '/api/settings', { key, value: val }),
  getCategories:      ()         => req('GET',   '/api/categories'),
  postCategory:       (name, icon) => req('POST', '/api/categories', { name, icon }),
  deleteCategory:     (name)     => req('DELETE', `/api/categories/${encodeURIComponent(name)}`),
};
