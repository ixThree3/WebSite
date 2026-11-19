import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDailyStreakLogin,
  getRiyadhDateString,
  getStreakDisplayState,
  IDLE_DISCONNECT_MS,
  normalizeColorHex,
  resolveFontCss,
  shouldDisconnectIdleUser,
} from './stylesAndStreak.ts';

const DAY = 86_400_000;

test('Streak tracks consecutive days, turns dormant during 3 grace days, and restores on return', () => {
  const baseNow = Date.UTC(2026, 10, 19, 10, 0, 0); // 2026-11-19 in Riyadh
  const today = getRiyadhDateString(baseNow);
  const yesterday = getRiyadhDateString(baseNow - 1 * DAY);
  const twoDaysAgo = getRiyadhDateString(baseNow - 2 * DAY);
  const threeDaysAgo = getRiyadhDateString(baseNow - 3 * DAY);
  const fourDaysAgo = getRiyadhDateString(baseNow - 4 * DAY);
  const fiveDaysAgo = getRiyadhDateString(baseNow - 5 * DAY);

  // Logged in today -> active fire
  const activeState = getStreakDisplayState(10, today, baseNow);
  assert.equal(activeState.visible, true);
  assert.equal(activeState.status, 'active');
  assert.equal(activeState.count, 10);

  // Missed 1..3 days -> dormant fire inside 3-day grace window
  const grace1 = getStreakDisplayState(10, yesterday, baseNow);
  assert.equal(grace1.status, 'dormant');
  assert.equal(grace1.graceDaysLeft, 3);

  const grace2 = getStreakDisplayState(10, twoDaysAgo, baseNow);
  assert.equal(grace2.status, 'dormant');
  assert.equal(grace2.graceDaysLeft, 2);

  const grace3 = getStreakDisplayState(10, threeDaysAgo, baseNow);
  assert.equal(grace3.status, 'dormant');
  assert.equal(grace3.graceDaysLeft, 1);

  // Missed > 3 grace days -> expired before login
  const expired = getStreakDisplayState(10, fourDaysAgo, baseNow);
  assert.equal(expired.visible, false);
  assert.equal(expired.status, 'expired');

  // Logging in inside grace window (e.g., 3 days ago or 4 days delta) restores & increments streak
  const restored = applyDailyStreakLogin(10, fourDaysAgo, baseNow);
  assert.equal(restored.streak, 11);
  assert.equal(restored.restoredFromGrace, true);
  assert.equal(restored.streakLastDay, today);

  // Logging in after 5 days resets streak to 1
  const reset = applyDailyStreakLogin(10, fiveDaysAgo, baseNow);
  assert.equal(reset.streak, 1);
  assert.equal(reset.restoredFromGrace, false);
});

test('Idle disconnect keeps mobile/background accounts open for 20 minutes then disconnects', () => {
  const now = 1_750_000_000_000;
  // Active WebSocket never disconnected
  assert.equal(
    shouldDisconnectIdleUser({
      online: true,
      hasActiveWs: true,
      lastSeen: now - 60 * 60_000,
      nowMs: now,
    }),
    false
  );
  // Screen locked for 12 minutes (< 20 minutes) -> remains online!
  assert.equal(
    shouldDisconnectIdleUser({
      online: true,
      hasActiveWs: false,
      lastSeen: now - 12 * 60_000,
      nowMs: now,
    }),
    false
  );
  // Idle for 25 minutes (> 20 minutes) without WS -> disconnected!
  assert.equal(
    shouldDisconnectIdleUser({
      online: true,
      hasActiveWs: false,
      lastSeen: now - IDLE_DISCONNECT_MS - 1000,
      nowMs: now,
    }),
    true
  );
});

test('Preset colors and fonts resolve cleanly', () => {
  assert.equal(normalizeColorHex('gold'), '#eab308');
  assert.equal(normalizeColorHex('#38bdf8'), '#38bdf8');
  assert.ok(resolveFontCss('cairo')?.includes('Cairo'));
  assert.ok(resolveFontCss('inter')?.includes('Inter'));
});
