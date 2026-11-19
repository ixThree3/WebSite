import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyTextShortcutsAndFilter,
  canAccessControlPanel,
  canManageTarget,
  checkRoomEntry,
  checkSecurityAllowlist,
  computeInactivePurgeCandidates,
  findMatchingBan,
  formatRelativeArabic,
  hasPermission,
  resolveRegistrationRank,
  validateSiteSettings,
} from './permissions.ts';
import {
  DEFAULT_FILTERS,
  DEFAULT_RANKS,
  DEFAULT_ROOMS,
  DEFAULT_SECURITY_ALLOW,
  DEFAULT_SHORTCUTS,
  DEFAULT_SITE_SETTINGS,
  DEFAULT_USERS,
} from './defaults.ts';

test('Control Panel access is strictly limited to Owner, Supervisors, and Admins/Upgraded', () => {
  const owner = DEFAULT_RANKS.find((r) => r.id === 'rank_owner');
  const supervisor = DEFAULT_RANKS.find((r) => r.id === 'rank_supervisor');
  const adminGold = DEFAULT_RANKS.find((r) => r.id === 'rank_admin_gold');
  const adminBronze = DEFAULT_RANKS.find((r) => r.id === 'rank_admin_bronze');
  const vip = DEFAULT_RANKS.find((r) => r.id === 'rank_vip');
  const member = DEFAULT_RANKS.find((r) => r.id === 'rank_member');
  const guest = DEFAULT_RANKS.find((r) => r.id === 'rank_guest');

  assert.equal(canAccessControlPanel(owner), true);
  assert.equal(canAccessControlPanel(supervisor), true);
  assert.equal(canAccessControlPanel(adminGold), true);
  assert.equal(canAccessControlPanel(adminBronze), true);

  assert.equal(canAccessControlPanel(vip), false);
  assert.equal(canAccessControlPanel(member), false);
  assert.equal(canAccessControlPanel(guest), false);
  assert.equal(canAccessControlPanel(null), false);
});

test('Local owner device registration automatically assigns Owner rank', () => {
  const localRank = resolveRegistrationRank(true, DEFAULT_RANKS);
  assert.equal(localRank.isOwner, true);
  assert.equal(localRank.name, 'المالك');
  assert.equal(canAccessControlPanel(localRank), true);

  const remoteRank = resolveRegistrationRank(false, DEFAULT_RANKS);
  assert.equal(remoteRank.isOwner, false);
  assert.equal(remoteRank.id, 'rank_member');
  assert.equal(canAccessControlPanel(remoteRank), false);
});

test('Rank permissions and hierarchy enforcement', () => {
  const owner = DEFAULT_RANKS.find((r) => r.id === 'rank_owner')!;
  const bronze = DEFAULT_RANKS.find((r) => r.id === 'rank_admin_bronze')!;

  assert.equal(hasPermission(owner, 'manage_site_settings'), true);
  assert.equal(hasPermission(bronze, 'manage_site_settings'), false);
  assert.equal(hasPermission(bronze, 'moderate_mics'), true);

  assert.equal(canManageTarget(1000, 800, false), true);
  assert.equal(canManageTarget(500, 800, false), false);
  assert.equal(canManageTarget(1000, 1000, true), false);
});

test('Site settings validation enforces Tathkar minimum limits', () => {
  const ok = validateSiteSettings(DEFAULT_SITE_SETTINGS);
  assert.equal(ok.valid, true);

  const bad = validateSiteSettings({
    ...DEFAULT_SITE_SETTINGS,
    wallMaxChars: 5,
    pmMaxChars: 9,
    roomMaxChars: 4,
    dailyMsgIntervalMin: 0,
    maxAccountsPerUser: 1,
    maxRegistrationsPerUser: 1,
    guestNameMinChars: 0,
    registerNameMinChars: 0,
  });
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.wallMaxChars);
  assert.ok(bad.errors.pmMaxChars);
  assert.ok(bad.errors.roomMaxChars);
  assert.ok(bad.errors.dailyMsgIntervalMin);
  assert.ok(bad.errors.maxAccountsPerUser);
  assert.ok(bad.errors.maxRegistrationsPerUser);
  assert.ok(bad.errors.guestNameMinChars);
  assert.ok(bad.errors.registerNameMinChars);
});

test('Room entry enforces likes, passwords, and room bans for regular users but allows Owner', () => {
  const vipRoom = DEFAULT_ROOMS.find((r) => r.id === 'room_vip')!;
  const memberRank = DEFAULT_RANKS.find((r) => r.id === 'rank_member')!;
  const ownerRank = DEFAULT_RANKS.find((r) => r.id === 'rank_owner')!;

  const denied = checkRoomEntry(vipRoom, { id: 'u1', likes: 10 }, memberRank);
  assert.equal(denied.allowed, false);

  const allowedMember = checkRoomEntry(vipRoom, { id: 'u1', likes: 600 }, memberRank);
  assert.equal(allowedMember.allowed, true);

  const lockedRoom = { ...vipRoom, requiredLikes: 0, password: '777' };
  const needsPass = checkRoomEntry(lockedRoom, { id: 'u1', likes: 0 }, memberRank);
  assert.equal(needsPass.allowed, false);
  assert.equal(needsPass.needsPassword, true);

  const wrongPass = checkRoomEntry(lockedRoom, { id: 'u1', likes: 0 }, memberRank, '111');
  assert.equal(wrongPass.allowed, false);

  const rightPass = checkRoomEntry(lockedRoom, { id: 'u1', likes: 0 }, memberRank, '777');
  assert.equal(rightPass.allowed, true);

  const ownerBypass = checkRoomEntry(lockedRoom, { id: 'u_owner', likes: 0 }, ownerRank);
  assert.equal(ownerBypass.allowed, true);
});

test('Shortcuts expansion and word filter detection', () => {
  const expanded = applyTextShortcutsAndFilter('س1 يا شباب', DEFAULT_SHORTCUTS, DEFAULT_FILTERS);
  assert.ok(expanded.text.includes('السلام عليكم ورحمة الله وبركاته'));
  assert.equal(expanded.blockedWord, undefined);

  const blocked = applyTextShortcutsAndFilter('رسالة فيها سبام_ممنوع هنا', DEFAULT_SHORTCUTS, DEFAULT_FILTERS);
  assert.equal(blocked.blockedWord, 'سبام_ممنوع');

  const monitored = applyTextShortcutsAndFilter('كلمة تواصل_خارجي', DEFAULT_SHORTCUTS, DEFAULT_FILTERS);
  assert.equal(monitored.monitoredWord, 'تواصل_خارجي');
});

test('Ban matching and security allowlist work accurately', () => {
  const now = Date.now();
  const bans = [
    {
      id: 'b1',
      targetName: 'bad',
      bannedBy: 'أحمد',
      reason: 'test',
      device: 'dev-bad',
      ip: '9.9.9.9',
      accountId: 'u_bad',
      country: 'XX',
      expiresAt: now + 60_000,
      createdAt: now,
    },
  ];
  assert.ok(findMatchingBan({ ip: '9.9.9.9' }, bans, now));
  assert.ok(findMatchingBan({ device: 'dev-bad' }, bans, now));
  assert.equal(findMatchingBan({ ip: '1.1.1.1', device: 'dev-good', accountId: 'u_good', country: 'SA' }, bans, now), null);
  assert.equal(findMatchingBan({ ip: '9.9.9.9' }, bans, now + 120_000), null);

  const uaBlocked = checkSecurityAllowlist(
    { browser: 'UnknownBot', os: 'Windows', fingerprintValid: true, isSuspect: false },
    DEFAULT_SECURITY_ALLOW
  );
  assert.equal(uaBlocked.allowed, false);
});

test('Inactive purge candidates exclude staff/online users and match date range', () => {
  const now = Date.now();
  const candidates = computeInactivePurgeCandidates(DEFAULT_USERS, DEFAULT_RANKS, 'm:6', now);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.id, 'user_saud_old');
});

test('Relative Arabic time formatting produces expected labels', () => {
  const now = 1_700_000_000_000;
  assert.equal(formatRelativeArabic(now - 20_000, now).value, 'الآن');
  assert.deepEqual(formatRelativeArabic(now - 3 * 60_000, now), {
    value: '3',
    unit: 'دقائق',
    tone: 'min',
  });
});
