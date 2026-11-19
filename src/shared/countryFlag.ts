import type { RankRole } from './types.ts';

export const COUNTRY_NAMES_AR: Record<string, string> = {
  SA: 'السعودية',
  AE: 'الإمارات',
  IQ: 'العراق',
  KW: 'الكويت',
  QA: 'قطر',
  BH: 'البحرين',
  OM: 'عُمان',
  EG: 'مصر',
  JO: 'الأردن',
  SY: 'سوريا',
  LB: 'لبنان',
  YE: 'اليمن',
  PS: 'فلسطين',
  MA: 'المغرب',
  DZ: 'الجزائر',
  TN: 'تونس',
  LY: 'ليبيا',
  SD: 'السودان',
  MR: 'موريتانيا',
  SO: 'الصومال',
  DJ: 'جيبوتي',
  KM: 'جزر القمر',
  TR: 'تركيا',
  GB: 'المملكة المتحدة',
  US: 'الولايات المتحدة',
  CA: 'كندا',
  AU: 'أستراليا',
  DE: 'ألمانيا',
  FR: 'فرنسا',
  NL: 'هولندا',
  SE: 'السويد',
  NO: 'النرويج',
  DK: 'الدنمارك',
  BE: 'بلجيكا',
  CH: 'سويسرا',
  AT: 'النمسا',
  IT: 'إيطاليا',
  ES: 'إسبانيا',
  PT: 'البرتغال',
  IE: 'أيرلندا',
  PL: 'بولندا',
  GR: 'اليونان',
  RU: 'روسيا',
  UA: 'أوكرانيا',
  CN: 'الصين',
  JP: 'اليابان',
  KR: 'كوريا الجنوبية',
  IN: 'الهند',
  PK: 'باكستان',
  ID: 'إندونيسيا',
  MY: 'ماليزيا',
  SG: 'سنغافورة',
  PH: 'الفلبين',
  BR: 'البرازيل',
  MX: 'المكسيك',
  AR: 'الأرجنتين',
  ZA: 'جنوب أفريقيا',
};

/**
 * Resolves the publicly visible ISO-2 country code for a user.
 * Applies universally to ALL users including Owner and every upgraded rank:
 * if hideCountryFlag is true, null is always returned.
 */
export function resolveVisibleCountryCode(user: {
  country?: string | null;
  hideCountryFlag?: boolean;
}): string | null {
  if (user.hideCountryFlag) return null;
  const clean = (user.country ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(clean)) return null;
  return clean;
}

export function getCountryNameAr(code: string): string {
  const clean = code.trim().toUpperCase();
  return COUNTRY_NAMES_AR[clean] ?? clean;
}

/**
 * Returns true if the rank represents an upgraded/privileged role
 * (Owner, Supervisor, Admin, or any rank above regular member level 0).
 */
export function hasUpgradedRank(rank: RankRole | null | undefined): boolean {
  if (!rank) return false;
  return Boolean(rank.isOwner || rank.level > 0 || rank.permissions.length > 0);
}
