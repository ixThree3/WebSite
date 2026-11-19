const DEVICE_TOKEN_KEY = 'majlis_device_token';
const SESSION_TOKEN_KEY = 'majlis_session_token';

export function getOrCreateDeviceToken(): string {
  if (typeof window === 'undefined') return 'ssr-device';
  let token = window.localStorage.getItem(DEVICE_TOKEN_KEY);
  if (!token) {
    token = `dev_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    window.localStorage.setItem(DEVICE_TOKEN_KEY, token);
  }
  return token;
}

export function buildDeviceFingerprint(): string {
  if (typeof navigator === 'undefined') return 'win64|10||ssr|001|Chrome';
  const ua = navigator.userAgent;
  let os = 'Linux|10';
  if (/Windows/i.test(ua)) os = 'win64|11';
  else if (/iPhone/i.test(ua)) os = 'iPhone|18.7';
  else if (/iPad/i.test(ua)) os = 'iPad|18.7';
  else if (/Android/i.test(ua)) os = 'Android|14';
  else if (/Mac OS X/i.test(ua)) os = 'Mac|15.2';

  let browser = 'Chrome';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';

  const token = getOrCreateDeviceToken().slice(-6);
  const seg1 = btoa(String(window.screen?.width ?? 1440)).replace(/=/g, '').slice(0, 6).toLowerCase();
  const seg2 = btoa(String(navigator.language || 'ar')).replace(/=/g, '').slice(0, 6).toLowerCase();
  return `${os}||${token}|${seg1}|${seg2}|rksabd|1vg1lwt.${browser}`;
}

export function getStoredSessionToken(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(SESSION_TOKEN_KEY) ?? '';
}

export function setStoredSessionToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem(SESSION_TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(SESSION_TOKEN_KEY);
  }
}

export interface SavedAccountEntry {
  userId: string;
  username: string;
  topic: string;
  color: string;
  nameStyle?: string;
  fontFamily?: string;
  avatarUrl: string | null;
  rankId: string;
  quickLoginToken: string;
  savedAt: number;
}

const SAVED_ACCOUNTS_KEY = 'majlis_saved_accounts';

export function getSavedAccounts(): SavedAccountEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SAVED_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedAccountEntry[]) : [];
  } catch {
    return [];
  }
}

export function upsertSavedAccount(entry: SavedAccountEntry): SavedAccountEntry[] {
  if (typeof window === 'undefined') return [];
  const existing = getSavedAccounts().filter(
    (a) => a.userId !== entry.userId && a.username.toLowerCase() !== entry.username.toLowerCase()
  );
  const next = [entry, ...existing].slice(0, 5);
  try {
    window.localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(next));
  } catch {
    // ignore storage quota errors
  }
  return next;
}

export function removeSavedAccount(quickLoginToken: string): SavedAccountEntry[] {
  if (typeof window === 'undefined') return [];
  const next = getSavedAccounts().filter((a) => a.quickLoginToken !== quickLoginToken);
  try {
    window.localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

const LOCAL_MUTED_KEY = 'majlis_local_muted_users';

export function getLocallyMutedUserIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_MUTED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function setLocallyMutedUserIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_MUTED_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export async function apiFetch<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  const sessionToken = getStoredSessionToken();
  if (sessionToken) {
    headers.set('x-session-token', sessionToken);
  }
  headers.set('x-device-token', getOrCreateDeviceToken());
  headers.set('x-device-fp', buildDeviceFingerprint());

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error((data as { error?: string }).error || 'حدث خطأ في الاتصال') as Error & {
      status?: number;
      data?: unknown;
    };
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

export function countryToFlagEmoji(code: string): string {
  const clean = (code || 'SA').trim().toUpperCase();
  if (clean.length !== 2) return '🏳️';
  return String.fromCodePoint(
    ...Array.from(clean).map((c) => 127397 + c.charCodeAt(0))
  );
}

export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}
