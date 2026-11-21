import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPmContactsList,
  computeReloginRoomCutoff,
  countUnreadPmFromPartner,
  filterMessagesSinceCutoff,
  formatElapsedArabic,
  markNotificationsAsRead,
  removePmNotificationsForPartner,
  validateAlertMessage,
} from './chatHistory.ts';
import type { ChatMessage, NotificationItem, PrivateMessage, PublicUser } from './types.ts';

function makeMsg(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: 'm1',
    roomId: 'room_general',
    userId: 'u1',
    username: 'أحمد',
    topic: 'أحمد',
    color: '#eab308',
    avatarUrl: null,
    rankId: 'rank_owner',
    verified: true,
    streak: 1,
    body: 'رسالة',
    createdAt: 1000,
    ...overrides,
  };
}

function makeUser(id: string, username: string, online = true): PublicUser {
  return {
    id,
    username,
    topic: username,
    isGuest: false,
    rankId: 'rank_member',
    color: '#cbd5e1',
    status: '',
    avatarUrl: null,
    likes: 10,
    streak: 1,
    verified: false,
    royalLoginBoys: false,
    royalLoginGirls: false,
    roomId: 'room_general',
    online,
    silencedUntil: null,
    lastSeen: 1000,
    createdAt: 1000,
  };
}

test('filterMessagesSinceCutoff excludes previous messages and login/move notices on logout/re-login', () => {
  const msgs: ChatMessage[] = [
    makeMsg({ id: 'm1', body: 'رسالة قبل الخروج', createdAt: 1000 }),
    makeMsg({
      id: 'sys_login',
      isSystem: true,
      systemKind: 'login',
      body: 'سجّل دخول إلى الموقع وانضم للغرفة',
      createdAt: 2000,
    }),
    makeMsg({
      id: 'sys_move',
      isSystem: true,
      systemKind: 'room_enter',
      body: 'انضم إلى الغرفة',
      createdAt: 2100,
    }),
    makeMsg({ id: 'm_other_room', roomId: 'room_poetry', body: 'غرفة أخرى', createdAt: 3000 }),
    makeMsg({ id: 'm_after', body: 'رسالة جديدة بعد الدخول', createdAt: 2500 }),
  ];

  // Without cutoff (active initial session) -> returns all room_general messages
  assert.deepEqual(
    filterMessagesSinceCutoff(msgs, 'room_general', null).map((m) => m.id),
    ['m1', 'sys_login', 'sys_move', 'm_after']
  );

  // With cutoff at 2100 -> excludes previous messages AND login/move notices, keeps only strictly newer messages
  const cutoff = computeReloginRoomCutoff({
    previousCutoff: 1500,
    lastNoticeCreatedAt: 2100,
    nowMs: 2100,
  });
  assert.equal(cutoff, 2100);
  assert.deepEqual(
    filterMessagesSinceCutoff(msgs, 'room_general', cutoff).map((m) => m.id),
    ['m_after']
  );

  // Right at login moment (cutoff === 2500) -> completely empty room slate
  assert.deepEqual(filterMessagesSinceCutoff(msgs, 'room_general', 2500), []);
});

test('buildPmContactsList preserves historical offline PM peers forever and prioritizes recent conversations', () => {
  const meId = 'u_me';
  const peerOffline = makeUser('u_old', 'خالد', false);
  const peerOnlineWithPm = makeUser('u_sara', 'سارة', true);
  const peerOnlineNoPm = makeUser('u_fahad', 'فهد', true);

  const pms: PrivateMessage[] = [
    { id: 'pm1', fromUserId: meId, toUserId: 'u_old', body: 'أهلاً خالد', readAt: 1200, createdAt: 5000 },
    { id: 'pm2', fromUserId: 'u_sara', toUserId: meId, body: 'هلا', readAt: null, createdAt: 9000 },
    { id: 'pm3', fromUserId: 'u_sara', toUserId: meId, body: 'وينك؟', readAt: null, createdAt: 9500 },
  ];

  const contacts = buildPmContactsList({
    meId,
    onlineUsers: [makeUser(meId, 'أنا', true), peerOnlineNoPm, peerOnlineWithPm],
    pmPeers: [peerOffline, peerOnlineWithPm],
    privateMessages: pms,
  });

  assert.deepEqual(
    contacts.map((c) => c.id),
    ['u_sara', 'u_old', 'u_fahad']
  );
  assert.equal(contacts[0]?.online, true);
  assert.equal(contacts[1]?.online, false);
  assert.equal(countUnreadPmFromPartner(pms, meId, 'u_sara'), 2);
  assert.equal(countUnreadPmFromPartner(pms, meId, 'u_old'), 0);
});

test('markNotificationsAsRead clears unread status while preserving all notification items', () => {
  const list: NotificationItem[] = [
    {
      id: 'n1',
      userId: 'me',
      actorId: 'u1',
      actorName: 'سارة',
      actorColor: '#fff',
      actorAvatarUrl: null,
      kind: 'alert',
      read: false,
      createdAt: 1000,
    },
    {
      id: 'n2',
      userId: 'me',
      actorId: 'u2',
      actorName: 'فهد',
      actorColor: '#fff',
      actorAvatarUrl: null,
      kind: 'profile_like',
      read: false,
      createdAt: 2000,
    },
  ];
  const cleared = markNotificationsAsRead(list);
  assert.equal(cleared.length, 2);
  assert.equal(cleared.every((n) => n.read === true), true);
});

test('removePmNotificationsForPartner deletes only the selected partner PM notifications', () => {
  const list: NotificationItem[] = [
    {
      id: 'n_pm_sara',
      userId: 'me',
      actorId: 'u_sara',
      actorName: 'سارة',
      actorColor: '#fff',
      actorAvatarUrl: null,
      kind: 'pm_message',
      postSnippet: 'هلا',
      read: false,
      createdAt: 3000,
    },
    {
      id: 'n_like_sara',
      userId: 'me',
      actorId: 'u_sara',
      actorName: 'سارة',
      actorColor: '#fff',
      actorAvatarUrl: null,
      kind: 'profile_like',
      read: false,
      createdAt: 2000,
    },
    {
      id: 'n_pm_khalid',
      userId: 'me',
      actorId: 'u_khalid',
      actorName: 'خالد',
      actorColor: '#fff',
      actorAvatarUrl: null,
      kind: 'pm_message',
      postSnippet: 'السلام عليكم',
      read: false,
      createdAt: 4000,
    },
    {
      id: 'n_alert_khalid',
      userId: 'me',
      actorId: 'u_khalid',
      actorName: 'خالد',
      actorColor: '#fff',
      actorAvatarUrl: null,
      kind: 'alert',
      read: false,
      createdAt: 5000,
    },
  ];

  const afterSelectSara = removePmNotificationsForPartner(list, 'u_sara');
  assert.deepEqual(
    afterSelectSara.map((n) => n.id),
    ['n_like_sara', 'n_pm_khalid', 'n_alert_khalid']
  );
});

test('formatElapsedArabic produces accurate Arabic elapsed durations', () => {
  const base = 100_000;
  assert.equal(formatElapsedArabic(base, base + 1000), 'الآن');
  assert.equal(formatElapsedArabic(base, base + 5000), 'منذ 5 ثوانٍ');
  assert.equal(formatElapsedArabic(base, base + 25_000), 'منذ 25 ثانية');
  assert.equal(formatElapsedArabic(base, base + 120_000), 'منذ دقيقتين');
  assert.equal(formatElapsedArabic(base, base + 3_600_000), 'منذ ساعة');
});

test('validateAlertMessage rejects empty/whitespace alerts and trims/caps valid alert text', () => {
  assert.deepEqual(validateAlertMessage(''), {
    ok: false,
    error: 'يرجى كتابة نص رسالة التنبيه',
  });
  assert.deepEqual(validateAlertMessage('   \n\t  '), {
    ok: false,
    error: 'يرجى كتابة نص رسالة التنبيه',
  });
  assert.deepEqual(validateAlertMessage('  مرحباً، تعال للمايك  '), {
    ok: true,
    text: 'مرحباً، تعال للمايك',
  });
  const longText = 'أ'.repeat(300);
  const res = validateAlertMessage(longText);
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.text.length, 240);
  }
});
