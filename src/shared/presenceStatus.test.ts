import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALERTS_LOCKED_ERROR_MESSAGE,
  canDeleteOwnedItem,
  checkPrivacyMessagePermission,
  computeActivityStatus,
  inferMediaKind,
  MAX_VIDEO_UPLOAD_BYTES,
  PM_LOCKED_ERROR_MESSAGE,
  sortMembersByRankDesc,
  validateUploadMedia,
} from './presenceStatus.ts';
import { DEFAULT_RANKS } from './defaults.ts';
import type { PublicUser } from './types.ts';

function makeUser(id: string, username: string, rankId: string, isGuest = false): PublicUser {
  return {
    id,
    username,
    topic: username,
    isGuest,
    rankId,
    color: '#cbd5e1',
    status: '',
    avatarUrl: null,
    likes: 0,
    streak: 0,
    verified: false,
    royalLoginBoys: false,
    royalLoginGirls: false,
    roomId: 'room_general',
    online: true,
    silencedUntil: null,
    lastSeen: 1000,
    createdAt: 1000,
  };
}

test('validateUploadMedia allows videos <= 30MB and blocks videos > 30MB with clear Arabic error', () => {
  const okVideo = validateUploadMedia({
    type: 'video/mp4',
    size: MAX_VIDEO_UPLOAD_BYTES,
    name: 'clip.mp4',
  });
  assert.deepEqual(okVideo, { ok: true, kind: 'video' });

  const tooBigVideo = validateUploadMedia({
    type: 'video/mp4',
    size: MAX_VIDEO_UPLOAD_BYTES + 1,
    name: 'huge.mp4',
  });
  assert.equal(tooBigVideo.ok, false);
  if (!tooBigVideo.ok) {
    assert.ok(tooBigVideo.error.includes('30'));
  }

  const okImage = validateUploadMedia({
    type: 'image/png',
    size: 512_000,
    name: 'pic.png',
  });
  assert.deepEqual(okImage, { ok: true, kind: 'image' });

  assert.equal(inferMediaKind('/uploads/abc.mp4'), 'video');
  assert.equal(inferMediaKind('/uploads/pic.webp'), 'image');
  assert.equal(inferMediaKind('data:video/webm;base64,AAA'), 'video');
  assert.equal(inferMediaKind('https://example.com/blob', 'video'), 'video');
});

test('computeActivityStatus accurately derives online, idle, and busy from interaction & mic state', () => {
  const now = 1_000_000;
  assert.equal(
    computeActivityStatus({ lastInteractionAt: now - 10_000, nowMs: now }),
    'online'
  );
  assert.equal(
    computeActivityStatus({ lastInteractionAt: now - 150_000, nowMs: now }),
    'idle'
  );
  assert.equal(
    computeActivityStatus({ lastInteractionAt: now - 1000, isTabHidden: true, nowMs: now }),
    'idle'
  );
  assert.equal(
    computeActivityStatus({ lastInteractionAt: now - 150_000, isOnMic: true, nowMs: now }),
    'busy'
  );
});

test('sortMembersByRankDesc orders users descending from highest rank to lowest rank', () => {
  const users = [
    makeUser('u_guest', 'ضيف', 'rank_guest', true),
    makeUser('u_member', 'عضو', 'rank_member'),
    makeUser('u_admin', 'أدمن', 'rank_admin_gold'),
    makeUser('u_owner', 'المالك', 'rank_owner'),
    makeUser('u_super', 'مشرف', 'rank_supervisor'),
  ];

  const sorted = sortMembersByRankDesc(users, DEFAULT_RANKS);
  assert.deepEqual(
    sorted.map((u) => u.id),
    ['u_owner', 'u_super', 'u_admin', 'u_member', 'u_guest']
  );
});

test('canDeleteOwnedItem restricts deletion to creator (or Site Owner when allowed) and blocks non-owner staff', () => {
  const ownerRank = DEFAULT_RANKS.find((r) => r.id === 'rank_owner')!;
  const supervisorRank = DEFAULT_RANKS.find((r) => r.id === 'rank_supervisor')!;
  const memberRank = DEFAULT_RANKS.find((r) => r.id === 'rank_member')!;

  // Own items can always be deleted by member
  assert.equal(
    canDeleteOwnedItem({ actorId: 'u1', ownerId: 'u1', actorRank: memberRank }),
    true
  );
  // Member cannot delete another user's item
  assert.equal(
    canDeleteOwnedItem({ actorId: 'u1', ownerId: 'u2', actorRank: memberRank }),
    false
  );
  // Non-owner supervisor (even with delete_messages in rank) cannot delete another user's item
  assert.equal(
    canDeleteOwnedItem({
      actorId: 'u_sup',
      ownerId: 'u2',
      actorRank: supervisorRank,
      allowSiteOwner: true,
    }),
    false
  );
  // Site Owner can delete when allowSiteOwner is true, and PM stays strictly sender-only when allowSiteOwner is false
  assert.equal(
    canDeleteOwnedItem({
      actorId: 'u_owner',
      ownerId: 'u2',
      actorRank: ownerRank,
      allowSiteOwner: true,
    }),
    true
  );
  assert.equal(
    canDeleteOwnedItem({
      actorId: 'u_owner',
      ownerId: 'u2',
      actorRank: ownerRank,
      allowSiteOwner: false,
    }),
    false
  );
});

test('computeActivityStatus respects manual privacy status override across interaction & mic state', () => {
  const now = 1_000_000;
  assert.equal(
    computeActivityStatus({
      manualStatus: 'idle',
      lastInteractionAt: now - 1000,
      isTabHidden: false,
      isOnMic: false,
      nowMs: now,
    }),
    'idle'
  );
  assert.equal(
    computeActivityStatus({
      manualStatus: 'busy',
      lastInteractionAt: now - 1000,
      isTabHidden: false,
      isOnMic: false,
      nowMs: now,
    }),
    'busy'
  );
  assert.equal(
    computeActivityStatus({
      manualStatus: 'online',
      lastInteractionAt: now - 300_000,
      isTabHidden: true,
      isOnMic: true,
      nowMs: now,
    }),
    'online'
  );
});

test('checkPrivacyMessagePermission enforces lockPm and lockAlerts with exact Arabic errors', () => {
  assert.deepEqual(
    checkPrivacyMessagePermission({ lockPm: true, lockAlerts: false }, 'pm'),
    { allowed: false, error: PM_LOCKED_ERROR_MESSAGE }
  );
  assert.deepEqual(
    checkPrivacyMessagePermission({ lockPm: true, lockAlerts: false }, 'alert'),
    { allowed: true }
  );
  assert.deepEqual(
    checkPrivacyMessagePermission({ lockPm: false, lockAlerts: true }, 'alert'),
    { allowed: false, error: ALERTS_LOCKED_ERROR_MESSAGE }
  );
  assert.deepEqual(
    checkPrivacyMessagePermission({ lockPm: false, lockAlerts: true }, 'pm'),
    { allowed: true }
  );
});

