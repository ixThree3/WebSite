import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Ban,
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
  MicOff,
  Monitor,
  Palette,
  PhoneOff,
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
import type { BanRecord, PublicUser, RevealLoginEntry, RevealResponse } from '../shared/types.ts';
import { CountryFlagBadge } from './CountryFlagBadge.tsx';
import {
  ConfirmActionModal,
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
    openPrivateChatWith,
    setViewMode,
    likeUser,
    updateMyProfile,
    adminMicAction,
    refreshBootstrap,
    notify,
  } = useChat();

  const [fetchedUser, setFetchedUser] = useState<PublicUser | null>(null);
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
    setModLikes(String(target.likes));

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      data-testid="member-profile-modal"
    >
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        {/* Top Profile Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border bg-surface-raised/60 p-4">
          <div className="flex items-center gap-3 min-w-0">
            <UserAvatar
              user={{
                username: target.username,
                color: isMe ? editColor : target.color,
                avatarUrl: isMe ? editAvatarUrl : target.avatarUrl,
              }}
              size="lg"
            />
            <div className="min-w-0">
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
                showRankLabel
                className="text-base"
              />
              <p className="mt-0.5 text-xs text-muted-foreground truncate">
                @{target.username} • {target.status || 'لا توجد حالة شخصية'}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground tabular-nums">
                <span className="inline-flex items-center gap-1 text-rose-400 font-semibold">
                  <Heart className="size-3.5 fill-current" />
                  {target.likes.toLocaleString('en-US')} لايك
                </span>
                {target.verified && (
                  <span className="inline-flex items-center gap-1 text-sky-400">
                    <BadgeCheck className="size-3.5" /> موثق
                  </span>
                )}
                {isSilenced && (
                  <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
                    <VolumeX className="size-3.5" /> مسكت حالياً
                  </span>
                )}
                <CountryFlagBadge
                  country={target.country}
                  hideCountryFlag={isMe ? editHideCountryFlag : target.hideCountryFlag}
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            aria-label="إغلاق البروفايل"
            onClick={() => openMemberProfile(null)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
          {/* Streak Status Card — hidden while editing membership design */}
          {streakInfo.visible && !(isMe && editingDesign) && (
            <div
              className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-xs ${
                streakInfo.status === 'dormant'
                  ? 'border-slate-500/40 bg-slate-900/50 text-slate-300'
                  : 'border-amber-500/35 bg-amber-500/10 text-amber-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <StreakFlameBadge
                  streak={target.streak}
                  streakLastDay={target.streakLastDay}
                  size="md"
                />
                <div>
                  <div className="font-bold">
                    {streakInfo.status === 'dormant'
                      ? `ستريك خامد (${streakInfo.count} يوم)`
                      : `ستريك نشط (${streakInfo.count} يوم متتالي)`}
                  </div>
                  <p className="text-[11px] opacity-80">
                    {streakInfo.status === 'dormant'
                      ? `فترة سماح 3 أيام قبل التصفير (متبقي ${streakInfo.graceDaysLeft} يوم)`
                      : 'الدخول اليومي المتتالي يضيء شعلة التفاعل'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* OWN PROFILE — Default View: Edit Membership Design + Control Panel (followed by real Staff Management panels for upgraded ranks) */}
          {isMe && !editingDesign && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="own-profile-overview">
              <button
                type="button"
                data-action="open-design-editor"
                onClick={() => setEditingDesign(true)}
                className={`flex items-center justify-center gap-2 rounded-xl bg-gradient-gold py-2.5 px-3 text-xs sm:text-sm font-bold text-primary-foreground hover:brightness-105 transition shadow-sm ${
                  canAccessCp ? '' : 'sm:col-span-2'
                }`}
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
                  className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/45 bg-amber-500/15 py-2.5 px-3 text-xs sm:text-sm font-bold text-amber-300 hover:bg-amber-500/25 transition"
                >
                  <ShieldCheck className="size-4" />
                  <span>فتح لوحة التحكم</span>
                </button>
              )}
            </div>
          )}

          {/* OWN PROFILE — MEMBERSHIP DESIGN EDITOR (Only visible when "تعديل تصميم العضوية" is clicked) */}
          {isMe && editingDesign && (
            <div className="space-y-3" data-testid="design-editor-panel">
              <div className="flex items-center justify-between gap-2 border-b border-border/70 pb-2.5">
                <div className="flex items-center gap-2">
                  <Palette className="size-4 text-primary" />
                  <h4 className="font-display text-base text-foreground">تعديل تصميم العضوية</h4>
                </div>
                <button
                  type="button"
                  data-action="close-design-editor"
                  onClick={() => setEditingDesign(false)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-raised px-2.5 py-1 text-xs font-semibold text-foreground hover:border-primary/60 transition"
                >
                  <ArrowRight className="size-3.5" />
                  <span>رجوع للبروفايل</span>
                </button>
              </div>

              {/* Tabs */}
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-background/70 p-1 border border-border">
                <button
                  type="button"
                  onClick={() => setMyTab('appearance')}
                  className={`inline-flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold transition ${
                    myTab === 'appearance'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Palette className="size-3.5" /> الألوان والخط
                </button>
                <button
                  type="button"
                  onClick={() => setMyTab('info')}
                  className={`inline-flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold transition ${
                    myTab === 'info'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Type className="size-3.5" /> الزخرفة والصورة
                </button>
                <button
                  type="button"
                  onClick={() => setMyTab('security')}
                  className={`inline-flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold transition ${
                    myTab === 'security'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <KeyRound className="size-3.5" /> كلمة المرور
                </button>
              </div>

              <form onSubmit={saveMyEdits} className="space-y-3">
                {myTab === 'appearance' && (
                  <div className="space-y-3">
                    {/* Preset Colors */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground">ألوان الاسم الجاهزة</span>
                        <span className="text-[11px] text-muted-foreground">اختر لون اسمك</span>
                      </div>
                      <div className="grid grid-cols-10 gap-1.5 rounded-xl border border-border bg-background/60 p-2.5">
                        {PRESET_NAME_COLORS.map((preset) => {
                          const selected = editColor.toLowerCase() === preset.hex.toLowerCase();
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              title={preset.label}
                              data-color-preset={preset.id}
                              onClick={() => setEditColor(preset.hex)}
                              className={`relative flex aspect-square items-center justify-center rounded-lg border transition ${
                                selected ? 'border-white scale-110 ring-2 ring-primary' : 'border-white/15 hover:scale-105'
                              }`}
                              style={{ backgroundColor: preset.hex }}
                            >
                              {selected && <Check className="size-3 text-slate-950 stroke-[3]" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Name Styles */}
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
                              className={`flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-start transition ${
                                selected
                                  ? 'border-primary bg-primary/10'
                                  : 'border-border bg-background/60 hover:border-primary/40'
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

                    {/* Arabic & English Fonts */}
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
                              className={`flex flex-col items-start gap-0.5 rounded-xl border px-2.5 py-2 text-start transition ${
                                selected
                                  ? 'border-primary bg-primary/10'
                                  : 'border-border bg-background/60 hover:border-primary/40'
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
                        className="h-9 w-full rounded-xl border border-border bg-background px-3 text-xs focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs text-muted-foreground">الحالة الشخصية</label>
                      <input
                        type="text"
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        maxLength={80}
                        placeholder="اكتب حالتك..."
                        className="h-9 w-full rounded-xl border border-border bg-background px-3 text-xs focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold hover:border-primary/60 transition">
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
                          className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
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
                      <p className="rounded-xl border border-border bg-background/60 p-3 text-xs text-muted-foreground">
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
                          className="h-9 w-full rounded-xl border border-border bg-background px-3 text-xs focus:border-primary focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Universal Country Flag Privacy Toggle (applies to all ranks including Owner) */}
                <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/60 px-3.5 py-2.5 cursor-pointer hover:border-primary/40 transition">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {editHideCountryFlag ? (
                      <EyeOff className="size-4 shrink-0 text-amber-400" />
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
                  className="flex h-10 w-full items-center justify-center rounded-xl bg-gradient-gold text-xs font-bold text-primary-foreground hover:brightness-105 disabled:opacity-50"
                >
                  {savingMine ? 'جاري الحفظ...' : 'حفظ تعديلات تصميم العضوية'}
                </button>
              </form>
            </div>
          )}

          {/* OTHER MEMBER ACTIONS */}
          {!isMe && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-action="profile-like"
                onClick={() => void likeUser(target.id)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface-raised py-2.5 text-xs font-semibold hover:border-rose-400/50 hover:text-rose-400 transition"
              >
                <Heart className="size-4" /> إرسال لايك
              </button>
              <button
                type="button"
                onClick={() => {
                  openMemberProfile(null);
                  openPrivateChatWith(target.id);
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground hover:brightness-105 transition"
              >
                <Mail className="size-4" /> محادثة خاصة
              </button>
            </div>
          )}

          {/* STAFF MIC CONTROLS (original project parity) */}
          {canMicMod && targetSeat && activeRoom && (
            <div className="rounded-xl border border-border bg-background/50 p-3 space-y-2">
              <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <MicOff className="size-3.5" /> إدارة المايك (مقعد #{targetSeat.seat})
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void adminMicAction(activeRoom.id, targetSeat.seat, 'admin_force_mute')}
                  className="rounded-lg border border-border bg-surface-raised py-1.5 text-xs font-semibold hover:text-amber-300"
                >
                  {targetSeat.forceMuted ? 'فك كتم المايك' : 'كتم المايك'}
                </button>
                <button
                  type="button"
                  onClick={() => void adminMicAction(activeRoom.id, targetSeat.seat, 'admin_kick')}
                  className="inline-flex items-center justify-center gap-1 rounded-lg border border-destructive/40 bg-destructive/15 py-1.5 text-xs font-semibold text-destructive"
                >
                  <PhoneOff className="size-3.5" /> إنزال من المايك
                </button>
              </div>
            </div>
          )}

          {/* COMPACT ICON-BASED REVEAL ("الكشف") + INTACT SAME-IP LINKED ACCOUNTS */}
          {canReveal && (
            <div className="rounded-xl border border-border bg-background/50 p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-sky-400">
                  <Eye className="size-4" /> الكشف والمطابقة
                </span>
                <button
                  type="button"
                  data-action="toggle-reveal"
                  onClick={() => void toggleReveal()}
                  className="rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-300 hover:bg-sky-500/25 transition"
                >
                  {revealLoading ? 'جاري الفحص...' : revealOpen ? 'إخفاء الكشف' : 'كشف'}
                </button>
              </div>

              {revealOpen && revealData && (
                <div className="space-y-2.5 pt-1" data-testid="reveal-panel">
                  <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-thin">
                    {revealData.logins.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-surface px-2.5 py-1.5 text-[11px]"
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

                  {/* Preserved exact Same-IP linked accounts section */}
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
                            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-raised px-2 py-1 text-xs hover:border-primary/60 transition"
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
            </div>
          )}

          {/* FULL ORIGINAL STAFF MODERATION CONTROLS (matching MemberCard.tsx) */}
          {(canBan || canRanks || canMembers || canVerify) && (
            <div
              className="rounded-xl border border-amber-500/35 bg-background/55 p-3 space-y-3"
              data-testid="staff-moderation-panel"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400">
                  <ShieldAlert className="size-4" /> صلاحيات الإدارة والرتب الأعلى
                </span>
              </div>

              {/* Kick / Ban / Silence + Active Bans Lift */}
              {canBan && (
                <div className="space-y-2 border-t border-border/60 pt-2.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {DURATION_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setBanMinutes(p.minutes)}
                        className={`rounded-lg px-2 py-1 text-[11px] font-semibold border transition ${
                          banMinutes === p.minutes
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-surface text-muted-foreground hover:text-foreground'
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
                    placeholder="سبب الطرد / الحظر (اختياري)..."
                    className="h-8 w-full rounded-lg border border-border bg-surface px-2.5 text-xs focus:border-primary focus:outline-none"
                  />
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      disabled={staffBusy}
                      onClick={() => void handleKickOrBan(10, 'طرد إداري')}
                      className="rounded-lg border border-amber-500/40 bg-amber-500/15 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/25"
                    >
                      طرد (10د)
                    </button>
                    <button
                      type="button"
                      disabled={staffBusy}
                      onClick={() => void handleKickOrBan(banMinutes, 'حظر إداري')}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-destructive/40 bg-destructive/15 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/25"
                    >
                      <Ban className="size-3.5" /> باند
                    </button>
                    <button
                      type="button"
                      disabled={staffBusy}
                      onClick={() => void handleSilence(isSilenced ? 0 : banMinutes || 15)}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-border bg-surface-raised py-1.5 text-xs font-semibold hover:text-amber-300"
                    >
                      {isSilenced ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
                      {isSilenced ? 'فك إسكات' : 'إسكات'}
                    </button>
                  </div>

                  {activeBans.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="block text-[11px] font-semibold text-rose-400">
                        سجلات حظر نشطة على هذا العضو:
                      </span>
                      {activeBans.map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px]"
                        >
                          <span className="truncate">{b.reason || 'حظر'}</span>
                          <button
                            type="button"
                            onClick={() => void handleUnban(b.id)}
                            className="shrink-0 rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/30"
                          >
                            فك
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Rank Promotion / Subscription Days */}
              {canRanks && (
                <div className="space-y-1.5 border-t border-border/60 pt-2.5">
                  <span className="block text-[11px] font-semibold text-muted-foreground">
                    الترقية والرتبة
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <select
                      value={modRankId}
                      onChange={(e) => setModRankId(e.target.value)}
                      className="h-8 flex-1 min-w-[130px] rounded-lg border border-border bg-surface px-2 text-xs"
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
                      className="h-8 w-20 rounded-lg border border-border bg-surface px-2 text-xs"
                    />
                    <button
                      type="button"
                      disabled={staffBusy}
                      onClick={() => void handleSaveRank()}
                      className="h-8 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground"
                    >
                      حفظ الرتبة
                    </button>
                  </div>
                </div>
              )}

              {/* Rename, Likes, Password */}
              {canMembers && (
                <div className="space-y-2 border-t border-border/60 pt-2.5">
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                    <UserCog className="size-3.5" /> تعديل بيانات العضو
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="text"
                      value={modUsername}
                      onChange={(e) => setModUsername(e.target.value)}
                      placeholder="الاسم"
                      className="h-8 rounded-lg border border-border bg-surface px-2.5 text-xs"
                    />
                    <input
                      type="text"
                      value={modTopic}
                      onChange={(e) => setModTopic(e.target.value)}
                      placeholder="الزخرفة"
                      className="h-8 rounded-lg border border-border bg-surface px-2.5 text-xs"
                    />
                    <input
                      type="number"
                      min={0}
                      value={modLikes}
                      onChange={(e) => setModLikes(e.target.value)}
                      placeholder="اللايكات"
                      className="h-8 rounded-lg border border-border bg-surface px-2.5 text-xs"
                    />
                    <input
                      type="password"
                      value={modPassword}
                      onChange={(e) => setModPassword(e.target.value)}
                      placeholder="كلمة سر جديدة"
                      className="h-8 rounded-lg border border-border bg-surface px-2.5 text-xs"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      disabled={staffBusy}
                      onClick={() => void handleMemberAdminSave()}
                      className="flex-1 rounded-lg bg-secondary py-1.5 text-xs font-bold text-secondary-foreground hover:bg-accent transition"
                    >
                      حفظ البيانات
                    </button>
                    {target.avatarUrl && (
                      <button
                        type="button"
                        disabled={staffBusy}
                        onClick={() => void handleClearMemberAvatar()}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs hover:text-amber-300"
                      >
                        <ImageOff className="size-3.5" /> حذف الصورة
                      </button>
                    )}
                    {!isMe && (
                      <button
                        type="button"
                        disabled={staffBusy}
                        onClick={() => setConfirmDeleteOpen(true)}
                        className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/15 px-2.5 py-1.5 text-xs text-destructive"
                      >
                        <Trash2 className="size-3.5" /> حذف العضوية
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Verify Toggle */}
              {canVerify && (
                <div className="border-t border-border/60 pt-2">
                  <button
                    type="button"
                    disabled={staffBusy}
                    onClick={() => void handleToggleVerify()}
                    className={`flex w-full items-center justify-center gap-1.5 rounded-lg border py-1.5 text-xs font-semibold transition ${
                      target.verified
                        ? 'border-sky-500/40 bg-sky-500/15 text-sky-300'
                        : 'border-border bg-surface text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <BadgeCheck className="size-4" />
                    {target.verified ? 'إلغاء توثيق العضوية' : 'توثيق العضوية'}
                  </button>
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
