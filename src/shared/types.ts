export type PermissionKey =
  | 'access_cp'
  | 'manage_ranks'
  | 'manage_members'
  | 'verify_members'
  | 'ban_users'
  | 'moderate_mics'
  | 'delete_messages'
  | 'manage_rooms'
  | 'view_logs'
  | 'view_states'
  | 'reveal_users'
  | 'manage_shortcuts'
  | 'manage_subs'
  | 'manage_messages'
  | 'manage_filter'
  | 'manage_front'
  | 'manage_symbols'
  | 'manage_domains'
  | 'manage_site_settings';

export type RankIcon =
  | 'crown'
  | 'shield'
  | 'star'
  | 'gem'
  | 'flame'
  | 'award'
  | 'sparkles'
  | 'heart'
  | 'zap'
  | 'badge';

export interface RankRole {
  id: string;
  name: string;
  level: number; // 1000 = owner, 0 = guest/member
  isOwner: boolean;
  isLocked: boolean;
  icon: RankIcon;
  color: string;
  permissions: PermissionKey[];
  createdAt: number;
}

export type OfflineStatusColor = 's0' | 's1' | 's2' | 's3';

export type ActivityStatus = 'online' | 'idle' | 'busy';

export type MediaKind = 'image' | 'video';

export interface UserAccount {
  id: string;
  username: string;
  topic: string; // الزخرفة / العرض المزخرف
  passwordHash?: string;
  isGuest: boolean;
  rankId: string;
  color: string;
  nameStyle?: string;
  nameBg?: string;
  fontFamily?: string;
  status: string;
  avatarUrl: string | null;
  likes: number;
  streak: number;
  streakLastDay?: string;
  verified: boolean;
  royalLoginBoys: boolean;
  royalLoginGirls: boolean;
  ip: string;
  country: string;
  hideCountryFlag?: boolean;
  device: string; // segmented device string
  deviceToken: string;
  roomId: string | null;
  online: boolean;
  activityStatus?: ActivityStatus;
  manualActivityStatus?: ActivityStatus | null;
  lockPm?: boolean;
  lockAlerts?: boolean;
  stealth: boolean;
  silencedUntil: number | null;
  micForceMuted?: boolean;
  subscriptionExpiresAt: number | null;
  subscriptionGrantedAt: number | null;
  lastSeen: number;
  createdAt: number;
  roomHistoryCutoff?: number | null;
}

export interface PublicUser {
  id: string;
  username: string;
  topic: string;
  isGuest: boolean;
  rankId: string;
  color: string;
  nameStyle?: string;
  nameBg?: string;
  fontFamily?: string;
  status: string;
  avatarUrl: string | null;
  likes: number;
  streak: number;
  streakLastDay?: string;
  verified: boolean;
  royalLoginBoys: boolean;
  royalLoginGirls: boolean;
  country?: string;
  hideCountryFlag?: boolean;
  roomId: string | null;
  online: boolean;
  activityStatus?: ActivityStatus;
  manualActivityStatus?: ActivityStatus | null;
  lockPm?: boolean;
  lockAlerts?: boolean;
  silencedUntil: number | null;
  micForceMuted?: boolean;
  lastSeen: number;
  createdAt: number;
}

export interface MicSeat {
  seat: number; // 1..5
  userId: string | null;
  muted: boolean;
  forceMuted: boolean;
  joinedAt: number | null;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  welcomeMessage: string;
  imageUrl: string | null;
  requiredLikes: number;
  password: string;
  maxCapacity: number; // 1..200
  maxMics: number; // 0..5
  isPinned: boolean;
  isPublicDefault: boolean;
  micEnabled: boolean;
  bannerEnabled: boolean;
  liveBroadcast: boolean;
  ownerId: string;
  ownerName: string;
  operators: string[]; // userIds
  bannedUserIds: string[];
  seats: MicSeat[];
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  topic: string;
  color: string;
  nameStyle?: string;
  fontFamily?: string;
  avatarUrl: string | null;
  rankId: string;
  verified: boolean;
  streak: number;
  streakLastDay?: string;
  body: string;
  mediaUrl?: string | null;
  mediaType?: MediaKind | null;
  replyTo?: { id: string; username: string; body: string } | null;
  isSystem?: boolean;
  systemKind?: 'login' | 'room_enter' | 'room_leave' | 'generic';
  systemTargetRoom?: string;
  createdAt: number;
}

export interface PrivateMessage {
  id: string;
  fromUserId: string;
  toUserId: string;
  body: string;
  mediaUrl?: string | null;
  mediaType?: MediaKind | null;
  readAt: number | null;
  createdAt: number;
}

export interface WallComment {
  id: string;
  postId: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  color: string;
  nameStyle?: string;
  fontFamily?: string;
  streak?: number;
  streakLastDay?: string;
  body: string;
  likes?: string[];
  replyTo?: { id: string; username: string; body: string } | null;
  createdAt: number;
}

export interface WallPost {
  id: string;
  userId: string;
  username: string;
  topic: string;
  avatarUrl: string | null;
  color: string;
  nameStyle?: string;
  fontFamily?: string;
  rankId: string;
  streak?: number;
  streakLastDay?: string;
  body: string;
  mediaUrl?: string | null;
  mediaType?: MediaKind | null;
  likes: string[];
  comments: WallComment[];
  createdAt: number;
}

export interface AccessLogEntry {
  id: string;
  state: string; // e.g., عضو | زائر | المالك | محظور|جهاز
  username: string;
  topic: string;
  ip: string;
  country: string;
  device: string;
  referrer: string;
  createdAt: number;
}

export interface ActionStateLog {
  id: string;
  action: string; // e.g., حذف حائط, مسح رسالة عامة, ترقية, تعديل اعجابات, حظر جهاز, تعديل غرفة
  actorName: string;
  targetName: string;
  roomOrDetail: string;
  ip: string;
  createdAt: number;
}

export interface BanRecord {
  id: string;
  targetName: string;
  bannedBy: string;
  reason: string;
  device: string;
  ip: string;
  accountId: string;
  country: string;
  expiresAt: number | null;
  createdAt: number;
}

export interface ShortcutItem {
  id: string;
  trigger: string;
  expansion: string;
}

export type FilterCategory = 'allowed' | 'blocked' | 'monitored';

export interface FilterRule {
  id: string;
  category: FilterCategory;
  word: string;
  createdAt: number;
}

export interface HitBlockedWord {
  id: string;
  username: string;
  word: string;
  context: string;
  createdAt: number;
}

export type AutoMessageType = 'welcome' | 'daily';

export interface AutoMessage {
  id: string;
  type: AutoMessageType;
  title: string;
  body: string;
  createdAt: number;
}

export interface SymbolItem {
  id: string;
  code: string;
  glyph: string;
  label: string;
  category: 'emoji' | 'badge' | 'decor';
}

export interface DomainConfig {
  id: string;
  domain: string;
  role: 'primary' | 'mic_server' | 'mirror' | 'invite_source';
  active: boolean;
  notes: string;
}

export interface FrontSettings {
  siteName: string;
  heroTitle: string;
  heroSubtitle: string;
  announcement: string;
  accentColor: string;
  showHeroBanner: boolean;
  showOnlineCountPublic: boolean;
}

export interface SecurityAllowConfig {
  allowedBrowsers: string[];
  allowedOs: string[];
  blockEmptyFp: boolean;
  blockInvalidFp: boolean;
  blockSuspectFp: boolean;
}

export interface SiteSettings {
  // الحائط
  wallCooldownMin: number;
  wallMaxChars: number;
  wallMinLikes: number;
  wallCommentMinLikes: number;
  wallUploadMinLikes: number;
  // الخاص
  pmMaxChars: number;
  pmMinLikes: number;
  pmCallMinLikes: number;
  pmFileMinLikes: number;
  // الغرف
  roomMaxChars: number;
  dailyMsgIntervalMin: number;
  roomWriteMinLikes: number;
  roomMediaMinLikes: number;
  // المتفرقات
  alertMinLikes: number;
  micMinLikes: number;
  storyMinLikes: number;
  gamesMinLikes: number;
  nameChangeMinLikes: number;
  picChangeMinLikes: number;
  // قيود الدخول
  maxAccountsPerUser: number;
  maxRegistrationsPerUser: number;
  guestNameMinChars: number;
  registerNameMinChars: number;
  // خيارات الإخفاء (19 خياراً)
  hideShields: boolean;
  hideStory: boolean;
  hideRoomMedia: boolean;
  hideProfileViewers: boolean;
  hideWallNotify: boolean;
  hideVoiceRecord: boolean;
  hideProfileCover: boolean;
  hideProfileYoutube: boolean;
  hideQuickChat: boolean;
  hideGames: boolean;
  hidePmDelete: boolean;
  hidePmReply: boolean;
  hideLudoStar: boolean;
  hideXoStar: boolean;
  hideWallCreator: boolean;
  hideWallTrend: boolean;
  hideMicStar: boolean;
  hideNotifBox: boolean;
  disableNotifSound: boolean;
  disableMention: boolean;
  // البوت والتفاعل والحماية
  contestBotEnabled: boolean;
  roomReplyEnabled: boolean;
  wallCommentsEnabled: boolean;
  pmCallsEnabled: boolean;
  pmReadReceiptEnabled: boolean;
  reconnectEnabled: boolean;
  blockGuests: boolean;
  blockRegistrations: boolean;
  blockVpn: boolean;
  stopAudioStay: boolean;
  outsideDesignEnabled: boolean;
  // تثبيت النكات
  offlinePinEnabled: boolean;
  offlineStatusColor: OfflineStatusColor;
  offlinePinHours: string;
  pinInsideRoom: boolean;
}

export type CpTabId =
  | 'logs'
  | 'states'
  | 'banned_logs'
  | 'users'
  | 'bans'
  | 'powers'
  | 'rooms'
  | 'shortcuts'
  | 'subs'
  | 'messages'
  | 'front'
  | 'symbols'
  | 'domains'
  | 'settings'
  | 'filter';

export interface CpPayload {
  logs: AccessLogEntry[];
  states: ActionStateLog[];
  bannedLogs: AccessLogEntry[];
  users: UserAccount[];
  bans: BanRecord[];
  securityAllow: SecurityAllowConfig;
  ranks: RankRole[];
  rooms: Room[];
  shortcuts: ShortcutItem[];
  filters: FilterRule[];
  blockedHits: HitBlockedWord[];
  autoMessages: AutoMessage[];
  front: FrontSettings;
  symbols: SymbolItem[];
  domains: DomainConfig[];
  siteSettings: SiteSettings;
}

export interface NotificationItem {
  id: string;
  userId: string;
  actorId: string;
  actorName: string;
  actorColor: string;
  actorNameStyle?: string;
  actorFontFamily?: string;
  actorAvatarUrl: string | null;
  kind:
    | 'profile_like'
    | 'post_like'
    | 'post_comment'
    | 'comment_like'
    | 'comment_reply'
    | 'alert'
    | 'pm_message';
  postId?: string;
  postSnippet?: string;
  read: boolean;
  createdAt: number;
}

export interface RevealLoginEntry {
  id: string;
  ip: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  os: 'android' | 'ios' | 'windows' | 'mac' | 'linux';
  browser: 'chrome' | 'safari' | 'edge' | 'firefox' | 'opera' | 'other';
  country: string;
  createdAt: number;
}

export interface RevealLinkedAccount {
  id: string;
  username: string;
  topic: string;
  color: string;
  nameStyle?: string;
  fontFamily?: string;
  avatarUrl: string | null;
  isGuest: boolean;
  rankId: string;
  ip: string;
}

export interface RevealResponse {
  logins: RevealLoginEntry[];
  linkedSameIp: RevealLinkedAccount[];
}

export interface BootstrapResponse {
  me: PublicUser | null;
  myRank: RankRole | null;
  isLocalOwnerDevice: boolean;
  canAccessCp: boolean;
  ranks: RankRole[];
  rooms: Room[];
  onlineUsers: PublicUser[];
  wallPosts: WallPost[];
  shortcuts: ShortcutItem[];
  symbols: SymbolItem[];
  front: FrontSettings;
  siteSettings: SiteSettings;
  privateMessages: PrivateMessage[];
  pmPeers?: PublicUser[];
  notifications: NotificationItem[];
}
