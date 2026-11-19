import { canManageTarget, effectiveRankLevel, hasPermission } from './permissions.ts';
import type { MicSeat, RankRole, Room } from './types.ts';

export interface MicMutableUser {
  id: string;
  micForceMuted?: boolean;
}

/**
 * Checks whether an actor can perform administrative mic actions
 * (global admin mute/unmute or kick from mic) on a target user.
 */
export function canStaffModerateMic(params: {
  actorRank: RankRole | null | undefined;
  actorId: string;
  targetRank: RankRole | null | undefined;
  targetId: string;
  roomOperators?: string[];
}): boolean {
  const { actorRank, actorId, targetRank, targetId, roomOperators = [] } = params;
  if (!actorId || !targetId || actorId === targetId) return false;
  const hasMicPower =
    hasPermission(actorRank, 'moderate_mics') || roomOperators.includes(actorId);
  if (!hasMicPower) return false;
  return canManageTarget(
    effectiveRankLevel(actorRank),
    effectiveRankLevel(targetRank),
    false
  );
}

/**
 * Places a user on a mic seat in the given room while strictly preserving
 * any persistent account-level global administrative mic mute (`user.micForceMuted`).
 */
export function applyMicJoinToSeat(
  room: Pick<Room, 'seats'>,
  user: MicMutableUser,
  seatNum: number,
  now = Date.now()
): MicSeat | null {
  const seat = room.seats.find((s) => s.seat === seatNum);
  if (!seat) return null;

  for (const s of room.seats) {
    if (s.userId === user.id) {
      s.userId = null;
      s.muted = false;
      s.forceMuted = false;
      s.joinedAt = null;
    }
  }

  const isGloballyMuted = Boolean(user.micForceMuted);
  seat.userId = user.id;
  seat.forceMuted = isGloballyMuted;
  seat.muted = isGloballyMuted;
  seat.joinedAt = now;
  return seat;
}

/**
 * Removes a user from mic seat(s) in a room WITHOUT clearing `user.micForceMuted`.
 */
export function applyMicLeaveFromRoom(
  room: Pick<Room, 'seats'>,
  userId: string,
  seatNum?: number
): boolean {
  let removed = false;
  for (const s of room.seats) {
    if (s.userId === userId && (!seatNum || s.seat === seatNum)) {
      s.userId = null;
      s.muted = false;
      s.forceMuted = false;
      s.joinedAt = null;
      removed = true;
    }
  }
  return removed;
}

/**
 * Determines whether the occupant of a mic seat is allowed to self-toggle mute.
 * Users under a global administrative mic mute cannot unmute themselves (except Owner).
 */
export function canSelfToggleMicMute(
  seat: Pick<MicSeat, 'forceMuted'>,
  user: MicMutableUser,
  rank: RankRole | null | undefined
): { allowed: boolean; reason?: string } {
  if ((seat.forceMuted || Boolean(user.micForceMuted)) && !rank?.isOwner) {
    return {
      allowed: false,
      reason: 'تم كتم المايك عام إدارياً — لا يمكنك فتح المايك حتى يفك الكتم مشرف مخوّل',
    };
  }
  return { allowed: true };
}

/**
 * Toggles the persistent account-level global admin mic mute on a target user
 * and synchronizes every active seat they occupy across all rooms.
 */
export function toggleGlobalAdminMicMute(
  rooms: Array<Pick<Room, 'seats'>>,
  targetUser: MicMutableUser
): boolean {
  const nextMuted = !Boolean(targetUser.micForceMuted);
  targetUser.micForceMuted = nextMuted;

  for (const room of rooms) {
    for (const s of room.seats) {
      if (s.userId === targetUser.id) {
        s.forceMuted = nextMuted;
        s.muted = nextMuted;
      }
    }
  }

  return nextMuted;
}
