export interface RichTextToken {
  type: 'text' | 'link';
  value: string;
  href?: string;
  displayHost?: string;
}

const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>"{}|\\^`[\]]+/gi;
const TRAILING_PUNCT_REGEX = /[.,،؛:!?)}\]]+$/;

export function normalizeSafeHttpUrl(raw: string): { href: string; displayHost: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (!parsed.hostname || !parsed.hostname.includes('.')) return null;
    return {
      href: parsed.toString(),
      displayHost: parsed.hostname.replace(/^www\./i, ''),
    };
  } catch {
    return null;
  }
}

export function tokenizeRichText(text: string): RichTextToken[] {
  if (!text) return [];
  const tokens: RichTextToken[] = [];
  let lastIndex = 0;

  URL_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = URL_REGEX.exec(text)) !== null) {
    const matchStart = match.index;
    const rawMatched = match[0];

    // Strip trailing sentence punctuation cleanly while preserving balanced URLs
    const punctMatch = rawMatched.match(TRAILING_PUNCT_REGEX);
    const trailing = punctMatch ? punctMatch[0] : '';
    const cleanUrl = trailing ? rawMatched.slice(0, rawMatched.length - trailing.length) : rawMatched;

    const safe = normalizeSafeHttpUrl(cleanUrl);
    if (!safe) continue;

    if (matchStart > lastIndex) {
      tokens.push({ type: 'text', value: text.slice(lastIndex, matchStart) });
    }
    tokens.push({
      type: 'link',
      value: cleanUrl,
      href: safe.href,
      displayHost: safe.displayHost,
    });
    if (trailing) {
      tokens.push({ type: 'text', value: trailing });
    }
    lastIndex = matchStart + rawMatched.length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return tokens;
}

const YT_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

export function extractYouTubeVideoId(rawUrl: string): string | null {
  const safe = normalizeSafeHttpUrl(rawUrl);
  if (!safe) return null;

  try {
    const u = new URL(safe.href);
    const host = u.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
    let candidate: string | null = null;

    if (host === 'youtu.be') {
      candidate = u.pathname.split('/').filter(Boolean)[0] ?? null;
    } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') {
        candidate = u.searchParams.get('v');
      } else {
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts[0] && ['shorts', 'embed', 'live', 'v'].includes(parts[0]) && parts[1]) {
          candidate = parts[1];
        }
      }
    }

    return candidate && YT_ID_REGEX.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

export function extractYouTubeVideosFromText(
  text: string,
  maxCount = 2
): Array<{ videoId: string; url: string }> {
  const seen = new Set<string>();
  const results: Array<{ videoId: string; url: string }> = [];

  for (const token of tokenizeRichText(text)) {
    if (token.type !== 'link' || !token.href) continue;
    const videoId = extractYouTubeVideoId(token.href);
    if (videoId && !seen.has(videoId)) {
      seen.add(videoId);
      results.push({ videoId, url: token.href });
      if (results.length >= maxCount) break;
    }
  }

  return results;
}
