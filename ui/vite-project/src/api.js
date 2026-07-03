async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    ...options,
  });
  if (!response.ok) {
    let detail = `${response.status}`;
    try {
      const data = await response.json();
      if (data.detail) detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch {
      /* keep status text */
    }
    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export const api = {
  dashboard: (scope) => request(`/api/dashboard?scope=${encodeURIComponent(scope)}`),
  scopes: () => request("/api/scopes"),
  sessions: () => request("/api/sessions"),
  story: () => request("/api/story"),
  me: () => request("/api/me"),
  login: (pin) => request("/api/auth/owner-login", { method: "POST", body: JSON.stringify({ pin }) }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  roster: () => request("/api/record/roster"),
  createSession: (payload) =>
    request("/api/record/sessions", { method: "POST", body: JSON.stringify(payload) }),
  sessionGames: (id) => request(`/api/record/sessions/${id}`),
  createGame: (payload) =>
    request("/api/record/games", { method: "POST", body: JSON.stringify(payload) }),
  updateGame: (id, payload) =>
    request(`/api/record/games/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteGame: (id) => request(`/api/record/games/${id}`, { method: "DELETE" }),
};

