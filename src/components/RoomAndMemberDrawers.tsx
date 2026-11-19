import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  DoorOpen,
  Lock,
  Mic,
  Pin,
  Plus,
  Search,
  Users,
  X,
} from 'lucide-react';
import { useChat } from '../lib/useChatClient.tsx';
import type { Room } from '../shared/types.ts';
import { CountryFlagBadge } from './CountryFlagBadge.tsx';
import { UserAvatar, UserDisplayName } from './UserBadges.tsx';
import { RoomEditorModal } from './cp/CpModals.tsx';

export function RoomAndMemberDrawers() {
  const {
    me,
    ranks,
    rooms,
    activeRoom,
    onlineUsers,
    activeDrawer,
    setActiveDrawer,
    joinRoom,
    openMemberProfile,
    notify,
  } = useChat();

  const [roomSearch, setRoomSearch] = useState('');
  const [pwdModalRoom, setPwdModalRoom] = useState<Room | null>(null);
  const [roomPwdInput, setRoomPwdInput] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (activeDrawer === 'none') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveDrawer('none');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeDrawer, setActiveDrawer]);

  const sortedRooms = useMemo(() => {
    const q = roomSearch.trim().toLowerCase();
    const list = q
      ? rooms.filter(
          (r) =>
            r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
        )
      : rooms;
    return [...list].sort((a, b) => Number(b.isPinned) - Number(a.isPinned));
  }, [rooms, roomSearch]);

  const roomMembers = useMemo(
    () =>
      activeRoom
        ? onlineUsers.filter((u) => u.roomId === activeRoom.id)
        : [],
    [activeRoom, onlineUsers]
  );

  async function handleSelectRoom(room: Room) {
    try {
      await joinRoom(room.id);
      setActiveDrawer('none');
    } catch (err) {
      const e = err as Error & { data?: { needsPassword?: boolean } };
      if (e.data?.needsPassword) {
        setPwdModalRoom(room);
        setRoomPwdInput('');
      } else {
        notify(e.message, 'error');
      }
    }
  }

  async function handleUnlockRoom(e: FormEvent) {
    e.preventDefault();
    if (!pwdModalRoom) return;
    try {
      await joinRoom(pwdModalRoom.id, roomPwdInput);
      setPwdModalRoom(null);
      setActiveDrawer('none');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'كلمة المرور خاطئة', 'error');
    }
  }

  return (
    <>
      {activeDrawer !== 'none' && (
        <div
          className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          data-drawer={activeDrawer}
        >
          <div className="h-full w-80 max-w-[88vw] bg-surface border-e border-border flex flex-col shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                {activeDrawer === 'rooms' ? (
                  <DoorOpen className="size-4 text-primary" />
                ) : (
                  <Users className="size-4 text-primary" />
                )}
                <span className="font-display text-base">
                  {activeDrawer === 'rooms'
                    ? `الرومات (${rooms.length})`
                    : `الأعضاء المتواجدون (${onlineUsers.length})`}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {activeDrawer === 'rooms' && me && !me.isGuest && (
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/25 transition whitespace-nowrap"
                  >
                    <Plus className="size-3.5" />
                    غرفة
                  </button>
                )}
                <button
                  type="button"
                  aria-label="إغلاق القائمة"
                  onClick={() => setActiveDrawer('none')}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-raised hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {activeDrawer === 'rooms' ? (
              <div className="flex flex-1 min-h-0 flex-col">
                <div className="p-2.5 border-b border-border/70">
                  <div className="relative">
                    <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="search"
                      value={roomSearch}
                      onChange={(e) => setRoomSearch(e.target.value)}
                      placeholder="بحث في الرومات..."
                      className="h-9 w-full rounded-lg border border-border bg-background/70 pe-2.5 ps-8 text-xs focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <ul className="flex-1 divide-y divide-border/50 overflow-y-auto scrollbar-thin">
                  {sortedRooms.map((room) => {
                    const isActive = activeRoom?.id === room.id;
                    const countInRoom = onlineUsers.filter((u) => u.roomId === room.id).length;
                    const activeMics = room.seats.filter((s) => s.userId).length;
                    return (
                      <li key={room.id}>
                        <button
                          type="button"
                          onClick={() => void handleSelectRoom(room)}
                          className={`w-full px-3.5 py-2.5 text-start transition hover:bg-accent/50 ${
                            isActive ? 'bg-accent/70' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {room.imageUrl && (
                              <img
                                src={room.imageUrl}
                                alt={room.name}
                                className="size-9 shrink-0 rounded-lg border border-border object-cover"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 min-w-0">
                                  {room.isPinned && <Pin className="size-3 shrink-0 text-primary" />}
                                  {room.password && <Lock className="size-3 shrink-0 text-amber-400" />}
                                  <span
                                    className={`truncate text-sm font-semibold ${
                                      isActive ? 'text-primary' : 'text-foreground'
                                    }`}
                                  >
                                    {room.name}
                                  </span>
                                </span>
                                <span className="shrink-0 text-[11px] font-medium text-muted-foreground tabular-nums">
                                  {countInRoom}/{room.maxCapacity}
                                </span>
                              </div>
                              <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                                <span className="truncate">{room.description}</span>
                                {room.micEnabled && (
                                  <span className="inline-flex shrink-0 items-center gap-0.5 text-primary/90 tabular-nums ms-2">
                                    <Mic className="size-3" />
                                    {activeMics}/{room.maxMics}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <div className="flex flex-1 min-h-0 flex-col">
                <div className="flex items-center justify-between border-b border-border/60 bg-background/40 px-3.5 py-2 text-[11px] font-semibold text-muted-foreground">
                  <span>في هذه الغرفة ({roomMembers.length})</span>
                  {activeRoom && (
                    <span className="truncate max-w-[140px] text-primary">{activeRoom.name}</span>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-thin">
                  <ul className="divide-y divide-border/50">
                    {roomMembers.map((u) => {
                      const rank = ranks.find((r) => r.id === u.rankId);
                      return (
                        <li key={u.id} data-member-row={u.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveDrawer('none');
                              openMemberProfile(u.id);
                            }}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-start hover:bg-accent/50 transition"
                          >
                            <UserAvatar user={u} size="sm" />
                            <div className="min-w-0 flex-1">
                              <UserDisplayName user={u} rank={rank} className="text-xs" />
                              <p className="truncate text-[11px] text-muted-foreground">
                                {u.status || (rank ? rank.name : 'متصل')}
                              </p>
                            </div>
                            <CountryFlagBadge
                              country={u.country}
                              hideCountryFlag={u.hideCountryFlag}
                              className="ms-auto"
                            />
                          </button>
                        </li>
                      );
                    })}
                    {roomMembers.length === 0 && (
                      <li className="px-4 py-5 text-center text-xs text-muted-foreground">
                        لا يوجد متواجدون في هذه الغرفة حالياً
                      </li>
                    )}
                  </ul>

                  <div className="px-3.5 py-2 text-[11px] font-semibold text-muted-foreground bg-background/40 border-y border-border/50 mt-1">
                    كافة المتصلين بالموقع ({onlineUsers.length})
                  </div>
                  <ul className="divide-y divide-border/50">
                    {onlineUsers
                      .filter((u) => u.roomId !== activeRoom?.id)
                      .map((u) => {
                        const rank = ranks.find((r) => r.id === u.rankId);
                        const rName = rooms.find((r) => r.id === u.roomId)?.name;
                        return (
                          <li key={u.id} data-member-row={u.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveDrawer('none');
                                openMemberProfile(u.id);
                              }}
                              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-start hover:bg-accent/50 transition opacity-85"
                            >
                              <UserAvatar user={u} size="xs" />
                              <div className="min-w-0 flex-1">
                                <UserDisplayName user={u} rank={rank} className="text-xs" />
                                {rName && (
                                  <p className="truncate text-[10px] text-muted-foreground">
                                    {rName}
                                  </p>
                                )}
                              </div>
                              <CountryFlagBadge
                                country={u.country}
                                hideCountryFlag={u.hideCountryFlag}
                                className="ms-auto"
                              />
                            </button>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              </div>
            )}
          </div>
          <div className="flex-1" onClick={() => setActiveDrawer('none')} />
        </div>
      )}

      {/* Room Password Modal */}
      {pwdModalRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
          <form
            onSubmit={handleUnlockRoom}
            className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-2xl space-y-4"
          >
            <h3 className="font-display text-xl">غرفة محمية: {pwdModalRoom.name}</h3>
            <input
              type="password"
              required
              autoFocus
              value={roomPwdInput}
              onChange={(e) => setRoomPwdInput(e.target.value)}
              placeholder="أدخل كلمة مرور الغرفة"
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPwdModalRoom(null)}
                className="rounded-lg border border-border px-4 py-2 text-xs font-medium"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
              >
                دخول الغرفة
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Room Modal — Exact same full modal as Control Panel */}
      {createOpen && (
        <RoomEditorModal
          isNew
          room={null}
          endpoint="/api/rooms"
          onClose={() => setCreateOpen(false)}
          onSaved={() => {}}
          onRoomCreated={async (createdRoom) => {
            try {
              await joinRoom(createdRoom.id, createdRoom.password || undefined);
              setActiveDrawer('none');
            } catch (err) {
              notify(
                err instanceof Error ? err.message : 'تم إنشاء الغرفة بنجاح',
                'info'
              );
            }
          }}
          onNotify={notify}
        />
      )}
    </>
  );
}
