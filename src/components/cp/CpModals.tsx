import { useState, type FormEvent } from 'react';
import { Check, Copy, Lock, ShieldCheck, Trash2, Upload, X } from 'lucide-react';
import { apiFetch, copyText, countryToFlagEmoji } from '../../lib/device.ts';
import { readImageFileAsDataUrl } from '../../lib/imageUpload.ts';
import type { AccessLogEntry, RankRole, Room, UserAccount } from '../../shared/types.ts';

export function InspectFingerprintModal({
  entry,
  onClose,
}: {
  entry: AccessLogEntry | null;
  onClose: () => void;
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  if (!entry) return null;

  const segments = entry.device.split('|');

  async function handleCopy(key: string, val: string) {
    const ok = await copyText(val);
    if (ok) {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-display text-xl text-primary">فحص البصمة والسجل</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-border bg-background/60 p-3">
            <span className="text-muted-foreground block">العضو / الحالة</span>
            <span className="font-semibold text-sm text-foreground mt-0.5 block">
              {entry.username} — {entry.state}
            </span>
          </div>
          <div className="rounded-xl border border-border bg-background/60 p-3">
            <span className="text-muted-foreground block">الدولة / الدعوة</span>
            <span className="font-semibold text-sm text-foreground mt-0.5 block">
              {countryToFlagEmoji(entry.country)} {entry.country} · {entry.referrer || '*'}
            </span>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between rounded-xl border border-border bg-background/60 p-3 gap-2">
            <div className="min-w-0">
              <span className="text-muted-foreground block">عنوان IP</span>
              <span className="font-mono-tabular text-foreground break-all" dir="ltr">
                {entry.ip}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void handleCopy('ip', entry.ip)}
              className="shrink-0 rounded-lg border border-border bg-surface-raised px-2.5 py-1.5 hover:border-primary"
            >
              {copiedKey === 'ip' ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
            </button>
          </div>

          <div className="rounded-xl border border-border bg-background/60 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">بصمة الجهاز الكاملة</span>
              <button
                type="button"
                onClick={() => void handleCopy('dev', entry.device)}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-raised px-2 py-1 text-[11px] hover:border-primary"
              >
                {copiedKey === 'dev' ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
                نسخ البصمة
              </button>
            </div>
            <p className="font-mono-tabular text-xs break-all text-sky-300" dir="ltr">
              {entry.device}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1" dir="ltr">
              {segments.filter(Boolean).map((seg, i) => (
                <span
                  key={`${seg}-${i}`}
                  className="rounded border border-border bg-surface px-2 py-0.5 font-mono-tabular text-[11px] text-amber-300"
                >
                  #{i}: {seg}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EditUserModal({
  user,
  ranks,
  onClose,
  onSaved,
  onNotify,
}: {
  user: UserAccount | null;
  ranks: RankRole[];
  onClose: () => void;
  onSaved: () => void;
  onNotify: (msg: string, tone?: 'info' | 'success' | 'error') => void;
}) {
  const [username, setUsername] = useState(user?.username ?? '');
  const [topic, setTopic] = useState(user?.topic ?? '');
  const [likes, setLikes] = useState(String(user?.likes ?? 0));
  const [rankId, setRankId] = useState(user?.rankId ?? 'rank_member');
  const [subDays, setSubDays] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [verified, setVerified] = useState(user?.verified ?? false);
  const [royalBoys, setRoyalBoys] = useState(user?.royalLoginBoys ?? false);
  const [royalGirls, setRoyalGirls] = useState(user?.royalLoginGirls ?? false);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiFetch(`/api/cp/users/${user!.id}/update`, {
        method: 'POST',
        body: JSON.stringify({
          username,
          topic,
          likes: Number(likes),
          rankId,
          subscriptionDays: subDays ? Number(subDays) : 0,
          newPassword: newPassword.trim() || undefined,
        }),
      });
      await apiFetch(`/api/cp/users/${user!.id}/verify`, {
        method: 'POST',
        body: JSON.stringify({
          verified,
          royalLoginBoys: royalBoys,
          royalLoginGirls: royalGirls,
        }),
      });
      onNotify(`تم حفظ تعديلات العضو ${username}`, 'success');
      onSaved();
      onClose();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر حفظ التعديلات', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={handleSave}
        className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto scrollbar-thin"
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <h3 className="font-display text-xl">تعديل وتوثيق العضوية: {user.username}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">اسم العضو</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">الزخرفة</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">عدد اللايكات</label>
            <input
              type="number"
              min={0}
              value={likes}
              onChange={(e) => setLikes(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm tabular-nums"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">الترقية / الصلاحية</label>
            <select
              value={rankId}
              onChange={(e) => setRankId(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
            >
              {ranks.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.level})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">مدة الإشتراك بالأيام (اختياري)</label>
            <input
              type="number"
              min={0}
              value={subDays}
              onChange={(e) => setSubDays(e.target.value)}
              placeholder="مفتوح إذا ترك فارغاً"
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm tabular-nums"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">كلمة مرور جديدة (اختياري)</label>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="اتركه فارغاً للإبقاء"
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background/50 p-3.5 space-y-2.5">
          <div className="text-xs font-semibold text-primary">خيارات التوثيق والدخول الملكي</div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
              className="size-4 accent-primary"
            />
            <span>توثيق العضوية</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={royalBoys}
              onChange={(e) => setRoyalBoys(e.target.checked)}
              className="size-4 accent-primary"
            />
            <span>دخول ملكي شباب</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={royalGirls}
              onChange={(e) => setRoyalGirls(e.target.checked)}
              className="size-4 accent-primary"
            />
            <span>دخول ملكي بنات</span>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-xs font-medium"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-gradient-gold px-5 py-2 text-xs font-bold text-primary-foreground"
          >
            {busy ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function RoomEditorModal({
  room,
  isNew,
  endpoint = '/api/cp/rooms',
  onClose,
  onSaved,
  onRoomCreated,
  onNotify,
}: {
  room: Room | null;
  isNew: boolean;
  endpoint?: string;
  onClose: () => void;
  onSaved: () => void;
  onRoomCreated?: (room: Room) => void | Promise<void>;
  onNotify: (msg: string, tone?: 'info' | 'success' | 'error') => void;
}) {
  const [name, setName] = useState(room?.name ?? '');
  const [description, setDescription] = useState(room?.description ?? '');
  const [welcomeMessage, setWelcomeMessage] = useState(room?.welcomeMessage ?? '');
  const [imageUrl, setImageUrl] = useState<string | null>(room?.imageUrl ?? null);
  const [requiredLikes, setRequiredLikes] = useState(String(room?.requiredLikes ?? 0));
  const [password, setPassword] = useState(room?.password ?? '');
  const [maxCapacity, setMaxCapacity] = useState(String(room?.maxCapacity ?? 100));
  const [maxMics, setMaxMics] = useState(String(room?.maxMics ?? 5));
  const [isPinned, setIsPinned] = useState(room?.isPinned ?? false);
  const [micEnabled, setMicEnabled] = useState(room?.micEnabled ?? true);
  const [bannerEnabled, setBannerEnabled] = useState(room?.bannerEnabled ?? false);
  const [liveBroadcast, setLiveBroadcast] = useState(room?.liveBroadcast ?? false);
  const [busy, setBusy] = useState(false);

  if (!room && !isNew) return null;

  async function handleImageUpload(file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await readImageFileAsDataUrl(file, 640, 0.82);
      setImageUrl(dataUrl);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر قراءة الصورة', 'error');
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiFetch<{ room?: Room }>(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          id: isNew ? undefined : room?.id,
          name,
          description,
          welcomeMessage,
          imageUrl,
          requiredLikes: Number(requiredLikes || 0),
          password,
          maxCapacity: Number(maxCapacity || 100),
          maxMics: Number(maxMics || 5),
          isPinned,
          micEnabled,
          bannerEnabled,
          liveBroadcast,
        }),
      });
      onNotify(isNew ? 'تم إنشاء الغرفة بنجاح' : 'تم حفظ تعديلات الغرفة', 'success');
      onSaved();
      if (isNew && res.room && onRoomCreated) {
        await onRoomCreated(res.room);
      }
      onClose();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر حفظ الغرفة', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleUnbanRoom() {
    if (!room) return;
    try {
      await apiFetch('/api/cp/rooms', {
        method: 'POST',
        body: JSON.stringify({ ...room, unbanAll: true }),
      });
      onNotify('تم فك جميع المحظورين من الغرفة', 'info');
      onSaved();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر فك الحظر', 'error');
    }
  }

  async function handleDeleteRoom() {
    if (!room) return;
    try {
      await apiFetch(`/api/cp/rooms/${room.id}`, { method: 'DELETE' });
      onNotify('تم حذف الغرفة', 'info');
      onSaved();
      onClose();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر حذف الغرفة', 'error');
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      data-testid="room-editor-modal"
    >
      <form
        onSubmit={handleSave}
        className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto scrollbar-thin"
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="font-display text-xl">
            {isNew ? 'إنشاء غرفة جديدة' : `تعديل غرفة: ${room?.name}`}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="size-20 shrink-0 rounded-xl border border-border bg-background overflow-hidden flex items-center justify-center">
            {imageUrl ? (
              <img src={imageUrl} alt="صورة الغرفة" className="size-full object-cover" />
            ) : (
              <span className="text-xs text-muted-foreground">بدون صورة</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium hover:border-primary">
              <Upload className="size-3.5" /> اختيار صورة
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  void handleImageUpload(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
            {imageUrl && (
              <button
                type="button"
                onClick={() => setImageUrl(null)}
                className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/15 px-3 py-1.5 text-xs text-destructive"
              >
                <Trash2 className="size-3.5" /> حذف الصورة
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs text-muted-foreground">عنوان الغرفة</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="عنوان الغرفة"
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs text-muted-foreground">الوصف</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="الوصف"
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs text-muted-foreground">رسالة الترحيب</label>
            <input
              type="text"
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              placeholder="رسالة الترحيب"
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">عدد لايكات الدخول للغرفة</label>
            <input
              type="number"
              min={0}
              value={requiredLikes}
              onChange={(e) => setRequiredLikes(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm tabular-nums"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Lock className="size-3" /> كلمة المرور
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="اختياري"
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">حجم الغرفة (1 إلى 200)</label>
            <input
              type="number"
              min={1}
              max={200}
              value={maxCapacity}
              onChange={(e) => setMaxCapacity(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm tabular-nums"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">عدد المايكات (0 إلى 5)</label>
            <input
              type="number"
              min={0}
              max={5}
              value={maxMics}
              onChange={(e) => setMaxMics(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm tabular-nums"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-border bg-background/50 p-3 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} className="size-4 accent-primary" />
            <span>تثبيت الغرفة</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={micEnabled} onChange={(e) => setMicEnabled(e.target.checked)} className="size-4 accent-primary" />
            <span>تفعيل المايك</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={bannerEnabled} onChange={(e) => setBannerEnabled(e.target.checked)} className="size-4 accent-primary" />
            <span>تفعيل البنر</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={liveBroadcast} onChange={(e) => setLiveBroadcast(e.target.checked)} className="size-4 accent-primary" />
            <span>تفعيل البث المباشر</span>
          </label>
        </div>

        {!isNew && room && (
          <div className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-3 py-2 text-xs">
            <span>المحظورون في الغرفة: {room.bannedUserIds.length}</span>
            <button
              type="button"
              onClick={() => void handleUnbanRoom()}
              className="rounded-lg border border-border bg-surface-raised px-2.5 py-1 hover:border-primary"
            >
              فك المحظورين
            </button>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          <div>
            {!isNew && room && !room.isPublicDefault && (
              <button
                type="button"
                onClick={() => void handleDeleteRoom()}
                className="inline-flex items-center gap-1 rounded-xl border border-destructive/40 bg-destructive/15 px-3 py-2 text-xs font-semibold text-destructive"
              >
                <Trash2 className="size-3.5" /> حذف الغرفة
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border px-4 py-2 text-xs font-medium"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-gradient-gold px-5 py-2 text-xs font-bold text-primary-foreground"
            >
              {isNew ? 'إنشاء الغرفة' : 'حفظ التعديلات'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
