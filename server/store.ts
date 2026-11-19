import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  AccessLogEntry,
  ActionStateLog,
  AutoMessage,
  BanRecord,
  ChatMessage,
  DomainConfig,
  FilterRule,
  FrontSettings,
  HitBlockedWord,
  NotificationItem,
  PrivateMessage,
  PublicUser,
  RankRole,
  Room,
  SecurityAllowConfig,
  ShortcutItem,
  SiteSettings,
  SymbolItem,
  UserAccount,
  WallPost,
} from '../src/shared/types.ts';
import {
  DEFAULT_ACCESS_LOGS,
  DEFAULT_ACTION_STATES,
  DEFAULT_AUTO_MESSAGES,
  DEFAULT_BANNED_LOGS,
  DEFAULT_BANS,
  DEFAULT_DOMAINS,
  DEFAULT_FILTERS,
  DEFAULT_FRONT_SETTINGS,
  DEFAULT_MESSAGES,
  DEFAULT_RANKS,
  DEFAULT_ROOMS,
  DEFAULT_SECURITY_ALLOW,
  DEFAULT_SHORTCUTS,
  DEFAULT_SITE_SETTINGS,
  DEFAULT_SYMBOLS,
  DEFAULT_USERS,
  DEFAULT_WALL_POSTS,
} from '../src/shared/defaults.ts';

export interface PersistedState {
  primaryRemoteOwnerToken: string | null;
  ranks: RankRole[];
  users: UserAccount[];
  rooms: Room[];
  messages: ChatMessage[];
  privateMessages: PrivateMessage[];
  wallPosts: WallPost[];
  notifications: NotificationItem[];
  logs: AccessLogEntry[];
  bannedLogs: AccessLogEntry[];
  states: ActionStateLog[];
  bans: BanRecord[];
  securityAllow: SecurityAllowConfig;
  shortcuts: ShortcutItem[];
  filters: FilterRule[];
  blockedHits: HitBlockedWord[];
  autoMessages: AutoMessage[];
  front: FrontSettings;
  symbols: SymbolItem[];
  domains: DomainConfig[];
  siteSettings: SiteSettings;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'majlis-state.json');

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(`majlis:${password}`).digest('hex');
}

function createInitialState(): PersistedState {
  return {
    primaryRemoteOwnerToken: null,
    ranks: structuredClone(DEFAULT_RANKS),
    users: DEFAULT_USERS.map((u) => ({
      ...structuredClone(u),
      passwordHash: u.isGuest ? undefined : hashPassword('123456'),
    })),
    rooms: structuredClone(DEFAULT_ROOMS),
    messages: structuredClone(DEFAULT_MESSAGES),
    privateMessages: [],
    wallPosts: structuredClone(DEFAULT_WALL_POSTS),
    notifications: [],
    logs: structuredClone(DEFAULT_ACCESS_LOGS),
    bannedLogs: structuredClone(DEFAULT_BANNED_LOGS),
    states: structuredClone(DEFAULT_ACTION_STATES),
    bans: structuredClone(DEFAULT_BANS),
    securityAllow: structuredClone(DEFAULT_SECURITY_ALLOW),
    shortcuts: structuredClone(DEFAULT_SHORTCUTS),
    filters: structuredClone(DEFAULT_FILTERS),
    blockedHits: [],
    autoMessages: structuredClone(DEFAULT_AUTO_MESSAGES),
    front: structuredClone(DEFAULT_FRONT_SETTINGS),
    symbols: structuredClone(DEFAULT_SYMBOLS),
    domains: structuredClone(DEFAULT_DOMAINS),
    siteSettings: structuredClone(DEFAULT_SITE_SETTINGS),
  };
}

export function loadState(): PersistedState {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      const base = createInitialState();
      return {
        ...base,
        ...parsed,
        ranks: parsed.ranks?.length ? parsed.ranks : base.ranks,
        users: parsed.users?.length ? parsed.users : base.users,
        rooms: parsed.rooms?.length ? parsed.rooms : base.rooms,
        notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
      };
    }
  } catch {
    // Fallback to initial state if corrupt
  }
  const initial = createInitialState();
  saveState(initial);
  return initial;
}

export function saveState(state: PersistedState): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmp = `${DATA_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf-8');
    fs.renameSync(tmp, DATA_FILE);
  } catch {
    // Best-effort persistence
  }
}

export function toPublicUser(u: UserAccount): PublicUser {
  return {
    id: u.id,
    username: u.username,
    topic: u.topic,
    isGuest: u.isGuest,
    rankId: u.rankId,
    color: u.color,
    nameStyle: u.nameStyle ?? 'solid',
    nameBg: u.nameBg,
    fontFamily: u.fontFamily ?? 'ibm_arabic',
    status: u.status,
    avatarUrl: u.avatarUrl,
    likes: u.likes,
    streak: u.streak,
    streakLastDay: u.streakLastDay,
    verified: u.verified,
    royalLoginBoys: u.royalLoginBoys,
    royalLoginGirls: u.royalLoginGirls,
    country: u.hideCountryFlag ? undefined : u.country || 'SA',
    hideCountryFlag: Boolean(u.hideCountryFlag),
    roomId: u.roomId,
    online: u.online,
    silencedUntil: u.silencedUntil,
    micForceMuted: Boolean(u.micForceMuted),
    lastSeen: u.lastSeen,
    createdAt: u.createdAt,
  };
}

export function isLoopbackIp(ip: string): boolean {
  const clean = ip.trim().toLowerCase();
  return (
    clean === '127.0.0.1' ||
    clean === '::1' ||
    clean === '::ffff:127.0.0.1' ||
    clean === 'localhost'
  );
}
