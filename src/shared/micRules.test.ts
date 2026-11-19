import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_RANKS, createDefaultSeats } from './defaults.ts';
import {
  applyMicJoinToSeat,
  applyMicLeaveFromRoom,
  canSelfToggleMicMute,
  canStaffModerateMic,
  toggleGlobalAdminMicMute,
} from './micRules.ts';

const ownerRank = DEFAULT_RANKS.find((r) => r.id === 'rank_owner')!;
const supervisorRank = DEFAULT_RANKS.find((r) => r.id === 'rank_supervisor')!;
const adminGoldRank = DEFAULT_RANKS.find((r) => r.id === 'rank_admin_gold')!;
const memberRank = DEFAULT_RANKS.find((r) => r.id === 'rank_member')!;

test('global admin mic mute persists across leaving, switching seats, and switching rooms', () => {
  const roomA = { seats: createDefaultSeats(5) };
  const roomB = { seats: createDefaultSeats(5) };
  const user = { id: 'u_member', micForceMuted: false };

  // User joins seat 1 in room A cleanly
  const seat1 = applyMicJoinToSeat(roomA, user, 1, 1000);
  assert.ok(seat1);
  assert.equal(seat1.userId, 'u_member');
  assert.equal(seat1.muted, false);
  assert.equal(seat1.forceMuted, false);

  // Staff applies global admin mic mute
  const mutedNow = toggleGlobalAdminMicMute([roomA, roomB], user);
  assert.equal(mutedNow, true);
  assert.equal(user.micForceMuted, true);
  assert.equal(roomA.seats[0]!.forceMuted, true);
  assert.equal(roomA.seats[0]!.muted, true);

  // User tries to unmute themselves -> blocked
  const selfCheck = canSelfToggleMicMute(roomA.seats[0]!, user, memberRank);
  assert.equal(selfCheck.allowed, false);

  // User leaves seat 1 -> account flag remains true
  const left = applyMicLeaveFromRoom(roomA, 'u_member');
  assert.equal(left, true);
  assert.equal(roomA.seats[0]!.userId, null);
  assert.equal(user.micForceMuted, true);

  // User joins seat 3 in room A -> still force-muted
  const seat3 = applyMicJoinToSeat(roomA, user, 3, 2000);
  assert.ok(seat3);
  assert.equal(seat3.forceMuted, true);
  assert.equal(seat3.muted, true);

  // User leaves room A and joins seat 2 in room B -> STILL force-muted
  applyMicLeaveFromRoom(roomA, 'u_member');
  const seatB2 = applyMicJoinToSeat(roomB, user, 2, 3000);
  assert.ok(seatB2);
  assert.equal(seatB2.forceMuted, true);
  assert.equal(seatB2.muted, true);

  // Staff unmutes user globally -> clears both account flag and active seat in room B
  const unmutedNow = toggleGlobalAdminMicMute([roomA, roomB], user);
  assert.equal(unmutedNow, false);
  assert.equal(user.micForceMuted, false);
  assert.equal(roomB.seats[1]!.forceMuted, false);
  assert.equal(roomB.seats[1]!.muted, false);

  // User can now self-toggle mute normally
  assert.equal(canSelfToggleMicMute(roomB.seats[1]!, user, memberRank).allowed, true);
});

test('staff mic moderation enforces permission and rank hierarchy', () => {
  // Owner can moderate supervisor and member
  assert.equal(
    canStaffModerateMic({
      actorRank: ownerRank,
      actorId: 'u_owner',
      targetRank: supervisorRank,
      targetId: 'u_sup',
    }),
    true
  );

  // Admin gold cannot moderate supervisor (higher rank) or same-rank admin
  assert.equal(
    canStaffModerateMic({
      actorRank: adminGoldRank,
      actorId: 'u_admin',
      targetRank: supervisorRank,
      targetId: 'u_sup',
    }),
    false
  );
  assert.equal(
    canStaffModerateMic({
      actorRank: adminGoldRank,
      actorId: 'u_admin1',
      targetRank: adminGoldRank,
      targetId: 'u_admin2',
    }),
    false
  );

  // Admin gold can moderate regular member
  assert.equal(
    canStaffModerateMic({
      actorRank: adminGoldRank,
      actorId: 'u_admin',
      targetRank: memberRank,
      targetId: 'u_mem',
    }),
    true
  );

  // Regular member cannot moderate another member
  assert.equal(
    canStaffModerateMic({
      actorRank: memberRank,
      actorId: 'u_mem1',
      targetRank: memberRank,
      targetId: 'u_mem2',
    }),
    false
  );

  // Nobody can administratively moderate themselves
  assert.equal(
    canStaffModerateMic({
      actorRank: ownerRank,
      actorId: 'u_owner',
      targetRank: ownerRank,
      targetId: 'u_owner',
    }),
    false
  );
});
