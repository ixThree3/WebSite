import type { ChatMessage, NotificationItem, PrivateMessage, PublicUser } from './types.ts';

/**
 * Computes the timestamp cutoff applied to room message history when a user
 * logs back in or starts a fresh clean session after logging out.
 * Any message or system notice created at or before this cutoff is hidden for that user.
 */
export function computeReloginRoomCutoff(params: {
  previousCutoff?: number | null;
  lastNoticeCreatedAt?: number | null;
  nowMs?: number;
}): number {
  const now = params.nowMs ?? Date.now();
  return Math.max(
    now,
    params.previousCutoff ?? 0,
    params.lastNoticeCreatedAt ?? 0
  );
}

/**
 * Filters a room's messages for a user session based on their `roomHistoryCutoff`.
 * When `cutoffMs` is unset/null/<= 0, all messages in the room are returned.
 * When `cutoffMs` > 0, previous messages AND system notices (login/enter/leave/etc.)
 * created at or before `cutoffMs` are excluded so the user starts with a clean room.
 */
export function filterMessagesSinceCutoff(
  messages: ChatMessage[],
  roomId: string,
  cutoffMs?: number | null
): ChatMessage[] {
  const cutoff = typeof cutoffMs === 'number' && cutoffMs > 0 ? cutoffMs : 0;
  return messages.filter(
    (m) => m.roomId === roomId && (cutoff === 0 || m.createdAt > cutoff)
  );
}

/**
 * Merges currently online users with offline PM conversation peers so private chat
 * history remains accessible forever even after logouts or disconnects,
 * ordered by most recent private message first (then online presence).
 */
export function buildPmContactsList(params: {
  meId: string | null | undefined;
  onlineUsers: PublicUser[];
  pmPeers: PublicUser[];
  privateMessages: PrivateMessage[];
}): PublicUser[] {
  if (!params.meId) return [];
  const byId = new Map<string, PublicUser>();

  for (const peer of params.pmPeers) {
    if (peer.id !== params.meId) {
      byId.set(peer.id, { ...peer, online: false });
    }
  }
  for (const onlineUser of params.onlineUsers) {
    if (onlineUser.id !== params.meId) {
      byId.set(onlineUser.id, onlineUser);
    }
  }

  const latestPmByPartner = new Map<string, number>();
  for (const pm of params.privateMessages) {
    const partnerId =
      pm.fromUserId === params.meId
        ? pm.toUserId
        : pm.toUserId === params.meId
        ? pm.fromUserId
        : null;
    if (!partnerId) continue;
    const prev = latestPmByPartner.get(partnerId) ?? 0;
    if (pm.createdAt > prev) {
      latestPmByPartner.set(partnerId, pm.createdAt);
    }
  }

  return Array.from(byId.values()).sort((a, b) => {
    const aLast = latestPmByPartner.get(a.id) ?? 0;
    const bLast = latestPmByPartner.get(b.id) ?? 0;
    if (aLast !== bLast) return bLast - aLast;
    if (a.online !== b.online) return a.online ? -1 : 1;
    return a.username.localeCompare(b.username, 'ar');
  });
}

/**
 * Counts unread private messages from a specific partner to the current user.
 */
export function countUnreadPmFromPartner(
  privateMessages: PrivateMessage[],
  meId: string | null | undefined,
  partnerId: string
): number {
  if (!meId) return 0;
  let count = 0;
  for (const pm of privateMessages) {
    if (pm.fromUserId === partnerId && pm.toUserId === meId && pm.readAt === null) {
      count++;
    }
  }
  return count;
}

/**
 * Marks all (or a specific) notifications as read while preserving every item in the list.
 */
export function markNotificationsAsRead(
  notifications: NotificationItem[],
  id?: string
): NotificationItem[] {
  return notifications.map((n) => (!id || n.id === id ? { ...n, read: true } : n));
}

/**
 * Removes private-message notifications belonging to a specific partner conversation
 * while keeping alerts, likes, wall notices, and other partners' PM notifications intact.
 */
export function removePmNotificationsForPartner(
  notifications: NotificationItem[],
  partnerId: string
): NotificationItem[] {
  return notifications.filter(
    (n) => !(n.kind === 'pm_message' && n.actorId === partnerId)
  );
}

/**
 * Formats the elapsed time since an alert or notification was sent in Arabic.
 */
export function formatElapsedArabic(createdAt: number, nowMs = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((nowMs - createdAt) / 1000));
  if (diffSec < 3) return 'الآن';
  if (diffSec < 60) {
    return diffSec === 1
      ? 'منذ ثانية'
      : diffSec === 2
      ? 'منذ ثانيتين'
      : diffSec <= 10
      ? `منذ ${diffSec} ثوانٍ`
      : `منذ ${diffSec} ثانية`;
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return diffMin === 1
      ? 'منذ دقيقة'
      : diffMin === 2
      ? 'منذ دقيقتين'
      : diffMin <= 10
      ? `منذ ${diffMin} دقائق`
      : `منذ ${diffMin} دقيقة`;
  }
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    return diffHr === 1
      ? 'منذ ساعة'
      : diffHr === 2
      ? 'منذ ساعتين'
      : diffHr <= 10
      ? `منذ ${diffHr} ساعات`
      : `منذ ${diffHr} ساعة`;
  }
  const diffDay = Math.floor(diffHr / 24);
  return diffDay === 1
    ? 'منذ يوم'
    : diffDay === 2
    ? 'منذ يومين'
    : `منذ ${diffDay} يوم`;
}

/**
 * Validates and normalizes a user-written alert message before sending or storing.
 * Alert notifications require non-empty user text (capped at 240 characters).
 */
export function validateAlertMessage(
  raw: string
): { ok: true; text: string } | { ok: false; error: string } {
  const cleaned = String(raw ?? '').trim().slice(0, 240);
  if (!cleaned) {
    return { ok: false, error: 'يرجى كتابة نص رسالة التنبيه' };
  }
  return { ok: true, text: cleaned };
}
