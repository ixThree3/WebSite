/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BellRing,
  CheckCheck,
  CheckCircle2,
  Clock,
  DoorOpen,
  Heart,
  Info,
  LogOut,
  Mail,
  Megaphone,
  MessageSquare,
  MessageSquareHeart,
  Reply,
  Send,
  Shield,
  ShieldCheck,
  UserRound,
  Users,
  VolumeX,
  X,
  XCircle,
} from 'lucide-react';
import { AuthScreen } from './components/AuthScreen.tsx';
import { ExternalLinkWarningModal } from './components/ExternalLinkWarningModal.tsx';
import { ImageLightboxModal } from './components/ImageLightboxModal.tsx';
import { PrivacySettingsModal } from './components/PrivacySettingsModal.tsx';
import { RoomAndMemberDrawers } from './components/RoomAndMemberDrawers.tsx';
import { RoomChatView } from './components/RoomChatView.tsx';
import { Logo, UserAvatar, UserDisplayName } from './components/UserBadges.tsx';
import {
  MemberProfileModal,
  PrivateChatView,
  WallView,
} from './components/WallAndPmViews.tsx';
import { ControlPanel } from './components/cp/ControlPanel.tsx';
import { formatElapsedArabic } from './shared/chatHistory.ts';
import {
  ChatProvider,
  useChat,
  type AlertPopupItem,
  type MainViewMode,
  type ToastNotice,
} from './lib/useChatClient.tsx';

function AlertPopupCard({
  alert,
  nowMs,
  onDismiss,
  onOpenProfile,
  onReplyAlert,
}: {
  alert: AlertPopupItem;
  nowMs: number;
  onDismiss: (id: string) => void;
  onOpenProfile: (userId: string) => void;
  onReplyAlert?: (actorId: string, message: string) => Promise<boolean>;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onReplyAlert || replyBusy) return;
    const trimmed = replyText.trim();
    if (!trimmed) return;
    setReplyBusy(true);
    try {
      const ok = await onReplyAlert(alert.actorId, trimmed);
      if (ok) {
        setReplyText('');
        setReplyOpen(false);
        onDismiss(alert.id);
      }
    } finally {
      setReplyBusy(false);
    }
  };

  return (
    <div
      data-alert-popup={alert.id}
      className="pointer-events-auto rounded-xl border border-primary/50 bg-surface/95 p-3 text-xs shadow-panel backdrop-blur-md animate-float-in"
    >
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={() => onOpenProfile(alert.actorId)}
          className="shrink-0 cursor-pointer"
          title={alert.actorName}
        >
          <UserAvatar
            user={{
              username: alert.actorName,
              color: alert.actorColor,
              avatarUrl: alert.actorAvatarUrl,
            }}
            size="md"
            fit="cover-top"
          />
        </button>

        <div className="min-w-0 flex-1 space-y-1.5 text-start">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onOpenProfile(alert.actorId)}
              className="truncate text-sm font-bold hover:underline cursor-pointer"
              style={{ color: alert.actorColor }}
            >
              {alert.actorName}
            </button>
            <div className="flex items-center gap-1 shrink-0">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                <BellRing className="size-3" /> تنبيه
              </span>
              <button
                type="button"
                aria-label="إغلاق التنبيه"
                data-action="alert-popup-close"
                onClick={() => onDismiss(alert.id)}
                className="rounded-md p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer transition"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          <p className="rounded-lg border border-border/70 bg-background/70 px-2.5 py-2 text-xs text-foreground leading-relaxed break-words whitespace-pre-wrap">
            {alert.message || 'أرسل لك تنبيهاً'}
          </p>

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
              <Clock className="size-3 shrink-0" />
              <span>{formatElapsedArabic(alert.createdAt, nowMs)}</span>
            </div>

            {onReplyAlert && (
              <button
                type="button"
                data-action="alert-reply-toggle"
                onClick={() => setReplyOpen((v) => !v)}
                className={`inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold transition cursor-pointer ${
                  replyOpen
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-border bg-surface-raised/80 text-foreground hover:border-primary/60 hover:text-primary'
                }`}
              >
                <Reply className="size-3" />
                <span>رد</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {replyOpen && (
        <form
          data-testid="alert-reply-form"
          onSubmit={(e) => void handleReplySubmit(e)}
          className="mt-2.5 space-y-2 border-t border-border/70 pt-2.5"
        >
          <input
            type="text"
            data-testid="alert-reply-input"
            autoFocus
            maxLength={240}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={`اكتب ردك على ${alert.actorName}...`}
            className="h-8 w-full rounded-md border border-input bg-background/80 px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          />
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              data-action="alert-reply-cancel"
              onClick={() => {
                setReplyOpen(false);
                setReplyText('');
              }}
              className="inline-flex h-7 items-center justify-center rounded-md border border-border bg-background/60 px-2.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground transition cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              data-action="alert-reply-send"
              disabled={replyBusy || !replyText.trim()}
              className="inline-flex h-7 items-center justify-center gap-1 rounded-md bg-gradient-gold px-3 text-[11px] font-semibold text-primary-foreground shadow-gold hover:brightness-110 disabled:opacity-50 transition cursor-pointer"
            >
              <Send className="size-3" />
              <span>{replyBusy ? 'جاري الإرسال...' : 'إرسال'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function LeftNoticeStack({
  alerts,
  toasts,
  onDismissAlert,
  onOpenProfile,
  onReplyAlert,
}: {
  alerts: AlertPopupItem[];
  toasts: ToastNotice[];
  onDismissAlert: (id: string) => void;
  onOpenProfile: (userId: string) => void;
  onReplyAlert?: (actorId: string, message: string) => Promise<boolean>;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (alerts.length === 0) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [alerts.length]);

  if (alerts.length === 0 && toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-20 left-4 z-40 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
    >
      {alerts.length > 0 && (
        <div data-testid="alert-popup-stack" className="flex flex-col gap-2">
          {alerts.map((a) => (
            <AlertPopupCard
              key={a.id}
              alert={a}
              nowMs={nowMs}
              onDismiss={onDismissAlert}
              onOpenProfile={onOpenProfile}
              onReplyAlert={onReplyAlert}
            />
          ))}
        </div>
      )}

      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2.5 rounded-lg border px-4 py-2.5 text-xs font-medium shadow-panel backdrop-blur-md animate-float-in ${
            t.tone === 'error'
              ? 'border-destructive/50 bg-destructive/20 text-destructive-foreground'
              : t.tone === 'success'
              ? 'border-success/40 bg-surface-raised/95 text-foreground'
              : 'border-border bg-popover/95 text-popover-foreground'
          }`}
        >
          {t.tone === 'error' ? (
            <XCircle className="size-4 shrink-0 text-destructive" />
          ) : t.tone === 'success' ? (
            <CheckCircle2 className="size-4 shrink-0 text-success" />
          ) : (
            <Info className="size-4 shrink-0 text-primary" />
          )}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

function ChatShell() {
  const {
    loading,
    me,
    myRank,
    canAccessCp,
    front,
    siteSettings,
    rooms,
    activeRoom,
    onlineUsers,
    privateMessages,
    notifications,
    unreadNotificationCount,
    markNotificationsRead,
    alertPopups,
    dismissAlertPopup,
    sendUserAlert,
    viewMode,
    setViewMode,
    activeDrawer,
    setActiveDrawer,
    setSelectedPmUserId,
    openPrivateChatWith,
    openMemberProfile,
    logout,
    toasts,
    notify,
  } = useChat();

  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-gradient-night p-6">
        <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-gradient-panel p-6 text-center shadow-panel">
          <div className="mx-auto size-12 rounded-xl bg-primary/20 animate-pulse" />
          <div className="mx-auto h-5 w-40 rounded-lg bg-surface-raised animate-pulse" />
          <div className="mx-auto h-3 w-56 rounded-lg bg-surface-raised animate-pulse" />
        </div>
      </div>
    );
  }

  if (!me) {
    return (
      <>
        <AuthScreen />
        <LeftNoticeStack
          alerts={[]}
          toasts={toasts}
          onDismissAlert={dismissAlertPopup}
          onOpenProfile={(userId) => openMemberProfile(userId)}
        />
      </>
    );
  }

  const unreadPmCount = privateMessages.filter(
    (pm) => pm.toUserId === me.id && !pm.readAt
  ).length;

  const roomMembersCount = activeRoom
    ? onlineUsers.filter((u) => u.roomId === activeRoom.id).length
    : onlineUsers.length;

  const announcement = front.announcement?.trim();
  const isSilenced = Boolean(me.silencedUntil && me.silencedUntil > Date.now());

  const handleRoomsNavClick = () => {
    setNotifOpen(false);
    setUserMenuOpen(false);
    if (viewMode !== 'rooms') {
      setViewMode('rooms');
      setActiveDrawer('rooms');
    } else {
      setActiveDrawer(activeDrawer === 'rooms' ? 'none' : 'rooms');
    }
  };

  const handleMembersNavClick = () => {
    setNotifOpen(false);
    setUserMenuOpen(false);
    setActiveDrawer(activeDrawer === 'members' ? 'none' : 'members');
  };

  const handleSecondaryNavClick = (mode: MainViewMode) => {
    setNotifOpen(false);
    setUserMenuOpen(false);
    setActiveDrawer('none');
    if (mode === 'pm') {
      setSelectedPmUserId(null);
    }
    setViewMode(mode);
  };

  const navBase =
    'flex shrink-0 items-center gap-1 sm:gap-1.5 rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium transition whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer';

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      {/* Top Workspace Navigation Bar — matches AppShell.tsx */}
      <header className="relative z-30 shrink-0 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-1.5 sm:gap-2 px-2.5 sm:px-5">
          {/* Brand Logo */}
          <button
            type="button"
            onClick={() => handleSecondaryNavClick('rooms')}
            className="hidden sm:inline-flex items-center me-2 text-xl sm:text-2xl shrink-0 cursor-pointer"
          >
            <Logo siteName={front.siteName} />
          </button>

          {/* Primary Navigation Tabs */}
          <nav
            aria-label="التنقل الرئيسي"
            className="flex min-w-0 flex-1 items-center gap-0.5 sm:gap-1 overflow-x-auto scrollbar-none"
          >
            <button
              type="button"
              data-nav="rooms"
              data-toggle="rooms"
              aria-expanded={activeDrawer === 'rooms'}
              onClick={handleRoomsNavClick}
              className={`${navBase} ${
                activeDrawer === 'rooms' || viewMode === 'rooms'
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              }`}
            >
              <DoorOpen className="size-4 shrink-0" />
              <span>الرومات</span>
              <span className="hidden sm:inline text-xs opacity-75 tabular-nums">
                ({rooms.length})
              </span>
            </button>

            <button
              type="button"
              data-toggle="members"
              aria-expanded={activeDrawer === 'members'}
              onClick={handleMembersNavClick}
              className={`${navBase} ${
                activeDrawer === 'members'
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              }`}
            >
              <Users className="size-4 shrink-0" />
              <span>الأعضاء</span>
              <span className="hidden sm:inline text-xs opacity-75 tabular-nums">
                ({roomMembersCount})
              </span>
            </button>

            <button
              type="button"
              data-nav="wall"
              onClick={() => handleSecondaryNavClick('wall')}
              className={`${navBase} ${
                viewMode === 'wall'
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              }`}
            >
              <MessageSquareHeart className="size-4 shrink-0" />
              <span>الحائط</span>
            </button>

            <button
              type="button"
              data-nav="pm"
              onClick={() => handleSecondaryNavClick('pm')}
              className={`${navBase} relative ${
                viewMode === 'pm'
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              }`}
            >
              <Mail className="size-4 shrink-0" />
              <span>الخاص</span>
              {unreadPmCount > 0 && (
                <span className="absolute -top-0.5 -start-0.5 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[0.7rem] font-bold text-destructive-foreground tabular-nums">
                  {unreadPmCount}
                </span>
              )}
            </button>
          </nav>

          {/* Online Pill + Notifications + User Menu */}
          <div className="ms-auto flex items-center gap-2 shrink-0">
            <span className="hidden md:flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground tabular-nums">
              <span className="size-2 rounded-full bg-success" />
              <Users className="size-3.5" />
              {onlineUsers.length}
              <span className="hidden lg:inline">متصل</span>
            </span>

            {/* Notifications Inbox */}
            {!siteSettings.hideNotifBox && (
              <div ref={notifRef} className="relative">
                <button
                  type="button"
                  data-action="notifications-bell"
                  aria-label="الإشعارات"
                  title="الإشعارات"
                  onClick={() => {
                    const nextOpen = !notifOpen;
                    setNotifOpen(nextOpen);
                    setUserMenuOpen(false);
                    if (nextOpen && unreadNotificationCount > 0) {
                      void markNotificationsRead();
                    }
                  }}
                  className={`relative flex size-8 items-center justify-center rounded-full border transition cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    unreadNotificationCount > 0
                      ? 'border-destructive bg-destructive/15 text-destructive hover:bg-destructive/25'
                      : notifOpen
                      ? 'border-primary bg-accent text-primary'
                      : 'border-border bg-surface-raised/70 text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <Bell className="size-4" />
                  {unreadNotificationCount > 0 && (
                    <span
                      data-testid="notifications-unread-badge"
                      className="absolute -top-1 -end-1 min-w-[18px] rounded-full bg-destructive px-1 text-center text-[10px] font-bold text-destructive-foreground tabular-nums leading-tight"
                    >
                      {unreadNotificationCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div
                    data-testid="notifications-inbox"
                    className="absolute end-0 top-10 z-50 w-80 max-w-[90vw] rounded-md border border-border bg-popover text-popover-foreground shadow-md overflow-hidden animate-in fade-in zoom-in-95"
                  >
                    <div className="flex items-center justify-between border-b border-border px-3 py-2">
                      <span className="font-display text-sm font-semibold">
                        الإشعارات ({notifications.length})
                      </span>
                      {unreadNotificationCount > 0 && (
                        <button
                          type="button"
                          onClick={() => void markNotificationsRead()}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                        >
                          <CheckCheck className="size-3.5" /> تحديد الكل كمقروء
                        </button>
                      )}
                    </div>
                    <ul className="max-h-72 divide-y divide-border/60 overflow-y-auto scrollbar-thin">
                      {notifications.map((n) => (
                        <li
                          key={n.id}
                          data-notif-id={n.id}
                          data-notif-kind={n.kind}
                          className={`flex items-start gap-2.5 px-3 py-2 text-xs transition ${
                            n.read ? 'opacity-80' : 'bg-destructive/10'
                          }`}
                        >
                          <UserAvatar
                            user={{
                              username: n.actorName,
                              color: n.actorColor,
                              avatarUrl: n.actorAvatarUrl,
                            }}
                            size="xs"
                          />
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="leading-relaxed">
                              <button
                                type="button"
                                onClick={() => {
                                  setNotifOpen(false);
                                  if (n.kind === 'pm_message') {
                                    openPrivateChatWith(n.actorId);
                                  } else {
                                    openMemberProfile(n.actorId);
                                  }
                                }}
                                className="font-bold hover:underline cursor-pointer"
                                style={{ color: n.actorColor }}
                              >
                                {n.actorName}
                              </button>{' '}
                              {n.kind === 'alert' ? (
                                <span className="inline-flex items-center gap-1 text-primary font-semibold">
                                  <BellRing className="size-3" /> أرسل لك تنبيهاً
                                </span>
                              ) : n.kind === 'pm_message' ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNotifOpen(false);
                                    openPrivateChatWith(n.actorId);
                                  }}
                                  className="inline-flex items-center gap-1 text-emerald-400 hover:underline cursor-pointer"
                                >
                                  <Mail className="size-3" /> أرسل لك رسالة خاصة
                                </button>
                              ) : n.kind === 'profile_like' ? (
                                <span className="inline-flex items-center gap-1 text-rose-400">
                                  <Heart className="size-3 fill-current" /> عمل لايك لك
                                </span>
                              ) : n.kind === 'post_like' ? (
                                <span className="inline-flex items-center gap-1 text-rose-400">
                                  <Heart className="size-3 fill-current" /> أعجب بمنشورك
                                </span>
                              ) : n.kind === 'comment_like' ? (
                                <span className="inline-flex items-center gap-1 text-rose-400">
                                  <Heart className="size-3 fill-current" /> أعجب بتعليقك
                                </span>
                              ) : n.kind === 'comment_reply' ? (
                                <span className="inline-flex items-center gap-1 text-sky-400">
                                  <MessageSquare className="size-3" /> ردّ على تعليقك
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-sky-400">
                                  <MessageSquare className="size-3" /> علّق على منشورك
                                </span>
                              )}
                            </p>
                            {n.postSnippet && (
                              <p className="truncate text-[11px] text-muted-foreground">
                                «{n.postSnippet}»
                              </p>
                            )}
                            <time className="block text-[10px] text-muted-foreground tabular-nums">
                              في الوقت{' '}
                              {new Date(n.createdAt).toLocaleString('ar', {
                                hour: '2-digit',
                                minute: '2-digit',
                                month: 'numeric',
                                day: 'numeric',
                              })}
                            </time>
                          </div>
                        </li>
                      ))}
                      {notifications.length === 0 && (
                        <li className="px-4 py-8 text-center text-xs text-muted-foreground">
                          لا توجد إشعارات جديدة
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Own Identity Avatar Button -> Dropdown Menu */}
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                data-action="own-name-menu"
                onClick={() => {
                  setUserMenuOpen((v) => !v);
                  setNotifOpen(false);
                }}
                title="قائمة حسابي"
                aria-label="قائمة حسابي"
                className="flex items-center gap-1.5 rounded-full outline-none ring-ring focus-visible:ring-2 cursor-pointer"
              >
                <UserAvatar user={me} size="sm" />
              </button>

              {userMenuOpen && (
                <div
                  data-testid="own-user-dropdown"
                  className="absolute end-0 top-10 z-50 w-52 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in zoom-in-95"
                >
                  <div className="px-2 py-1.5">
                    <UserDisplayName user={me} plain className="text-sm" />
                    <p className="truncate text-xs text-muted-foreground">
                      {me.status || myRank?.name || 'بدون حالة'}
                    </p>
                  </div>

                  <div className="-mx-1 my-1 h-px bg-muted" />

                  <button
                    type="button"
                    data-action="open-own-profile"
                    onClick={() => {
                      setUserMenuOpen(false);
                      openMemberProfile(me.id);
                    }}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer"
                  >
                    <UserRound className="size-4 text-primary" />
                    <span>ملفي</span>
                  </button>

                  <button
                    type="button"
                    data-action="open-privacy-settings"
                    onClick={() => {
                      setUserMenuOpen(false);
                      setPrivacyOpen(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer"
                  >
                    <Shield className="size-4 text-primary" />
                    <span>إعدادات الخصوصية</span>
                  </button>

                  {canAccessCp && (
                    <button
                      type="button"
                      data-nav="cp"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setViewMode('cp');
                      }}
                      className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer ${
                        viewMode === 'cp' ? 'bg-accent text-foreground font-semibold' : ''
                      }`}
                    >
                      <ShieldCheck className="size-4 text-primary" />
                      <span>لوحة التحكم</span>
                    </button>
                  )}

                  <button
                    type="button"
                    data-action="logout"
                    onClick={() => {
                      setUserMenuOpen(false);
                      void logout();
                    }}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive outline-none transition-colors hover:bg-accent focus:text-destructive cursor-pointer"
                  >
                    <LogOut className="size-4" />
                    <span>خروج</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Global Announcement Banner (matches AppShell.tsx) */}
      {announcement && (
        <div className="flex items-center justify-center gap-2 border-b border-border bg-primary/10 px-3 py-1.5 text-center text-sm text-primary shrink-0">
          <Megaphone className="size-4 shrink-0" />
          <span className="min-w-0">{announcement}</span>
        </div>
      )}

      {/* Silenced Notice Banner (matches AppShell.tsx) */}
      {isSilenced && (
        <div className="flex items-center justify-center gap-2 bg-destructive/15 px-3 py-1.5 text-center text-xs text-destructive shrink-0">
          <VolumeX className="size-3.5 shrink-0" />
          <span>
            تم إسكاتك{' '}
            {me.silencedUntil
              ? `حتى ${new Date(me.silencedUntil).toLocaleString('ar')}`
              : 'بشكل دائم'}{' '}
            — تقدر تقرأ وتسمع بس ما تقدر تكتب أو تصعد المايك
          </span>
        </div>
      )}

      {/* Main Active View */}
      <main className="min-h-0 flex-1 overflow-hidden">
        {viewMode === 'rooms' && <RoomChatView />}
        {viewMode === 'wall' && <WallView />}
        {viewMode === 'pm' && <PrivateChatView />}
        {viewMode === 'cp' && <ControlPanel />}
      </main>

      <RoomAndMemberDrawers />
      <MemberProfileModal />
      <ExternalLinkWarningModal />
      <ImageLightboxModal />
      <PrivacySettingsModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
      <LeftNoticeStack
        alerts={alertPopups}
        toasts={toasts}
        onDismissAlert={dismissAlertPopup}
        onOpenProfile={(userId) => openMemberProfile(userId)}
        onReplyAlert={async (actorId, message) => {
          try {
            await sendUserAlert(actorId, message);
            return true;
          } catch (err) {
            notify(err instanceof Error ? err.message : 'تعذر إرسال الرد', 'error');
            return false;
          }
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ChatProvider>
      <ChatShell />
    </ChatProvider>
  );
}
