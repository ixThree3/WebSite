import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCountryNameAr,
  hasUpgradedRank,
  resolveVisibleCountryCode,
} from './countryFlag';
import { DEFAULT_RANKS } from './defaults';

test('resolveVisibleCountryCode hides flag whenever hideCountryFlag is true for any rank including Owner', () => {
  assert.equal(resolveVisibleCountryCode({ country: 'SA', hideCountryFlag: true }), null);
  assert.equal(resolveVisibleCountryCode({ country: 'IQ', hideCountryFlag: true }), null);
  assert.equal(resolveVisibleCountryCode({ country: 'ae', hideCountryFlag: false }), 'AE');
  assert.equal(resolveVisibleCountryCode({ country: 'kw' }), 'KW');
  assert.equal(resolveVisibleCountryCode({ country: '', hideCountryFlag: false }), null);
  assert.equal(resolveVisibleCountryCode({ country: 'INVALID', hideCountryFlag: false }), null);
});

test('getCountryNameAr resolves Arabic names for Gulf and Arab countries', () => {
  assert.equal(getCountryNameAr('SA'), 'السعودية');
  assert.equal(getCountryNameAr('iq'), 'العراق');
  assert.equal(getCountryNameAr('KW'), 'الكويت');
  assert.equal(getCountryNameAr('ZZ'), 'ZZ');
});

test('hasUpgradedRank distinguishes Owner and upgraded ranks from regular members', () => {
  const owner = DEFAULT_RANKS.find((r) => r.isOwner);
  const supervisor = DEFAULT_RANKS.find((r) => r.id === 'rank_supervisor');
  const member = DEFAULT_RANKS.find((r) => r.id === 'rank_member');
  assert.equal(hasUpgradedRank(owner), true);
  assert.equal(hasUpgradedRank(supervisor), true);
  assert.equal(hasUpgradedRank(member), false);
  assert.equal(hasUpgradedRank(null), false);
});
