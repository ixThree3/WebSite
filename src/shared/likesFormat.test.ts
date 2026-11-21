import test from 'node:test';
import assert from 'node:assert/strict';
import {
  expandScientificIntegerString,
  formatCompactLikes,
  formatExactNumberString,
} from './likesFormat.ts';

test('expandScientificIntegerString expands scientific notation without losing digits', () => {
  assert.equal(expandScientificIntegerString(0), '0');
  assert.equal(expandScientificIntegerString(-5), '0');
  assert.equal(expandScientificIntegerString(10000), '10000');
  assert.equal(expandScientificIntegerString(1e24), '1000000000000000000000000');
  assert.equal(expandScientificIntegerString('1e+24'), '1000000000000000000000000');
  assert.equal(expandScientificIntegerString('2.5e+21'), '2500000000000000000000');
});

test('formatExactNumberString renders written numbers with commas and never e+', () => {
  const large = formatExactNumberString(1e24);
  assert.equal(large, '1,000,000,000,000,000,000,000,000');
  assert.equal(large.toLowerCase().includes('e+'), false);
});

test('formatCompactLikes keeps counts <= 10,000 exact and uses English scale suffixes above 10,000', () => {
  assert.deepEqual(formatCompactLikes(42), {
    valueText: '42',
    unitText: 'لايك',
    fullText: '42 لايك',
    exactText: '42',
    isCompact: false,
  });

  assert.deepEqual(formatCompactLikes(10000), {
    valueText: '10,000',
    unitText: 'لايك',
    fullText: '10,000 لايك',
    exactText: '10,000',
    isCompact: false,
  });

  const kRes = formatCompactLikes(15400);
  assert.equal(kRes.valueText, '15.4K');
  assert.equal(kRes.fullText, '15.4K لايكات');
  assert.equal(kRes.exactText, '15,400');
  assert.equal(kRes.isCompact, true);

  const mRes = formatCompactLikes(2_500_000);
  assert.equal(mRes.valueText, '2.5M');
  assert.equal(mRes.fullText, '2.5M لايكات');

  const bRes = formatCompactLikes(1_000_000_000);
  assert.equal(bRes.valueText, '1B');
  assert.equal(bRes.fullText, '1B لايكات');

  const spRes = formatCompactLikes(1e24);
  assert.equal(spRes.valueText, '1Sp');
  assert.equal(spRes.fullText, '1Sp لايكات');
  assert.equal(spRes.exactText, '1,000,000,000,000,000,000,000,000');
  assert.equal(spRes.fullText.toLowerCase().includes('e+'), false);
});
