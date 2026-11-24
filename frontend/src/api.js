// JWT is kept in sessionStorage so it is cleared when the tab closes.
const KEY = "hms_token";
export const getToken = () => {
  try { return sessionStorage.getItem(KEY); } catch { return null; }
};
export const setToken = (t) => {
  try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
};

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function request(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = [data.error, ...(data.details || [])].filter(Boolean).join(": ") || `Request failed (${res.status})`;
    throw new ApiError(msg, res.status);
  }
  return data;
}

export const api = {
  login: (email, password) => request("/auth/login", { method: "POST", body: { email, password } }),
  register: (name, email, password) => request("/auth/register", { method: "POST", body: { name, email, password } }),
  me: () => request("/auth/me"),
  doctors: () => request("/users/doctors"),
  createStaff: (b) => request("/users", { method: "POST", body: b }),
  patients: (q = "") => request(`/patients${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  patient: (id) => request(`/patients/${id}`),
  myRecord: () => request("/patients/me"),
  addNote: (id, text) => request(`/patients/${id}/notes`, { method: "POST", body: { text } }),
  deletePatient: (id) => request(`/patients/${id}`, { method: "DELETE" }),
  appointments: () => request("/appointments"),
  book: (b) => request("/appointments", { method: "POST", body: b }),
  setStatus: (id, status) => request(`/appointments/${id}/status`, { method: "PATCH", body: { status } }),
};
