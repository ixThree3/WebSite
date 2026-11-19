import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  BootstrapResponse,
  ChatMessage,
  CpPayload,
  FrontSettings,
  NotificationItem,
  PrivateMessage,
  PublicUser,
  RankRole,
  Room,
  ShortcutItem,
  SiteSettings,
  SymbolItem,
  WallPost,
} from '../shared/types.ts';
import {
  DEFAULT_FRONT_SETTINGS,
  DEFAULT_RANKS,
  DEFAULT_SITE_SETTINGS,
} from '../shared/defaults.ts';
import {
  apiFetch,
  getLocallyMutedUserIds,
  getSavedAccounts,
  getStoredSessionToken,
  removeSavedAccount,
  setLocallyMutedUserIds as saveLocallyMutedUserIds,
  setStoredSessionToken,
  upsertSavedAccount,
  type SavedAccountEntry,
} from './device.ts';
import { normalizeSafeHttpUrl } from '../shared/richText.ts';

export type MainViewMode = 'rooms' | 'wall' | 'pm' | 'cp';
export type ActiveDrawer = 'none' | 'rooms' | 'members';

export interface ToastNotice {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'error';
}

interface ChatContextValue {
  loading: boolean;
  me: PublicUser | null;
  myRank: RankRole | null;
  canAccessCp: boolean;
  isLocalOwnerDevice: boolean;
  ranks: RankRole[];
  rooms: Room[];
  activeRoomId: string;
  activeRoom: Room | null;
  onlineUsers: PublicUser[];
  messagesByRoom: Record<string, ChatMessage[]>;
  wallPosts: WallPost[];
  shortcuts: ShortcutItem[];
  symbols: SymbolItem[];
  front: FrontSettings;
  siteSettings: SiteSettings;
  privateMessages: PrivateMessage[];
  notifications: NotificationItem[];
  unreadNotificationCount: number;
  markNotificationsRead: (id?: string) => Promise<void>;
  savedAccounts: SavedAccountEntry[];
  quickLogin: (quickLoginToken: string) => Promise<void>;
  deleteSavedAccount: (quickLoginToken: string) => Promise<void>;
  viewMode: MainViewMode;
  setViewMode: (mode: MainViewMode) => void;
  activeDrawer: ActiveDrawer;
  setActiveDrawer: (drawer: ActiveDrawer) => void;
  selectedPmUserId: string | null;
  openPrivateChatWith: (userId: string) => void;
  profileModalUserId: string | null;
  openMemberProfile: (userId: string | null) => void;
  pendingExternalUrl: string | null;
  openExternalLink: (url: string) => void;
  closeExternalLink: () => void;
  toasts: ToastNotice[];
  notify: (message: string, tone?: ToastNotice['tone']) => void;
  // Mic / Audio state
  speakingUserIds: Set<string>;
  locallyMutedUserIds: Set<string>;
  toggleLocalMute: (userId: string, displayName?: string) => void;
  micBusy: boolean;
  joinMic: (roomId: string, seat: number) => Promise<void>;
  leaveMic: (roomId: string) => Promise<void>;
  toggleMicMute: (roomId: string, seat: number) => Promise<void>;
  adminMicAction: (roomId: string, seat: number, action: 'admin_kick' | 'admin_force_mute') => Promise<void>;
  // Auth & Actions
  refreshBootstrap: () => Promise<void>;
  registerAccount: (username: string, password: string, topic?: string) => Promise<void>;
  loginAccount: (username: string, password: string) => Promise<void>;
  loginGuest: (username: string) => Promise<void>;
  logout: () => Promise<void>;
  joinRoom: (roomId: string, password?: string) => Promise<void>;
  createRoom: (payload: {
    name: string;
    description: string;
    password?: string;
    maxMics?: number;
  }) => Promise<Room>;
  sendRoomMessage: (
    roomId: string,
    body: string,
    options?: { mediaUrl?: string; replyTo?: { id: string; username: string; body: string } | null }
  ) => Promise<void>;
  deleteRoomMessage: (roomId: string, msgId: string) => Promise<void>;
  likeUser: (userId: string) => Promise<void>;
  updateMyProfile: (patch: {
    topic?: string;
    status?: string;
    color?: string;
    nameStyle?: string;
    fontFamily?: string;
    avatarUrl?: string | null;
    hideCountryFlag?: boolean;
    newPassword?: string;
  }) => Promise<void>;
  createWallPost: (body: string, mediaUrl?: string | null) => Promise<void>;
  toggleWallLike: (postId: string) => Promise<void>;
  commentWallPost: (
    postId: string,
    body: string,
    replyTo?: { id: string; username: string; body: string } | null
  ) => Promise<void>;
  toggleWallCommentLike: (postId: string, commentId: string) => Promise<void>;
  deleteWallPost: (postId: string) => Promise<void>;
  sendPrivateMessage: (toUserId: string, body: string) => Promise<void>;
  cpVersion: number;
  fetchCpState: () => Promise<CpPayload>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<PublicUser | null>(null);
  const [myRank, setMyRank] = useState<RankRole | null>(null);
  const [canAccessCp, setCanAccessCp] = useState(false);
  const [isLocalOwnerDevice, setIsLocalOwnerDevice] = useState(true);
  const [ranks, setRanks] = useState<RankRole[]>(DEFAULT_RANKS);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState('room_general');
  const [onlineUsers, setOnlineUsers] = useState<PublicUser[]>([]);
  const [messagesByRoom, setMessagesByRoom] = useState<Record<string, ChatMessage[]>>({});
  const [wallPosts, setWallPosts] = useState<WallPost[]>([]);
  const [shortcuts, setShortcuts] = useState<ShortcutItem[]>([]);
  const [symbols, setSymbols] = useState<SymbolItem[]>([]);
  const [front, setFront] = useState<FrontSettings>(DEFAULT_FRONT_SETTINGS);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [privateMessages, setPrivateMessages] = useState<PrivateMessage[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccountEntry[]>(() => getSavedAccounts());
  const [viewMode, setViewMode] = useState<MainViewMode>('rooms');
  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>('none');
  const [selectedPmUserId, setSelectedPmUserId] = useState<string | null>(null);
  const [profileModalUserId, setProfileModalUserId] = useState<string | null>(null);
  const [pendingExternalUrl, setPendingExternalUrl] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastNotice[]>([]);
  const [cpVersion, setCpVersion] = useState(0);
  const [micBusy, setMicBusy] = useState(false);
  const [speakingUserIds, setSpeakingUserIds] = useState<Set<string>>(new Set());
  const [locallyMutedUserIds, setLocallyMutedUserIds] = useState<Set<string>>(
    () => new Set(getLocallyMutedUserIds())
  );

  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeRoomIdRef = useRef(activeRoomId);
  activeRoomIdRef.current = activeRoomId;

  const notify = useCallback((message: string, tone: ToastNotice['tone'] = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const openExternalLink = useCallback(
    (rawUrl: string) => {
      const safe = normalizeSafeHttpUrl(rawUrl);
      if (!safe) {
        notify('هذا الرابط غير صالح أو غير آمن للفتح', 'error');
        return;
      }
      setPendingExternalUrl(safe.href);
    },
    [notify]
  );

  const closeExternalLink = useCallback(() => {
    setPendingExternalUrl(null);
  }, []);

  const stopAudioCapture = useCallback(() => {
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        track.stop();
      }
      localStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setSpeakingUserIds((prev) => {
      if (!me) return prev;
      const next = new Set(prev);
      next.delete(me.id);
      return next;
    });
  }, [me]);

  const startAudioMonitor = useCallback(
    async (userId: string) => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) return;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (!localStreamRef.current) return;
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i]!;
          const avg = sum / data.length;
          const isSpeaking = avg > 14;
          setSpeakingUserIds((prev) => {
            const has = prev.has(userId);
            if (has === isSpeaking) return prev;
            const next = new Set(prev);
            if (isSpeaking) next.add(userId);
            else next.delete(userId);
            return next;
          });
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      } catch {
        // Microphone denied or headless browser — seat still functions in UI
      }
    },
    []
  );

  const refreshBootstrap = useCallback(async () => {
    try {
      const data = await apiFetch<BootstrapResponse>('/api/bootstrap');
      setMe(data.me);
      setMyRank(data.myRank);
      setCanAccessCp(data.canAccessCp);
      setIsLocalOwnerDevice(data.isLocalOwnerDevice);
      setRanks(data.ranks);
      setRooms(data.rooms);
      setOnlineUsers(data.onlineUsers);
      setWallPosts(data.wallPosts);
      setShortcuts(data.shortcuts);
      setSymbols(data.symbols);
      setFront(data.front);
      setSiteSettings(data.siteSettings);
      setPrivateMessages(data.privateMessages);
      setNotifications(data.notifications ?? []);

      if (data.me) {
        const roomToLoad = data.me.roomId || data.rooms[0]?.id || 'room_general';
        setActiveRoomId(roomToLoad);
        const msgRes = await apiFetch<{ messages: ChatMessage[] }>(
          `/api/rooms/${roomToLoad}/messages`
        ).catch(() => ({ messages: [] }));
        setMessagesByRoom((prev) => ({ ...prev, [roomToLoad]: msgRes.messages }));
      }
    } catch {
      setStoredSessionToken(null);
      setMe(null);
      setMyRank(null);
      setCanAccessCp(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshBootstrap();
  }, [refreshBootstrap]);

  // WebSocket live sync with resilient auto-reconnect & mobile screen-unlock activity heartbeat
  useEffect(() => {
    let closedByCleanup = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

    const connectWs = () => {
      if (closedByCleanup) return;
      const token = getStoredSessionToken();
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        const t = getStoredSessionToken();
        if (t) {
          ws.send(JSON.stringify({ event: 'auth', token: t }));
        }
      };

      ws.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(String(ev.data)) as { event: string; payload: unknown };
          switch (parsed.event) {
            case 'rooms:update':
              setRooms(parsed.payload as Room[]);
              break;
            case 'presence:update': {
              const list = parsed.payload as PublicUser[];
              setOnlineUsers(list);
              setMe((prev) => {
                if (!prev) return prev;
                const updated = list.find((u) => u.id === prev.id);
                return updated ?? prev;
              });
              break;
            }
            case 'chat:message': {
              const msg = parsed.payload as ChatMessage;
              setMessagesByRoom((prev) => ({
                ...prev,
                [msg.roomId]: [...(prev[msg.roomId] ?? []), msg].slice(-120),
              }));
              break;
            }
            case 'chat:delete': {
              const del = parsed.payload as { id: string; roomId: string };
              setMessagesByRoom((prev) => ({
                ...prev,
                [del.roomId]: (prev[del.roomId] ?? []).filter((m) => m.id !== del.id),
              }));
              break;
            }
            case 'wall:update':
              setWallPosts(parsed.payload as WallPost[]);
              break;
            case 'pm:new': {
              const pm = parsed.payload as PrivateMessage;
              setPrivateMessages((prev) =>
                prev.some((x) => x.id === pm.id) ? prev : [...prev, pm]
              );
              break;
            }
            case 'notification:new': {
              const ntf = parsed.payload as NotificationItem;
              setNotifications((prev) =>
                prev.some((x) => x.id === ntf.id) ? prev : [ntf, ...prev].slice(0, 60)
              );
              const label =
                ntf.kind === 'profile_like'
                  ? `أعجب ${ntf.actorName} بملفك الشخصي`
                  : ntf.kind === 'post_like'
                  ? `أعجب ${ntf.actorName} بمنشورك في الحائط`
                  : ntf.kind === 'comment_like'
                  ? `أعجب ${ntf.actorName} بتعليقك في الحائط`
                  : ntf.kind === 'comment_reply'
                  ? `ردّ ${ntf.actorName} على تعليقك في الحائط`
                  : `علّق ${ntf.actorName} على منشورك في الحائط`;
              notify(label, 'info');
              break;
            }
            case 'shortcuts:update':
              setShortcuts(parsed.payload as ShortcutItem[]);
              break;
            case 'symbols:update':
              setSymbols(parsed.payload as SymbolItem[]);
              break;
            case 'front:update':
              setFront(parsed.payload as FrontSettings);
              break;
            case 'settings:update':
              setSiteSettings(parsed.payload as SiteSettings);
              break;
            case 'cp:invalidate':
              setCpVersion((v) => v + 1);
              void refreshBootstrap();
              break;
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        if (!closedByCleanup) {
          reconnectTimer = setTimeout(connectWs, 2500);
        }
      };
    };

    connectWs();

    const pingActivity = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ event: 'activity' }));
      } else if (!closedByCleanup && getStoredSessionToken()) {
        connectWs();
      }
    };

    const onVisibleOrFocus = () => {
      if (document.visibilityState === 'visible') {
        pingActivity();
      }
    };

    heartbeatTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        pingActivity();
      }
    }, 45_000);

    document.addEventListener('visibilitychange', onVisibleOrFocus);
    window.addEventListener('online', pingActivity);

    return () => {
      closedByCleanup = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      document.removeEventListener('visibilitychange', onVisibleOrFocus);
      window.removeEventListener('online', pingActivity);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [me?.id, notify, refreshBootstrap]);

  const rememberUser = useCallback((user: PublicUser, quickLoginToken?: string) => {
    if (user.isGuest || !quickLoginToken) return;
    const next = upsertSavedAccount({
      userId: user.id,
      username: user.username,
      topic: user.topic,
      color: user.color,
      nameStyle: user.nameStyle,
      fontFamily: user.fontFamily,
      avatarUrl: user.avatarUrl,
      rankId: user.rankId,
      quickLoginToken,
      savedAt: Date.now(),
    });
    setSavedAccounts(next);
  }, []);

  const registerAccount = useCallback(
    async (username: string, password: string, topic?: string) => {
      const res = await apiFetch<{
        token: string;
        quickLoginToken?: string;
        user: PublicUser;
        rank: RankRole;
        canAccessCp: boolean;
        isLocalOwnerDevice: boolean;
      }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password, topic }),
      });
      setStoredSessionToken(res.token);
      rememberUser(res.user, res.quickLoginToken);
      setMe(res.user);
      setMyRank(res.rank);
      setCanAccessCp(res.canAccessCp);
      setIsLocalOwnerDevice(res.isLocalOwnerDevice);
      setViewMode('rooms');
      await refreshBootstrap();
      notify(
        res.rank.isOwner
          ? `مرحباً ${res.user.username} — تم منحك ترقية المالك تلقائياً على هذا الجهاز`
          : `أهلاً بك ${res.user.username} في شات الخليج`,
        'success'
      );
    },
    [notify, refreshBootstrap, rememberUser]
  );

  const loginAccount = useCallback(
    async (username: string, password: string) => {
      const res = await apiFetch<{
        token: string;
        quickLoginToken?: string;
        user: PublicUser;
        rank: RankRole;
        canAccessCp: boolean;
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setStoredSessionToken(res.token);
      rememberUser(res.user, res.quickLoginToken);
      setMe(res.user);
      setMyRank(res.rank);
      setCanAccessCp(res.canAccessCp);
      setViewMode('rooms');
      await refreshBootstrap();
      notify(`تم تسجيل الدخول كـ ${res.user.username}`, 'success');
    },
    [notify, refreshBootstrap, rememberUser]
  );

  const quickLogin = useCallback(
    async (quickLoginToken: string) => {
      try {
        const res = await apiFetch<{
          token: string;
          quickLoginToken?: string;
          user: PublicUser;
          rank: RankRole;
          canAccessCp: boolean;
        }>('/api/auth/quick-login', {
          method: 'POST',
          body: JSON.stringify({ quickLoginToken }),
        });
        setStoredSessionToken(res.token);
        rememberUser(res.user, res.quickLoginToken ?? quickLoginToken);
        setMe(res.user);
        setMyRank(res.rank);
        setCanAccessCp(res.canAccessCp);
        setViewMode('rooms');
        await refreshBootstrap();
        notify(`تم تسجيل الدخول السريع كـ ${res.user.username}`, 'success');
      } catch (err) {
        const status = (err as Error & { status?: number }).status;
        if (status === 401 || status === 404) {
          setSavedAccounts(removeSavedAccount(quickLoginToken));
        }
        throw err;
      }
    },
    [notify, refreshBootstrap, rememberUser]
  );

  const deleteSavedAccount = useCallback(async (quickLoginToken: string) => {
    setSavedAccounts(removeSavedAccount(quickLoginToken));
    await apiFetch('/api/auth/quick-login', {
      method: 'DELETE',
      body: JSON.stringify({ quickLoginToken }),
    }).catch(() => {});
  }, []);

  const loginGuest = useCallback(
    async (username: string) => {
      const res = await apiFetch<{
        token: string;
        user: PublicUser;
        rank: RankRole;
        canAccessCp: boolean;
      }>('/api/auth/guest', {
        method: 'POST',
        body: JSON.stringify({ username }),
      });
      setStoredSessionToken(res.token);
      setMe(res.user);
      setMyRank(res.rank);
      setCanAccessCp(false);
      setViewMode('rooms');
      await refreshBootstrap();
      notify(`أهلاً بك كزائر: ${res.user.username}`, 'success');
    },
    [notify, refreshBootstrap]
  );

  const logout = useCallback(async () => {
    stopAudioCapture();
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setStoredSessionToken(null);
    setMe(null);
    setMyRank(null);
    setCanAccessCp(false);
    setNotifications([]);
    setViewMode('rooms');
    notify('تم تسجيل الخروج (تم حفظ حسابك للدخول السريع)', 'info');
  }, [notify, stopAudioCapture]);

  const joinRoom = useCallback(
    async (roomId: string, password?: string) => {
      const res = await apiFetch<{ room: Room; messages: ChatMessage[] }>(
        `/api/rooms/${roomId}/join`,
        {
          method: 'POST',
          body: JSON.stringify({ password }),
        }
      );
      setActiveRoomId(roomId);
      setMessagesByRoom((prev) => ({ ...prev, [roomId]: res.messages }));
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ event: 'room:watch', roomId }));
      }
      setViewMode('rooms');
    },
    []
  );

  const createRoom = useCallback(
    async (payload: { name: string; description: string; password?: string; maxMics?: number }) => {
      const res = await apiFetch<{ room: Room }>('/api/rooms', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await joinRoom(res.room.id, payload.password);
      notify(`تم إنشاء غرفة "${res.room.name}"`, 'success');
      return res.room;
    },
    [joinRoom, notify]
  );

  const sendRoomMessage = useCallback(
    async (
      roomId: string,
      body: string,
      options?: { mediaUrl?: string; replyTo?: { id: string; username: string; body: string } | null }
    ) => {
      const res = await apiFetch<{ message: ChatMessage }>(`/api/rooms/${roomId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body, mediaUrl: options?.mediaUrl, replyTo: options?.replyTo }),
      });
      setMessagesByRoom((prev) => {
        const list = prev[roomId] ?? [];
        if (list.some((m) => m.id === res.message.id)) return prev;
        return { ...prev, [roomId]: [...list, res.message] };
      });
    },
    []
  );

  const deleteRoomMessage = useCallback(
    async (roomId: string, msgId: string) => {
      await apiFetch(`/api/rooms/${roomId}/messages/${msgId}`, { method: 'DELETE' });
      setMessagesByRoom((prev) => ({
        ...prev,
        [roomId]: (prev[roomId] ?? []).filter((m) => m.id !== msgId),
      }));
      notify('تم حذف الرسالة', 'info');
    },
    [notify]
  );

  const joinMic = useCallback(
    async (roomId: string, seat: number) => {
      if (!me) return;
      setMicBusy(true);
      try {
        await apiFetch(`/api/rooms/${roomId}/mic`, {
          method: 'POST',
          body: JSON.stringify({ action: 'join', seat }),
        });
        await startAudioMonitor(me.id);
        notify(`صعدت على مايك ${seat}`, 'success');
      } finally {
        setMicBusy(false);
      }
    },
    [me, notify, startAudioMonitor]
  );

  const leaveMic = useCallback(
    async (roomId: string) => {
      setMicBusy(true);
      try {
        await apiFetch(`/api/rooms/${roomId}/mic`, {
          method: 'POST',
          body: JSON.stringify({ action: 'leave' }),
        });
        stopAudioCapture();
        notify('نزلت من المايك', 'info');
      } finally {
        setMicBusy(false);
      }
    },
    [notify, stopAudioCapture]
  );

  const toggleMicMute = useCallback(async (roomId: string, seat: number) => {
    await apiFetch(`/api/rooms/${roomId}/mic`, {
      method: 'POST',
      body: JSON.stringify({ action: 'toggle_mute', seat }),
    });
  }, []);

  const toggleLocalMute = useCallback(
    (userId: string, displayName?: string) => {
      setLocallyMutedUserIds((prev) => {
        const next = new Set(prev);
        const willMute = !next.has(userId);
        if (willMute) next.add(userId);
        else next.delete(userId);
        saveLocallyMutedUserIds(Array.from(next));
        notify(
          willMute
            ? `تم كتم ${displayName || 'المتحدث'} شخصياً (لديك فقط)`
            : `تم إلغاء الكتم الشخصي عن ${displayName || 'المتحدث'}`,
          'info'
        );
        return next;
      });
    },
    [notify]
  );

  const adminMicAction = useCallback(
    async (roomId: string, seat: number, action: 'admin_kick' | 'admin_force_mute') => {
      await apiFetch(`/api/rooms/${roomId}/mic`, {
        method: 'POST',
        body: JSON.stringify({ action, seat }),
      });
      notify(
        action === 'admin_kick'
          ? 'تم إنزال العضو من المايك'
          : 'تم تحديث الكتم العام الإداري للمايك',
        'info'
      );
    },
    [notify]
  );

  const likeUser = useCallback(
    async (userId: string) => {
      await apiFetch(`/api/users/${userId}/like`, { method: 'POST' });
      notify('تم إرسال لايك للعضو', 'success');
    },
    [notify]
  );

  const updateMyProfile = useCallback(
    async (patch: {
      topic?: string;
      status?: string;
      color?: string;
      nameStyle?: string;
      fontFamily?: string;
      avatarUrl?: string | null;
      hideCountryFlag?: boolean;
      newPassword?: string;
    }) => {
      const res = await apiFetch<{ user: PublicUser }>('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setMe(res.user);
      setSavedAccounts((prev) => {
        const match = prev.find((a) => a.userId === res.user.id);
        if (!match) return prev;
        return upsertSavedAccount({
          ...match,
          topic: res.user.topic,
          color: res.user.color,
          nameStyle: res.user.nameStyle,
          fontFamily: res.user.fontFamily,
          avatarUrl: res.user.avatarUrl,
          rankId: res.user.rankId,
          savedAt: Date.now(),
        });
      });
      notify('تم تحديث ملفك الشخصي', 'success');
    },
    [notify]
  );

  const markNotificationsRead = useCallback(async (id?: string) => {
    setNotifications((prev) =>
      prev.map((n) => (!id || n.id === id ? { ...n, read: true } : n))
    );
    await apiFetch('/api/notifications/read', {
      method: 'POST',
      body: JSON.stringify(id ? { id } : {}),
    }).catch(() => {});
  }, []);

  const createWallPost = useCallback(
    async (body: string, mediaUrl?: string | null) => {
      const res = await apiFetch<{ post: WallPost }>('/api/wall', {
        method: 'POST',
        body: JSON.stringify({ body, mediaUrl: mediaUrl || null }),
      });
      setWallPosts((prev) =>
        prev.some((p) => p.id === res.post.id) ? prev : [res.post, ...prev]
      );
      notify('تم النشر في الحائط', 'success');
    },
    [notify]
  );

  const toggleWallLike = useCallback(async (postId: string) => {
    await apiFetch(`/api/wall/${postId}/like`, { method: 'POST' });
  }, []);

  const commentWallPost = useCallback(
    async (
      postId: string,
      body: string,
      replyTo?: { id: string; username: string; body: string } | null
    ) => {
      await apiFetch(`/api/wall/${postId}/comment`, {
        method: 'POST',
        body: JSON.stringify({ body, replyTo: replyTo || null }),
      });
    },
    []
  );

  const toggleWallCommentLike = useCallback(async (postId: string, commentId: string) => {
    await apiFetch(`/api/wall/${postId}/comments/${commentId}/like`, {
      method: 'POST',
    });
  }, []);

  const deleteWallPost = useCallback(
    async (postId: string) => {
      await apiFetch(`/api/wall/${postId}`, { method: 'DELETE' });
      setWallPosts((prev) => prev.filter((p) => p.id !== postId));
      notify('تم حذف المنشور', 'info');
    },
    [notify]
  );

  const sendPrivateMessage = useCallback(async (toUserId: string, body: string) => {
    const res = await apiFetch<{ pm: PrivateMessage }>('/api/pm', {
      method: 'POST',
      body: JSON.stringify({ toUserId, body }),
    });
    setPrivateMessages((prev) =>
      prev.some((x) => x.id === res.pm.id) ? prev : [...prev, res.pm]
    );
  }, []);

  const openPrivateChatWith = useCallback((userId: string) => {
    setSelectedPmUserId(userId);
    setViewMode('pm');
    void apiFetch('/api/pm/read', {
      method: 'POST',
      body: JSON.stringify({ fromUserId: userId }),
    }).catch(() => {});
  }, []);

  const fetchCpState = useCallback(() => {
    return apiFetch<CpPayload>('/api/cp/state');
  }, []);

  const activeRoom = useMemo(
    () => rooms.find((r) => r.id === activeRoomId) ?? rooms[0] ?? null,
    [rooms, activeRoomId]
  );

  // Sync activeRoomRef read-only effect
  useEffect(() => {
    if (me && activeRoom && !messagesByRoom[activeRoom.id]) {
      void apiFetch<{ messages: ChatMessage[] }>(`/api/rooms/${activeRoom.id}/messages`)
        .then((r) => {
          if (activeRoomIdRef.current === activeRoom.id) {
            setMessagesByRoom((prev) => ({ ...prev, [activeRoom.id]: r.messages }));
          }
        })
        .catch(() => {});
    }
  }, [activeRoom, me, messagesByRoom]);

  const unreadNotificationCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const value: ChatContextValue = {
    loading,
    me,
    myRank,
    canAccessCp,
    isLocalOwnerDevice,
    ranks,
    rooms,
    activeRoomId,
    activeRoom,
    onlineUsers,
    messagesByRoom,
    wallPosts,
    shortcuts,
    symbols,
    front,
    siteSettings,
    privateMessages,
    notifications,
    unreadNotificationCount,
    markNotificationsRead,
    savedAccounts,
    quickLogin,
    deleteSavedAccount,
    viewMode,
    setViewMode,
    activeDrawer,
    setActiveDrawer,
    selectedPmUserId,
    openPrivateChatWith,
    profileModalUserId,
    openMemberProfile: setProfileModalUserId,
    pendingExternalUrl,
    openExternalLink,
    closeExternalLink,
    toasts,
    notify,
    speakingUserIds,
    locallyMutedUserIds,
    toggleLocalMute,
    micBusy,
    joinMic,
    leaveMic,
    toggleMicMute,
    adminMicAction,
    refreshBootstrap,
    registerAccount,
    loginAccount,
    loginGuest,
    logout,
    joinRoom,
    createRoom,
    sendRoomMessage,
    deleteRoomMessage,
    likeUser,
    updateMyProfile,
    createWallPost,
    toggleWallLike,
    commentWallPost,
    toggleWallCommentLike,
    deleteWallPost,
    sendPrivateMessage,
    cpVersion,
    fetchCpState,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used inside ChatProvider');
  return ctx;
}
