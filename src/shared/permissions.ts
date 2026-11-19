import type {
  BanRecord,
  FilterRule,
  PermissionKey,
  RankRole,
  Room,
  SecurityAllowConfig,
  ShortcutItem,
  SiteSettings,
  UserAccount,
} from './types.ts';

export const OWNER_LEVEL = 1000;

export const CP_PERMISSIONS: { key: PermissionKey; label: string }[] = [
  { key: 'access_cp', label: 'دخول لوحة التحكم' },
  { key: 'view_logs', label: 'مشاهدة السجل والمحظورين' },
  { key: 'view_states', label: 'مشاهدة سجل الحالات' },
  { key: 'reveal_users', label: 'الكشف (الآيبي، الجهاز، البصمة)' },
  { key: 'manage_members', label: 'إدارة الأعضاء وتعديل اللايكات' },
  { key: 'verify_members', label: 'توثيق العضويات والدخول الملكي' },
  { key: 'ban_users', label: 'الحظر وفك الحظر والإسكات' },
  { key: 'manage_ranks', label: 'إدارة الصلاحيات والترقيات' },
  { key: 'moderate_mics', label: 'إدارة المايكات (كتم وإنزال)' },
  { key: 'delete_messages', label: 'حذف رسائل الغرف والحائط' },
  { key: 'manage_rooms', label: 'إنشاء وتعديل وحذف الغرف' },
  { key: 'manage_shortcuts', label: 'إدارة الإختصارات' },
  { key: 'manage_subs', label: 'إدارة الإشتراكات' },
  { key: 'manage_messages', label: 'إدارة رسائل الترحيب واليومية' },
  { key: 'manage_filter', label: 'إدارة فلتر الكلمات' },
  { key: 'manage_front', label: 'إدارة الواجهة والإعلان' },
  { key: 'manage_symbols', label: 'إدارة الرموز والفيسات' },
  { key: 'manage_domains', label: 'إدارة النطاقات' },
  { key: 'manage_site_settings', label: 'إدارة الموقع والقيود' },
];

export function effectiveRankLevel(rank: RankRole | null | undefined): number {
  if (!rank) return 0;
  return rank.isOwner ? OWNER_LEVEL : rank.level;
}

/**
 * Strictly restricts Control Panel access to Owner, Supervisors, and Admins / Upgraded ranks.
 * Guests and regular members always return false.
 */
export function canAccessControlPanel(rank: RankRole | null | undefined): boolean {
  if (!rank) return false;
  if (rank.isOwner) return true;
  if (rank.level <= 0) return false;
  return rank.permissions.includes('access_cp') || rank.level >= 200;
}

export function hasPermission(
  rank: RankRole | null | undefined,
  perm: PermissionKey
): boolean {
  if (!rank) return false;
  if (rank.isOwner) return true;
  return rank.permissions.includes(perm);
}

export function canManageTarget(
  actorLevel: number,
  targetLevel: number,
  isSelf: boolean
): boolean {
  if (isSelf) return false;
  return actorLevel > targetLevel;
}

export function resolveRegistrationRank(
  isLocalOwnerDevice: boolean,
  ranks: RankRole[]
): RankRole {
  if (isLocalOwnerDevice) {
    const owner = ranks.find((r) => r.isOwner || r.id === 'rank_owner');
    if (owner) return owner;
  }
  const member = ranks.find((r) => r.id === 'rank_member');
  if (member) return member;
  return (
    ranks.find((r) => !r.isOwner && r.level === 0) ?? {
      id: 'rank_member',
      name: 'عضو',
      level: 0,
      isOwner: false,
      isLocked: false,
      icon: 'badge',
      color: '#cbd5e1',
      permissions: [],
      createdAt: 0,
    }
  );
}

export function validateSiteSettings(
  next: SiteSettings
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (next.wallMaxChars < 10) errors.wallMaxChars = 'يجب ألا يقل العدد عن 10 أحرف';
  if (next.pmMaxChars < 10) errors.pmMaxChars = 'يجب ألا يقل العدد عن 10 أحرف';
  if (next.roomMaxChars < 10) errors.roomMaxChars = 'يجب ألا يقل العدد عن 10 أحرف';
  if (next.dailyMsgIntervalMin < 1) {
    errors.dailyMsgIntervalMin = 'لا يمكن أن تكون قيمة الرسائل اليومية 0';
  }
  if (next.maxAccountsPerUser < 2) {
    errors.maxAccountsPerUser = 'يجب أن يكون الرقم أكبر من 1';
  }
  if (next.maxRegistrationsPerUser < 2) {
    errors.maxRegistrationsPerUser = 'يجب أن يكون الرقم أكبر من 1';
  }
  if (next.guestNameMinChars < 1) {
    errors.guestNameMinChars = 'لا يمكن أن تكون القيمة 0';
  }
  if (next.registerNameMinChars < 1) {
    errors.registerNameMinChars = 'لا يمكن أن تكون القيمة 0';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function findMatchingBan(
  params: { ip?: string; device?: string; accountId?: string; country?: string },
  bans: BanRecord[],
  now = Date.now()
): BanRecord | null {
  for (const ban of bans) {
    if (ban.expiresAt !== null && ban.expiresAt <= now) continue;
    if (params.accountId && ban.accountId && ban.accountId === params.accountId) {
      return ban;
    }
    if (params.ip && ban.ip && ban.ip === params.ip) {
      return ban;
    }
    if (params.device && ban.device && ban.device === params.device) {
      return ban;
    }
    if (params.country && ban.country && ban.country.toUpperCase() === params.country.toUpperCase()) {
      return ban;
    }
  }
  return null;
}

export function checkSecurityAllowlist(
  deviceInfo: { browser: string; os: string; fingerprintValid: boolean; isSuspect: boolean },
  config: SecurityAllowConfig
): { allowed: boolean; reason?: string } {
  const b = deviceInfo.browser.toLowerCase();
  const o = deviceInfo.os.toLowerCase();

  if (config.allowedBrowsers.length > 0 && b && !config.allowedBrowsers.includes(b)) {
    return { allowed: false, reason: `المتصفح غير مسموح به (${deviceInfo.browser})` };
  }
  if (config.allowedOs.length > 0 && o && !config.allowedOs.includes(o)) {
    return { allowed: false, reason: `النظام غير مسموح به (${deviceInfo.os})` };
  }
  if (config.blockEmptyFp && !deviceInfo.browser) {
    return { allowed: false, reason: 'محظور|بيانات ناقصة' };
  }
  if (config.blockInvalidFp && !deviceInfo.fingerprintValid) {
    return { allowed: false, reason: 'محظور|بيانات غير صحيحة' };
  }
  if (config.blockSuspectFp && deviceInfo.isSuspect) {
    return { allowed: false, reason: 'محظور|تلاعب بالجهاز' };
  }
  return { allowed: true };
}

export function checkRoomEntry(
  room: Room,
  user: { id: string; likes: number },
  rank: RankRole | null | undefined,
  passwordInput?: string
): { allowed: boolean; reason?: string; needsPassword?: boolean } {
  if (rank?.isOwner || hasPermission(rank, 'manage_rooms')) {
    return { allowed: true };
  }
  if (room.bannedUserIds.includes(user.id)) {
    return { allowed: false, reason: 'أنت محظور من دخول هذه الغرفة' };
  }
  if (room.requiredLikes > 0 && user.likes < room.requiredLikes) {
    return {
      allowed: false,
      reason: `دخول الغرفة يتطلب ${room.requiredLikes} لايك على الأقل`,
    };
  }
  if (room.password && room.password.trim().length > 0) {
    if (!passwordInput) {
      return { allowed: false, needsPassword: true, reason: 'هذه الغرفة محمية بكلمة مرور' };
    }
    if (passwordInput !== room.password) {
      return { allowed: false, needsPassword: true, reason: 'كلمة مرور الغرفة غير صحيحة' };
    }
  }
  return { allowed: true };
}

export function applyTextShortcutsAndFilter(
  rawText: string,
  shortcuts: ShortcutItem[],
  filters: FilterRule[]
): {
  text: string;
  blockedWord?: string;
  monitoredWord?: string;
} {
  let text = rawText.trim();
  const allowedWords = new Set(
    filters.filter((f) => f.category === 'allowed').map((f) => f.word.toLowerCase())
  );

  // Exact or token shortcut expansion
  for (const sc of shortcuts) {
    const trig = sc.trigger.trim();
    if (!trig) continue;
    if (text === trig) {
      text = sc.expansion;
      break;
    }
    const escaped = trig.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'g'), `$1${sc.expansion}`);
  }

  const lower = text.toLowerCase();
  for (const rule of filters) {
    if (rule.category !== 'blocked') continue;
    const w = rule.word.trim().toLowerCase();
    if (!w || allowedWords.has(w)) continue;
    if (lower.includes(w)) {
      return { text, blockedWord: rule.word };
    }
  }

  for (const rule of filters) {
    if (rule.category !== 'monitored') continue;
    const w = rule.word.trim().toLowerCase();
    if (!w) continue;
    if (lower.includes(w)) {
      return { text, monitoredWord: rule.word };
    }
  }

  return { text };
}

export type PurgeRangeKey = 'm:1' | 'd:45' | 'm:2' | 'm:3' | 'm:5' | 'm:6' | 'y:1';

export function purgeRangeToMs(range: PurgeRangeKey): number {
  const day = 86_400_000;
  switch (range) {
    case 'm:1':
      return 30 * day;
    case 'd:45':
      return 45 * day;
    case 'm:2':
      return 60 * day;
    case 'm:3':
      return 90 * day;
    case 'm:5':
      return 150 * day;
    case 'm:6':
      return 180 * day;
    case 'y:1':
      return 365 * day;
  }
}

export function computeInactivePurgeCandidates(
  users: UserAccount[],
  ranks: RankRole[],
  range: PurgeRangeKey,
  now = Date.now()
): UserAccount[] {
  const threshold = now - purgeRangeToMs(range);
  const rankMap = new Map(ranks.map((r) => [r.id, r]));
  return users.filter((u) => {
    const rank = rankMap.get(u.rankId);
    if (rank?.isOwner || (rank?.level ?? 0) >= 200) return false;
    return u.lastSeen < threshold && !u.online;
  });
}

export function formatRelativeArabic(timestamp: number, now = Date.now()): {
  value: string;
  unit: string;
  tone: 'now' | 'min' | 'hour' | 'day' | 'month';
} {
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (diffSec < 60) return { value: 'الآن', unit: '', tone: 'now' };
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) {
    return {
      value: String(mins),
      unit: mins === 1 ? 'دقيقة' : mins <= 10 ? 'دقائق' : 'دقيقة',
      tone: 'min',
    };
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return {
      value: String(hours),
      unit: hours === 1 ? 'ساعة' : hours <= 10 ? 'ساعات' : 'ساعة',
      tone: 'hour',
    };
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return {
      value: String(days),
      unit: days === 1 ? 'يوم' : days <= 10 ? 'أيام' : 'يوم',
      tone: 'day',
    };
  }
  const months = Math.floor(days / 30);
  return {
    value: String(months),
    unit: months === 1 ? 'شهر' : months <= 10 ? 'أشهر' : 'شهر',
    tone: 'month',
  };
}
