import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Ban,
  BellRing,
  Check,
  Chrome,
  Compass,
  Eye,
  EyeOff,
  Flag,
  Globe,
  Heart,
  ImageOff,
  KeyRound,
  Laptop,
  Mail,
  Mic,
  MicOff,
  Monitor,
  Palette,
  PhoneOff,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Tablet,
  Trash2,
  Type,
  Upload,
  UserCog,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { apiFetch } from '../lib/device.ts';
import { useChat } from '../lib/useChatClient.tsx';
import { hasUpgradedRank } from '../shared/countryFlag.ts';
import {
  expandScientificIntegerString,
  formatCompactLikes,
  formatExactNumberString,
} from '../shared/likesFormat.ts';
import {
  canManageTarget,
  effectiveRankLevel,
  hasPermission,
} from '../shared/permissions.ts';
import {
  getStreakDisplayState,
  NAME_FONTS,
  PRESET_NAME_COLORS,
  TELEGRAM_NAME_STYLES,
} from '../shared/stylesAndStreak.ts';
import {
  ALERTS_LOCKED_ERROR_MESSAGE,
  PM_LOCKED_ERROR_MESSAGE,
} from '../shared/presenceStatus.ts';
import type { BanRecord, PublicUser, RevealLoginEntry, RevealResponse } from '../shared/types.ts';
import { CountryFlagBadge } from './CountryFlagBadge.tsx';
import {
  ConfirmActionModal,
  RankIconGlyph,
  StreakFlameBadge,
  UserAvatar,
  UserDisplayName,
} from './UserBadges.tsx';

const DURATION_PRESETS = [
  { label: '10 د', minutes: 10 },
  { label: 'ساعة', minutes: 60 },
  { label: 'يوم', minutes: 1440 },
  { label: 'أسبوع', minutes: 10080 },
  { label: 'مؤبد', minutes: 0 },
];

function CompactRevealIcons({ entry }: { entry: RevealLoginEntry }) {
  const DeviceIcon =
    entry.deviceType === 'mobile'
      ? Smartphone
      : entry.deviceType === 'tablet'
      ? Tablet
      : Monitor;

  const BrowserIcon =
    entry.browser === 'safari'
      ? Compass
      : entry.browser === 'chrome'
      ? Chrome
      : Globe;

  const osTag =
    entry.os === 'ios'
      ? 'iOS'
      : entry.os === 'android'
      ? 'AND'
      : entry.os === 'mac'
      ? 'MAC'
      : entry.os === 'linux'
      ? 'LNX'
      : 'WIN';

  return (
    <span className="inline-flex items-center gap-1 shrink-0">
      <span
        title="نوع الجهاز"
        className="inline-flex size-6 items-center justify-center rounded-md border border-border bg-background text-primary"
      >
        <DeviceIcon className="size-3.5" />
      </span>
      <span
        title="نظام التشغيل"
        className="inline-flex h-6 items-center justify-center gap-0.5 rounded-md border border-border bg-background px-1.5 text-[10px] font-mono font-bold text-secondary-foreground"
      >
        <Laptop className="size-2.5 opacity-70" />
        {osTag}
      </span>
      <span
        title="المتصفح"
        className="inline-flex size-6 items-center justify-center rounded-md border border-border bg-background text-sky-400"
      >
        <BrowserIcon className="size-3.5" />
      </span>
    </span>
  );
}

export function MemberProfileModal() {
  const {
    me,
    myRank,
    canAccessCp,
    ranks,
    activeRoom,
    onlineUsers,
    profileModalUserId,
    openMemberProfile,
    openImageLightbox,
    openPrivateChatWith,
    setViewMode,
    likeUser,
    sendUserAlert,
    updateMyProfile,
    adminMicAction,
    refreshBootstrap,
    notify,
  } = useChat();

  const [fetchedUser, setFetchedUser] = useState<PublicUser | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [alertComposerOpen, setAlertComposerOpen] = useState(false);
  const [alertText, setAlertText] = useState('');
  const [editingDesign, setEditingDesign] = useState(false);
  const [myTab, setMyTab] = useState<'appearance' | 'info' | 'security'>('appearance');

  // Own profile edit state
  const [editTopic, setEditTopic] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editColor, setEditColor] = useState('#eab308');
  const [editNameStyle, setEditNameStyle] = useState('solid');
  const [editFontFamily, setEditFontFamily] = useState('ibm_arabic');
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null);
  const [editHideCountryFlag, setEditHideCountryFlag] = useState(false);
  const [newMyPassword, setNewMyPassword] = useState('');
  const [savingMine, setSavingMine] = useState(false);

  // Staff moderation state
  const [revealOpen, setRevealOpen] = useState(false);
  const [revealLoading, setRevealLoading] = useState(false);
  const [revealData, setRevealData] = useState<RevealResponse | null>(null);
  const [activeBans, setActiveBans] = useState<BanRecord[]>([]);
  const [banMinutes, setBanMinutes] = useState<number>(60);
  const [banReason, setBanReason] = useState('');
  const [modRankId, setModRankId] = useState('');
  const [modSubDays, setModSubDays] = useState('');
  const [modUsername, setModUsername] = useState('');
  const [modTopic, setModTopic] = useState('');
  const [modLikes, setModLikes] = useState('0');
  const [modPassword, setModPassword] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [staffBusy, setStaffBusy] = useState(false);

  const onlineMatch = profileModalUserId
    ? onlineUsers.find((u) => u.id === profileModalUserId) ?? (me?.id === profileModalUserId ? me : null)
    : null;
  const target = onlineMatch ?? fetchedUser;

  useEffect(() => {
    setEditingDesign(false);
    setAlertComposerOpen(false);
    setAlertText('');
    setMyTab('appearance');
    setRevealOpen(false);
    setRevealData(null);
    setActiveBans([]);
    setBanReason('');
    setModPassword('');
    setNewMyPassword('');

    if (!profileModalUserId) {
      setFetchedUser(null);
      return;
    }

    if (!onlineMatch) {
      void apiFetch<{ user: PublicUser }>(`/api/users/${profileModalUserId}`)
        .then((res) => setFetchedUser(res.user))
        .catch(() => setFetchedUser(null));
    } else {
      setFetchedUser(null);
    }
  }, [profileModalUserId, onlineMatch?.id]);

  useEffect(() => {
    if (!target) return;
    setEditTopic(target.topic || target.username);
    setEditStatus(target.status || '');
    setEditColor(target.color || '#eab308');
    setEditNameStyle(target.nameStyle || 'solid');
    setEditFontFamily(target.fontFamily || 'ibm_arabic');
    setEditAvatarUrl(target.avatarUrl);
    setEditHideCountryFlag(Boolean(target.hideCountryFlag));

    setModRankId(target.rankId);
    setModUsername(target.username);
    setModTopic(target.topic);
    setModLikes(expandScientificIntegerString(target.likes));

    if (me && target.id !== me.id && hasPermission(myRank, 'ban_users')) {
      void apiFetch<{ bans: BanRecord[] }>(`/api/cp/users/${target.id}/bans`)
        .then((res) => setActiveBans(res.bans ?? []))
        .catch(() => setActiveBans([]));
    }
  }, [
    target?.id,
    target?.rankId,
    target?.likes,
    target?.topic,
    target?.color,
    target?.nameStyle,
    target?.fontFamily,
    target?.hideCountryFlag,
    me,
    myRank,
  ]);

  if (!profileModalUserId || !target) return null;

  const isMe = target.id === me?.id;
  const targetRank = ranks.find((r) => r.id === target.rankId) ?? null;
  const streakInfo = getStreakDisplayState(target.streak, target.streakLastDay);

  const hideModForDesign = isMe && editingDesign;
  const canMod =
    !isMe &&
    canManageTarget(effectiveRankLevel(myRank), effectiveRankLevel(targetRank), false);
  const canSelfStaff = isMe && !editingDesign && hasUpgradedRank(myRank);
  const canBan = !isMe && canMod && hasPermission(myRank, 'ban_users');
  const canRanks = !hideModForDesign && (canMod || canSelfStaff) && hasPermission(myRank, 'manage_ranks');
  const canMembers = !hideModForDesign && (canMod || canSelfStaff) && hasPermission(myRank, 'manage_members');
  const canVerify = !hideModForDesign && (canMod || canSelfStaff) && hasPermission(myRank, 'verify_members');
  const canMicMod = !hideModForDesign && (canMod || canSelfStaff) && hasPermission(myRank, 'moderate_mics');
  const canReveal =
    !hideModForDesign &&
    (hasPermission(myRank, 'reveal_users') ||
      hasPermission(myRank, 'view_logs') ||
      Boolean(myRank?.isOwner));

  const targetSeat = activeRoom?.seats.find((s) => s.userId === target.id) ?? null;
  const isSilenced = Boolean(target.silencedUntil && target.silencedUntil > Date.now());
  const actorLevel = effectiveRankLevel(myRank);
  const isTargetOnline = Boolean(onlineMatch || target.online);
  const compactLikes = formatCompactLikes(target.likes);
  const exactLikes = formatExactNumberString(target.likes);

  async function handleLikeClick() {
    if (!target || actionBusy) return;
    setActionBusy(true);
    try {
      await likeUser(target.id);
      if (!onlineMatch) {
        const res = await apiFetch<{ user: PublicUser }>(`/api/users/${target.id}`).catch(() => null);
        if (res?.user) setFetchedUser(res.user);
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر تسجيل اللايك', 'error');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleSendAlertSubmit(e?: FormEvent) {
    e?.preventDefault();
    if (!target || actionBusy) return;
    const trimmed = alertText.trim();
    if (!trimmed) {
      notify('يرجى كتابة نص رسالة التنبيه', 'error');
      return;
    }
    setActionBusy(true);
    try {
      await sendUserAlert(target.id, trimmed);
      setAlertText('');
      setAlertComposerOpen(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر إرسال التنبيه', 'error');
    } finally {
      setActionBusy(false);
    }
  }

  function handleAvatarFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setEditAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  async function saveMyEdits(e: FormEvent) {
    e.preventDefault();
    setSavingMine(true);
    try {
      await updateMyProfile({
        topic: editTopic || undefined,
        status: editStatus,
        color: editColor,
        nameStyle: editNameStyle,
        fontFamily: editFontFamily,
        avatarUrl: editAvatarUrl,
        hideCountryFlag: editHideCountryFlag,
        newPassword: newMyPassword.trim() || undefined,
      });
      setNewMyPassword('');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر حفظ التعديلات', 'error');
    } finally {
      setSavingMine(false);
    }
  }

  async function toggleReveal() {
    if (revealOpen) {
      setRevealOpen(false);
      return;
    }
    setRevealOpen(true);
    setRevealLoading(true);
    try {
      const data = await apiFetch<RevealResponse>(`/api/cp/reveal/${target!.id}`);
      setRevealData(data);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر جلب بيانات الكشف', 'error');
      setRevealOpen(false);
    } finally {
      setRevealLoading(false);
    }
  }

  async function handleSilence(minutes: number) {
    setStaffBusy(true);
    try {
      await apiFetch(`/api/cp/users/${target!.id}/silence`, {
        method: 'POST',
        body: JSON.stringify({ minutes }),
      });
      await refreshBootstrap();
      notify(minutes > 0 ? `تم إسكات ${target!.username} لمدة ${minutes} دقيقة` : 'تم فك الإسكات', 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر تنفيذ الإسكات', 'error');
    } finally {
      setStaffBusy(false);
    }
  }

  async function handleKickOrBan(minutes: number, defaultReason: string) {
    setStaffBusy(true);
    try {
      await apiFetch('/api/cp/bans', {
        method: 'POST',
        body: JSON.stringify({
          targetUserId: target!.id,
          reason: banReason.trim() || defaultReason,
          minutes: minutes > 0 ? minutes : null,
        }),
      });
      const bansRes = await apiFetch<{ bans: BanRecord[] }>(`/api/cp/users/${target!.id}/bans`).catch(() => ({ bans: [] }));
      setActiveBans(bansRes.bans);
      await refreshBootstrap();
      notify(minutes === 10 ? `تم طرد ${target!.username}` : `تم حظر ${target!.username}`, 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر تنفيذ الحظر', 'error');
    } finally {
      setStaffBusy(false);
    }
  }

  async function handleUnban(banId: string) {
    setStaffBusy(true);
    try {
      await apiFetch(`/api/cp/bans/${banId}/unban`, { method: 'POST' });
      setActiveBans((prev) => prev.filter((b) => b.id !== banId));
      await refreshBootstrap();
      notify('تم فك الحظر', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر فك الحظر', 'error');
    } finally {
      setStaffBusy(false);
    }
  }

  async function handleSaveRank() {
    setStaffBusy(true);
    try {
      await apiFetch(`/api/cp/users/${target!.id}/update`, {
        method: 'POST',
        body: JSON.stringify({
          rankId: modRankId,
          subscriptionDays: modSubDays ? Number(modSubDays) : 0,
        }),
      });
      await refreshBootstrap();
      notify('تم تحديث الرتبة', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر تحديث الرتبة', 'error');
    } finally {
      setStaffBusy(false);
    }
  }

  async function handleMemberAdminSave() {
    setStaffBusy(true);
    try {
      await apiFetch(`/api/cp/users/${target!.id}/update`, {
        method: 'POST',
        body: JSON.stringify({
          username: modUsername.trim() || undefined,
          topic: modTopic.trim() || undefined,
          likes: Number.isFinite(Number(modLikes)) ? Number(modLikes) : undefined,
          newPassword: modPassword.trim() || undefined,
        }),
      });
      setModPassword('');
      await refreshBootstrap();
      notify('تم حفظ تعديلات العضو', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر حفظ التعديلات', 'error');
    } finally {
      setStaffBusy(false);
    }
  }

  async function handleToggleVerify() {
    setStaffBusy(true);
    try {
      await apiFetch(`/api/cp/users/${target!.id}/verify`, {
        method: 'POST',
        body: JSON.stringify({
          verified: !target!.verified,
          royalLoginBoys: target!.royalLoginBoys,
          royalLoginGirls: target!.royalLoginGirls,
        }),
      });
      await refreshBootstrap();
      notify(!target!.verified ? 'تم توثيق العضوية' : 'تم إلغاء التوثيق', 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر تغيير التوثيق', 'error');
    } finally {
      setStaffBusy(false);
    }
  }

  async function handleClearMemberAvatar() {
    setStaffBusy(true);
    try {
      await apiFetch(`/api/cp/users/${target!.id}/update`, {
        method: 'POST',
        body: JSON.stringify({ clearAvatar: true }),
      });
      await refreshBootstrap();
      notify('تم حذف صورة العضو', 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر حذف الصورة', 'error');
    } finally {
      setStaffBusy(false);
    }
  }

  async function handleDeleteMember() {
    setStaffBusy(true);
    try {
      await apiFetch(`/api/cp/users/${target!.id}`, { method: 'DELETE' });
      setConfirmDeleteOpen(false);
      openMemberProfile(null);
      await refreshBootstrap();
      notify('تم حذف العضوية نهائياً', 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر حذف العضوية', 'error');
    } finally {
      setStaffBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      data-testid="member-profile-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) openMemberProfile(null);
      }}
    >
      <div className="relative flex max-h-[90dvh] w-full max-w-md flex-col overflow-y-auto rounded-lg border border-border bg-gradient-panel p-0 shadow-panel scrollbar-thin">
        {/* Top Night + Gold Banner matching MemberCard.tsx */}
        <div className="relative h-24 shrink-0 bg-gradient-night">
          <div className="absolute inset-0 bg-gradient-gold opacity-20" />
          <button
            type="button"
            aria-label="إغلاق البروفايل"
            onClick={() => openMemberProfile(null)}
            className="absolute end-4 top-4 z-10 rounded-sm p-1 text-foreground/80 opacity-80 transition hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Centered Profile Header & Overlapping 2xl Avatar */}
        <div className="relative z-10 -mt-12 flex flex-col items-center px-5 pb-5 text-center">
          {(() => {
            const displayedAvatarUrl = isMe ? editAvatarUrl : target.avatarUrl;
            const avatarEl = (
              <UserAvatar
                user={{
                  username: target.username,
                  color: isMe ? editColor : target.color,
                  avatarUrl: displayedAvatarUrl,
                }}
                size="2xl"
                fit="cover-top"
                className="ring-4 ring-surface"
              />
            );
            return displayedAvatarUrl ? (
              <button
                type="button"
                data-action="zoom-profile-avatar"
                aria-label="تكبير صورة العضو"
                onClick={() => openImageLightbox(displayedAvatarUrl, target.topic || target.username)}
                className="rounded-full cursor-zoom-in transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {avatarEl}
              </button>
            ) : (
              avatarEl
            );
          })()}

          <div className="mt-2 flex flex-col items-center space-y-1 text-center">
            <h2 className="text-xl font-semibold leading-none tracking-tight">
              <UserDisplayName
                user={
                  isMe
                    ? {
                        ...target,
                        topic: editTopic || target.topic,
                        color: editColor,
                        nameStyle: editNameStyle,
                        fontFamily: editFontFamily,
                      }
                    : target
                }
                rank={targetRank}
                hideStreak={false}
              />
            </h2>

            {targetRank && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-surface-raised px-2.5 py-0.5 text-sm font-semibold"
                style={{ color: targetRank.color }}
              >
                <RankIconGlyph icon={targetRank.icon} className="size-3.5" />
                <span>{targetRank.name}</span>
              </span>
            )}

            <p className="text-sm text-muted-foreground">
              {target.status || 'بدون حالة'}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1">
              <span className={`size-2 rounded-full ${isTargetOnline ? 'bg-success' : 'bg-muted-foreground'}`} />
              {isTargetOnline ? 'متصل الآن' : 'غير متصل'}
            </span>
            <span
              title={!target.isGuest ? `${exactLikes} لايك` : undefined}
              className="rounded-full bg-secondary px-2.5 py-1 tabular-nums"
            >
              {target.isGuest ? 'زائر' : `عضو · ${compactLikes.fullText}`}
            </span>
            {target.verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-sky-400">
                <BadgeCheck className="size-3.5" /> موثق
              </span>
            )}
            {isSilenced && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2.5 py-1 text-destructive font-semibold">
                <VolumeX className="size-3.5" /> مسكت حالياً
              </span>
            )}
            <CountryFlagBadge
              country={target.country}
              hideCountryFlag={isMe ? editHideCountryFlag : target.hideCountryFlag}
            />
          </div>

          {/* Streak Status Card */}
          {streakInfo.visible && !(isMe && editingDesign) && (
            <div
              className={`mt-3 w-full flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-xs text-start ${
                streakInfo.status === 'dormant'
                  ? 'border-border bg-surface/70 text-muted-foreground'
                  : 'border-primary/35 bg-primary/10 text-foreground'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <StreakFlameBadge
                  streak={target.streak}
                  streakLastDay={target.streakLastDay}
                  size="md"
                />
                <div>
                  <div className="font-bold text-primary">
                    {streakInfo.status === 'dormant'
                      ? `ستريك خامد (${streakInfo.count} يوم)`
                      : `ستريك نشط (${streakInfo.count} يوم متتالي)`}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {streakInfo.status === 'dormant'
                      ? `فترة سماح 3 أيام قبل التصفير (متبقي ${streakInfo.graceDaysLeft} يوم)`
                      : 'الدخول اليومي المتتالي يضيء شعلة التفاعل'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* OWN PROFILE ACTIONS */}
          {isMe && !editingDesign && (
            <div className="mt-4 flex w-full gap-2" data-testid="own-profile-overview">
              <button
                type="button"
                data-action="open-design-editor"
                onClick={() => setEditingDesign(true)}
                className="flex-1 inline-flex h-9 items-center justify-center gap-2 rounded-md bg-gradient-gold px-4 text-sm font-semibold text-primary-foreground shadow-gold hover:brightness-110 transition cursor-pointer"
              >
                <Palette className="size-4" />
                <span>تعديل تصميم العضوية</span>
              </button>

              {canAccessCp && (
                <button
                  type="button"
                  data-action="profile-open-cp"
                  onClick={() => {
                    openMemberProfile(null);
                    setViewMode('cp');
                  }}
                  className="flex-1 inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-surface-raised/70 px-4 text-sm font-medium text-foreground backdrop-blur hover:bg-accent transition cursor-pointer"
                >
                  <ShieldCheck className="size-4 text-primary" />
                  <span>فتح لوحة التحكم</span>
                </button>
              )}
            </div>
          )}

          {/* OWN PROFILE — MEMBERSHIP DESIGN EDITOR */}
          {isMe && editingDesign && (
            <div
              className="mt-4 w-full space-y-3 rounded-xl border border-border bg-surface/70 p-3 text-start"
              data-testid="design-editor-panel"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border/70 pb-2.5">
                <div className="flex items-center gap-2">
                  <Palette className="size-4 text-primary" />
                  <h4 className="font-display text-base text-foreground">تعديل تصميم العضوية</h4>
                </div>
                <button
                  type="button"
                  data-action="close-design-editor"
                  onClick={() => setEditingDesign(false)}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-surface-raised/70 px-2.5 text-xs font-medium text-foreground hover:bg-accent transition cursor-pointer"
                >
                  <ArrowRight className="size-3.5" />
                  <span>رجوع للبروفايل</span>
                </button>
              </div>

              {/* Editor Tabs matching tabs.tsx */}
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 text-muted-foreground">
                <button
                  type="button"
                  onClick={() => setMyTab('appearance')}
                  className={`inline-flex items-center justify-center gap-1 rounded-md py-1 text-xs font-medium transition cursor-pointer ${
                    myTab === 'appearance'
                      ? 'bg-background text-foreground shadow'
                      : 'hover:text-foreground'
                  }`}
                >
                  <Palette className="size-3.5" /> الألوان والخط
                </button>
                <button
                  type="button"
                  onClick={() => setMyTab('info')}
                  className={`inline-flex items-center justify-center gap-1 rounded-md py-1 text-xs font-medium transition cursor-pointer ${
                    myTab === 'info'
                      ? 'bg-background text-foreground shadow'
                      : 'hover:text-foreground'
                  }`}
                >
                  <Type className="size-3.5" /> الزخرفة والصورة
                </button>
                <button
                  type="button"
                  onClick={() => setMyTab('security')}
                  className={`inline-flex items-center justify-center gap-1 rounded-md py-1 text-xs font-medium transition cursor-pointer ${
                    myTab === 'security'
                      ? 'bg-background text-foreground shadow'
                      : 'hover:text-foreground'
                  }`}
                >
                  <KeyRound className="size-3.5" /> كلمة المرور
                </button>
              </div>

              <form onSubmit={saveMyEdits} className="space-y-3">
                {myTab === 'appearance' && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground">ألوان الاسم الجاهزة</span>
                        <span className="text-[11px] text-muted-foreground">اختر لون اسمك</span>
                      </div>
                      <div className="grid grid-cols-10 gap-1.5 rounded-lg border border-border bg-background/50 p-2.5">
                        {PRESET_NAME_COLORS.map((preset) => {
                          const selected = editColor.toLowerCase() === preset.hex.toLowerCase();
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              title={preset.label}
                              data-color-preset={preset.id}
                              onClick={() => setEditColor(preset.hex)}
                              className={`relative flex aspect-square items-center justify-center rounded-full ring-offset-2 ring-offset-background transition cursor-pointer ${
                                selected ? 'ring-2 ring-ring scale-110' : 'hover:scale-105'
                              }`}
                              style={{ backgroundColor: preset.hex }}
                            >
                              {selected && <Check className="size-3 text-primary-foreground stroke-[3]" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="block text-xs font-semibold text-foreground">
                        نمط الاسم
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {TELEGRAM_NAME_STYLES.map((st) => {
                          const selected = editNameStyle === st.id;
                          return (
                            <button
                              key={st.id}
                              type="button"
                              data-name-style={st.id}
                              onClick={() => setEditNameStyle(st.id)}
                              className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-start transition cursor-pointer ${
                                selected
                                  ? 'border-primary bg-primary/10'
                                  : 'border-border bg-background/50 hover:border-primary/40'
                              }`}
                            >
                              <UserDisplayName
                                user={{
                                  username: editTopic || target.username,
                                  topic: editTopic || target.topic,
                                  color: editColor,
                                  nameStyle: st.id,
                                  fontFamily: editFontFamily,
                                }}
                                hideStreak
                                className="text-xs"
                              />
                              <span className="shrink-0 text-[10px] text-muted-foreground">
                                {st.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="block text-xs font-semibold text-foreground">
                        نوع الخط (عربي & English)
                      </span>
                      <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto scrollbar-thin pe-0.5">
                        {NAME_FONTS.map((f) => {
                          const selected = editFontFamily === f.id;
                          return (
                            <button
                              key={f.id}
                              type="button"
                              data-font-option={f.id}
                              onClick={() => setEditFontFamily(f.id)}
                              className={`flex flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-start transition cursor-pointer ${
                                selected
                                  ? 'border-primary bg-primary/10'
                                  : 'border-border bg-background/50 hover:border-primary/40'
                              }`}
                            >
                              <span
                                className="text-xs font-bold text-foreground"
                                style={{ fontFamily: f.cssFamily }}
                              >
                                {editTopic || f.sample}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {f.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {myTab === 'info' && (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="block text-xs text-muted-foreground">الزخرفة / الاسم المعروض</label>
                      <input
                        type="text"
                        value={editTopic}
                        onChange={(e) => setEditTopic(e.target.value)}
                        maxLength={32}
                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs text-muted-foreground">الحالة الشخصية</label>
                      <input
                        type="text"
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        maxLength={80}
                        placeholder="اكتب شي يعبر عنك..."
                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface-raised/70 px-3 text-xs font-medium hover:bg-accent transition">
                        <Upload className="size-3.5 text-primary" />
                        <span>رفع صورة شخصية</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarFile}
                          className="hidden"
                        />
                      </label>
                      {editAvatarUrl && (
                        <button
                          type="button"
                          onClick={() => setEditAvatarUrl(null)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 text-xs text-destructive hover:bg-destructive/20 cursor-pointer"
                        >
                          <ImageOff className="size-3.5" /> إزالة الصورة
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {myTab === 'security' && (
                  <div className="space-y-2">
                    {target.isGuest ? (
                      <p className="rounded-lg border border-border bg-background/50 p-3 text-xs text-muted-foreground">
                        حساب الزائر لا يملك كلمة مرور. سجل عضوية دائمة لحفظ بياناتك.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        <label className="block text-xs text-muted-foreground">كلمة المرور الجديدة</label>
                        <input
                          type="password"
                          value={newMyPassword}
                          onChange={(e) => setNewMyPassword(e.target.value)}
                          placeholder="أدخل كلمة المرور الجديدة (3 أحرف فأكثر)"
                          className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                      </div>
                    )}
                  </div>
                )}

                <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/50 px-3 py-2.5 cursor-pointer hover:border-primary/40 transition">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {editHideCountryFlag ? (
                      <EyeOff className="size-4 shrink-0 text-warning" />
                    ) : (
                      <Flag className="size-4 shrink-0 text-primary" />
                    )}
                    <div className="min-w-0">
                      <span className="block text-xs font-semibold text-foreground">
                        إخفاء علم الدولة من قائمة الأعضاء
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        عند التفعيل لن يظهر علم دولتك لأي عضو أو إدارة في الموقع
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    data-testid="toggle-hide-country-flag"
                    checked={editHideCountryFlag}
                    onChange={(e) => setEditHideCountryFlag(e.target.checked)}
                    className="size-4 shrink-0 accent-primary"
                  />
                </label>

                <button
                  type="submit"
                  disabled={savingMine}
                  data-action="save-design-edits"
                  className="inline-flex h-10 w-full items-center justify-center rounded-md bg-gradient-gold text-sm font-semibold text-primary-foreground shadow-gold hover:brightness-110 disabled:opacity-50 transition cursor-pointer"
                >
                  {savingMine ? 'جاري الحفظ...' : 'حفظ تعديلات تصميم العضوية'}
                </button>
              </form>
            </div>
          )}

          {/* OTHER MEMBER ACTIONS: Like, Private Message, Alert (تنبيه) */}
          {!isMe && (
            <div className="mt-4 w-full space-y-2.5">
              <div className="grid w-full grid-cols-3 gap-2">
                <button
                  type="button"
                  data-action="profile-like"
                  disabled={actionBusy}
                  onClick={() => void handleLikeClick()}
                  title={`${exactLikes} لايك`}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-surface-raised/70 px-2.5 text-xs sm:text-sm font-medium text-foreground backdrop-blur hover:bg-accent transition cursor-pointer disabled:opacity-50"
                >
                  <Heart className="size-4 shrink-0 text-rose-400" />
                  <span className="tabular-nums" dir="ltr">
                    {compactLikes.valueText}
                  </span>
                  <span className="text-xs opacity-80">لايك</span>
                </button>
                <button
                  type="button"
                  data-action="profile-pm"
                  onClick={() => {
                    if (target.lockPm) {
                      notify(PM_LOCKED_ERROR_MESSAGE, 'error');
                      return;
                    }
                    openMemberProfile(null);
                    openPrivateChatWith(target.id);
                  }}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-surface-raised/70 px-2.5 text-xs sm:text-sm font-medium text-foreground backdrop-blur hover:bg-accent transition cursor-pointer"
                >
                  <Mail className="size-4 shrink-0" />
                  <span>رسالة خاصة</span>
                </button>
                <button
                  type="button"
                  data-action="profile-alert"
                  disabled={actionBusy}
                  aria-expanded={alertComposerOpen}
                  onClick={() => {
                    if (target.lockAlerts) {
                      notify(ALERTS_LOCKED_ERROR_MESSAGE, 'error');
                      return;
                    }
                    setAlertComposerOpen((v) => !v);
                  }}
                  className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs sm:text-sm font-medium backdrop-blur transition cursor-pointer disabled:opacity-50 ${
                    alertComposerOpen
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border bg-surface-raised/70 text-foreground hover:bg-accent'
                  }`}
                >
                  <BellRing className="size-4 shrink-0 text-primary" />
                  <span>تنبيه</span>
                </button>
              </div>

              {alertComposerOpen && (
                <form
                  data-testid="alert-compose-box"
                  onSubmit={(e) => void handleSendAlertSubmit(e)}
                  className="space-y-2 rounded-xl border border-primary/40 bg-surface/90 p-3 text-start shadow-panel animate-float-in"
                >
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="profile-alert-input"
                      className="flex items-center gap-1.5 text-xs font-semibold text-primary"
                    >
                      <BellRing className="size-3.5" />
                      <span>إرسال رسالة تنبيه إلى {target.topic}</span>
                    </label>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {alertText.trim().length}/240
                    </span>
                  </div>
                  <textarea
                    id="profile-alert-input"
                    data-testid="alert-message-input"
                    autoFocus
                    rows={2}
                    maxLength={240}
                    value={alertText}
                    onChange={(e) => setAlertText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendAlertSubmit();
                      }
                    }}
                    placeholder="اكتب رسالة التنبيه التي تريد إرسالها..."
                    className="w-full resize-none rounded-md border border-input bg-background/70 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      data-action="cancel-alert-compose"
                      onClick={() => {
                        setAlertComposerOpen(false);
                        setAlertText('');
                      }}
                      className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-background/60 px-3 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      data-action="send-alert-submit"
                      disabled={actionBusy || !alertText.trim()}
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-gradient-gold px-4 text-xs font-semibold text-primary-foreground shadow-gold hover:brightness-110 disabled:opacity-50 transition cursor-pointer"
                    >
                      <BellRing className="size-3.5" />
                      <span>{actionBusy ? 'جاري الإرسال...' : 'إرسال'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* STAFF TOOLS */}
          {(canMicMod || canReveal || canBan || canRanks || canMembers || canVerify) && (
            <div className="mt-5 w-full space-y-3 text-start">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <ShieldCheck className="size-4 text-primary" /> أدوات الإشراف
              </p>

              {/* Staff Mic Controls */}
              {canMicMod && targetSeat && activeRoom && (
                <section className="space-y-2.5 rounded-xl border border-border bg-surface/70 p-3 text-start">
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                    <Mic className="size-4" /> المايك (مقعد #{targetSeat.seat})
                  </h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void adminMicAction(activeRoom.id, targetSeat.seat, 'admin_force_mute')}
                      className="flex-1 inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-surface-raised/70 px-3 text-xs font-medium text-foreground hover:bg-accent transition cursor-pointer"
                    >
                      <MicOff className="size-3.5" />
                      {targetSeat.forceMuted ? 'فك الكتم' : 'كتم المايك'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void adminMicAction(activeRoom.id, targetSeat.seat, 'admin_kick')}
                      className="flex-1 inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-destructive px-3 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 transition cursor-pointer"
                    >
                      <PhoneOff className="size-3.5" /> إنزال من المايك
                    </button>
                  </div>
                </section>
              )}

              {/* Compact Reveal ("الكشف") */}
              {canReveal && (
                <section className="space-y-2.5 rounded-xl border border-border bg-surface/70 p-3 text-start">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                      <ScanSearch className="size-4" /> الكشف والمطابقة
                    </h3>
                    <button
                      type="button"
                      data-action="toggle-reveal"
                      onClick={() => void toggleReveal()}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-surface-raised/70 px-3 text-xs font-medium text-foreground hover:bg-accent transition cursor-pointer"
                    >
                      <Eye className="size-3.5 text-primary" />
                      {revealLoading ? 'جاري الفحص...' : revealOpen ? 'إخفاء الكشف' : 'كشف'}
                    </button>
                  </div>

                  {revealOpen && revealData && (
                    <div className="space-y-2.5 pt-1" data-testid="reveal-panel">
                      <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-thin">
                        {revealData.logins.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/60 px-2.5 py-1.5 text-[11px]"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <CompactRevealIcons entry={entry} />
                              <span className="font-mono text-muted-foreground truncate" dir="ltr">
                                {entry.ip}
                              </span>
                            </div>
                            <time className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                              {new Date(entry.createdAt).toLocaleString('ar', {
                                month: 'numeric',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </time>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-border/70 pt-2 space-y-1.5">
                        <div className="text-[11px] font-bold text-muted-foreground">
                          حسابات ثانية دخلت من نفس الآيبي ({revealData.linkedSameIp.length})
                        </div>
                        {revealData.linkedSameIp.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {revealData.linkedSameIp.map((acc) => (
                              <button
                                key={acc.id}
                                type="button"
                                onClick={() => openMemberProfile(acc.id)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-2 py-1 text-xs hover:border-primary/60 transition cursor-pointer"
                              >
                                <UserAvatar user={acc} size="xs" />
                                <UserDisplayName
                                  user={{
                                    username: acc.username,
                                    topic: acc.topic,
                                    color: acc.color,
                                    nameStyle: acc.nameStyle,
                                    fontFamily: acc.fontFamily,
                                  }}
                                  hideStreak
                                  className="text-xs"
                                />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">
                            لا توجد حسابات أخرى مسجلة من نفس الآيبي
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Full Staff Moderation Sections */}
              {(canBan || canRanks || canMembers || canVerify) && (
                <div className="space-y-3" data-testid="staff-moderation-panel">
                  {canBan && (
                    <section className="space-y-2.5 rounded-xl border border-border bg-surface/70 p-3 text-start">
                      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                        <Ban className="size-4" /> طرد وباند وإسكات
                      </h3>

                      {activeBans.length > 0 && (
                        <div className="space-y-1">
                          {activeBans.map((b) => (
                            <div
                              key={b.id}
                              className="flex items-center justify-between gap-2 rounded-lg bg-destructive/15 px-2.5 py-1.5 text-xs"
                            >
                              <span className="truncate">{b.reason || 'حظر'}</span>
                              <button
                                type="button"
                                onClick={() => void handleUnban(b.id)}
                                className="shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold text-success hover:bg-accent cursor-pointer"
                              >
                                فك
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-1">
                        {DURATION_PRESETS.map((p) => (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => setBanMinutes(p.minutes)}
                            className={`rounded-md px-2 py-1 text-[11px] font-medium border transition cursor-pointer ${
                              banMinutes === p.minutes
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border bg-background/50 text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>

                      <input
                        type="text"
                        value={banReason}
                        onChange={(e) => setBanReason(e.target.value)}
                        placeholder="السبب (اختياري)"
                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />

                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          disabled={staffBusy}
                          onClick={() => void handleKickOrBan(10, 'طرد إداري')}
                          className="h-8 rounded-md border border-border bg-surface-raised/70 text-xs font-medium text-warning hover:bg-accent cursor-pointer"
                        >
                          طرد (10د)
                        </button>
                        <button
                          type="button"
                          disabled={staffBusy}
                          onClick={() => void handleKickOrBan(banMinutes, 'حظر إداري')}
                          className="inline-flex h-8 items-center justify-center gap-1 rounded-md bg-destructive text-xs font-medium text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
                        >
                          <Ban className="size-3.5" /> باند
                        </button>
                        <button
                          type="button"
                          disabled={staffBusy}
                          onClick={() => void handleSilence(isSilenced ? 0 : banMinutes || 15)}
                          className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-border bg-surface-raised/70 text-xs font-medium hover:bg-accent cursor-pointer"
                        >
                          {isSilenced ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
                          {isSilenced ? 'فك إسكات' : 'إسكات'}
                        </button>
                      </div>
                    </section>
                  )}

                  {canRanks && (
                    <section className="space-y-2.5 rounded-xl border border-border bg-surface/70 p-3 text-start">
                      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                        <ShieldAlert className="size-4" /> الرتبة (المجموعة)
                      </h3>
                      <div className="grid grid-cols-[1fr_5.5rem] gap-2">
                        <select
                          value={modRankId}
                          onChange={(e) => setModRankId(e.target.value)}
                          className="h-9 rounded-md border border-input bg-surface px-2.5 text-xs"
                        >
                          {ranks
                            .filter(
                              (r) =>
                                Boolean(myRank?.isOwner) ||
                                effectiveRankLevel(r) < actorLevel ||
                                r.id === target.rankId
                            )
                            .map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                        </select>
                        <input
                          type="number"
                          min={0}
                          value={modSubDays}
                          onChange={(e) => setModSubDays(e.target.value)}
                          placeholder="أيام"
                          className="h-9 rounded-md border border-input bg-transparent px-2.5 text-xs"
                        />
                      </div>
                      <p className="text-[0.7rem] text-muted-foreground">اترك الأيام فاضية لرتبة دائمة.</p>
                      <button
                        type="button"
                        disabled={staffBusy}
                        onClick={() => void handleSaveRank()}
                        className="h-8 w-full rounded-md bg-gradient-gold text-xs font-semibold text-primary-foreground shadow-gold hover:brightness-110 transition cursor-pointer"
                      >
                        حفظ الرتبة
                      </button>
                    </section>
                  )}

                  {canMembers && (
                    <section className="space-y-2.5 rounded-xl border border-border bg-surface/70 p-3 text-start">
                      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                        <UserCog className="size-4" /> بيانات الحساب
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={modUsername}
                          onChange={(e) => setModUsername(e.target.value)}
                          placeholder="الاسم"
                          className="h-9 rounded-md border border-input bg-transparent px-2.5 text-xs"
                        />
                        <input
                          type="text"
                          value={modTopic}
                          onChange={(e) => setModTopic(e.target.value)}
                          placeholder="الزخرفة"
                          className="h-9 rounded-md border border-input bg-transparent px-2.5 text-xs"
                        />
                        <input
                          type="text"
                          inputMode="numeric"
                          value={modLikes}
                          onChange={(e) => setModLikes(e.target.value.replace(/[^\d]/g, ''))}
                          placeholder="اللايكات"
                          className="h-9 rounded-md border border-input bg-transparent px-2.5 text-xs tabular-nums"
                        />
                        <input
                          type="password"
                          value={modPassword}
                          onChange={(e) => setModPassword(e.target.value)}
                          placeholder="كلمة سر جديدة"
                          className="h-9 rounded-md border border-input bg-transparent px-2.5 text-xs"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={staffBusy}
                          onClick={() => void handleMemberAdminSave()}
                          className="flex-1 h-8 rounded-md border border-border bg-surface-raised/70 text-xs font-medium text-foreground hover:bg-accent transition cursor-pointer"
                        >
                          حفظ البيانات
                        </button>
                        {target.avatarUrl && (
                          <button
                            type="button"
                            disabled={staffBusy}
                            onClick={() => void handleClearMemberAvatar()}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-surface-raised/70 px-2.5 text-xs hover:bg-accent cursor-pointer"
                          >
                            <ImageOff className="size-3.5" /> حذف الصورة
                          </button>
                        )}
                        {!isMe && (
                          <button
                            type="button"
                            disabled={staffBusy}
                            onClick={() => setConfirmDeleteOpen(true)}
                            className="inline-flex h-8 items-center gap-1 rounded-md bg-destructive px-2.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
                          >
                            <Trash2 className="size-3.5" /> حذف العضوية
                          </button>
                        )}
                      </div>
                    </section>
                  )}

                  {canVerify && (
                    <button
                      type="button"
                      disabled={staffBusy}
                      onClick={() => void handleToggleVerify()}
                      className={`flex h-9 w-full items-center justify-center gap-1.5 rounded-md border text-xs font-semibold transition cursor-pointer ${
                        target.verified
                          ? 'border-sky-500/40 bg-sky-500/15 text-sky-300'
                          : 'border-border bg-surface/70 text-muted-foreground hover:bg-accent hover:text-foreground'
                      }`}
                    >
                      <BadgeCheck className="size-4" />
                      {target.verified ? 'إلغاء توثيق العضوية' : 'توثيق العضوية'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmActionModal
        open={confirmDeleteOpen}
        title="تأكيد حذف العضوية"
        message={`هل أنت متأكد من حذف حساب "${target.username}" نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="حذف نهائي"
        danger
        onConfirm={() => void handleDeleteMember()}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
}
