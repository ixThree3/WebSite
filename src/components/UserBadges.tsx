import {
  Award,
  BadgeCheck,
  Crown,
  Flame,
  Gem,
  Heart,
  Minus,
  Moon,
  Shield,
  Sparkles,
  Star,
  UserCheck,
  Zap,
} from 'lucide-react';
import { type CSSProperties } from 'react';
import { getStreakDisplayState, resolveFontCss } from '../shared/stylesAndStreak.ts';
import type { ActivityStatus, RankIcon, RankRole } from '../shared/types.ts';

export function Logo({
  siteName = 'شات الخليج',
  className = '',
}: {
  siteName?: string;
  className?: string;
}) {
  const normalized = siteName.trim();
  if (!normalized || normalized === 'شات الخليج') {
    return (
      <span className={`font-display font-bold tracking-tight ${className}`}>
        <span className="text-gradient-gold">شات</span>{' '}
        <span className="text-foreground">الخليج</span>
      </span>
    );
  }
  const parts = normalized.split(/\s+/);
  if (parts.length >= 2) {
    return (
      <span className={`font-display font-bold tracking-tight ${className}`}>
        <span className="text-gradient-gold">{parts[0]}</span>{' '}
        <span className="text-foreground">{parts.slice(1).join(' ')}</span>
      </span>
    );
  }
  return (
    <span className={`font-display font-bold tracking-tight text-gradient-gold ${className}`}>
      {normalized}
    </span>
  );
}

export function RankIconGlyph({
  icon,
  className = 'size-4',
}: {
  icon: RankIcon;
  className?: string;
}) {
  switch (icon) {
    case 'crown':
      return <Crown className={className} />;
    case 'shield':
      return <Shield className={className} />;
    case 'gem':
      return <Gem className={className} />;
    case 'flame':
      return <Flame className={className} />;
    case 'award':
      return <Award className={className} />;
    case 'sparkles':
      return <Sparkles className={className} />;
    case 'heart':
      return <Heart className={className} />;
    case 'zap':
      return <Zap className={className} />;
    case 'star':
      return <Star className={className} />;
    default:
      return <UserCheck className={className} />;
  }
}

export function StreakFlameBadge({
  streak,
  streakLastDay,
  size = 'sm',
}: {
  streak?: number;
  streakLastDay?: string;
  size?: 'sm' | 'md';
}) {
  const info = getStreakDisplayState(streak ?? 0, streakLastDay);
  if (!info.visible || info.count <= 0) return null;

  const isDormant = info.status === 'dormant';
  const dim = size === 'md' ? 'w-7 h-8' : 'w-[22px] h-[25px]';
  const textClass =
    info.count >= 100
      ? size === 'md'
        ? 'text-[9px]'
        : 'text-[7px]'
      : size === 'md'
      ? 'text-[11px]'
      : 'text-[8.5px]';

  const tooltip = isDormant
    ? `ستريك خامد (${info.count} يوم) — فترة سماح متبقية ${info.graceDaysLeft} يوم`
    : `ستريك نشط: ${info.count} يوم متتالي`;

  return (
    <span
      title={tooltip}
      data-streak-status={info.status}
      className={`relative inline-flex shrink-0 items-center justify-center select-none ${dim}`}
    >
      <svg
        viewBox="0 0 28 32"
        className={`h-full w-full ${
          isDormant ? 'drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]' : 'drop-shadow-[0_0_5px_rgba(249,115,22,0.55)]'
        }`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="streak-lit-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="48%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
          <linearGradient id="streak-dormant-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="55%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
        </defs>
        <path
          d="M14.6 1.5C15.1 6.2 19.6 8.8 21.8 13.4C24.3 18.6 22.1 26.8 14 29.8C6 26.8 3.6 19.4 6.1 13.8C7.5 10.6 10.2 8.7 10.8 5.2C12.2 6.8 13.3 8.1 13.4 9.6C13.6 6.8 13.9 4.1 14.6 1.5Z"
          fill={isDormant ? 'url(#streak-dormant-grad)' : 'url(#streak-lit-grad)'}
          stroke={isDormant ? '#475569' : '#fed7aa'}
          strokeWidth="1"
          strokeOpacity={isDormant ? 0.7 : 0.65}
        />
      </svg>
      <span
        className={`absolute inset-x-0 bottom-[3px] text-center font-mono font-extrabold leading-none tabular-nums ${textClass} ${
          isDormant ? 'text-slate-300/90' : 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]'
        }`}
      >
        {info.count}
      </span>
    </span>
  );
}

const NAME_STYLE_CLASS_MAP: Record<string, string> = {
  solid: '',
  pill_tint: 'name-style-pill-tint',
  pill_border: 'name-style-pill-border',
  dual_stripe: 'name-style-dual-stripe',
  gradient_gold: 'name-style-gradient-gold',
  gradient_sunset: 'name-style-gradient-sunset',
  gradient_ocean: 'name-style-gradient-ocean',
  gradient_berry: 'name-style-gradient-berry',
  gradient_emerald: 'name-style-gradient-emerald',
  glow_soft: 'name-style-glow-soft',
};

export function UserAvatar({
  user,
  size = 'md',
  fit = 'cover-top',
  className = '',
}: {
  user: { username: string; color: string; avatarUrl: string | null };
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  fit?: 'cover' | 'cover-top' | 'contain';
  className?: string;
}) {
  const dims = {
    xs: 'size-7 text-xs',
    sm: 'size-8 text-sm',
    md: 'size-10 text-base',
    lg: 'size-14 text-xl',
    xl: 'size-16 text-xl',
    '2xl': 'size-24 text-4xl',
    full: 'size-full',
  }[size];

  const fitClass =
    fit === 'contain'
      ? 'object-contain bg-surface-raised'
      : fit === 'cover'
      ? 'object-cover object-center'
      : 'object-cover object-top';

  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.username}
        className={`${dims} shrink-0 rounded-full bg-surface-raised ${fitClass} ${className}`}
      />
    );
  }

  return (
    <span
      className={`${dims} inline-flex shrink-0 items-center justify-center rounded-full font-sans font-bold text-primary-foreground select-none ${className}`}
      style={{
        backgroundColor: user.color || 'var(--primary)',
      }}
      aria-hidden="true"
    >
      {Array.from(user.username.trim())[0] ?? '؟'}
    </span>
  );
}

/**
 * Displays live activity status ('online' | 'idle' | 'busy') next to another member's avatar.
 * Never shown for the current user's own account (`targetUserId === currentUserId`) or offline members.
 */
export function ActivityStatusBadge({
  status,
  targetUserId,
  currentUserId,
  online = true,
  className = '',
}: {
  status?: ActivityStatus;
  targetUserId?: string;
  currentUserId?: string | null;
  online?: boolean;
  className?: string;
}) {
  if (!online || !targetUserId || (currentUserId && targetUserId === currentUserId)) {
    return null;
  }

  const resolved: ActivityStatus = status ?? 'online';

  if (resolved === 'busy') {
    return (
      <span
        data-activity-status="busy"
        data-activity-for={targetUserId}
        title="مشغول"
        aria-label="مشغول"
        className={`pointer-events-none absolute -bottom-0.5 -end-0.5 flex size-3.5 items-center justify-center rounded-full bg-rose-500 text-white ring-2 ring-surface ${className}`}
      >
        <Minus className="size-2.5 stroke-[3]" />
      </span>
    );
  }

  if (resolved === 'idle') {
    return (
      <span
        data-activity-status="idle"
        data-activity-for={targetUserId}
        title="خامل"
        aria-label="خامل"
        className={`pointer-events-none absolute -bottom-0.5 -end-0.5 flex size-3.5 items-center justify-center rounded-full bg-amber-500 text-slate-950 ring-2 ring-surface ${className}`}
      >
        <Moon className="size-2 fill-current" />
      </span>
    );
  }

  return (
    <span
      data-activity-status="online"
      data-activity-for={targetUserId}
      title="متصل الآن"
      aria-label="متصل الآن"
      className={`pointer-events-none absolute -bottom-0.5 -end-0.5 flex size-3.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-surface ${className}`}
    />
  );
}

export function UserDisplayName({
  user,
  rank,
  showRankLabel = false,
  hideStreak = false,
  plain = false,
  className = '',
}: {
  user: {
    username: string;
    topic?: string;
    color: string;
    nameStyle?: string;
    fontFamily?: string;
    verified?: boolean;
    streak?: number;
    streakLastDay?: string;
  };
  rank?: RankRole | null;
  showRankLabel?: boolean;
  hideStreak?: boolean;
  plain?: boolean;
  className?: string;
}) {
  const baseColor = user.color || rank?.color || '#eab308';
  const styleClass = NAME_STYLE_CLASS_MAP[user.nameStyle ?? 'solid'] ?? '';
  const resolvedFont = resolveFontCss(user.fontFamily);
  const nameCssVars = {
    '--name-color': baseColor,
    color: styleClass.includes('gradient') ? undefined : baseColor,
    fontFamily: resolvedFont,
  } as CSSProperties;

  return (
    <span className={`inline-flex items-center gap-1 min-w-0 max-w-full ${className}`}>
      {!plain && rank && (rank.isOwner || rank.level > 0) && (
        <span
          title={rank.name}
          className="inline-flex shrink-0 items-center align-middle"
          style={{ color: rank.color }}
        >
          <RankIconGlyph icon={rank.icon} className="size-[1.05em]" />
        </span>
      )}
      <span
        className={`truncate font-semibold ${styleClass}`}
        style={nameCssVars}
      >
        {user.topic || user.username}
      </span>
      {!plain && user.verified && (
        <span title="عضوية موثقة" className="inline-flex shrink-0 text-sky-400">
          <BadgeCheck className="size-3.5" />
        </span>
      )}
      {!plain && !hideStreak && (
        <StreakFlameBadge streak={user.streak} streakLastDay={user.streakLastDay} size="sm" />
      )}
      {!plain && showRankLabel && rank && (
        <span
          className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-surface-raised"
          style={{ color: rank.color }}
        >
          {rank.name}
        </span>
      )}
    </span>
  );
}

export function ConfirmActionModal({
  open,
  title,
  message,
  confirmLabel = 'تأكيد',
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-gradient-panel p-6 shadow-panel">
        <h3 className="font-display text-lg font-semibold leading-none tracking-tight text-foreground">
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{message}</p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-surface-raised/70 px-4 text-sm font-medium text-foreground backdrop-blur hover:bg-accent transition cursor-pointer whitespace-nowrap"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-semibold transition cursor-pointer whitespace-nowrap ${
              danger
                ? 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90'
                : 'bg-gradient-gold text-primary-foreground shadow-gold hover:brightness-110'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
