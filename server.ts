import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import express, { type Request, type Response, type NextFunction } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import {
  applyTextShortcutsAndFilter,
  canAccessControlPanel,
  canManageTarget,
  checkRoomEntry,
  checkSecurityAllowlist,
  computeInactivePurgeCandidates,
  effectiveRankLevel,
  findMatchingBan,
  hasPermission,
  resolveRegistrationRank,
  validateSiteSettings,
  type PurgeRangeKey,
} from './src/shared/permissions.ts';
import {
  applyDailyStreakLogin,
  getRiyadhDateString,
  normalizeColorHex,
  shouldDisconnectIdleUser,
} from './src/shared/stylesAndStreak.ts';
import {
  applyMicJoinToSeat,
  applyMicLeaveFromRoom,
  canSelfToggleMicMute,
  canStaffModerateMic,
  toggleGlobalAdminMicMute,
} from './src/shared/micRules.ts';
import { createDefaultSeats } from './src/shared/defaults.ts';
import type {
  AccessLogEntry,
  ActionStateLog,
  BanRecord,
  ChatMessage,
  CpPayload,
  FilterCategory,
  NotificationItem,
  PermissionKey,
  PrivateMessage,
  RankRole,
  RevealLinkedAccount,
  RevealLoginEntry,
  RevealResponse,
  Room,
  UserAccount,
  WallPost,
} from './src/shared/types.ts';
import {
  hashPassword,
  isLoopbackIp,
  loadState,
  saveState,
  toPublicUser,
} from './server/store.ts';
import {
  normalizeIpAddress,
  resolveCountryForRequest,
  resolveCountryFromIp,
} from './server/geoip.ts';

const PORT = Number(process.env.PORT ?? 3000);
const state = loadState();

// Persistent session map stored in memory + disk
const SESSIONS_FILE = path.resolve(process.cwd(), '.data', 'sessions.json');
const REMEMBER_FILE = path.resolve(process.cwd(), '.data', 'remember-tokens.json');
const sessions = new Map<string, string>();
const rememberTokens = new Map<string, string>();
try {
  if (fs.existsSync(SESSIONS_FILE)) {
    const parsed = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8')) as Record<string, string>;
    for (const [token, uid] of Object.entries(parsed)) {
      sessions.set(token, uid);
    }
  }
} catch {
  // ignore
}
try {
  if (fs.existsSync(REMEMBER_FILE)) {
    const parsed = JSON.parse(fs.readFileSync(REMEMBER_FILE, 'utf-8')) as Record<string, string>;
    for (const [token, uid] of Object.entries(parsed)) {
      rememberTokens.set(token, uid);
    }
  }
} catch {
  // ignore
}

function persistSessions(): void {
  try {
    fs.mkdirSync(path.dirname(SESSIONS_FILE), { recursive: true });
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(Object.fromEntries(sessions)), 'utf-8');
  } catch {
    // ignore
  }
}

function persistRememberTokens(): void {
  try {
    fs.mkdirSync(path.dirname(REMEMBER_FILE), { recursive: true });
    fs.writeFileSync(REMEMBER_FILE, JSON.stringify(Object.fromEntries(rememberTokens)), 'utf-8');
  } catch {
    // ignore
  }
}

function issueRememberToken(userId: string): string {
  const token = crypto.randomUUID();
  rememberTokens.set(token, userId);
  persistRememberTokens();
  return token;
}

function getClientIp(req: Request): string {
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.trim()) return normalizeIpAddress(cf);
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) return normalizeIpAddress(fwd);
  return normalizeIpAddress(req.socket.remoteAddress || '127.0.0.1');
}

function getDeviceToken(req: Request): string {
  const dt = req.headers['x-device-token'];
  return typeof dt === 'string' ? dt.trim() : '';
}

function getDeviceString(req: Request): string {
  const ds = req.headers['x-device-fp'];
  if (typeof ds === 'string' && ds.trim()) return ds.trim().slice(0, 180);
  const ua = String(req.headers['user-agent'] ?? '');
  return `Web|10||local|device|fp|001|001|${ua.includes('Chrome') ? 'Chrome' : 'Browser'}`;
}

function parseDeviceMeta(deviceStr: string, uaHeader: string) {
  const lower = `${deviceStr} ${uaHeader}`.toLowerCase();
  let browser = 'chrome';
  if (lower.includes('edg')) browser = 'edge';
  else if (lower.includes('opr') || lower.includes('opera')) browser = 'opera';
  else if (lower.includes('samsung')) browser = 'samsung';
  else if (lower.includes('firefox')) browser = 'firefox';
  else if (lower.includes('brave')) browser = 'brave';
  else if (lower.includes('vivaldi')) browser = 'vivaldi';
  else if (lower.includes('safari') && !lower.includes('chrome')) browser = 'safari';

  let os = 'windows';
  if (lower.includes('iphone')) os = 'ios';
  else if (lower.includes('ipad')) os = 'ipados';
  else if (lower.includes('android')) os = 'android';
  else if (lower.includes('mac')) os = 'macos';
  else if (lower.includes('cros')) os = 'chromeos';
  else if (lower.includes('harmony')) os = 'harmonyos';
  else if (lower.includes('linux')) os = 'linux';

  return {
    browser,
    os,
    fingerprintValid: deviceStr.length >= 6,
    isSuspect: lower.includes('headlessbot'),
  };
}

function isLocalOwnerDevice(req: Request): boolean {
  const ip = getClientIp(req);
  const host = String(req.headers.host ?? '');
  const deviceToken = getDeviceToken(req);

  if (isLoopbackIp(ip) || host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
    return true;
  }
  if (deviceToken) {
    if (!state.primaryRemoteOwnerToken) {
      state.primaryRemoteOwnerToken = deviceToken;
      saveState(state);
    }
    return state.primaryRemoteOwnerToken === deviceToken;
  }
  return false;
}

function findRank(rankId: string): RankRole {
  return (
    state.ranks.find((r) => r.id === rankId) ??
    state.ranks.find((r) => r.id === 'rank_member') ??
    state.ranks[state.ranks.length - 1]!
  );
}

function addAccessLog(entry: Omit<AccessLogEntry, 'id' | 'createdAt'>, isBanned = false) {
  const item: AccessLogEntry = {
    ...entry,
    id: `${isBanned ? 'blog' : 'log'}_${crypto.randomUUID().slice(0, 8)}`,
    createdAt: Date.now(),
  };
  if (isBanned) {
    state.bannedLogs.unshift(item);
    state.bannedLogs = state.bannedLogs.slice(0, 300);
  } else {
    state.logs.unshift(item);
    state.logs = state.logs.slice(0, 500);
  }
}

function addStateLog(
  action: string,
  actorName: string,
  targetName: string,
  roomOrDetail: string,
  ip: string
) {
  const item: ActionStateLog = {
    id: `st_${crypto.randomUUID().slice(0, 8)}`,
    action,
    actorName,
    targetName,
    roomOrDetail,
    ip,
    createdAt: Date.now(),
  };
  state.states.unshift(item);
  state.states = state.states.slice(0, 500);
}

interface AuthedRequest extends Request {
  user?: UserAccount;
  userRank?: RankRole;
}

function resolveUserFromRequest(req: Request): { user?: UserAccount; rank?: RankRole } {
  const token = String(req.headers['x-session-token'] ?? '').trim();
  if (!token) return {};
  const userId = sessions.get(token);
  if (!userId) return {};
  const user = state.users.find((u) => u.id === userId);
  if (!user) return {};
  return { user, rank: findRank(user.rankId) };
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const { user, rank } = resolveUserFromRequest(req);
  if (!user || !rank) {
    res.status(401).json({ error: 'يجب تسجيل الدخول أولاً' });
    return;
  }
  const activeBan = findMatchingBan(
    { ip: getClientIp(req), device: user.device, accountId: user.id, country: user.country },
    state.bans
  );
  if (activeBan && !rank.isOwner) {
    res.status(403).json({
      error: `تم حظرك${activeBan.reason ? `: ${activeBan.reason}` : ''}`,
      banned: activeBan,
    });
    return;
  }
  req.user = user;
  req.userRank = rank;
  next();
}

function requireCpAccess(perm?: PermissionKey) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    requireAuth(req, res, () => {
      if (!canAccessControlPanel(req.userRank)) {
        res.status(403).json({ error: 'لوحة التحكم متاحة فقط للمالك والمشرفين والأدمنية' });
        return;
      }
      if (perm && !hasPermission(req.userRank, perm)) {
        res.status(403).json({ error: 'لا تملك الصلاحية المطلوبة لهذا القسم' });
        return;
      }
      next();
    });
  };
}

const app = express();
app.use(express.json({ limit: '6mb' }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const wsClients = new Map<WebSocket, { userId: string | null; roomId: string | null }>();

function broadcastAll(event: string, payload: unknown) {
  const raw = JSON.stringify({ event, payload });
  for (const [ws] of wsClients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(raw);
    }
  }
}

function broadcastRoom(roomId: string, event: string, payload: unknown) {
  const raw = JSON.stringify({ event, payload });
  for (const [ws, meta] of wsClients) {
    if (ws.readyState === WebSocket.OPEN && meta.roomId === roomId) {
      ws.send(raw);
    }
  }
}

function emitLivePresenceAndRooms() {
  broadcastAll('rooms:update', state.rooms);
  broadcastAll(
    'presence:update',
    state.users.filter((u) => u.online && !u.stealth).map(toPublicUser)
  );
}

function emitCpUpdate() {
  for (const [ws, meta] of wsClients) {
    if (ws.readyState !== WebSocket.OPEN || !meta.userId) continue;
    const u = state.users.find((x) => x.id === meta.userId);
    if (!u) continue;
    if (canAccessControlPanel(findRank(u.rankId))) {
      ws.send(JSON.stringify({ event: 'cp:invalidate', payload: { at: Date.now() } }));
    }
  }
}

function pushNotification(params: {
  userId: string;
  actor: UserAccount;
  kind: NotificationItem['kind'];
  postId?: string;
  postSnippet?: string;
}) {
  if (params.userId === params.actor.id) return;
  const item: NotificationItem = {
    id: `ntf_${crypto.randomUUID().slice(0, 8)}`,
    userId: params.userId,
    actorId: params.actor.id,
    actorName: params.actor.topic || params.actor.username,
    actorColor: params.actor.color,
    actorNameStyle: params.actor.nameStyle,
    actorFontFamily: params.actor.fontFamily,
    actorAvatarUrl: params.actor.avatarUrl,
    kind: params.kind,
    postId: params.postId,
    postSnippet: params.postSnippet,
    read: false,
    createdAt: Date.now(),
  };
  state.notifications.unshift(item);
  state.notifications = state.notifications.slice(0, 300);

  const packet = JSON.stringify({ event: 'notification:new', payload: item });
  for (const [ws, meta] of wsClients) {
    if (meta.userId === params.userId && ws.readyState === WebSocket.OPEN) {
      ws.send(packet);
    }
  }
}

function pushSystemRoomNotice(params: {
  roomId: string;
  actor: UserAccount;
  kind: 'login' | 'room_enter' | 'room_leave' | 'generic';
  body: string;
  targetRoomName?: string;
}) {
  if (!params.roomId || params.actor.stealth) return;
  const msg: ChatMessage = {
    id: `sys_${crypto.randomUUID().slice(0, 8)}`,
    roomId: params.roomId,
    userId: params.actor.id,
    username: params.actor.username,
    topic: params.actor.topic,
    color: params.actor.color,
    nameStyle: params.actor.nameStyle,
    fontFamily: params.actor.fontFamily,
    avatarUrl: params.actor.avatarUrl,
    rankId: params.actor.rankId,
    verified: params.actor.verified,
    streak: params.actor.streak,
    streakLastDay: params.actor.streakLastDay,
    body: params.body,
    isSystem: true,
    systemKind: params.kind,
    systemTargetRoom: params.targetRoomName,
    createdAt: Date.now(),
  };
  state.messages.push(msg);
  if (state.messages.length > 400) {
    state.messages = state.messages.slice(-400);
  }
  broadcastRoom(params.roomId, 'chat:message', msg);
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url ?? '/ws', `http://${req.headers.host ?? 'localhost'}`);
  const token = url.searchParams.get('token') ?? '';
  const userId = token ? sessions.get(token) ?? null : null;
  const user = userId ? state.users.find((u) => u.id === userId) : undefined;

  if (user) {
    user.online = true;
    user.lastSeen = Date.now();
    if (!user.isGuest) {
      const st = applyDailyStreakLogin(user.streak, user.streakLastDay, Date.now());
      user.streak = st.streak;
      user.streakLastDay = st.streakLastDay;
    }
    saveState(state);
  }

  wsClients.set(ws, { userId, roomId: user?.roomId ?? null });
  emitLivePresenceAndRooms();

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(String(raw)) as {
        event?: string;
        roomId?: string;
        targetUserId?: string;
        signal?: unknown;
        token?: string;
      };
      const meta = wsClients.get(ws);
      if (!meta) return;

      if (msg.event === 'auth' && msg.token) {
        const uid = sessions.get(msg.token) ?? null;
        meta.userId = uid;
        const u = uid ? state.users.find((x) => x.id === uid) : undefined;
        if (u) {
          u.online = true;
          u.lastSeen = Date.now();
          meta.roomId = u.roomId;
          emitLivePresenceAndRooms();
        }
      } else if (msg.event === 'activity' && meta.userId) {
        const u = state.users.find((x) => x.id === meta.userId);
        if (u) {
          const wasOffline = !u.online;
          u.online = true;
          u.lastSeen = Date.now();
          if (wasOffline) emitLivePresenceAndRooms();
        }
      } else if (msg.event === 'room:watch' && msg.roomId) {
        meta.roomId = msg.roomId;
        if (meta.userId) {
          const u = state.users.find((x) => x.id === meta.userId);
          if (u) {
            u.roomId = msg.roomId;
            u.lastSeen = Date.now();
          }
          emitLivePresenceAndRooms();
        }
      } else if (msg.event === 'webrtc:signal' && msg.targetUserId && meta.userId) {
        const packet = JSON.stringify({
          event: 'webrtc:signal',
          payload: {
            fromUserId: meta.userId,
            roomId: msg.roomId,
            signal: msg.signal,
          },
        });
        for (const [peerWs, peerMeta] of wsClients) {
          if (peerMeta.userId === msg.targetUserId && peerWs.readyState === WebSocket.OPEN) {
            peerWs.send(packet);
          }
        }
      }
    } catch {
      // ignore malformed ws frame
    }
  });

  ws.on('close', () => {
    const meta = wsClients.get(ws);
    wsClients.delete(ws);
    if (meta?.userId) {
      // Preserve online session during mobile screen lock / brief backgrounding;
      // refresh lastSeen so the 20-minute idle sweep starts from disconnect.
      const u = state.users.find((x) => x.id === meta.userId);
      if (u && u.online) {
        u.lastSeen = Date.now();
        saveState(state);
      }
    }
  });
});

// Idle timeout sweep: disconnects inactive accounts only after 20 minutes without an active connection
setInterval(() => {
  if (state.siteSettings.offlinePinEnabled) return;
  const nowMs = Date.now();
  const activeWsUserIds = new Set(
    Array.from(wsClients.values())
      .map((m) => m.userId)
      .filter((id): id is string => Boolean(id))
  );
  let changed = false;
  for (const u of state.users) {
    if (
      shouldDisconnectIdleUser({
        online: u.online,
        hasActiveWs: activeWsUserIds.has(u.id),
        lastSeen: u.lastSeen,
        nowMs,
      })
    ) {
      u.online = false;
      for (const room of state.rooms) {
        for (const seat of room.seats) {
          if (seat.userId === u.id) {
            seat.userId = null;
            seat.muted = false;
            seat.forceMuted = false;
            seat.joinedAt = null;
          }
        }
      }
      changed = true;
    }
  }
  if (changed) {
    saveState(state);
    emitLivePresenceAndRooms();
  }
}, 60_000);

// ======================== PUBLIC & AUTH ROUTES ========================

app.get('/api/bootstrap', async (req, res) => {
  const { user, rank } = resolveUserFromRequest(req);
  const ip = getClientIp(req);
  const localOwner = isLocalOwnerDevice(req);
  const resolvedCountry = user
    ? await resolveCountryForRequest(req, ip, user.country)
    : null;

  const activeBan = user
    ? findMatchingBan(
        {
          ip,
          device: user.device,
          accountId: user.id,
          country: resolvedCountry ?? user.country,
        },
        state.bans
      )
    : null;

  if (activeBan && !rank?.isOwner) {
    res.status(403).json({
      error: 'تم حظرك من الموقع',
      ban: activeBan,
    });
    return;
  }

  if (user) {
    let dirty = false;
    user.online = true;
    user.lastSeen = Date.now();
    if (user.ip !== ip) {
      user.ip = ip;
      dirty = true;
    }
    if (resolvedCountry && user.country !== resolvedCountry) {
      user.country = resolvedCountry;
      dirty = true;
    }
    if (!user.isGuest) {
      const st = applyDailyStreakLogin(user.streak, user.streakLastDay, Date.now());
      if (st.streak !== user.streak || st.streakLastDay !== user.streakLastDay) {
        user.streak = st.streak;
        user.streakLastDay = st.streakLastDay;
        dirty = true;
      }
    }
    if (dirty) {
      saveState(state);
      emitLivePresenceAndRooms();
    }
  }

  const privateMessages = user
    ? state.privateMessages.filter(
        (pm) => pm.fromUserId === user.id || pm.toUserId === user.id
      )
    : [];

  const notifications = user
    ? state.notifications.filter((n) => n.userId === user.id).slice(0, 50)
    : [];

  res.json({
    me: user ? toPublicUser(user) : null,
    myRank: rank ?? null,
    isLocalOwnerDevice: localOwner,
    canAccessCp: canAccessControlPanel(rank),
    ranks: state.ranks,
    rooms: state.rooms,
    onlineUsers: state.users.filter((u) => u.online && !u.stealth).map(toPublicUser),
    wallPosts: state.wallPosts,
    shortcuts: state.shortcuts,
    symbols: state.symbols,
    front: state.front,
    siteSettings: state.siteSettings,
    privateMessages,
    notifications,
  });
});

app.post('/api/auth/register', async (req, res) => {
  const ip = getClientIp(req);
  const device = getDeviceString(req);
  const deviceToken = getDeviceToken(req);
  const localOwner = isLocalOwnerDevice(req);
  const country = await resolveCountryForRequest(req, ip);

  const meta = parseDeviceMeta(device, String(req.headers['user-agent'] ?? ''));
  const allowCheck = checkSecurityAllowlist(meta, state.securityAllow);
  if (!allowCheck.allowed && !localOwner) {
    addAccessLog(
      {
        state: allowCheck.reason ?? 'محظور|متصفح',
        username: String(req.body?.username ?? 'غير معروف'),
        topic: String(req.body?.username ?? 'غير معروف'),
        ip,
        country,
        device,
        referrer: 'security',
      },
      true
    );
    saveState(state);
    res.status(403).json({ error: allowCheck.reason });
    return;
  }

  const activeBan = findMatchingBan({ ip, device, country }, state.bans);
  if (activeBan && !localOwner) {
    addAccessLog(
      {
        state: 'محظور|تسجيل|جهاز',
        username: String(req.body?.username ?? 'محظور'),
        topic: String(req.body?.username ?? 'محظور'),
        ip,
        country,
        device,
        referrer: 'band',
      },
      true
    );
    saveState(state);
    res.status(403).json({ error: `أنت محظور من التسجيل: ${activeBan.reason || 'مخالفة'}` });
    return;
  }

  if (state.siteSettings.blockRegistrations && !localOwner) {
    res.status(403).json({ error: 'تسجيل العضويات الجديدة مغلق حالياً من الإدارة' });
    return;
  }

  const username = String(req.body?.username ?? '').trim();
  const password = String(req.body?.password ?? '');
  const topic = String(req.body?.topic ?? username).trim() || username;

  if (username.length < state.siteSettings.registerNameMinChars || username.length > 24) {
    res.status(400).json({
      error: `اسم العضوية يجب أن يكون بين ${state.siteSettings.registerNameMinChars} و 24 حرف`,
    });
    return;
  }
  if (password.length < 3) {
    res.status(400).json({ error: 'كلمة المرور قصيرة جداً (3 أحرف على الأقل)' });
    return;
  }
  if (state.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    res.status(409).json({ error: 'هذا الاسم مسجل مسبقاً' });
    return;
  }

  // Enforce local device auto-Owner rank upgrade when registering from this device
  const assignedRank = resolveRegistrationRank(localOwner, state.ranks);
  const now = Date.now();
  const newUser: UserAccount = {
    id: `user_${crypto.randomUUID().slice(0, 8)}`,
    username,
    topic,
    passwordHash: hashPassword(password),
    isGuest: false,
    rankId: assignedRank.id,
    color: assignedRank.isOwner ? '#eab308' : '#e2e8f0',
    nameStyle: 'solid',
    fontFamily: 'ibm_arabic',
    status: assignedRank.isOwner ? 'صلاحية المالك (تجربة محلية)' : 'عضو جديد في المجلس',
    avatarUrl: null,
    likes: assignedRank.isOwner ? 1000 : 10,
    streak: 1,
    streakLastDay: getRiyadhDateString(now),
    verified: assignedRank.isOwner,
    royalLoginBoys: false,
    royalLoginGirls: false,
    ip,
    country,
    device,
    deviceToken,
    roomId: 'room_general',
    online: true,
    stealth: false,
    silencedUntil: null,
    subscriptionExpiresAt: null,
    subscriptionGrantedAt: assignedRank.isOwner ? now : null,
    lastSeen: now,
    createdAt: now,
  };

  state.users.unshift(newUser);
  addAccessLog({
    state: assignedRank.name,
    username: newUser.username,
    topic: newUser.topic,
    ip,
    country: newUser.country,
    device,
    referrer: String(req.headers.referer ?? '*'),
  });
  if (assignedRank.isOwner) {
    addStateLog('ترقية تلقائية للمالك (جهاز المطور)', 'النظام', newUser.username, 'المالك', ip);
  }
  pushSystemRoomNotice({
    roomId: newUser.roomId || 'room_general',
    actor: newUser,
    kind: 'login',
    body: 'سجّل دخول إلى الموقع وانضم للغرفة',
  });
  saveState(state);

  const token = crypto.randomUUID();
  sessions.set(token, newUser.id);
  persistSessions();
  const quickLoginToken = issueRememberToken(newUser.id);
  emitLivePresenceAndRooms();
  emitCpUpdate();

  res.json({
    token,
    quickLoginToken,
    user: toPublicUser(newUser),
    rank: assignedRank,
    canAccessCp: canAccessControlPanel(assignedRank),
    isLocalOwnerDevice: localOwner,
  });
});

app.post('/api/auth/login', async (req, res) => {
  const ip = getClientIp(req);
  const device = getDeviceString(req);
  const username = String(req.body?.username ?? '').trim();
  const password = String(req.body?.password ?? '');
  const localOwner = isLocalOwnerDevice(req);

  const user = state.users.find(
    (u) => !u.isGuest && u.username.toLowerCase() === username.toLowerCase()
  );
  if (!user || user.passwordHash !== hashPassword(password)) {
    res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    return;
  }

  const country = await resolveCountryForRequest(req, ip, user.country);
  const rank = findRank(user.rankId);
  const activeBan = findMatchingBan(
    { ip, device, accountId: user.id, country },
    state.bans
  );
  if (activeBan && !rank.isOwner && !localOwner) {
    addAccessLog(
      {
        state: 'محظور|عضو|جهاز',
        username: user.username,
        topic: user.topic,
        ip,
        country,
        device,
        referrer: 'band',
      },
      true
    );
    saveState(state);
    res.status(403).json({ error: `الحساب محظور: ${activeBan.reason || 'مخالفة'}` });
    return;
  }

  const now = Date.now();
  const st = applyDailyStreakLogin(user.streak, user.streakLastDay, now);
  user.streak = st.streak;
  user.streakLastDay = st.streakLastDay;
  user.ip = ip;
  user.country = country;
  user.device = device;
  user.online = true;
  user.lastSeen = now;
  user.roomId = user.roomId ?? 'room_general';

  addAccessLog({
    state: rank.name,
    username: user.username,
    topic: user.topic,
    ip,
    country: user.country,
    device,
    referrer: String(req.headers.referer ?? '*'),
  });
  pushSystemRoomNotice({
    roomId: user.roomId || 'room_general',
    actor: user,
    kind: 'login',
    body: 'سجّل دخول إلى الموقع وانضم للغرفة',
  });
  saveState(state);

  const token = crypto.randomUUID();
  sessions.set(token, user.id);
  persistSessions();
  const quickLoginToken = issueRememberToken(user.id);
  emitLivePresenceAndRooms();
  emitCpUpdate();

  res.json({
    token,
    quickLoginToken,
    user: toPublicUser(user),
    rank,
    canAccessCp: canAccessControlPanel(rank),
    isLocalOwnerDevice: localOwner,
  });
});

app.post('/api/auth/quick-login', async (req, res) => {
  const quickLoginToken = String(req.body?.quickLoginToken ?? '').trim();
  const uid = quickLoginToken ? rememberTokens.get(quickLoginToken) : undefined;
  if (!uid) {
    res.status(401).json({ error: 'جلسة الدخول السريع منتهية، سجل بكلمة المرور' });
    return;
  }
  const user = state.users.find((u) => u.id === uid && !u.isGuest);
  if (!user) {
    rememberTokens.delete(quickLoginToken);
    persistRememberTokens();
    res.status(404).json({ error: 'الحساب غير موجود' });
    return;
  }

  const ip = getClientIp(req);
  const device = getDeviceString(req);
  const localOwner = isLocalOwnerDevice(req);
  const country = await resolveCountryForRequest(req, ip, user.country);
  const rank = findRank(user.rankId);
  const activeBan = findMatchingBan(
    { ip, device, accountId: user.id, country },
    state.bans
  );
  if (activeBan && !rank.isOwner && !localOwner) {
    res.status(403).json({ error: `الحساب محظور: ${activeBan.reason || 'مخالفة'}` });
    return;
  }

  const now = Date.now();
  const st = applyDailyStreakLogin(user.streak, user.streakLastDay, now);
  user.streak = st.streak;
  user.streakLastDay = st.streakLastDay;
  user.ip = ip;
  user.country = country;
  user.device = device;
  user.online = true;
  user.lastSeen = now;
  user.roomId = user.roomId ?? 'room_general';

  addAccessLog({
    state: rank.name,
    username: user.username,
    topic: user.topic,
    ip,
    country: user.country,
    device,
    referrer: String(req.headers.referer ?? '*'),
  });
  pushSystemRoomNotice({
    roomId: user.roomId || 'room_general',
    actor: user,
    kind: 'login',
    body: 'سجّل دخول إلى الموقع وانضم للغرفة',
  });
  saveState(state);

  const token = crypto.randomUUID();
  sessions.set(token, user.id);
  persistSessions();
  emitLivePresenceAndRooms();
  emitCpUpdate();

  res.json({
    token,
    quickLoginToken,
    user: toPublicUser(user),
    rank,
    canAccessCp: canAccessControlPanel(rank),
    isLocalOwnerDevice: localOwner,
  });
});

app.delete('/api/auth/quick-login', (req, res) => {
  const quickLoginToken = String(req.body?.quickLoginToken ?? '').trim();
  if (quickLoginToken && rememberTokens.delete(quickLoginToken)) {
    persistRememberTokens();
  }
  res.json({ ok: true });
});

app.post('/api/auth/guest', async (req, res) => {
  const ip = getClientIp(req);
  const device = getDeviceString(req);
  const localOwner = isLocalOwnerDevice(req);
  const country = await resolveCountryForRequest(req, ip);

  if (state.siteSettings.blockGuests) {
    res.status(403).json({ error: 'دخول الزوار مغلق حالياً من إدارة الموقع' });
    return;
  }
  const activeBan = findMatchingBan({ ip, device, country }, state.bans);
  if (activeBan && !localOwner) {
    addAccessLog(
      {
        state: 'محظور|زائر',
        username: String(req.body?.username ?? 'زائر'),
        topic: String(req.body?.username ?? 'زائر'),
        ip,
        country,
        device,
        referrer: 'band',
      },
      true
    );
    saveState(state);
    res.status(403).json({ error: `أنت محظور من الدخول: ${activeBan.reason || 'مخالفة'}` });
    return;
  }

  const username = String(req.body?.username ?? '').trim();
  if (username.length < state.siteSettings.guestNameMinChars || username.length > 20) {
    res.status(400).json({
      error: `اسم الزائر يجب أن يكون بين ${state.siteSettings.guestNameMinChars} و 20 حرف`,
    });
    return;
  }

  const guestRank = findRank('rank_guest');
  const now = Date.now();
  const guestUser: UserAccount = {
    id: `guest_${crypto.randomUUID().slice(0, 8)}`,
    username,
    topic: username,
    isGuest: true,
    rankId: guestRank.id,
    color: '#94a3b8',
    status: 'زائر',
    avatarUrl: null,
    likes: 0,
    streak: 0,
    verified: false,
    royalLoginBoys: false,
    royalLoginGirls: false,
    ip,
    country,
    device,
    deviceToken: getDeviceToken(req),
    roomId: 'room_general',
    online: true,
    stealth: false,
    silencedUntil: null,
    subscriptionExpiresAt: null,
    subscriptionGrantedAt: null,
    lastSeen: now,
    createdAt: now,
  };

  state.users.unshift(guestUser);
  addAccessLog({
    state: 'زائر',
    username: guestUser.username,
    topic: guestUser.topic,
    ip,
    country: guestUser.country,
    device,
    referrer: '*',
  });
  pushSystemRoomNotice({
    roomId: guestUser.roomId || 'room_general',
    actor: guestUser,
    kind: 'login',
    body: 'دخل كزائر إلى الغرفة',
  });
  saveState(state);

  const token = crypto.randomUUID();
  sessions.set(token, guestUser.id);
  persistSessions();
  emitLivePresenceAndRooms();
  emitCpUpdate();

  res.json({
    token,
    user: toPublicUser(guestUser),
    rank: guestRank,
    canAccessCp: false,
    isLocalOwnerDevice: localOwner,
  });
});

app.post('/api/auth/logout', requireAuth, (req: AuthedRequest, res) => {
  const token = String(req.headers['x-session-token'] ?? '').trim();
  const user = req.user!;
  user.online = false;
  user.lastSeen = Date.now();
  for (const room of state.rooms) {
    for (const seat of room.seats) {
      if (seat.userId === user.id) {
        seat.userId = null;
        seat.muted = false;
        seat.forceMuted = false;
        seat.joinedAt = null;
      }
    }
  }
  if (token) {
    sessions.delete(token);
    persistSessions();
  }
  saveState(state);
  emitLivePresenceAndRooms();
  res.json({ ok: true });
});

// ======================== PROFILE & SOCIAL ========================

app.patch('/api/profile', requireAuth, (req: AuthedRequest, res) => {
  const user = req.user!;
  const rank = req.userRank!;
  const {
    topic,
    status,
    color,
    nameStyle,
    fontFamily,
    avatarUrl,
    hideCountryFlag,
    newPassword,
  } = req.body ?? {};

  if (typeof topic === 'string' && topic.trim() && topic.trim() !== user.topic) {
    if (!rank.isOwner && user.likes < state.siteSettings.nameChangeMinLikes) {
      res.status(403).json({
        error: `تغيير الزخرفة يتطلب ${state.siteSettings.nameChangeMinLikes} لايك`,
      });
      return;
    }
    user.topic = topic.trim().slice(0, 32);
  }
  if (typeof status === 'string') {
    user.status = status.trim().slice(0, 80);
  }
  if (typeof color === 'string' && color.trim()) {
    user.color = normalizeColorHex(color.trim());
  }
  if (typeof nameStyle === 'string' && nameStyle.trim()) {
    user.nameStyle = nameStyle.trim().slice(0, 32);
  }
  if (typeof fontFamily === 'string' && fontFamily.trim()) {
    user.fontFamily = fontFamily.trim().slice(0, 40);
  }
  if (typeof hideCountryFlag === 'boolean') {
    user.hideCountryFlag = hideCountryFlag;
  }
  if (avatarUrl === null || typeof avatarUrl === 'string') {
    if (!rank.isOwner && user.likes < state.siteSettings.picChangeMinLikes) {
      res.status(403).json({
        error: `تغيير الصورة يتطلب ${state.siteSettings.picChangeMinLikes} لايك`,
      });
      return;
    }
    user.avatarUrl = avatarUrl ? avatarUrl.slice(0, 450_000) : null;
  }
  if (typeof newPassword === 'string' && newPassword.trim()) {
    if (user.isGuest) {
      res.status(403).json({ error: 'لا يمكن للزائر تعيين كلمة مرور' });
      return;
    }
    if (newPassword.trim().length < 3) {
      res.status(400).json({ error: 'كلمة المرور قصيرة جداً (3 أحرف على الأقل)' });
      return;
    }
    user.passwordHash = hashPassword(newPassword.trim());
  }

  user.lastSeen = Date.now();
  saveState(state);
  emitLivePresenceAndRooms();
  res.json({ user: toPublicUser(user) });
});

app.get('/api/users/:id', requireAuth, (req: AuthedRequest, res) => {
  const target = state.users.find((u) => u.id === req.params.id);
  if (!target) {
    res.status(404).json({ error: 'العضو غير موجود' });
    return;
  }
  res.json({ user: toPublicUser(target) });
});

app.post('/api/users/:id/like', requireAuth, (req: AuthedRequest, res) => {
  const actor = req.user!;
  const target = state.users.find((u) => u.id === req.params.id);
  if (!target) {
    res.status(404).json({ error: 'العضو غير موجود' });
    return;
  }
  target.likes += 1;
  pushNotification({
    userId: target.id,
    actor,
    kind: 'profile_like',
  });
  saveState(state);
  emitLivePresenceAndRooms();
  res.json({ user: toPublicUser(target) });
});

app.post('/api/notifications/read', requireAuth, (req: AuthedRequest, res) => {
  const user = req.user!;
  const notifId = typeof req.body?.id === 'string' ? req.body.id : null;
  let changed = false;
  for (const n of state.notifications) {
    if (n.userId === user.id && !n.read && (!notifId || n.id === notifId)) {
      n.read = true;
      changed = true;
    }
  }
  if (changed) saveState(state);
  res.json({ ok: true });
});

// ======================== ROOMS, MIC CIRCLE & CHAT ========================

app.post('/api/rooms', requireAuth, (req: AuthedRequest, res) => {
  const user = req.user!;
  const rank = req.userRank!;
  if (user.isGuest) {
    res.status(403).json({ error: 'إنشاء الغرف متاح للأعضاء المسجلين والإدارة فقط' });
    return;
  }
  const name = String(req.body?.name ?? '').trim();
  const description = String(req.body?.description ?? '').trim();
  const welcomeMessage = String(req.body?.welcomeMessage ?? '').trim();
  const password = String(req.body?.password ?? '').trim();
  const imageUrl =
    typeof req.body?.imageUrl === 'string' && req.body.imageUrl.trim()
      ? req.body.imageUrl.trim().slice(0, 1_200_000)
      : null;
  const maxMics = Math.min(5, Math.max(0, Number(req.body?.maxMics ?? 5)));
  const maxCapacity = Math.min(200, Math.max(1, Number(req.body?.maxCapacity ?? 100)));
  const requiredLikes = Math.max(0, Number(req.body?.requiredLikes ?? 0));
  const canUseStaffFlags = rank.isOwner || hasPermission(rank, 'manage_rooms');

  if (name.length < 2 || name.length > 40) {
    res.status(400).json({ error: 'اسم الغرفة يجب أن يكون بين 2 و 40 حرفاً' });
    return;
  }

  const room: Room = {
    id: `room_${crypto.randomUUID().slice(0, 8)}`,
    name,
    description: description || 'غرفة دردشة صوتية وكتابية',
    welcomeMessage: welcomeMessage || `أهلاً بكم في ${name}`,
    imageUrl,
    requiredLikes,
    password,
    maxCapacity,
    maxMics,
    isPinned: canUseStaffFlags ? Boolean(req.body?.isPinned) : false,
    isPublicDefault: false,
    micEnabled: req.body?.micEnabled === undefined ? true : Boolean(req.body?.micEnabled),
    bannerEnabled: Boolean(req.body?.bannerEnabled),
    liveBroadcast: Boolean(req.body?.liveBroadcast),
    ownerId: user.id,
    ownerName: user.username,
    operators: [user.id],
    bannedUserIds: [],
    seats: createDefaultSeats(maxMics),
    createdAt: Date.now(),
  };

  state.rooms.push(room);
  addStateLog('إنشاء غرفة', user.username, user.username, room.name, getClientIp(req));
  saveState(state);
  emitLivePresenceAndRooms();
  emitCpUpdate();
  res.json({ room });
});

app.post('/api/rooms/:id/join', requireAuth, (req: AuthedRequest, res) => {
  const room = state.rooms.find((r) => r.id === req.params.id);
  if (!room) {
    res.status(404).json({ error: 'الغرفة غير موجودة' });
    return;
  }
  const user = req.user!;
  const rank = req.userRank!;

  const entry = checkRoomEntry(room, user, rank, String(req.body?.password ?? ''));
  if (!entry.allowed) {
    res.status(403).json({ error: entry.reason, needsPassword: entry.needsPassword });
    return;
  }

  const previousRoomId = user.roomId;
  const switchedRoom = previousRoomId !== room.id;

  // Leave any mic in previous room (never clears persistent user.micForceMuted)
  if (previousRoomId && switchedRoom) {
    const prev = state.rooms.find((r) => r.id === previousRoomId);
    if (prev) {
      applyMicLeaveFromRoom(prev, user.id);
      pushSystemRoomNotice({
        roomId: prev.id,
        actor: user,
        kind: 'room_leave',
        body: `انتقل إلى غرفة ${room.name}`,
        targetRoomName: room.name,
      });
    }
  }

  user.roomId = room.id;
  user.lastSeen = Date.now();

  if (switchedRoom) {
    pushSystemRoomNotice({
      roomId: room.id,
      actor: user,
      kind: 'room_enter',
      body: 'انضم إلى الغرفة',
    });
  }

  saveState(state);
  emitLivePresenceAndRooms();

  const messages = state.messages.filter((m) => m.roomId === room.id).slice(-80);
  res.json({ room, messages });
});

app.get('/api/rooms/:id/messages', requireAuth, (req: AuthedRequest, res) => {
  const room = state.rooms.find((r) => r.id === req.params.id);
  if (!room) {
    res.status(404).json({ error: 'الغرفة غير موجودة' });
    return;
  }
  const messages = state.messages.filter((m) => m.roomId === room.id).slice(-100);
  res.json({ messages });
});

app.post('/api/rooms/:id/messages', requireAuth, (req: AuthedRequest, res) => {
  const room = state.rooms.find((r) => r.id === req.params.id);
  if (!room) {
    res.status(404).json({ error: 'الغرفة غير موجودة' });
    return;
  }
  const user = req.user!;
  const rank = req.userRank!;

  if (user.silencedUntil && user.silencedUntil > Date.now() && !rank.isOwner) {
    res.status(403).json({ error: 'أنت مسكت حالياً ولا يمكنك إرسال رسائل' });
    return;
  }
  if (!rank.isOwner && user.likes < state.siteSettings.roomWriteMinLikes) {
    res.status(403).json({
      error: `الكتابة في الغرف تتطلب ${state.siteSettings.roomWriteMinLikes} لايك`,
    });
    return;
  }

  const rawBody = String(req.body?.body ?? '').trim();
  const mediaUrl = typeof req.body?.mediaUrl === 'string' ? req.body.mediaUrl.trim() : null;
  if (!rawBody && !mediaUrl) {
    res.status(400).json({ error: 'الرسالة فارغة' });
    return;
  }
  if (rawBody.length > state.siteSettings.roomMaxChars) {
    res.status(400).json({
      error: `الحد الأقصى لأحرف الرسالة في الغرف هو ${state.siteSettings.roomMaxChars} حرفاً`,
    });
    return;
  }
  if (mediaUrl && !rank.isOwner) {
    if (state.siteSettings.hideRoomMedia) {
      res.status(403).json({ error: 'إرسال الوسائط في الغرف معطّل حالياً' });
      return;
    }
    if (user.likes < state.siteSettings.roomMediaMinLikes) {
      res.status(403).json({
        error: `إرسال الوسائط يتطلب ${state.siteSettings.roomMediaMinLikes} لايك`,
      });
      return;
    }
  }

  const processed = applyTextShortcutsAndFilter(rawBody, state.shortcuts, state.filters);
  if (processed.blockedWord && !rank.isOwner) {
    state.blockedHits.unshift({
      id: `hit_${crypto.randomUUID().slice(0, 8)}`,
      username: user.username,
      word: processed.blockedWord,
      context: room.name,
      createdAt: Date.now(),
    });
    state.blockedHits = state.blockedHits.slice(0, 200);
    saveState(state);
    emitCpUpdate();
    res.status(400).json({ error: 'الرسالة تحتوي على كلمة ممنوعة من فلتر الموقع' });
    return;
  }

  const msg: ChatMessage = {
    id: `msg_${crypto.randomUUID().slice(0, 8)}`,
    roomId: room.id,
    userId: user.id,
    username: user.username,
    topic: user.topic,
    color: user.color,
    nameStyle: user.nameStyle,
    fontFamily: user.fontFamily,
    avatarUrl: user.avatarUrl,
    rankId: user.rankId,
    verified: user.verified,
    streak: user.streak,
    streakLastDay: user.streakLastDay,
    body: processed.text,
    mediaUrl,
    replyTo: req.body?.replyTo ?? null,
    createdAt: Date.now(),
  };

  state.messages.push(msg);
  if (state.messages.length > 600) {
    state.messages = state.messages.slice(-600);
  }
  user.lastSeen = Date.now();
  saveState(state);

  broadcastRoom(room.id, 'chat:message', msg);
  res.json({ message: msg });
});

app.delete('/api/rooms/:roomId/messages/:msgId', requireAuth, (req: AuthedRequest, res) => {
  const user = req.user!;
  const rank = req.userRank!;
  const idx = state.messages.findIndex(
    (m) => m.id === req.params.msgId && m.roomId === req.params.roomId
  );
  if (idx === -1) {
    res.status(404).json({ error: 'الرسالة غير موجودة' });
    return;
  }
  const msg = state.messages[idx]!;
  const canDelete = msg.userId === user.id || hasPermission(rank, 'delete_messages');
  if (!canDelete) {
    res.status(403).json({ error: 'لا تملك صلاحية حذف هذه الرسالة' });
    return;
  }

  const room = state.rooms.find((r) => r.id === req.params.roomId);
  state.messages.splice(idx, 1);
  addStateLog(
    'مسح رسالة عامة',
    user.username,
    msg.username,
    room?.name ?? req.params.roomId,
    getClientIp(req)
  );
  saveState(state);
  broadcastRoom(req.params.roomId, 'chat:delete', { id: msg.id, roomId: req.params.roomId });
  emitCpUpdate();
  res.json({ ok: true });
});

app.post('/api/rooms/:id/mic', requireAuth, (req: AuthedRequest, res) => {
  const room = state.rooms.find((r) => r.id === req.params.id);
  if (!room) {
    res.status(404).json({ error: 'الغرفة غير موجودة' });
    return;
  }
  const user = req.user!;
  const rank = req.userRank!;
  const action = String(req.body?.action ?? '');
  const seatNum = Number(req.body?.seat ?? 0);
  const seat = room.seats.find((s) => s.seat === seatNum);

  if (!room.micEnabled && !rank.isOwner) {
    res.status(403).json({ error: 'المايكات معطلة في هذه الغرفة' });
    return;
  }

  if (action === 'join') {
    if (!seat) {
      res.status(404).json({ error: 'المقعد غير موجود' });
      return;
    }
    if (user.silencedUntil && user.silencedUntil > Date.now() && !rank.isOwner) {
      res.status(403).json({ error: 'أنت مسكت حالياً' });
      return;
    }
    if (!rank.isOwner && user.likes < state.siteSettings.micMinLikes) {
      res.status(403).json({
        error: `الصعود على المايك يتطلب ${state.siteSettings.micMinLikes} لايك`,
      });
      return;
    }
    if (seat.userId && seat.userId !== user.id) {
      res.status(409).json({ error: 'المايك مشغول حالياً' });
      return;
    }
    applyMicJoinToSeat(room, user, seatNum, Date.now());
  } else if (action === 'leave') {
    applyMicLeaveFromRoom(room, user.id, seatNum || undefined);
  } else if (action === 'toggle_mute' && seat && seat.userId === user.id) {
    const check = canSelfToggleMicMute(seat, user, rank);
    if (!check.allowed) {
      res.status(403).json({ error: check.reason || 'تم كتم المايك من قبل الإدارة' });
      return;
    }
    seat.muted = !seat.muted;
  } else if (action === 'admin_kick' && seat && seat.userId) {
    if (!hasPermission(rank, 'moderate_mics') && !room.operators.includes(user.id)) {
      res.status(403).json({ error: 'لا تملك صلاحية إنزال من المايك' });
      return;
    }
    const target = state.users.find((u) => u.id === seat.userId);
    const targetRank = target ? findRank(target.rankId) : null;
    if (
      !canStaffModerateMic({
        actorRank: rank,
        actorId: user.id,
        targetRank,
        targetId: seat.userId,
        roomOperators: room.operators,
      })
    ) {
      res.status(403).json({ error: 'رتبة العضو أعلى أو تساوي رتبتك' });
      return;
    }
    addStateLog('إنزال من المايك', user.username, target?.username ?? 'عضو', room.name, getClientIp(req));
    applyMicLeaveFromRoom(room, seat.userId, seat.seat);
  } else if (action === 'admin_force_mute' && seat && seat.userId) {
    if (!hasPermission(rank, 'moderate_mics') && !room.operators.includes(user.id)) {
      res.status(403).json({ error: 'لا تملك صلاحية كتم المايك' });
      return;
    }
    const target = state.users.find((u) => u.id === seat.userId);
    if (!target) {
      res.status(404).json({ error: 'العضو غير موجود' });
      return;
    }
    const targetRank = findRank(target.rankId);
    if (
      !canStaffModerateMic({
        actorRank: rank,
        actorId: user.id,
        targetRank,
        targetId: target.id,
        roomOperators: room.operators,
      })
    ) {
      res.status(403).json({ error: 'رتبة العضو أعلى أو تساوي رتبتك' });
      return;
    }
    const isNowMuted = toggleGlobalAdminMicMute(state.rooms, target);
    addStateLog(
      isNowMuted ? 'كتم مايك عام' : 'فك كتم مايك عام',
      user.username,
      target.username,
      room.name,
      getClientIp(req)
    );
  }

  saveState(state);
  emitLivePresenceAndRooms();
  emitCpUpdate();
  res.json({ room });
});

// ======================== WALL & PRIVATE CHAT ========================

app.post('/api/wall', requireAuth, (req: AuthedRequest, res) => {
  const user = req.user!;
  const rank = req.userRank!;
  const body = String(req.body?.body ?? '').trim();
  const rawMedia = typeof req.body?.mediaUrl === 'string' ? req.body.mediaUrl.trim() : '';
  const mediaUrl = rawMedia ? rawMedia.slice(0, 1_200_000) : null;

  if (!body && !mediaUrl) {
    res.status(400).json({ error: 'محتوى المنشور فارغ' });
    return;
  }
  if (body.length > state.siteSettings.wallMaxChars) {
    res.status(400).json({
      error: `الحد الأقصى لمنشور الحائط هو ${state.siteSettings.wallMaxChars} حرفاً`,
    });
    return;
  }
  if (!rank.isOwner && user.likes < state.siteSettings.wallMinLikes) {
    res.status(403).json({ error: `النشر في الحائط يتطلب ${state.siteSettings.wallMinLikes} لايك` });
    return;
  }
  if (mediaUrl && !rank.isOwner && user.likes < state.siteSettings.wallUploadMinLikes) {
    res.status(403).json({
      error: `رفع الصور في الحائط يتطلب ${state.siteSettings.wallUploadMinLikes} لايك`,
    });
    return;
  }

  const post: WallPost = {
    id: `wall_${crypto.randomUUID().slice(0, 8)}`,
    userId: user.id,
    username: user.username,
    topic: user.topic,
    avatarUrl: user.avatarUrl,
    color: user.color,
    nameStyle: user.nameStyle,
    fontFamily: user.fontFamily,
    rankId: user.rankId,
    streak: user.streak,
    streakLastDay: user.streakLastDay,
    body,
    mediaUrl,
    likes: [],
    comments: [],
    createdAt: Date.now(),
  };

  state.wallPosts.unshift(post);
  state.wallPosts = state.wallPosts.slice(0, 120);
  saveState(state);
  broadcastAll('wall:update', state.wallPosts);
  res.json({ post });
});

app.post('/api/wall/:id/like', requireAuth, (req: AuthedRequest, res) => {
  const post = state.wallPosts.find((p) => p.id === req.params.id);
  if (!post) {
    res.status(404).json({ error: 'المنشور غير موجود' });
    return;
  }
  const actor = req.user!;
  const uid = actor.id;
  if (post.likes.includes(uid)) {
    post.likes = post.likes.filter((id) => id !== uid);
  } else {
    post.likes.push(uid);
    pushNotification({
      userId: post.userId,
      actor,
      kind: 'post_like',
      postId: post.id,
      postSnippet: post.body.slice(0, 60) || 'منشور بصورة',
    });
  }
  saveState(state);
  broadcastAll('wall:update', state.wallPosts);
  res.json({ post });
});

app.post('/api/wall/:id/comment', requireAuth, (req: AuthedRequest, res) => {
  if (!state.siteSettings.wallCommentsEnabled) {
    res.status(403).json({ error: 'التعليقات في الحائط معطلة حالياً' });
    return;
  }
  const post = state.wallPosts.find((p) => p.id === req.params.id);
  if (!post) {
    res.status(404).json({ error: 'المنشور غير موجود' });
    return;
  }
  const user = req.user!;
  const body = String(req.body?.body ?? '').trim();
  if (!body) {
    res.status(400).json({ error: 'التعليق فارغ' });
    return;
  }

  let replyTo: { id: string; username: string; body: string } | null = null;
  let repliedUserId: string | null = null;
  if (req.body?.replyTo && typeof req.body.replyTo === 'object') {
    const refId = String(req.body.replyTo.id ?? '');
    const original = post.comments.find((c) => c.id === refId);
    if (original) {
      replyTo = {
        id: original.id,
        username: original.username,
        body: original.body.slice(0, 80),
      };
      repliedUserId = original.userId;
    } else if (req.body.replyTo.username && req.body.replyTo.body) {
      replyTo = {
        id: refId || 'reply',
        username: String(req.body.replyTo.username).slice(0, 40),
        body: String(req.body.replyTo.body).slice(0, 80),
      };
    }
  }

  post.comments.push({
    id: `wc_${crypto.randomUUID().slice(0, 8)}`,
    postId: post.id,
    userId: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    color: user.color,
    nameStyle: user.nameStyle,
    fontFamily: user.fontFamily,
    streak: user.streak,
    streakLastDay: user.streakLastDay,
    body: body.slice(0, 200),
    likes: [],
    replyTo,
    createdAt: Date.now(),
  });

  if (repliedUserId && repliedUserId !== user.id) {
    pushNotification({
      userId: repliedUserId,
      actor: user,
      kind: 'comment_reply',
      postId: post.id,
      postSnippet: body.slice(0, 60),
    });
  }
  if (post.userId !== repliedUserId) {
    pushNotification({
      userId: post.userId,
      actor: user,
      kind: 'post_comment',
      postId: post.id,
      postSnippet: body.slice(0, 60),
    });
  }
  saveState(state);
  broadcastAll('wall:update', state.wallPosts);
  res.json({ post });
});

app.post('/api/wall/:postId/comments/:commentId/like', requireAuth, (req: AuthedRequest, res) => {
  const post = state.wallPosts.find((p) => p.id === req.params.postId);
  if (!post) {
    res.status(404).json({ error: 'المنشور غير موجود' });
    return;
  }
  const comment = post.comments.find((c) => c.id === req.params.commentId);
  if (!comment) {
    res.status(404).json({ error: 'التعليق غير موجود' });
    return;
  }
  const actor = req.user!;
  const list = Array.isArray(comment.likes) ? comment.likes : [];
  if (list.includes(actor.id)) {
    comment.likes = list.filter((id) => id !== actor.id);
  } else {
    comment.likes = [...list, actor.id];
    pushNotification({
      userId: comment.userId,
      actor,
      kind: 'comment_like',
      postId: post.id,
      postSnippet: comment.body.slice(0, 60),
    });
  }
  saveState(state);
  broadcastAll('wall:update', state.wallPosts);
  res.json({ post });
});

app.delete('/api/wall/:id', requireAuth, (req: AuthedRequest, res) => {
  const user = req.user!;
  const rank = req.userRank!;
  const idx = state.wallPosts.findIndex((p) => p.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'المنشور غير موجود' });
    return;
  }
  const post = state.wallPosts[idx]!;
  if (post.userId !== user.id && !hasPermission(rank, 'delete_messages')) {
    res.status(403).json({ error: 'لا تملك صلاحية حذف المنشور' });
    return;
  }
  state.wallPosts.splice(idx, 1);
  addStateLog('حذف حائط', user.username, post.username, '', getClientIp(req));
  saveState(state);
  broadcastAll('wall:update', state.wallPosts);
  emitCpUpdate();
  res.json({ ok: true });
});

app.post('/api/pm', requireAuth, (req: AuthedRequest, res) => {
  const user = req.user!;
  const rank = req.userRank!;
  const toUserId = String(req.body?.toUserId ?? '');
  const body = String(req.body?.body ?? '').trim();

  if (!toUserId || !body) {
    res.status(400).json({ error: 'بيانات الرسالة الخاصة ناقصة' });
    return;
  }
  if (body.length > state.siteSettings.pmMaxChars) {
    res.status(400).json({
      error: `الحد الأقصى للرسالة الخاصة هو ${state.siteSettings.pmMaxChars} حرفاً`,
    });
    return;
  }
  if (!rank.isOwner && user.likes < state.siteSettings.pmMinLikes) {
    res.status(403).json({ error: `الخاص يتطلب ${state.siteSettings.pmMinLikes} لايك` });
    return;
  }

  const pm: PrivateMessage = {
    id: `pm_${crypto.randomUUID().slice(0, 8)}`,
    fromUserId: user.id,
    toUserId,
    body,
    readAt: null,
    createdAt: Date.now(),
  };
  state.privateMessages.push(pm);
  if (state.privateMessages.length > 500) {
    state.privateMessages = state.privateMessages.slice(-500);
  }
  saveState(state);

  const packet = JSON.stringify({ event: 'pm:new', payload: pm });
  for (const [ws, meta] of wsClients) {
    if (
      ws.readyState === WebSocket.OPEN &&
      (meta.userId === toUserId || meta.userId === user.id)
    ) {
      ws.send(packet);
    }
  }
  res.json({ pm });
});

app.post('/api/pm/read', requireAuth, (req: AuthedRequest, res) => {
  const user = req.user!;
  const fromUserId = String(req.body?.fromUserId ?? '');
  const now = Date.now();
  for (const pm of state.privateMessages) {
    if (pm.fromUserId === fromUserId && pm.toUserId === user.id && pm.readAt === null) {
      pm.readAt = now;
    }
  }
  saveState(state);
  res.json({ ok: true });
});

// ======================== CONTROL PANEL (STRICT RBAC) ========================

app.get('/api/cp/state', requireCpAccess(), (req: AuthedRequest, res) => {
  const safeUsers = state.users.map((u) => {
    const { passwordHash: _ph, ...rest } = u;
    return rest;
  });

  const payload: CpPayload = {
    logs: state.logs,
    states: state.states,
    bannedLogs: state.bannedLogs,
    users: safeUsers,
    bans: state.bans,
    securityAllow: state.securityAllow,
    ranks: state.ranks,
    rooms: state.rooms,
    shortcuts: state.shortcuts,
    filters: state.filters,
    blockedHits: state.blockedHits,
    autoMessages: state.autoMessages,
    front: state.front,
    symbols: state.symbols,
    domains: state.domains,
    siteSettings: state.siteSettings,
  };
  res.json(payload);
});

app.post('/api/cp/users/:id/verify', requireCpAccess('verify_members'), (req: AuthedRequest, res) => {
  const target = state.users.find((u) => u.id === req.params.id);
  if (!target) {
    res.status(404).json({ error: 'العضو غير موجود' });
    return;
  }
  target.verified = Boolean(req.body?.verified);
  target.royalLoginBoys = Boolean(req.body?.royalLoginBoys);
  target.royalLoginGirls = Boolean(req.body?.royalLoginGirls);
  addStateLog(
    'تعديل حاله',
    req.user!.username,
    target.username,
    target.verified ? 'توثيق العضوية' : 'إلغاء التوثيق',
    getClientIp(req)
  );
  saveState(state);
  emitLivePresenceAndRooms();
  emitCpUpdate();
  res.json({ user: toPublicUser(target) });
});

// Compact Reveal ("الكشف") + Same-IP linked accounts (matching original project's RevealList behavior)
app.get('/api/cp/reveal/:userId', requireCpAccess(), (req: AuthedRequest, res) => {
  const actorRank = req.userRank!;
  if (
    !hasPermission(actorRank, 'reveal_users') &&
    !hasPermission(actorRank, 'view_logs') &&
    !actorRank.isOwner
  ) {
    res.status(403).json({ error: 'لا تملك صلاحية الكشف' });
    return;
  }
  const target = state.users.find((u) => u.id === req.params.userId);
  if (!target) {
    res.status(404).json({ error: 'العضو غير موجود' });
    return;
  }

  const mapRevealMeta = (deviceStr: string): Pick<RevealLoginEntry, 'deviceType' | 'os' | 'browser'> => {
    const low = deviceStr.toLowerCase();
    const deviceType: RevealLoginEntry['deviceType'] = low.includes('ipad') || low.includes('tablet')
      ? 'tablet'
      : low.includes('iphone') || low.includes('android') || low.includes('mobile')
      ? 'mobile'
      : 'desktop';
    const os: RevealLoginEntry['os'] = low.includes('iphone') || low.includes('ipad') || low.includes('ios')
      ? 'ios'
      : low.includes('android')
      ? 'android'
      : low.includes('mac')
      ? 'mac'
      : low.includes('linux')
      ? 'linux'
      : 'windows';
    const browser: RevealLoginEntry['browser'] = low.includes('edg')
      ? 'edge'
      : low.includes('firefox')
      ? 'firefox'
      : low.includes('opr') || low.includes('opera')
      ? 'opera'
      : low.includes('safari') && !low.includes('chrome')
      ? 'safari'
      : low.includes('chrome')
      ? 'chrome'
      : 'other';
    return { deviceType, os, browser };
  };

  const userLogs = state.logs
    .filter((l) => l.username.toLowerCase() === target.username.toLowerCase())
    .slice(0, 12);

  const logins: RevealLoginEntry[] =
    userLogs.length > 0
      ? userLogs.map((l) => ({
          id: l.id,
          ip: l.ip,
          country: l.country || 'SA',
          createdAt: l.createdAt,
          ...mapRevealMeta(l.device || target.device),
        }))
      : [
          {
            id: `rev_${target.id}`,
            ip: target.ip || '127.0.0.1',
            country: target.country || 'SA',
            createdAt: target.lastSeen || target.createdAt,
            ...mapRevealMeta(target.device || ''),
          },
        ];

  const targetIps = new Set([target.ip, ...userLogs.map((l) => l.ip)].filter(Boolean));
  const linkedMap = new Map<string, RevealLinkedAccount>();

  for (const u of state.users) {
    if (u.id === target.id) continue;
    if (u.ip && targetIps.has(u.ip)) {
      linkedMap.set(u.id, {
        id: u.id,
        username: u.username,
        topic: u.topic,
        color: u.color,
        nameStyle: u.nameStyle,
        fontFamily: u.fontFamily,
        avatarUrl: u.avatarUrl,
        isGuest: u.isGuest,
        rankId: u.rankId,
        ip: u.ip,
      });
    }
  }

  for (const log of state.logs) {
    if (!targetIps.has(log.ip)) continue;
    if (log.username.toLowerCase() === target.username.toLowerCase()) continue;
    const matched = state.users.find(
      (u) => u.username.toLowerCase() === log.username.toLowerCase()
    );
    const key = matched ? matched.id : `log_${log.username}`;
    if (!linkedMap.has(key) && matched) {
      linkedMap.set(key, {
        id: matched.id,
        username: matched.username,
        topic: matched.topic,
        color: matched.color,
        nameStyle: matched.nameStyle,
        fontFamily: matched.fontFamily,
        avatarUrl: matched.avatarUrl,
        isGuest: matched.isGuest,
        rankId: matched.rankId,
        ip: log.ip,
      });
    }
  }

  const response: RevealResponse = {
    logins,
    linkedSameIp: Array.from(linkedMap.values()),
  };
  res.json(response);
});

app.get('/api/cp/users/:id/bans', requireCpAccess('ban_users'), (req: AuthedRequest, res) => {
  const target = state.users.find((u) => u.id === req.params.id);
  if (!target) {
    res.status(404).json({ error: 'العضو غير موجود' });
    return;
  }
  const now = Date.now();
  const activeBans = state.bans.filter(
    (b) =>
      (!b.expiresAt || b.expiresAt > now) &&
      (b.accountId === target.id ||
        (target.ip && b.ip === target.ip) ||
        (target.device && b.device === target.device))
  );
  res.json({ bans: activeBans });
});

app.post('/api/cp/users/:id/silence', requireCpAccess('ban_users'), (req: AuthedRequest, res) => {
  const actor = req.user!;
  const actorRank = req.userRank!;
  const target = state.users.find((u) => u.id === req.params.id);
  if (!target) {
    res.status(404).json({ error: 'العضو غير موجود' });
    return;
  }
  const actorLevel = effectiveRankLevel(actorRank);
  const targetLevel = effectiveRankLevel(findRank(target.rankId));
  if (!canManageTarget(actorLevel, targetLevel, target.id === actor.id)) {
    res.status(403).json({ error: 'لا يمكنك إسكات عضو برتبة أعلى أو مساوية لرتبتك' });
    return;
  }
  const minutes = Number(req.body?.minutes ?? 0);
  target.silencedUntil = minutes > 0 ? Date.now() + minutes * 60_000 : null;
  addStateLog(
    minutes > 0 ? 'إسكات' : 'فك الإسكات',
    actor.username,
    target.username,
    minutes > 0 ? `${minutes} دقيقة` : '',
    getClientIp(req)
  );
  saveState(state);
  emitLivePresenceAndRooms();
  emitCpUpdate();
  res.json({ user: toPublicUser(target) });
});

app.post('/api/cp/users/:id/update', requireCpAccess(), (req: AuthedRequest, res) => {
  const actor = req.user!;
  const actorRank = req.userRank!;
  const target = state.users.find((u) => u.id === req.params.id);
  if (!target) {
    res.status(404).json({ error: 'العضو غير موجود' });
    return;
  }

  const actorLevel = effectiveRankLevel(actorRank);
  const targetLevel = effectiveRankLevel(findRank(target.rankId));
  if (target.id !== actor.id && !canManageTarget(actorLevel, targetLevel, false)) {
    res.status(403).json({ error: 'لا يمكنك تعديل عضو برتبة أعلى أو مساوية لرتبتك' });
    return;
  }

  const { topic, username, likes, rankId, subscriptionDays, newPassword, silencedMinutes, clearAvatar } =
    req.body ?? {};

  const wantsMemberEdit =
    username !== undefined ||
    topic !== undefined ||
    likes !== undefined ||
    newPassword !== undefined ||
    clearAvatar !== undefined;
  if (wantsMemberEdit && !hasPermission(actorRank, 'manage_members')) {
    res.status(403).json({ error: 'لا تملك صلاحية تعديل بيانات الأعضاء' });
    return;
  }

  if (typeof username === 'string' && username.trim() && username.trim() !== target.username) {
    target.username = username.trim().slice(0, 24);
  }
  if (typeof topic === 'string' && topic.trim() && topic.trim() !== target.topic) {
    target.topic = topic.trim().slice(0, 36);
    addStateLog('تعديل زخرفة', actor.username, target.username, target.topic, getClientIp(req));
  }
  if (clearAvatar === true) {
    target.avatarUrl = null;
    addStateLog('حذف صورة العضو', actor.username, target.username, 'البروفايل', getClientIp(req));
  }
  if (typeof likes === 'number' && Number.isFinite(likes) && likes >= 0) {
    const diff = Math.floor(likes) - target.likes;
    target.likes = Math.floor(likes);
    addStateLog(
      `تعديل اعجابات [${diff >= 0 ? `+${diff}` : diff}]`,
      actor.username,
      target.username,
      'out room',
      getClientIp(req)
    );
  }
  if (typeof rankId === 'string' && rankId !== target.rankId) {
    if (!hasPermission(actorRank, 'manage_ranks')) {
      res.status(403).json({ error: 'لا تملك صلاحية تعديل الرتب' });
      return;
    }
    const nextRank = findRank(rankId);
    const nextLevel = effectiveRankLevel(nextRank);
    if (!actorRank.isOwner && nextLevel >= actorLevel) {
      res.status(403).json({ error: 'لا يمكنك منح رتبة مساوية أو أعلى من رتبتك' });
      return;
    }
    target.rankId = nextRank.id;
    target.color = nextRank.color;
    const daysNum = Number(subscriptionDays ?? 0);
    target.subscriptionGrantedAt = Date.now();
    target.subscriptionExpiresAt =
      daysNum > 0 ? Date.now() + daysNum * 86_400_000 : null;
    addStateLog(
      'ترقية',
      actor.username,
      `${target.username}[${nextRank.name}]`,
      nextRank.name,
      getClientIp(req)
    );
  }
  if (typeof newPassword === 'string' && newPassword.trim().length >= 3) {
    target.passwordHash = hashPassword(newPassword.trim());
    addStateLog('تغيير كلمة مرور', actor.username, target.username, 'لوحة التحكم', getClientIp(req));
  }
  if (typeof silencedMinutes === 'number') {
    if (!hasPermission(actorRank, 'ban_users')) {
      res.status(403).json({ error: 'لا تملك صلاحية الإسكات' });
      return;
    }
    target.silencedUntil =
      silencedMinutes > 0 ? Date.now() + silencedMinutes * 60_000 : null;
    addStateLog(
      silencedMinutes > 0 ? 'إسكات' : 'فك الإسكات',
      actor.username,
      target.username,
      silencedMinutes > 0 ? `${silencedMinutes} دقيقة` : '',
      getClientIp(req)
    );
  }

  saveState(state);
  emitLivePresenceAndRooms();
  emitCpUpdate();
  res.json({ user: toPublicUser(target) });
});

app.delete('/api/cp/users/:id', requireCpAccess('manage_members'), (req: AuthedRequest, res) => {
  const actor = req.user!;
  const actorRank = req.userRank!;
  const idx = state.users.findIndex((u) => u.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'العضو غير موجود' });
    return;
  }
  const target = state.users[idx]!;
  if (
    !canManageTarget(
      effectiveRankLevel(actorRank),
      effectiveRankLevel(findRank(target.rankId)),
      target.id === actor.id
    )
  ) {
    res.status(403).json({ error: 'لا يمكنك حذف هذا الحساب' });
    return;
  }

  state.users.splice(idx, 1);
  addStateLog('حذف عضوية', actor.username, target.username, 'لوحة التحكم', getClientIp(req));
  saveState(state);
  emitLivePresenceAndRooms();
  emitCpUpdate();
  res.json({ ok: true });
});

app.post('/api/cp/users/purge-preview', requireCpAccess('manage_members'), (req, res) => {
  const range = (req.body?.range ?? 'm:6') as PurgeRangeKey;
  const candidates = computeInactivePurgeCandidates(state.users, state.ranks, range);
  res.json({ count: candidates.length, usernames: candidates.map((u) => u.username) });
});

app.post('/api/cp/users/purge-execute', requireCpAccess('manage_members'), (req: AuthedRequest, res) => {
  const range = (req.body?.range ?? 'm:6') as PurgeRangeKey;
  const candidates = computeInactivePurgeCandidates(state.users, state.ranks, range);
  const removeIds = new Set(candidates.map((u) => u.id));
  state.users = state.users.filter((u) => !removeIds.has(u.id));
  addStateLog(
    'تنظيف العضويات الخاملة',
    req.user!.username,
    `${candidates.length} عضو`,
    range,
    getClientIp(req)
  );
  saveState(state);
  emitCpUpdate();
  res.json({ deletedCount: candidates.length });
});

// ---- BANS & SECURITY ALLOWLIST ----

app.post('/api/cp/bans', requireCpAccess('ban_users'), (req: AuthedRequest, res) => {
  const actor = req.user!;
  const { targetUserId, manualValue, reason, minutes } = req.body ?? {};
  const now = Date.now();
  const expiresAt = typeof minutes === 'number' && minutes > 0 ? now + minutes * 60_000 : null;

  let ban: BanRecord;
  if (targetUserId) {
    const target = state.users.find((u) => u.id === targetUserId);
    if (!target) {
      res.status(404).json({ error: 'العضو غير موجود' });
      return;
    }
    if (
      !canManageTarget(
        effectiveRankLevel(req.userRank),
        effectiveRankLevel(findRank(target.rankId)),
        target.id === actor.id
      )
    ) {
      res.status(403).json({ error: 'لا يمكنك حظر هذا العضو' });
      return;
    }
    target.online = false;
    ban = {
      id: `ban_${crypto.randomUUID().slice(0, 8)}`,
      targetName: target.username,
      bannedBy: actor.username,
      reason: String(reason ?? 'مخالفة القوانين'),
      device: target.device,
      ip: target.ip,
      accountId: target.id,
      country: target.country,
      expiresAt,
      createdAt: now,
    };
    addStateLog(
      expiresAt ? 'باند مؤقت' : 'حظر جهاز',
      actor.username,
      target.username,
      target.ip,
      getClientIp(req)
    );
  } else {
    const val = String(manualValue ?? '').trim();
    if (!val) {
      res.status(400).json({ error: 'أدخل قيمة الحظر (جهاز / آي بي / دولة / حساب)' });
      return;
    }
    const isIp = /^[0-9a-fA-F.:]+$/.test(val);
    const isCountry = /^[A-Za-z]{2}$/.test(val);
    ban = {
      id: `ban_${crypto.randomUUID().slice(0, 8)}`,
      targetName: val,
      bannedBy: actor.username,
      reason: String(reason ?? 'حظر يدوي'),
      device: !isIp && !isCountry && val.includes('|') ? val : '',
      ip: isIp ? val : '',
      accountId: !isIp && !isCountry && !val.includes('|') ? val : '',
      country: isCountry ? val.toUpperCase() : '',
      expiresAt,
      createdAt: now,
    };
    addStateLog(isIp ? 'حظر اي بي' : 'حظر يدوي', actor.username, val, val, getClientIp(req));
  }

  state.bans.unshift(ban);
  saveState(state);
  emitLivePresenceAndRooms();
  emitCpUpdate();
  res.json({ ban });
});

app.post('/api/cp/bans/:id/unban', requireCpAccess('ban_users'), (req: AuthedRequest, res) => {
  const idx = state.bans.findIndex((b) => b.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'السجل غير موجود' });
    return;
  }
  const [removed] = state.bans.splice(idx, 1);
  addStateLog('فك الحظر', req.user!.username, removed!.targetName, removed!.ip || removed!.device, getClientIp(req));
  saveState(state);
  emitCpUpdate();
  res.json({ ok: true });
});

app.post('/api/cp/bans/clear-all', requireCpAccess('ban_users'), (req: AuthedRequest, res) => {
  const count = state.bans.length;
  state.bans = [];
  addStateLog('فك جميع المحظورين', req.user!.username, `${count} محظور`, 'الكل', getClientIp(req));
  saveState(state);
  emitCpUpdate();
  res.json({ cleared: count });
});

app.post('/api/cp/security-allow', requireCpAccess('ban_users'), (req: AuthedRequest, res) => {
  const { allowedBrowsers, allowedOs, blockEmptyFp, blockInvalidFp, blockSuspectFp } =
    req.body ?? {};
  if (Array.isArray(allowedBrowsers)) state.securityAllow.allowedBrowsers = allowedBrowsers;
  if (Array.isArray(allowedOs)) state.securityAllow.allowedOs = allowedOs;
  if (typeof blockEmptyFp === 'boolean') state.securityAllow.blockEmptyFp = blockEmptyFp;
  if (typeof blockInvalidFp === 'boolean') state.securityAllow.blockInvalidFp = blockInvalidFp;
  if (typeof blockSuspectFp === 'boolean') state.securityAllow.blockSuspectFp = blockSuspectFp;

  addStateLog('تحديث حماية المتصفحات والبصمات', req.user!.username, 'الأمان', 'الحظر', getClientIp(req));
  saveState(state);
  emitCpUpdate();
  res.json({ securityAllow: state.securityAllow });
});

// ---- RANKS / POWERS ----

app.post('/api/cp/ranks', requireCpAccess('manage_ranks'), (req: AuthedRequest, res) => {
  const { id, name, level, icon, color, permissions, isLocked } = req.body ?? {};
  const cleanName = String(name ?? '').trim();
  if (cleanName.length < 2) {
    res.status(400).json({ error: 'اسم الصلاحية يجب أن يكون حرفين على الأقل' });
    return;
  }

  if (id) {
    const existing = state.ranks.find((r) => r.id === id);
    if (!existing) {
      res.status(404).json({ error: 'الرتبة غير موجودة' });
      return;
    }
    if (existing.isLocked && !req.userRank?.isOwner && typeof isLocked !== 'boolean') {
      res.status(403).json({ error: 'هذه الصلاحية مقفلة' });
      return;
    }
    existing.name = cleanName;
    if (!existing.isOwner && typeof level === 'number') {
      existing.level = Math.min(999, Math.max(0, Math.floor(level)));
    }
    if (icon) existing.icon = icon;
    if (color) existing.color = color;
    if (Array.isArray(permissions)) existing.permissions = permissions;
    if (typeof isLocked === 'boolean' && req.userRank?.isOwner) {
      existing.isLocked = isLocked;
    }
    addStateLog('تعديل صلاحية', req.user!.username, existing.name, `المستوى ${existing.level}`, getClientIp(req));
    saveState(state);
    emitLivePresenceAndRooms();
    emitCpUpdate();
    res.json({ rank: existing });
    return;
  }

  const created: RankRole = {
    id: `rank_${crypto.randomUUID().slice(0, 6)}`,
    name: cleanName,
    level: Math.min(999, Math.max(1, Number(level ?? 150))),
    isOwner: false,
    isLocked: Boolean(isLocked),
    icon: icon ?? 'shield',
    color: color ?? '#38bdf8',
    permissions: Array.isArray(permissions) ? permissions : ['access_cp'],
    createdAt: Date.now(),
  };
  state.ranks.push(created);
  addStateLog('إنشاء صلاحية', req.user!.username, created.name, `المستوى ${created.level}`, getClientIp(req));
  saveState(state);
  emitCpUpdate();
  res.json({ rank: created });
});

app.delete('/api/cp/ranks/:id', requireCpAccess('manage_ranks'), (req: AuthedRequest, res) => {
  const rank = state.ranks.find((r) => r.id === req.params.id);
  if (!rank) {
    res.status(404).json({ error: 'الصلاحية غير موجودة' });
    return;
  }
  if (rank.isOwner || rank.id === 'rank_member' || rank.id === 'rank_guest') {
    res.status(403).json({ error: 'لا يمكن حذف هذه الرتبة الأساسية' });
    return;
  }
  if (rank.isLocked && !req.userRank?.isOwner) {
    res.status(403).json({ error: 'الصلاحية مقفلة' });
    return;
  }
  state.ranks = state.ranks.filter((r) => r.id !== rank.id);
  for (const u of state.users) {
    if (u.rankId === rank.id) u.rankId = 'rank_member';
  }
  addStateLog('حذف صلاحية', req.user!.username, rank.name, '', getClientIp(req));
  saveState(state);
  emitLivePresenceAndRooms();
  emitCpUpdate();
  res.json({ ok: true });
});

// ---- ROOMS MANAGEMENT ----

app.post('/api/cp/rooms', requireCpAccess('manage_rooms'), (req: AuthedRequest, res) => {
  const {
    id,
    name,
    description,
    welcomeMessage,
    imageUrl,
    requiredLikes,
    password,
    maxCapacity,
    maxMics,
    isPinned,
    micEnabled,
    bannerEnabled,
    liveBroadcast,
    unbanAll,
    unbanUserId,
  } = req.body ?? {};

  const cleanName = String(name ?? '').trim();
  if (cleanName.length < 2) {
    res.status(400).json({ error: 'عنوان الغرفة مطلوب' });
    return;
  }

  const nextMics = Math.min(5, Math.max(0, Number(maxMics ?? 5)));
  const nextCap = Math.min(200, Math.max(1, Number(maxCapacity ?? 100)));

  if (id) {
    const room = state.rooms.find((r) => r.id === id);
    if (!room) {
      res.status(404).json({ error: 'الغرفة غير موجودة' });
      return;
    }
    room.name = cleanName;
    room.description = String(description ?? '');
    room.welcomeMessage = String(welcomeMessage ?? '');
    room.imageUrl = imageUrl === undefined ? room.imageUrl : imageUrl;
    room.requiredLikes = Math.max(0, Number(requiredLikes ?? 0));
    room.password = String(password ?? '');
    room.maxCapacity = nextCap;
    if (room.maxMics !== nextMics) {
      room.maxMics = nextMics;
      const oldSeats = room.seats;
      room.seats = Array.from({ length: nextMics }, (_, i) => {
        const prev = oldSeats.find((s) => s.seat === i + 1);
        return (
          prev ?? {
            seat: i + 1,
            userId: null,
            muted: false,
            forceMuted: false,
            joinedAt: null,
          }
        );
      });
    }
    room.isPinned = Boolean(isPinned);
    room.micEnabled = Boolean(micEnabled);
    room.bannerEnabled = Boolean(bannerEnabled);
    room.liveBroadcast = Boolean(liveBroadcast);
    if (unbanAll) room.bannedUserIds = [];
    if (unbanUserId) room.bannedUserIds = room.bannedUserIds.filter((uid) => uid !== unbanUserId);

    addStateLog('تعديل غرفة', req.user!.username, room.ownerName, room.name, getClientIp(req));
    saveState(state);
    emitLivePresenceAndRooms();
    emitCpUpdate();
    res.json({ room });
    return;
  }

  const room: Room = {
    id: `room_${crypto.randomUUID().slice(0, 8)}`,
    name: cleanName,
    description: String(description ?? ''),
    welcomeMessage: String(welcomeMessage ?? ''),
    imageUrl: imageUrl ?? null,
    requiredLikes: Math.max(0, Number(requiredLikes ?? 0)),
    password: String(password ?? ''),
    maxCapacity: nextCap,
    maxMics: nextMics,
    isPinned: Boolean(isPinned),
    isPublicDefault: false,
    micEnabled: micEnabled !== false,
    bannerEnabled: Boolean(bannerEnabled),
    liveBroadcast: Boolean(liveBroadcast),
    ownerId: req.user!.id,
    ownerName: req.user!.username,
    operators: [req.user!.id],
    bannedUserIds: [],
    seats: createDefaultSeats(nextMics),
    createdAt: Date.now(),
  };
  state.rooms.push(room);
  addStateLog('إنشاء غرفة', req.user!.username, req.user!.username, room.name, getClientIp(req));
  saveState(state);
  emitLivePresenceAndRooms();
  emitCpUpdate();
  res.json({ room });
});

app.delete('/api/cp/rooms/:id', requireCpAccess('manage_rooms'), (req: AuthedRequest, res) => {
  const room = state.rooms.find((r) => r.id === req.params.id);
  if (!room) {
    res.status(404).json({ error: 'الغرفة غير موجودة' });
    return;
  }
  if (room.isPublicDefault) {
    res.status(403).json({ error: 'لا يمكن حذف الروم العام الأساسي' });
    return;
  }
  state.rooms = state.rooms.filter((r) => r.id !== room.id);
  for (const u of state.users) {
    if (u.roomId === room.id) u.roomId = 'room_general';
  }
  addStateLog('حذف غرفة', req.user!.username, room.ownerName, room.name, getClientIp(req));
  saveState(state);
  emitLivePresenceAndRooms();
  emitCpUpdate();
  res.json({ ok: true });
});

// ---- SHORTCUTS, FILTERS, MESSAGES, SYMBOLS, DOMAINS, FRONT, SETTINGS ----

app.post('/api/cp/shortcuts', requireCpAccess('manage_shortcuts'), (req: AuthedRequest, res) => {
  const trigger = String(req.body?.trigger ?? '').trim();
  const expansion = String(req.body?.expansion ?? '').trim();
  if (!trigger || !expansion) {
    res.status(400).json({ error: 'أدخل الإختصار والزخرفة' });
    return;
  }
  const item = { id: `sc_${crypto.randomUUID().slice(0, 6)}`, trigger, expansion };
  state.shortcuts.unshift(item);
  addStateLog('إضافة إختصار', req.user!.username, trigger, expansion, getClientIp(req));
  saveState(state);
  broadcastAll('shortcuts:update', state.shortcuts);
  emitCpUpdate();
  res.json({ item });
});

app.delete('/api/cp/shortcuts/:id', requireCpAccess('manage_shortcuts'), (req: AuthedRequest, res) => {
  state.shortcuts = state.shortcuts.filter((s) => s.id !== req.params.id);
  saveState(state);
  broadcastAll('shortcuts:update', state.shortcuts);
  emitCpUpdate();
  res.json({ ok: true });
});

app.post('/api/cp/filters', requireCpAccess('manage_filter'), (req: AuthedRequest, res) => {
  const category = String(req.body?.category ?? 'blocked') as FilterCategory;
  const word = String(req.body?.word ?? '').trim();
  if (!word) {
    res.status(400).json({ error: 'أدخل الكلمة أو الرابط' });
    return;
  }
  const rule = {
    id: `flt_${crypto.randomUUID().slice(0, 6)}`,
    category,
    word,
    createdAt: Date.now(),
  };
  state.filters.unshift(rule);
  addStateLog('إضافة فلتر', req.user!.username, word, category, getClientIp(req));
  saveState(state);
  emitCpUpdate();
  res.json({ rule });
});

app.delete('/api/cp/filters/:id', requireCpAccess('manage_filter'), (req: AuthedRequest, res) => {
  const existing = state.filters.find((f) => f.id === req.params.id);
  state.filters = state.filters.filter((f) => f.id !== req.params.id);
  if (existing) {
    addStateLog('حذف الفلتر', req.user!.username, existing.word, existing.category, getClientIp(req));
  }
  saveState(state);
  emitCpUpdate();
  res.json({ ok: true });
});

app.post('/api/cp/auto-messages', requireCpAccess('manage_messages'), (req: AuthedRequest, res) => {
  const type = (req.body?.type === 'daily' ? 'daily' : 'welcome') as 'welcome' | 'daily';
  const title = String(req.body?.title ?? '').trim();
  const body = String(req.body?.body ?? '').trim().slice(0, 250);
  if (!title || !body) {
    res.status(400).json({ error: 'أدخل عنوان الرسالة ونصها' });
    return;
  }
  const item = {
    id: `am_${crypto.randomUUID().slice(0, 6)}`,
    type,
    title,
    body,
    createdAt: Date.now(),
  };
  state.autoMessages.unshift(item);
  addStateLog(
    type === 'welcome' ? 'إضافة رسالة ترحيب' : 'إضافة رسالة يومية',
    req.user!.username,
    title,
    body.slice(0, 40),
    getClientIp(req)
  );
  saveState(state);
  emitCpUpdate();
  res.json({ item });
});

app.delete('/api/cp/auto-messages/:id', requireCpAccess('manage_messages'), (req, res) => {
  state.autoMessages = state.autoMessages.filter((m) => m.id !== req.params.id);
  saveState(state);
  emitCpUpdate();
  res.json({ ok: true });
});

app.post('/api/cp/symbols', requireCpAccess('manage_symbols'), (req, res) => {
  const code = String(req.body?.code ?? '').trim();
  const glyph = String(req.body?.glyph ?? '').trim();
  const label = String(req.body?.label ?? '').trim();
  const category = req.body?.category ?? 'emoji';
  if (!glyph || !label) {
    res.status(400).json({ error: 'أدخل الرمز والاسم' });
    return;
  }
  const item = {
    id: `sym_${crypto.randomUUID().slice(0, 6)}`,
    code: code || `:${label}:`,
    glyph,
    label,
    category,
  };
  state.symbols.unshift(item);
  saveState(state);
  broadcastAll('symbols:update', state.symbols);
  emitCpUpdate();
  res.json({ item });
});

app.delete('/api/cp/symbols/:id', requireCpAccess('manage_symbols'), (req, res) => {
  state.symbols = state.symbols.filter((s) => s.id !== req.params.id);
  saveState(state);
  broadcastAll('symbols:update', state.symbols);
  emitCpUpdate();
  res.json({ ok: true });
});

app.post('/api/cp/domains', requireCpAccess('manage_domains'), (req, res) => {
  const domain = String(req.body?.domain ?? '').trim();
  const role = req.body?.role ?? 'mirror';
  const notes = String(req.body?.notes ?? '').trim();
  if (!domain) {
    res.status(400).json({ error: 'أدخل اسم النطاق' });
    return;
  }
  const item = {
    id: `dom_${crypto.randomUUID().slice(0, 6)}`,
    domain,
    role,
    active: true,
    notes,
  };
  state.domains.push(item);
  saveState(state);
  emitCpUpdate();
  res.json({ item });
});

app.delete('/api/cp/domains/:id', requireCpAccess('manage_domains'), (req, res) => {
  state.domains = state.domains.filter((d) => d.id !== req.params.id);
  saveState(state);
  emitCpUpdate();
  res.json({ ok: true });
});

app.post('/api/cp/front', requireCpAccess('manage_front'), (req: AuthedRequest, res) => {
  state.front = { ...state.front, ...(req.body ?? {}) };
  addStateLog('تعديل الواجهة', req.user!.username, state.front.siteName, 'الواجهة', getClientIp(req));
  saveState(state);
  broadcastAll('front:update', state.front);
  emitCpUpdate();
  res.json({ front: state.front });
});

app.post('/api/cp/site-settings', requireCpAccess('manage_site_settings'), (req: AuthedRequest, res) => {
  const merged = { ...state.siteSettings, ...(req.body ?? {}) };
  const validation = validateSiteSettings(merged);
  if (!validation.valid) {
    res.status(400).json({ error: 'تحقق من القيم المدخلة', errors: validation.errors });
    return;
  }
  state.siteSettings = merged;
  addStateLog('تعديل ادارة الموقع', req.user!.username, 'الإعدادات العامة', 'حفظ', getClientIp(req));
  saveState(state);
  broadcastAll('settings:update', state.siteSettings);
  emitCpUpdate();
  res.json({ siteSettings: state.siteSettings });
});

// ======================== VITE / STATIC ENTRY ========================

async function hydrateUserCountriesFromIp(): Promise<void> {
  let changed = false;
  await Promise.all(
    state.users.map(async (u) => {
      if (!u.ip) return;
      const resolved = await resolveCountryFromIp(u.ip, u.country);
      if (resolved && resolved !== u.country) {
        u.country = resolved;
        changed = true;
      }
    })
  );
  if (changed) {
    saveState(state);
    emitLivePresenceAndRooms();
  }
}

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Majlis Mic Circle + Control Panel running on http://0.0.0.0:${PORT}`);
    void hydrateUserCountriesFromIp();
  });
}

void startServer();
