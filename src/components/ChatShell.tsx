import type { ReactNode } from 'react';
import {
  DoorOpen,
  LayoutDashboard,
  LogOut,
  Mail,
  Megaphone,
  MessageSquareHeart,
  Users,
  VolumeX,
} from 'lucide-react';
import { useChat } from '../lib/useChatClient.tsx';
import { UserAvatar, UserDisplayName } from './UserBadges.tsx';

export function ChatShell({ children }: { children: ReactNode }) {
  const {
    me,
    myRank,
    canAccessCp,
    front,
    onlineUsers,
    privateMessages,
    viewMode,
    setViewMode,
    openMemberProfile,
    logout,
    toasts,
  } = useChat();

  const unreadPmCount = me
    ? privateMessages.filter((pm) => pm.toUserId === me.id && pm.readAt === null).length
    : 0;

  const isSilenced = Boolean(me?.silencedUntil && me.silencedUntil > Date.now() && !myRank?.isOwner);

  const navBtn = (
    active: boolean,
    label: string,
    icon: ReactNode,
    onClick: () => void,
    badge?: number
  ) => (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium transition whitespace-nowrap shrink-0 ${
        active
          ? 'bg-accent text-foreground border border-primary/35'
          : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground'
      }`}
    >
      {icon}
      <span>{label}</span>
      {badge && badge > 0 ? (
        <span className="ms-1 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold text-destructive-foreground tabular-nums">
          {badge}
        </span>
      ) : null}
    </button>
  );

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      {/* Top Bar */}
      <header className="z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-2 px-3 sm:px-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setViewMode('rooms')}
              className="font-display text-xl sm:text-2xl font-bold text-primary whitespace-nowrap shrink-0"
            >
              {front.siteName}
            </button>

            <nav className="hidden md:flex items-center gap-1">
              {navBtn(
                viewMode === 'rooms',
                'الرومات والدردشة',
                <DoorOpen className="size-4 text-primary" />,
                () => setViewMode('rooms')
              )}
              {navBtn(
                viewMode === 'wall',
                'الحائط',
                <MessageSquareHeart className="size-4 text-primary" />,
                () => setViewMode('wall')
              )}
              {navBtn(
                viewMode === 'pm',
                'الخاص',
                <Mail className="size-4 text-primary" />,
                () => setViewMode('pm'),
                unreadPmCount
              )}
              {canAccessCp &&
                navBtn(
                  viewMode === 'cp',
                  'لوحة التحكم',
                  <LayoutDashboard className="size-4 text-amber-400" />,
                  () => setViewMode('cp')
                )}
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-2.5 py-1 text-xs text-muted-foreground tabular-nums">
              <Users className="size-3.5 text-success" />
              {onlineUsers.length} متصل
            </span>

            {me && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openMemberProfile(me.id)}
                  className="flex items-center gap-2 rounded-xl border border-border bg-surface-raised px-2.5 py-1 hover:border-primary/50 transition"
                >
                  <UserAvatar user={me} size="xs" />
                  <UserDisplayName
                    user={me}
                    rank={myRank}
                    showRankLabel
                    className="text-xs max-w-[170px]"
                  />
                </button>
                <button
                  type="button"
                  onClick={() => void logout()}
                  title="خروج"
                  aria-label="خروج"
                  className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-surface-raised text-muted-foreground hover:text-destructive transition"
                >
                  <LogOut className="size-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Site Announcement Banner */}
      {front.announcement.trim() && viewMode !== 'cp' && (
        <div className="flex items-center justify-center gap-2 border-b border-border/80 bg-primary/10 px-4 py-1.5 text-center text-xs sm:text-sm text-primary">
          <Megaphone className="size-3.5 shrink-0" />
          <span className="truncate">{front.announcement}</span>
        </div>
      )}

      {/* Silence Notice */}
      {isSilenced && (
        <div className="flex items-center justify-center gap-2 bg-destructive/15 px-4 py-1.5 text-xs text-destructive">
          <VolumeX className="size-3.5" />
          <span>تم إسكاتك حالياً — يمكنك القراءة فقط</span>
        </div>
      )}

      {/* Main Content */}
      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>

      {/* Mobile Bottom Navigation */}
      <nav className="flex md:hidden items-center justify-around border-t border-border bg-surface px-2 py-1.5">
        <button
          type="button"
          onClick={() => setViewMode('rooms')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] ${
            viewMode === 'rooms' ? 'text-primary font-semibold' : 'text-muted-foreground'
          }`}
        >
          <DoorOpen className="size-5" />
          <span>الرومات</span>
        </button>
        <button
          type="button"
          onClick={() => setViewMode('wall')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] ${
            viewMode === 'wall' ? 'text-primary font-semibold' : 'text-muted-foreground'
          }`}
        >
          <MessageSquareHeart className="size-5" />
          <span>الحائط</span>
        </button>
        <button
          type="button"
          onClick={() => setViewMode('pm')}
          className={`relative flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] ${
            viewMode === 'pm' ? 'text-primary font-semibold' : 'text-muted-foreground'
          }`}
        >
          <Mail className="size-5" />
          <span>الخاص</span>
        </button>
        {canAccessCp && (
          <button
            type="button"
            onClick={() => setViewMode('cp')}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] ${
              viewMode === 'cp' ? 'text-amber-400 font-semibold' : 'text-muted-foreground'
            }`}
          >
            <LayoutDashboard className="size-5" />
            <span>لوحة التحكم</span>
          </button>
        )}
      </nav>

      {/* Toast Stack */}
      {toasts.length > 0 && (
        <div className="fixed bottom-16 md:bottom-4 start-4 z-[60] flex flex-col gap-2 max-w-sm pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`rounded-xl border px-3.5 py-2.5 text-xs font-medium shadow-xl backdrop-blur ${
                t.tone === 'error'
                  ? 'border-destructive/50 bg-destructive/90 text-destructive-foreground'
                  : t.tone === 'success'
                  ? 'border-emerald-500/40 bg-surface text-emerald-300'
                  : 'border-border bg-surface text-foreground'
              }`}
            >
              {t.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
