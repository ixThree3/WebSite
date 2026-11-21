import { effectiveRankLevel } from './permissions.ts';
import type { ActivityStatus, MediaKind, PublicUser, RankRole } from './types.ts';

export const MAX_VIDEO_UPLOAD_BYTES = 30 * 1024 * 1024; // 30 MB
export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
export const IDLE_ACTIVITY_THRESHOLD_MS = 120_000; // 2 minutes without user interaction

const VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v|ogv|3gp)(\?|#|$)/i;
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|#|$)/i;

/**
 * Validates an uploaded image or video file before reading/uploading.
 * Rejects videos exceeding 30 MB with an explicit Arabic message.
 */
export function validateUploadMedia(file: {
  type?: string;
  size: number;
  name?: string;
}): { ok: true; kind: MediaKind } | { ok: false; error: string } {
  const mime = String(file.type ?? '').toLowerCase();
  const name = String(file.name ?? '').toLowerCase();
  const isVideo = mime.startsWith('video/') || (!mime && VIDEO_EXT_RE.test(name));
  const isImage = mime.startsWith('image/') || (!mime && IMAGE_EXT_RE.test(name));

  if (isVideo) {
    if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
      return {
        ok: false,
        error: 'حجم الفيديو أكبر من 30 ميغابايت (30MB) ولا يمكن رفعه',
      };
    }
    if (file.size <= 0) {
      return { ok: false, error: 'ملف الفيديو فارغ أو غير صالح' };
    }
    return { ok: true, kind: 'video' };
  }

  if (isImage) {
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      return {
        ok: false,
        error: 'حجم الصورة كبير جداً (الحد الأقصى 10 ميجابايت)',
      };
    }
    if (file.size <= 0) {
      return { ok: false, error: 'ملف الصورة فارغ أو غير صالح' };
    }
    return { ok: true, kind: 'image' };
  }

  return {
    ok: false,
    error: 'نوع الملف غير مدعوم — يرجى اختيار صورة أو مقطع فيديو صالح',
  };
}

/**
 * Infers whether a media URL points to a video or an image.
 */
export function inferMediaKind(
  url: string | null | undefined,
  explicitType?: MediaKind | null
): MediaKind {
  if (explicitType === 'video' || explicitType === 'image') {
    return explicitType;
  }
  const clean = String(url ?? '').trim().toLowerCase();
  if (clean.startsWith('data:video/') || VIDEO_EXT_RE.test(clean)) {
    return 'video';
  }
  return 'image';
}

/**
 * Computes a user's live activity status ('online' | 'idle' | 'busy') based on
 * manual privacy override (when set), current site interaction, tab visibility,
 * and active mic/busy states.
 */
export function computeActivityStatus(params: {
  manualStatus?: ActivityStatus | null;
  isOnMic?: boolean;
  isBusyMode?: boolean;
  isTabHidden?: boolean;
  lastInteractionAt: number;
  nowMs?: number;
  idleThresholdMs?: number;
}): ActivityStatus {
  if (
    params.manualStatus === 'online' ||
    params.manualStatus === 'idle' ||
    params.manualStatus === 'busy'
  ) {
    return params.manualStatus;
  }
  if (params.isOnMic || params.isBusyMode) {
    return 'busy';
  }
  const now = params.nowMs ?? Date.now();
  const threshold = params.idleThresholdMs ?? IDLE_ACTIVITY_THRESHOLD_MS;
  if (params.isTabHidden || now - params.lastInteractionAt >= threshold) {
    return 'idle';
  }
  return 'online';
}

export const PM_LOCKED_ERROR_MESSAGE = 'هذا المستخدم قام بقفل الرسائل الخاصة';
export const ALERTS_LOCKED_ERROR_MESSAGE = 'هذا المستخدم قام بقفل التنبيهات';

/**
 * Checks whether a target user allows receiving a private message or alert.
 */
export function checkPrivacyMessagePermission(
  target: Pick<PublicUser, 'lockPm' | 'lockAlerts'> | null | undefined,
  kind: 'pm' | 'alert'
): { allowed: true } | { allowed: false; error: string } {
  if (!target) return { allowed: true };
  if (kind === 'pm' && target.lockPm) {
    return { allowed: false, error: PM_LOCKED_ERROR_MESSAGE };
  }
  if (kind === 'alert' && target.lockAlerts) {
    return { allowed: false, error: ALERTS_LOCKED_ERROR_MESSAGE };
  }
  return { allowed: true };
}

/**
 * Sorts online members descending by effective rank level (Owner -> highest -> lowest).
 * Registered members precede guests at equal rank levels, then alphabetical by display name.
 */
export function sortMembersByRankDesc<T extends Pick<PublicUser, 'id' | 'rankId' | 'isGuest' | 'username' | 'topic'>>(
  users: T[],
  ranks: RankRole[]
): T[] {
  const rankMap = new Map<string, RankRole>();
  for (const r of ranks) {
    rankMap.set(r.id, r);
  }
  return [...users].sort((a, b) => {
    const ra = rankMap.get(a.rankId) ?? null;
    const rb = rankMap.get(b.rankId) ?? null;
    const la = effectiveRankLevel(ra);
    const lb = effectiveRankLevel(rb);
    if (la !== lb) return lb - la;
    if (a.isGuest !== b.isGuest) return a.isGuest ? 1 : -1;
    return (a.topic || a.username).localeCompare(b.topic || b.username, 'ar');
  });
}

/**
 * Enforces owner-only deletion rules:
 * - A member can ALWAYS delete items they themselves sent/created (`actorId === ownerId`).
 * - When `allowSiteOwner` is true (e.g., room messages, wall posts, wall replies),
 *   the Site Owner (`actorRank?.isOwner`) can also delete for moderation.
 * - Non-owner ranks (even moderators/admins) cannot delete other members' items.
 */
export function canDeleteOwnedItem(params: {
  actorId: string | null | undefined;
  ownerId: string | null | undefined;
  actorRank?: RankRole | null;
  allowSiteOwner?: boolean;
}): boolean {
  if (!params.actorId || !params.ownerId) return false;
  if (params.actorId === params.ownerId) return true;
  if (params.allowSiteOwner && params.actorRank?.isOwner) return true;
  return false;
}
