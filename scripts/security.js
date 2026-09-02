const sessionKey = 'lavender-session';
let sessionPromise;
const apiBase = () => (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

const loadTurnstile = () => new Promise((resolve, reject) => {
  if (window.turnstile) return resolve(window.turnstile);
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.async = true;
  script.onload = () => resolve(window.turnstile);
  script.onerror = reject;
  document.head.appendChild(script);
});

const getTurnstileToken = async () => {
  const config = await fetch(`${apiBase()}/api/config`).then(response => response.json());
  const container = document.querySelector('#turnstile-widget');
  const sitekey = container?.dataset.sitekey || config.turnstileSiteKey;
  if (!sitekey) throw new Error('Turnstile is not configured.');
  const turnstile = await loadTurnstile();
  if (!container) throw new Error('Turnstile widget container is missing.');
  return new Promise((resolve, reject) => turnstile.render(container, {
    sitekey,
    action: 'session',
    callback: resolve,
    'error-callback': () => reject(new Error('Human verification failed.')),
    'expired-callback': () => reject(new Error('Human verification expired.'))
  }));
};

const getSession = async () => {
  const stored = JSON.parse(sessionStorage.getItem(sessionKey) || 'null');
  if (stored?.sessionId && stored?.sessionToken && stored.expiresAt > Date.now()) return stored;
  const response = await fetch(`${apiBase()}/api/session`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ turnstileToken: await getTurnstileToken() })
  });
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Authentication failed.');
  const session = await response.json();
  const value = { ...session, expiresAt: Date.now() + (session.expiresInSeconds - 30) * 1000 };
  sessionStorage.setItem(sessionKey, JSON.stringify(value));
  return value;
};

export const apiFetch = async (url, options = {}) => {
  if (new URL(url, window.location.href).pathname === '/api/session') {
    const headers = new Headers(options.headers || {});
    headers.set('content-type', 'application/json');
    const body = options.body || JSON.stringify({ turnstileToken: await getTurnstileToken() });
    return fetch(url, { ...options, method: 'POST', headers, body });
  }
  const session = await getSession();
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${session.sessionToken}`);
  headers.set('X-Session-Id', session.sessionId);
  return fetch(url, { ...options, headers });
};
