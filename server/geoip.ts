/**
 * IP-to-Country geolocation utilities for resolving every user's country flag
 * directly from their IP address (and authoritative proxy/CDN headers when present).
 */

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const GEO_TIMEOUT_MS = 2500;

interface CacheEntry {
  code: string;
  at: number;
}

const ipCountryCache = new Map<string, CacheEntry>();
const inflightLookups = new Map<string, Promise<string>>();

/**
 * Normalizes a raw IP address header/socket string:
 * - Takes the first entry if comma-separated (x-forwarded-for)
 * - Strips IPv4-mapped IPv6 prefix (::ffff:)
 * - Strips surrounding brackets / port if present
 */
export function normalizeIpAddress(raw: string | null | undefined): string {
  if (!raw) return '127.0.0.1';
  let value = raw.split(',')[0]?.trim() ?? '';
  if (!value) return '127.0.0.1';

  // Strip IPv6 brackets e.g. [::1]:1234
  if (value.startsWith('[')) {
    const end = value.indexOf(']');
    if (end > 0) value = value.slice(1, end);
  }

  // Strip IPv4-mapped IPv6 prefix
  if (value.toLowerCase().startsWith('::ffff:')) {
    value = value.slice(7);
  }

  // Strip IPv4 port e.g. 1.2.3.4:5678
  if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(value)) {
    value = value.split(':')[0]!;
  }

  return value.trim() || '127.0.0.1';
}

/**
 * Returns true if the IP is loopback, link-local, RFC1918 private, or ULA IPv6.
 */
export function isPrivateOrLoopbackIp(rawIp: string): boolean {
  const ip = normalizeIpAddress(rawIp).toLowerCase();
  if (!ip || ip === '::1' || ip === 'localhost' || ip === '0.0.0.0') return true;
  if (ip.startsWith('127.')) return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('169.254.')) return true;
  if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:')) return true;

  // 172.16.0.0 - 172.31.255.255
  const m172 = /^172\.(\d+)\./.exec(ip);
  if (m172) {
    const second = Number(m172[1]);
    if (second >= 16 && second <= 31) return true;
  }

  // 100.64.0.0/10 CGNAT
  const m100 = /^100\.(\d+)\./.exec(ip);
  if (m100) {
    const second = Number(m100[1]);
    if (second >= 64 && second <= 127) return true;
  }

  return false;
}

export function normalizeCountryCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const clean = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(clean)) return null;
  // Ignore reserved/unknown ISO proxy codes
  if (clean === 'XX' || clean === 'T1' || clean === 'ZZ' || clean === 'A1' || clean === 'A2') {
    return null;
  }
  return clean;
}

/**
 * Extracts country code from reverse-proxy / CDN headers when available
 * (Cloudflare, Google App Engine / Cloud Load Balancer, Vercel, Fastly, etc.).
 */
export function extractHeaderCountry(
  headers: Record<string, string | string[] | undefined>
): string | null {
  const keys = [
    'cf-ipcountry',
    'x-appengine-country',
    'x-cloud-country',
    'x-vercel-ip-country',
    'x-geo-country',
    'x-country-code',
  ];
  for (const key of keys) {
    const val = headers[key];
    const str = Array.isArray(val) ? val[0] : val;
    const code = normalizeCountryCode(str);
    if (code) return code;
  }
  return null;
}

/**
 * Fallback helper: extracts region subtag from Accept-Language (e.g. "ar-IQ,ar;q=0.9" -> "IQ").
 */
export function extractAcceptLanguageCountry(acceptLanguage?: string | string[]): string | null {
  const raw = Array.isArray(acceptLanguage) ? acceptLanguage[0] : acceptLanguage;
  if (!raw) return null;
  const parts = raw.split(',');
  for (const part of parts) {
    const langTag = part.split(';')[0]?.trim() ?? '';
    const match = /^[a-z]{2,3}[-_]([a-zA-Z]{2})(?:$|[-_])/.exec(langTag);
    if (match) {
      const code = normalizeCountryCode(match[1]);
      if (code) return code;
    }
  }
  return null;
}

/**
 * Parses common GeoIP JSON responses (ipwho.is, ip-api.com, ipapi.co).
 */
export function parseGeoApiCountry(payload: unknown): string | null {
  if (typeof payload === 'string') return normalizeCountryCode(payload);
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;

  // ipwho.is format: { success: true, country_code: "IQ" }
  if (obj.success === false) return null;
  // ip-api.com format: { status: "success", countryCode: "SA" }
  if (obj.status === 'fail') return null;

  return (
    normalizeCountryCode(obj.country_code) ??
    normalizeCountryCode(obj.countryCode) ??
    normalizeCountryCode(obj.country)
  );
}

async function fetchJsonWithTimeout(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(GEO_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

async function queryGeoProviders(ip: string | null): Promise<string | null> {
  // Primary: ipwho.is (HTTPS, free, no API key required)
  const ipwhoUrl = ip ? `https://ipwho.is/${encodeURIComponent(ip)}` : 'https://ipwho.is/';
  const primary = parseGeoApiCountry(await fetchJsonWithTimeout(ipwhoUrl));
  if (primary) return primary;

  // Secondary: ip-api.com
  const ipApiUrl = ip
    ? `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode`
    : 'http://ip-api.com/json/?fields=status,countryCode';
  const secondary = parseGeoApiCountry(await fetchJsonWithTimeout(ipApiUrl));
  if (secondary) return secondary;

  return null;
}

/**
 * Resolves a 2-letter ISO country code from an IP address using an in-memory TTL cache.
 * - For public IPs: queries GeoIP providers for that exact IP.
 * - For private/loopback IPs (e.g. local dev): queries GeoIP for the server's public egress IP.
 * - Falls back gracefully to fallbackCountry or 'SA' if offline/timed out.
 */
export async function resolveCountryFromIp(
  rawIp: string,
  fallbackCountry?: string | null
): Promise<string> {
  const ip = normalizeIpAddress(rawIp);
  const isPrivate = isPrivateOrLoopbackIp(ip);
  const cacheKey = isPrivate ? '__local_egress__' : ip;

  const cached = ipCountryCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.code;
  }

  const existing = inflightLookups.get(cacheKey);
  if (existing) return existing;

  const lookupPromise = (async () => {
    const resolved = await queryGeoProviders(isPrivate ? null : ip);
    if (resolved) {
      ipCountryCache.set(cacheKey, { code: resolved, at: Date.now() });
      return resolved;
    }
    return normalizeCountryCode(fallbackCountry) ?? 'SA';
  })().finally(() => {
    inflightLookups.delete(cacheKey);
  });

  inflightLookups.set(cacheKey, lookupPromise);
  return lookupPromise;
}

/**
 * Resolves the user's country code for an incoming HTTP request:
 * 1. Authoritative proxy/CDN country header (cf-ipcountry, x-appengine-country, etc.)
 *    unless the client supplied an explicit different public x-forwarded-for IP.
 * 2. GeoIP lookup of the client's normalized IP address.
 * 3. Accept-Language region fallback -> existing user country -> 'SA'.
 */
export async function resolveCountryForRequest(
  req: { headers: Record<string, string | string[] | undefined> },
  rawIp: string,
  fallbackCountry?: string | null
): Promise<string> {
  const headerCountry = extractHeaderCountry(req.headers);
  if (headerCountry) return headerCountry;

  const langCountry = extractAcceptLanguageCountry(req.headers['accept-language']);
  return resolveCountryFromIp(rawIp, langCountry ?? fallbackCountry);
}
