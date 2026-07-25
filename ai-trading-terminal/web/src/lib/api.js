export async function api(path, options = {}) {
  const token = localStorage.getItem('jwt');
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? res.statusText);
  }
  return res.json();
}

export async function fetchPrice(ticker) {
  try {
    const { price } = await api(`/api/prices/${encodeURIComponent(ticker)}`);
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}
