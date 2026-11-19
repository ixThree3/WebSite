export interface PresetNameColor {
  id: string;
  label: string;
  hex: string;
  group: 'classic' | 'telegram';
}

// Preserves the 8 classic majlis-mic-circle palette colors first + rich Telegram jewel tones
export const PRESET_NAME_COLORS: PresetNameColor[] = [
  // Classic project presets
  { id: 'gold', label: 'ذهبي خليجي', hex: '#eab308', group: 'classic' },
  { id: 'coral', label: 'مرجاني', hex: '#fb7185', group: 'classic' },
  { id: 'teal', label: 'فيروزي', hex: '#2dd4bf', group: 'classic' },
  { id: 'sky', label: 'سماوي', hex: '#38bdf8', group: 'classic' },
  { id: 'rose', label: 'وردي', hex: '#f472b6', group: 'classic' },
  { id: 'lime', label: 'ليموني', hex: '#a3e635', group: 'classic' },
  { id: 'violet', label: 'بنفسجي', hex: '#a78bfa', group: 'classic' },
  { id: 'pearl', label: 'لؤلؤي', hex: '#f1f5f9', group: 'classic' },
  // Extended Telegram-inspired jewel palette
  { id: 'crimson', label: 'ياقوتي', hex: '#ef4444', group: 'telegram' },
  { id: 'amber', label: 'كهرماني', hex: '#f59e0b', group: 'telegram' },
  { id: 'emerald', label: 'زمردي', hex: '#10b981', group: 'telegram' },
  { id: 'cyan', label: 'سماوي نيون', hex: '#06b6d4', group: 'telegram' },
  { id: 'indigo', label: 'نيلي ملكي', hex: '#818cf8', group: 'telegram' },
  { id: 'magenta', label: 'أرجواني', hex: '#e879f9', group: 'telegram' },
  { id: 'tangerine', label: 'برتقالي غروب', hex: '#fb923c', group: 'telegram' },
  { id: 'mint', label: 'نعناعي', hex: '#6ee7b7', group: 'telegram' },
  { id: 'rosegold', label: 'روز جولد', hex: '#fda4af', group: 'telegram' },
  { id: 'ice', label: 'ثلجي', hex: '#bae6fd', group: 'telegram' },
  { id: 'champagne', label: 'شامبين', hex: '#fde68a', group: 'telegram' },
  { id: 'plum', label: 'خوخي داكن', hex: '#c084fc', group: 'telegram' },
];

export function normalizeColorHex(colorOrId?: string): string {
  if (!colorOrId) return '#eab308';
  const match = PRESET_NAME_COLORS.find((c) => c.id === colorOrId || c.hex.toLowerCase() === colorOrId.toLowerCase());
  if (match) return match.hex;
  if (/^#[0-9a-fA-F]{3,8}$/.test(colorOrId)) return colorOrId;
  return '#eab308';
}

export interface TelegramNameStyle {
  id: string;
  label: string;
  previewHint: string;
}

export const TELEGRAM_NAME_STYLES: TelegramNameStyle[] = [
  { id: 'solid', label: 'لون صافي', previewHint: 'كلاسيكي' },
  { id: 'pill_tint', label: 'شارة تيليجرام', previewHint: 'خلفية شفافة' },
  { id: 'pill_border', label: 'إطار مضيء', previewHint: 'محدد بلونك' },
  { id: 'dual_stripe', label: 'شريط ثنائي', previewHint: 'نمط بريميوم' },
  { id: 'gradient_gold', label: 'تدرج ملكي', previewHint: 'ذهبي متدرج' },
  { id: 'gradient_sunset', label: 'تدرج غروب', previewHint: 'ناري متدرج' },
  { id: 'gradient_ocean', label: 'تدرج بحري', previewHint: 'أزرق سماوي' },
  { id: 'gradient_berry', label: 'تدرج توتي', previewHint: 'وردي بنفسجي' },
  { id: 'gradient_emerald', label: 'تدرج زمردي', previewHint: 'أخضر متدرج' },
  { id: 'glow_soft', label: 'توهج ناعم', previewHint: 'إضاءة فاخرة' },
];

export interface NameFontOption {
  id: string;
  label: string;
  lang: 'ar' | 'en';
  cssFamily: string;
  sample: string;
}

export const NAME_FONTS: NameFontOption[] = [
  // Arabic Fonts
  { id: 'ibm_arabic', label: 'IBM العربي (الافتراضي)', lang: 'ar', cssFamily: '"IBM Plex Sans Arabic", sans-serif', sample: 'مجلس الخليج' },
  { id: 'cairo', label: 'القاهرة (Cairo)', lang: 'ar', cssFamily: '"Cairo", "IBM Plex Sans Arabic", sans-serif', sample: 'مجلس الخليج' },
  { id: 'tajawal', label: 'تجول (Tajawal)', lang: 'ar', cssFamily: '"Tajawal", "IBM Plex Sans Arabic", sans-serif', sample: 'مجلس الخليج' },
  { id: 'reem_kufi', label: 'ريم كوفي (Reem Kufi)', lang: 'ar', cssFamily: '"Reem Kufi", "IBM Plex Sans Arabic", sans-serif', sample: 'مجلس الخليج' },
  { id: 'readex', label: 'ريدكس برو (Readex)', lang: 'ar', cssFamily: '"Readex Pro", "IBM Plex Sans Arabic", sans-serif', sample: 'مجلس الخليج' },
  { id: 'changa', label: 'تشانجا (Changa)', lang: 'ar', cssFamily: '"Changa", "IBM Plex Sans Arabic", sans-serif', sample: 'مجلس الخليج' },
  { id: 'amiri', label: 'أميري نسخ (Amiri)', lang: 'ar', cssFamily: '"Amiri", serif', sample: 'مجلس الخليج' },
  // English / Telegram-like Fonts
  { id: 'inter', label: 'Inter (تيليجرام)', lang: 'en', cssFamily: '"Inter", "IBM Plex Sans Arabic", sans-serif', sample: 'Majlis VIP' },
  { id: 'poppins', label: 'Poppins (دائري)', lang: 'en', cssFamily: '"Poppins", "IBM Plex Sans Arabic", sans-serif', sample: 'Majlis VIP' },
  { id: 'space_grotesk', label: 'Space Grotesk', lang: 'en', cssFamily: '"Space Grotesk", "IBM Plex Sans Arabic", sans-serif', sample: 'Majlis VIP' },
  { id: 'playfair', label: 'Playfair Classic', lang: 'en', cssFamily: '"Playfair Display", "Amiri", serif', sample: 'Majlis VIP' },
  { id: 'jetbrains', label: 'JetBrains Mono', lang: 'en', cssFamily: '"JetBrains Mono", monospace', sample: 'Majlis_01' },
];

export function resolveFontCss(fontId?: string): string | undefined {
  if (!fontId) return undefined;
  return NAME_FONTS.find((f) => f.id === fontId)?.cssFamily;
}

// ======================== STREAK & IDLE LOGIC ========================

export function getRiyadhDateString(nowMs = Date.now()): string {
  // Format YYYY-MM-DD in Asia/Riyadh (UTC+3)
  const riyadhMs = nowMs + 3 * 60 * 60 * 1000;
  return new Date(riyadhMs).toISOString().slice(0, 10);
}

export function diffDaysYmd(fromYmd: string, toYmd: string): number {
  const fromMs = Date.parse(`${fromYmd}T00:00:00Z`);
  const toMs = Date.parse(`${toYmd}T00:00:00Z`);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return 999;
  return Math.round((toMs - fromMs) / 86_400_000);
}

/**
 * Computes updated login streak when a user visits / logs in today.
 * - Same day: preserves existing streak
 * - Consecutive day (diff = 1) or within 3 missed grace days (diff = 2..4): restores & increments streak
 * - Missed > 3 grace days (diff > 4): resets streak to 1
 */
export function applyDailyStreakLogin(
  currentStreak: number,
  lastDay: string | undefined,
  nowMs = Date.now()
): { streak: number; streakLastDay: string; restoredFromGrace: boolean } {
  const today = getRiyadhDateString(nowMs);
  if (!lastDay) {
    return {
      streak: Math.max(1, currentStreak || 1),
      streakLastDay: today,
      restoredFromGrace: false,
    };
  }
  const diff = diffDaysYmd(lastDay, today);
  if (diff <= 0) {
    return {
      streak: Math.max(1, currentStreak || 1),
      streakLastDay: lastDay,
      restoredFromGrace: false,
    };
  }
  if (diff <= 4) {
    return {
      streak: Math.max(1, currentStreak || 0) + 1,
      streakLastDay: today,
      restoredFromGrace: diff >= 2,
    };
  }
  return {
    streak: 1,
    streakLastDay: today,
    restoredFromGrace: false,
  };
}

export interface StreakDisplayState {
  visible: boolean;
  count: number;
  status: 'active' | 'dormant' | 'expired';
  graceDaysLeft: number;
}

/**
 * Returns visual state of streak flame:
 * - Entered today (diff === 0): active (lit orange flame + bright count)
 * - Missed 1..3 days (diff 1..3): dormant (extinguished gray flame + dim count, 3-day grace window)
 * - Missed > 3 days (diff >= 4): expired
 */
export function getStreakDisplayState(
  streak: number,
  lastDay: string | undefined,
  nowMs = Date.now()
): StreakDisplayState {
  if (!streak || streak <= 0) {
    return { visible: false, count: 0, status: 'expired', graceDaysLeft: 0 };
  }
  if (!lastDay) {
    return { visible: true, count: streak, status: 'active', graceDaysLeft: 3 };
  }
  const today = getRiyadhDateString(nowMs);
  const diff = diffDaysYmd(lastDay, today);
  if (diff <= 0) {
    return { visible: true, count: streak, status: 'active', graceDaysLeft: 3 };
  }
  if (diff <= 3) {
    return {
      visible: true,
      count: streak,
      status: 'dormant',
      graceDaysLeft: Math.max(1, 4 - diff),
    };
  }
  return { visible: false, count: 0, status: 'expired', graceDaysLeft: 0 };
}

// Keep mobile screen-locked / backgrounded accounts online for 20 minutes (within 15-30m window)
export const IDLE_DISCONNECT_MS = 20 * 60 * 1000;

export function shouldDisconnectIdleUser(params: {
  online: boolean;
  hasActiveWs: boolean;
  lastSeen: number;
  nowMs?: number;
}): boolean {
  if (!params.online) return false;
  if (params.hasActiveWs) return false;
  const now = params.nowMs ?? Date.now();
  return now - params.lastSeen >= IDLE_DISCONNECT_MS;
}
