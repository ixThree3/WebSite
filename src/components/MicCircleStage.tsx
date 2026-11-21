import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
  Lock,
  LogOut,
  Mic,
  MicOff,
  Plus,
  User,
  UserX,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useChat } from '../lib/useChatClient.tsx';
import { canStaffModerateMic } from '../shared/micRules.ts';
import type { PublicUser, Room } from '../shared/types.ts';
import { UserAvatar, UserDisplayName } from './UserBadges.tsx';

interface PopoverState {
  seatNum: number;
  occupantId: string;
  top: number;
  left: number;
}

export function MicCircleStage({ room }: { room: Room }) {
  const {
    me,
    myRank,
    ranks,
    onlineUsers,
    speakingUserIds,
    locallyMutedUserIds,
    toggleLocalMute,
    micBusy,
    joinMic,
    leaveMic,
    toggleMicMute,
    adminMicAction,
    openMemberProfile,
    notify,
  } = useChat();

  const [popover, setPopover] = useState<PopoverState | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!popover) return;
    const onDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopover(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopover(null);
    };
    const onResizeOrScroll = () => setPopover(null);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResizeOrScroll);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResizeOrScroll);
    };
  }, [popover]);

  useEffect(() => {
    if (!popover) return;
    const seat = room.seats.find((s) => s.seat === popover.seatNum);
    if (!seat || seat.userId !== popover.occupantId) {
      setPopover(null);
    }
  }, [popover, room.seats]);

  if (!room.micEnabled || room.seats.length === 0) {
    return (
      <div className="border-b border-border bg-surface/90 px-4 py-2.5 text-center text-xs text-muted-foreground">
        <span className="font-semibold text-foreground" data-testid="mic-stage-room-name">
          {room.name}
        </span>
        {' · '}
        المايكات مغلقة حالياً في هذه الغرفة
      </div>
    );
  }

  async function handleSeatClick(
    e: ReactMouseEvent<HTMLButtonElement>,
    seatNum: number,
    occupant: PublicUser | null
  ) {
    if (!me) return;
    if (!occupant) {
      setPopover(null);
      try {
        await joinMic(room.id, seatNum);
      } catch (err) {
        notify(err instanceof Error ? err.message : 'تعذر الصعود على المايك', 'error');
      }
      return;
    }

    if (popover && popover.seatNum === seatNum && popover.occupantId === occupant.id) {
      setPopover(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 248;
    const margin = 12;
    const rawLeft = rect.left + rect.width / 2 - menuWidth / 2;
    const clampedLeft = Math.max(
      margin,
      Math.min(window.innerWidth - menuWidth - margin, rawLeft)
    );
    const top = Math.min(window.innerHeight - 260, rect.bottom + 8);
    setPopover({
      seatNum,
      occupantId: occupant.id,
      top: Math.max(60, top),
      left: clampedLeft,
    });
  }

  const activeSeat = popover
    ? room.seats.find((s) => s.seat === popover.seatNum) ?? null
    : null;
  const activeOccupant =
    popover && activeSeat?.userId
      ? onlineUsers.find((u) => u.id === activeSeat.userId) ?? null
      : null;

  const isPopoverMine = Boolean(activeOccupant && me && activeOccupant.id === me.id);
  const activeOccupantRank = activeOccupant
    ? ranks.find((r) => r.id === activeOccupant.rankId) ?? null
    : null;
  const canModerateActive = Boolean(
    me &&
      activeOccupant &&
      canStaffModerateMic({
        actorRank: myRank,
        actorId: me.id,
        targetRank: activeOccupantRank,
        targetId: activeOccupant.id,
        roomOperators: room.operators,
      })
  );
  const isActiveGloballyMuted = Boolean(
    activeSeat?.forceMuted || activeOccupant?.micForceMuted
  );
  const isActiveLocallyMuted = Boolean(
    activeOccupant && !isPopoverMine && locallyMutedUserIds.has(activeOccupant.id)
  );

  return (
    <div
      data-testid="mic-circle-stage"
      className="relative border-b border-border bg-surface/90 px-3 py-3 sm:px-5"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <Mic className="size-3.5 shrink-0 text-primary" />
          <span
            data-testid="mic-stage-room-name"
            className="truncate font-semibold text-foreground"
          >
            {room.name}
          </span>
          <span className="shrink-0 tabular-nums">
            ({room.seats.filter((s) => s.userId).length}/{room.seats.length})
          </span>
        </div>
      </div>

      {/* Preserve outer RTL horizontal scroll container so seat 1 never clips on narrow viewports */}
      <div className="w-full overflow-x-auto scrollbar-thin">
        <ul className="mx-auto flex w-max min-w-full items-start justify-center gap-3 sm:gap-6 pt-2 pb-1.5 px-1 sm:px-2">
          {room.seats.map((seat) => {
            const occupant = seat.userId
              ? onlineUsers.find((u) => u.id === seat.userId) ?? null
              : null;
            const isMine = occupant?.id === me?.id;
            const isGloballyMuted = Boolean(
              occupant && (seat.forceMuted || occupant.micForceMuted)
            );
            const isLocallyMuted = Boolean(
              occupant && !isMine && locallyMutedUserIds.has(occupant.id)
            );
            const isSpeaking = Boolean(
              occupant &&
                !seat.muted &&
                !isGloballyMuted &&
                !isLocallyMuted &&
                speakingUserIds.has(occupant.id)
            );
            const isPopoverOpen = Boolean(
              popover && popover.seatNum === seat.seat && occupant && popover.occupantId === occupant.id
            );

            return (
              <li
                key={seat.seat}
                data-mic-seat={seat.seat}
                className="flex w-16 shrink-0 flex-col items-center gap-1.5 sm:w-20"
              >
                <div className="relative">
                  <button
                    type="button"
                    disabled={micBusy}
                    data-mic-avatar={seat.seat}
                    data-speaking={isSpeaking ? 'true' : 'false'}
                    aria-expanded={occupant ? isPopoverOpen : undefined}
                    aria-haspopup={occupant ? 'menu' : undefined}
                    onClick={(e) => void handleSeatClick(e, seat.seat, occupant)}
                    aria-label={
                      occupant
                        ? `مايك ${seat.seat}: ${occupant.username}`
                        : `اصعد على مايك ${seat.seat}`
                    }
                    className={`relative flex size-14 items-center justify-center rounded-full transition sm:size-16 outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      occupant
                        ? 'cursor-pointer'
                        : 'border-2 border-dashed border-primary/50 bg-surface-raised text-primary hover:border-primary hover:bg-accent cursor-pointer'
                    } ${
                      isSpeaking
                        ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface animate-speak'
                        : isGloballyMuted
                        ? 'ring-2 ring-destructive ring-offset-2 ring-offset-surface'
                        : isLocallyMuted
                        ? 'ring-2 ring-warning ring-offset-2 ring-offset-surface'
                        : isMine || isPopoverOpen
                        ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface'
                        : ''
                    }`}
                  >
                    {occupant ? (
                      <span className="flex size-full items-center justify-center overflow-hidden rounded-full bg-surface-raised">
                        <UserAvatar
                          user={occupant}
                          size="full"
                          fit="cover-top"
                          className="text-xl"
                        />
                      </span>
                    ) : (
                      <span className="flex flex-col items-center">
                        <Mic className="size-5" />
                        <Plus className="absolute bottom-1 size-3" />
                      </span>
                    )}

                    {occupant && isGloballyMuted && (
                      <span
                        title="مكتوم عام إدارياً"
                        data-mute-badge="global"
                        className="absolute -bottom-1 -end-1 flex size-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                      >
                        <Lock className="size-3.5" />
                      </span>
                    )}
                    {occupant && !isGloballyMuted && isLocallyMuted && (
                      <span
                        title="مكتوم شخصياً لديك"
                        data-mute-badge="local"
                        className="absolute -bottom-1 -end-1 flex size-6 items-center justify-center rounded-full bg-warning text-primary-foreground"
                      >
                        <VolumeX className="size-3.5" />
                      </span>
                    )}
                    {occupant && !isGloballyMuted && !isLocallyMuted && seat.muted && (
                      <span
                        title="المايك مكتوم"
                        data-mute-badge="self"
                        className="absolute -bottom-1 -end-1 flex size-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
                      >
                        <MicOff className="size-3.5" />
                      </span>
                    )}
                    {occupant && !isGloballyMuted && !isLocallyMuted && !seat.muted && (
                      <span
                        title="المايك مفتوح"
                        className="absolute -bottom-1 -end-1 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
                      >
                        <Mic className="size-3.5" />
                      </span>
                    )}
                  </button>
                </div>

                {/* Username directly under seat (clean, matching MicSeats.tsx) */}
                {occupant ? (
                  <div className="w-full text-center leading-tight">
                    <UserDisplayName
                      user={occupant}
                      plain
                      className="max-w-full justify-center text-xs text-foreground"
                    />
                    {isGloballyMuted && (
                      <span className="mt-0.5 block text-[10px] font-medium text-destructive">
                        مكتوم عام
                      </span>
                    )}
                    {!isGloballyMuted && isLocallyMuted && (
                      <span className="mt-0.5 block text-[10px] font-medium text-warning">
                        مكتوم لديك
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="w-full truncate text-center text-xs text-muted-foreground">
                    مايك {seat.seat}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Avatar-triggered Mic Action Popover */}
      {popover && activeSeat && activeOccupant && (
        <div
          ref={popoverRef}
          role="menu"
          data-testid="mic-action-popover"
          style={{ top: `${popover.top}px`, left: `${popover.left}px` }}
          className="fixed z-50 w-[248px] rounded-md border border-border bg-popover p-1.5 text-popover-foreground shadow-md space-y-1 animate-in fade-in zoom-in-95"
        >
          <div className="flex items-center gap-2.5 border-b border-border/70 px-2 py-2 mb-1">
            <UserAvatar user={activeOccupant} size="sm" />
            <div className="min-w-0 flex-1">
              <UserDisplayName user={activeOccupant} plain className="text-xs font-bold" />
              <p className="truncate text-[11px] text-muted-foreground">
                {isActiveGloballyMuted
                  ? 'مكتوم عام إدارياً عن الجميع'
                  : isActiveLocallyMuted
                  ? 'مكتوم شخصياً لديك فقط'
                  : activeSeat.muted
                  ? `مايك ${activeSeat.seat} · مكتوم مؤقتاً`
                  : `مايك ${activeSeat.seat} · مفتوح الآن`}
              </p>
            </div>
          </div>

          {!isPopoverMine ? (
            <>
              <button
                type="button"
                role="menuitem"
                data-mic-action="local-mute"
                onClick={() => {
                  toggleLocalMute(activeOccupant.id, activeOccupant.topic || activeOccupant.username);
                  setPopover(null);
                }}
                className={`flex min-h-[38px] w-full items-center justify-between gap-2 rounded-sm px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  isActiveLocallyMuted
                    ? 'bg-accent text-foreground'
                    : 'text-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  {isActiveLocallyMuted ? (
                    <Volume2 className="size-4 text-warning shrink-0" />
                  ) : (
                    <VolumeX className="size-4 text-warning shrink-0" />
                  )}
                  <span>{isActiveLocallyMuted ? 'إلغاء الكتم الشخصي' : 'كتم شخصي'}</span>
                </span>
                <span className="text-[10px] font-normal text-muted-foreground">لك فقط</span>
              </button>

              {canModerateActive && (
                <button
                  type="button"
                  role="menuitem"
                  data-mic-action="global-mute"
                  onClick={async () => {
                    try {
                      await adminMicAction(room.id, activeSeat.seat, 'admin_force_mute');
                      setPopover(null);
                    } catch (err) {
                      notify(err instanceof Error ? err.message : 'تعذر تنفيذ الكتم العام', 'error');
                    }
                  }}
                  className="flex min-h-[38px] w-full items-center justify-between gap-2 rounded-sm px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-accent hover:text-accent-foreground transition cursor-pointer"
                >
                  <span className="inline-flex items-center gap-2">
                    {isActiveGloballyMuted ? (
                      <Mic className="size-4 text-success shrink-0" />
                    ) : (
                      <MicOff className="size-4 text-destructive shrink-0" />
                    )}
                    <span>{isActiveGloballyMuted ? 'فك الكتم العام' : 'كتم عام للمايك'}</span>
                  </span>
                  <span className="text-[10px] font-normal text-muted-foreground">للجميع</span>
                </button>
              )}

              {canModerateActive && (
                <button
                  type="button"
                  role="menuitem"
                  data-mic-action="kick-mic"
                  onClick={async () => {
                    try {
                      await adminMicAction(room.id, activeSeat.seat, 'admin_kick');
                      setPopover(null);
                    } catch (err) {
                      notify(err instanceof Error ? err.message : 'تعذر الإنزال من المايك', 'error');
                    }
                  }}
                  className="flex min-h-[38px] w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-accent transition cursor-pointer"
                >
                  <UserX className="size-4 shrink-0" />
                  <span>إنزال من المايك</span>
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                disabled={isActiveGloballyMuted && !myRank?.isOwner}
                onClick={async () => {
                  try {
                    await toggleMicMute(room.id, activeSeat.seat);
                    setPopover(null);
                  } catch (err) {
                    notify(err instanceof Error ? err.message : 'تعذر تغيير حالة المايك', 'error');
                  }
                }}
                className="flex min-h-[38px] w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-accent hover:text-accent-foreground transition disabled:opacity-50 cursor-pointer"
              >
                {activeSeat.muted ? (
                  <Mic className="size-4 text-primary shrink-0" />
                ) : (
                  <MicOff className="size-4 text-destructive shrink-0" />
                )}
                <span>
                  {isActiveGloballyMuted && !myRank?.isOwner
                    ? 'مكتوم عام إدارياً'
                    : activeSeat.muted
                    ? 'فتح المايك'
                    : 'كتم المايك مؤقتاً'}
                </span>
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={async () => {
                  await leaveMic(room.id);
                  setPopover(null);
                }}
                className="flex min-h-[38px] w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-accent transition cursor-pointer"
              >
                <LogOut className="size-4 shrink-0" />
                <span>نزول من المايك</span>
              </button>
            </>
          )}

          <div className="-mx-1 my-1 h-px bg-muted" />
          <button
            type="button"
            role="menuitem"
            data-mic-action="view-profile"
            onClick={() => {
              const targetId = activeOccupant.id;
              setPopover(null);
              openMemberProfile(targetId);
            }}
            className="flex min-h-[38px] w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-accent transition cursor-pointer"
          >
            <User className="size-4 shrink-0" />
            <span>عرض البروفايل</span>
          </button>
        </div>
      )}
    </div>
  );
}
