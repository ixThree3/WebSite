const COMPACT_SUFFIXES = [
  '',
  'K',
  'M',
  'B',
  'T',
  'Qa',
  'Qi',
  'Sx',
  'Sp',
  'Oc',
  'No',
  'Dc',
  'Ud',
  'Dd',
  'Td',
  'Qad',
  'Qid',
  'Sxd',
  'Spd',
  'Ocd',
  'Nod',
  'Vg',
] as const;

/**
 * Converts a number or numeric string (including scientific notation like "1e+24" or "2.5e+21")
 * into its exact non-scientific integer decimal digit string (never returns "1e+24").
 */
export function expandScientificIntegerString(
  input: number | string | null | undefined
): string {
  if (input === null || input === undefined) return '0';
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input <= 0) return '0';
    return expandScientificIntegerString(String(Math.floor(input)));
  }

  const cleaned = String(input).trim().replace(/,/g, '').replace(/\s+/g, '');
  if (!cleaned || cleaned.startsWith('-')) return '0';

  const sciMatch = /^(\d+)(?:\.(\d+))?[eE]\+?(\d+)$/.exec(cleaned);
  if (sciMatch) {
    const intPart = sciMatch[1] ?? '0';
    const fracPart = sciMatch[2] ?? '';
    const exp = Number.parseInt(sciMatch[3] ?? '0', 10);
    if (!Number.isFinite(exp) || exp < 0) return '0';

    const combined = `${intPart}${fracPart}`;
    const totalShift = exp - fracPart.length;
    if (totalShift >= 0) {
      return stripLeadingZeros(`${combined}${'0'.repeat(totalShift)}`);
    }
    const cut = combined.length + totalShift;
    if (cut <= 0) return '0';
    return stripLeadingZeros(combined.slice(0, cut));
  }

  const plainMatch = /^(\d+)(?:\.\d+)?$/.exec(cleaned);
  if (plainMatch) {
    return stripLeadingZeros(plainMatch[1] ?? '0');
  }

  return '0';
}

function stripLeadingZeros(digits: string): string {
  const stripped = digits.replace(/^0+/, '');
  return stripped.length > 0 ? stripped : '0';
}

export function addThousandSeparators(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Formats any likes count into its true written integer representation with thousand separators.
 * Never produces scientific notation (e.g., 1e+24 -> "1,000,000,000,000,000,000,000,000").
 */
export function formatExactNumberString(
  input: number | string | null | undefined
): string {
  return addThousandSeparators(expandScientificIntegerString(input));
}

export interface CompactLikesDisplay {
  valueText: string;
  unitText: string;
  fullText: string;
  exactText: string;
  isCompact: boolean;
}

/**
 * Formats likes for a user's profile:
 * - <= 10,000: full exact count + "لايك" (e.g. "450 لايك", "10,000 لايك")
 * - > 10,000: compact English scale suffix (K, M, B, T, Qa, Qi, Sx, Sp, Oc...) + "لايكات"
 *   (e.g. "15.4K لايكات", "2.5M لايكات", "1Sp لايكات")
 * Never returns scientific notation such as 1e+24.
 */
export function formatCompactLikes(
  input: number | string | null | undefined
): CompactLikesDisplay {
  const digits = expandScientificIntegerString(input);
  const exactText = addThousandSeparators(digits);
  const bigVal = BigInt(digits);

  if (bigVal <= 10_000n) {
    return {
      valueText: exactText,
      unitText: 'لايك',
      fullText: `${exactText} لايك`,
      exactText,
      isCompact: false,
    };
  }

  let tier = Math.floor((digits.length - 1) / 3);
  if (tier >= COMPACT_SUFFIXES.length) {
    return {
      valueText: exactText,
      unitText: 'لايكات',
      fullText: `${exactText} لايكات`,
      exactText,
      isCompact: false,
    };
  }

  let divisorPower = tier * 3;
  let intLen = digits.length - divisorPower;
  let intPart = Number(digits.slice(0, intLen));
  const nextDigit = Number(digits[intLen] ?? '0');
  const secondDigit = Number(digits[intLen + 1] ?? '0');
  let decimal = 0;

  if (intPart < 100) {
    decimal = nextDigit + (secondDigit >= 5 ? 1 : 0);
    if (decimal >= 10) {
      intPart += 1;
      decimal = 0;
    }
    if (intPart >= 1000 && tier + 1 < COMPACT_SUFFIXES.length) {
      tier += 1;
      divisorPower = tier * 3;
      intLen = digits.length - divisorPower;
      intPart = Number(digits.slice(0, intLen));
      decimal = Number(digits[intLen] ?? '0');
    }
  } else if (nextDigit >= 5) {
    intPart += 1;
    if (intPart >= 1000 && tier + 1 < COMPACT_SUFFIXES.length) {
      tier += 1;
      divisorPower = tier * 3;
      intLen = digits.length - divisorPower;
      intPart = Number(digits.slice(0, intLen));
      decimal = Number(digits[intLen] ?? '0');
    }
  }

  const suffix = COMPACT_SUFFIXES[tier] ?? '';
  const numStr = decimal > 0 ? `${intPart}.${decimal}` : `${intPart}`;
  const valueText = `${numStr}${suffix}`;

  return {
    valueText,
    unitText: 'لايكات',
    fullText: `${valueText} لايكات`,
    exactText,
    isCompact: true,
  };
}
