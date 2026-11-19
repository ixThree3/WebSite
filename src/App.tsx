/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  DoorOpen,
  Heart,
  Info,
  LogOut,
  Mail,
  MessageSquare,
  MessageSquareHeart,
  ShieldCheck,
  User,
  Users,
  XCircle,
} from 'lucide-react';
import { AuthScreen } from './components/AuthScreen.tsx';
import { ExternalLinkWarningModal } from './components/ExternalLinkWarningModal.tsx';
import { RoomAndMemberDrawers } from './components/RoomAndMemberDrawers.tsx';
import { RoomChatView } from './components/RoomChatView.tsx';
import { UserAvatar, UserDisplayName } from './components/UserBadges.tsx';
import {
  MemberProfileModal,
  PrivateChatView,
  WallView,
} from './components/WallAndPmViews.tsx';
import { ControlPanel } from './components/cp/ControlPanel.tsx';
import {
  ChatProvider,
  useChat,
  type MainViewMode,
  type ToastNotice,
} from './lib/useChatClient.tsx';

function ToastStack({ toasts }: { toasts: ToastNotice[] }) {
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-20 left-4 z-50 flex flex-col gap-2 max-w-xs sm:max-w-sm"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-xs font-medium shadow-xl backdrop-blur-md ${
            t.tone === 'error'
              ? 'border-destructive/50 bg-destructive/20 text-red-100'
              : t.tone === 'success'
              ? 'border-emerald-500/40 bg-emerald-950/90 text-emerald-100'
              : 'border-border bg-surface-raised/95 text-foreground'
          }`}
        >
          {t.tone === 'error' ? (
            <XCircle className="size-4 shrink-0 text-destructive" />
          ) : t.tone === 'success' ? (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
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
    viewMode,
    setViewMode,
    activeDrawer,
    setActiveDrawer,
    openMemberProfile,
    logout,
    toasts,
  } = useChat();

  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
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
      <div className="flex min-h-screen items-center justify-center bg-gradient-night p-6">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-surface p-6 text-center">
          <div className="mx-auto size-12 rounded-2xl bg-primary/20 animate-pulse" />
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
        <ToastStack toasts={toasts} />
      </>
    );
  }

  const unreadPmCount = privateMessages.filter(
    (pm) => pm.toUserId === me.id && !pm.readAt
  ).length;

  const roomMembersCount = activeRoom
    ? onlineUsers.filter((u) => u.roomId === activeRoom.id).length
    : onlineUsers.length;

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
    setViewMode(mode);
  };

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-gradient-night text-foreground">
      {/* Top Workspace Navigation Bar */}
      <header className="relative z-30 shrink-0 border-b border-border bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-1.5 px-2 sm:gap-2 sm:px-5">
          {/* Brand */}
          <div className="hidden sm:flex items-center gap-2.5 min-w-0">
            <span className="flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-gold text-xs sm:text-sm font-black text-primary-foreground shadow-sm">
              خ
            </span>
            <div className="min-w-0 hidden md:block">
              <div className="truncate font-display text-lg leading-tight text-foreground">
                {front.siteName}
              </div>
            </div>
          </div>

          {/* Primary Navigation Tabs: الرومات + الأعضاء side-by-side, then الحائط and الخاص */}
          <nav
            aria-label="التنقل الرئيسي"
            className="flex min-w-0 items-center gap-0.5 sm:gap-1.5"
          >
            <button
              type="button"
              data-nav="rooms"
              data-toggle="rooms"
              aria-expanded={activeDrawer === 'rooms'}
              onClick={handleRoomsNavClick}
              className={`relative inline-flex shrink-0 items-center gap-1 sm:gap-1.5 rounded-xl px-2 py-1.5 text-[11px] sm:px-3 sm:text-sm font-medium transition whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
                activeDrawer === 'rooms' || viewMode === 'rooms'
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground'
              }`}
            >
              <DoorOpen className="size-3.5 sm:size-4 shrink-0" />
              <span>الرومات</span>
              <span className="hidden sm:inline text-[11px] opacity-80 tabular-nums">
                ({rooms.length})
              </span>
            </button>

            <button
              type="button"
              data-toggle="members"
              aria-expanded={activeDrawer === 'members'}
              onClick={handleMembersNavClick}
              className={`relative inline-flex shrink-0 items-center gap-1 sm:gap-1.5 rounded-xl px-2 py-1.5 text-[11px] sm:px-3 sm:text-sm font-medium transition whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
                activeDrawer === 'members'
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground'
              }`}
            >
              <Users className="size-3.5 sm:size-4 shrink-0" />
              <span>الأعضاء</span>
              <span className="text-[10px] sm:text-[11px] opacity-80 tabular-nums">
                ({roomMembersCount})
              </span>
            </button>

            <button
              type="button"
              data-nav="wall"
              onClick={() => handleSecondaryNavClick('wall')}
              className={`relative inline-flex shrink-0 items-center gap-1 sm:gap-1.5 rounded-xl px-2 py-1.5 text-[11px] sm:px-3 sm:text-sm font-medium transition whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
                viewMode === 'wall'
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground'
              }`}
            >
              <MessageSquareHeart className="size-3.5 sm:size-4 shrink-0" />
              <span>الحائط</span>
            </button>

            <button
              type="button"
              data-nav="pm"
              onClick={() => handleSecondaryNavClick('pm')}
              className={`relative inline-flex shrink-0 items-center gap-1 sm:gap-1.5 rounded-xl px-2 py-1.5 text-[11px] sm:px-3 sm:text-sm font-medium transition whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
                viewMode === 'pm'
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground'
              }`}
            >
              <Mail className="size-3.5 sm:size-4 shrink-0" />
              <span>الخاص</span>
              {unreadPmCount > 0 && (
                <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] font-bold text-white tabular-nums">
                  {unreadPmCount}
                </span>
              )}
            </button>
          </nav>

          {/* Notifications + Own Name Dropdown (with Control Panel) + Logout */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Notifications Inbox */}
            {!siteSettings.hideNotifBox && (
              <div ref={notifRef} className="relative">
                <button
                  type="button"
                  data-action="notifications-bell"
                  aria-label="الإشعارات"
                  title="الإشعارات"
                  onClick={() => {
                    setNotifOpen((v) => !v);
                    setUserMenuOpen(false);
                  }}
                  className={`relative flex size-9 items-center justify-center rounded-xl border transition ${
                    notifOpen
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border bg-surface-raised/70 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Bell className="size-4" />
                  {unreadNotificationCount > 0 && (
                    <span className="absolute -top-1 -end-1 min-w-[18px] rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold text-white tabular-nums leading-tight">
                      {unreadNotificationCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div
                    data-testid="notifications-inbox"
                    className="absolute end-0 top-11 z-50 w-80 max-w-[90vw] rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden"
                  >
                    <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
                      <span className="font-display text-sm">الإشعارات ({notifications.length})</span>
                      {unreadNotificationCount > 0 && (
                        <button
                          type="button"
                          onClick={() => void markNotificationsRead()}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                        >
                          <CheckCheck className="size-3.5" /> تحديد الكل كمقروء
                        </button>
                      )}
                    </div>
                    <ul className="max-h-72 divide-y divide-border/60 overflow-y-auto scrollbar-thin">
                      {notifications.map((n) => (
                        <li
                          key={n.id}
                          className={`flex items-start gap-2.5 px-3.5 py-2.5 text-xs transition ${
                            n.read ? 'opacity-75' : 'bg-primary/5'
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
                                  openMemberProfile(n.actorId);
                                }}
                                className="font-bold hover:underline"
                                style={{ color: n.actorColor }}
                              >
                                {n.actorName}
                              </button>{' '}
                              {n.kind === 'profile_like' ? (
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

            {/* Own Identity Button -> Dropdown Menu containing "لوحة التحكم" + "ملفي الشخصي" */}
            <div ref={userMenuRef} className="relative">
              <button
                type="button"
                data-action="own-name-menu"
                onClick={() => {
                  setUserMenuOpen((v) => !v);
                  setNotifOpen(false);
                }}
                title="قائمة حسابي"
                className={`flex items-center gap-1.5 sm:gap-2 rounded-xl border p-1 sm:px-2.5 sm:py-1 transition ${
                  userMenuOpen
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-surface-raised/70 hover:border-primary/60'
                }`}
              >
                <UserAvatar user={me} size="sm" />
                <div className="hidden md:block text-start max-w-[150px] truncate">
                  <UserDisplayName
                    user={me}
                    plain
                    className="text-xs"
                  />
                </div>
                <ChevronDown className="size-3.5 text-muted-foreground hidden sm:block" />
              </button>

              {userMenuOpen && (
                <div
                  data-testid="own-user-dropdown"
                  className="absolute end-0 top-11 z-50 w-56 rounded-2xl border border-border bg-surface p-1.5 shadow-2xl space-y-1"
                >
                  <div className="border-b border-border/70 px-3 py-2">
                    <UserDisplayName user={me} plain className="text-xs" />
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {myRank ? myRank.name : `@${me.username}`}
                    </p>
                  </div>

                  <button
                    type="button"
                    data-action="open-own-profile"
                    onClick={() => {
                      setUserMenuOpen(false);
                      openMemberProfile(me.id);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-raised transition"
                  >
                    <User className="size-4 text-primary" />
                    <span>ملفي الشخصي</span>
                  </button>

                  {canAccessCp && (
                    <button
                      type="button"
                      data-nav="cp"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setViewMode('cp');
                      }}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${
                        viewMode === 'cp'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'text-amber-300 hover:bg-amber-500/15'
                      }`}
                    >
                      <ShieldCheck className="size-4" />
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
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/15 transition"
                  >
                    <LogOut className="size-4" />
                    <span>تسجيل الخروج</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

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
      <ToastStack toasts={toasts} />
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

