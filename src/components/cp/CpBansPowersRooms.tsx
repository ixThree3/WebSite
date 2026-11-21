import { useState, type FormEvent } from 'react';
import {
  Ban,
  DoorOpen,
  Lock,
  Plus,
  Save,
  Settings,
  Shield,
  Trash2,
  Unlock,
} from 'lucide-react';
import { apiFetch, countryToFlagEmoji } from '../../lib/device.ts';
import { CP_PERMISSIONS } from '../../shared/permissions.ts';
import type {
  BanRecord,
  PermissionKey,
  RankIcon,
  RankRole,
  Room,
  SecurityAllowConfig,
} from '../../shared/types.ts';
import { ConfirmActionModal, RankIconGlyph } from '../UserBadges.tsx';
import { RoomEditorModal } from './CpModals.tsx';

const BROWSERS = ['chrome', 'safari', 'edge', 'firefox', 'samsung', 'opera', 'brave', 'vivaldi'];
const OS_LIST = ['android', 'ios', 'ipados', 'windows', 'macos', 'linux', 'chromeos', 'harmonyos'];
const ICONS: RankIcon[] = [
  'crown',
  'shield',
  'star',
  'gem',
  'flame',
  'award',
  'sparkles',
  'heart',
  'zap',
  'badge',
];

export function BansTab({
  bans,
  securityAllow,
  onReload,
  onNotify,
}: {
  bans: BanRecord[];
  securityAllow: SecurityAllowConfig;
  onReload: () => void;
  onNotify: (msg: string, tone?: 'info' | 'success' | 'error') => void;
}) {
  const [manualValue, setManualValue] = useState('');
  const [reason, setReason] = useState('');
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const [browsers, setBrowsers] = useState<string[]>(securityAllow.allowedBrowsers);
  const [osList, setOsList] = useState<string[]>(securityAllow.allowedOs);
  const [blockEmptyFp, setBlockEmptyFp] = useState(securityAllow.blockEmptyFp);
  const [blockInvalidFp, setBlockInvalidFp] = useState(securityAllow.blockInvalidFp);
  const [blockSuspectFp, setBlockSuspectFp] = useState(securityAllow.blockSuspectFp);

  async function handleManualBan() {
    if (!manualValue.trim()) return;
    try {
      await apiFetch('/api/cp/bans', {
        method: 'POST',
        body: JSON.stringify({ manualValue: manualValue.trim(), reason: reason.trim() || 'حظر من لوحة التحكم' }),
      });
      setManualValue('');
      setReason('');
      onNotify('تم تنفيذ الحظر', 'success');
      onReload();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر تنفيذ الحظر', 'error');
    }
  }

  async function handleUnban(id: string) {
    await apiFetch(`/api/cp/bans/${id}/unban`, { method: 'POST' });
    onNotify('تم فك الحظر', 'info');
    onReload();
  }

  async function handleClearAllBans() {
    setConfirmClearAll(false);
    const res = await apiFetch<{ cleared: number }>('/api/cp/bans/clear-all', { method: 'POST' });
    onNotify(`تم فك جميع المحظورين (${res.cleared})`, 'success');
    onReload();
  }

  async function handleSaveSecurity() {
    await apiFetch('/api/cp/security-allow', {
      method: 'POST',
      body: JSON.stringify({
        allowedBrowsers: browsers,
        allowedOs: osList,
        blockEmptyFp,
        blockInvalidFp,
        blockSuspectFp,
      }),
    });
    onNotify('تم حفظ إعدادات المتصفحات والبصمات', 'success');
    onReload();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">إدارة الحظر والحماية ({bans.length})</h2>
        <button
          type="button"
          onClick={() => setConfirmClearAll(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 px-3.5 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 transition"
        >
          <Unlock className="size-3.5" /> فك جميع المحظورين
        </button>
      </div>

      {/* Manual Ban/Allow Input */}
      <div className="rounded-xl border border-border bg-surface p-4 flex flex-wrap items-center gap-2.5">
        <input
          type="text"
          value={manualValue}
          onChange={(e) => setManualValue(e.target.value)}
          placeholder="حظر جهاز / آي بي / دولة / حساب"
          className="h-9 min-w-[220px] flex-1 rounded-md border border-input bg-transparent px-3 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="السبب (اختياري)"
          className="h-9 w-48 rounded-md border border-input bg-transparent px-3 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={() => void handleManualBan()}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-destructive px-4 text-xs font-semibold text-destructive-foreground shadow-sm hover:bg-destructive/90 cursor-pointer"
        >
          <Ban className="size-3.5" /> حظر
        </button>
      </div>

      {/* Browser / OS Allowlist & Suspicious Fingerprints */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <div className="text-sm font-semibold text-primary">السماح بدخول المتصفحات والأنظمة</div>
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">المتصفحات:</span>
            <div className="flex flex-wrap gap-2">
              {BROWSERS.map((b) => (
                <label
                  key={b}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-2.5 py-1 text-xs capitalize cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={browsers.includes(b)}
                    onChange={(e) =>
                      setBrowsers((prev) =>
                        e.target.checked ? [...prev, b] : prev.filter((x) => x !== b)
                      )
                    }
                    className="accent-primary"
                  />
                  {b}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">الأنظمة:</span>
            <div className="flex flex-wrap gap-2">
              {OS_LIST.map((os) => (
                <label
                  key={os}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-2.5 py-1 text-xs capitalize cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={osList.includes(os)}
                    onChange={(e) =>
                      setOsList((prev) =>
                        e.target.checked ? [...prev, os] : prev.filter((x) => x !== os)
                      )
                    }
                    className="accent-primary"
                  />
                  {os}
                </label>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleSaveSecurity()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-gradient-gold px-3.5 text-xs font-semibold text-primary-foreground shadow-gold hover:brightness-110 cursor-pointer"
          >
            <Save className="size-3.5" /> حفظ
          </button>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <div className="text-sm font-semibold text-primary">حظر البصمات المشكوك بها (اختياري)</div>
          <div className="space-y-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={blockEmptyFp}
                onChange={(e) => setBlockEmptyFp(e.target.checked)}
                className="size-4 accent-primary"
              />
              <span>حظر البيانات الناقصة</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={blockInvalidFp}
                onChange={(e) => setBlockInvalidFp(e.target.checked)}
                className="size-4 accent-primary"
              />
              <span>حظر البيانات غير الصحيحة</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={blockSuspectFp}
                onChange={(e) => setBlockSuspectFp(e.target.checked)}
                className="size-4 accent-primary"
              />
              <span>حظر التلاعب بالجهاز</span>
            </label>
          </div>
          <button
            type="button"
            onClick={() => void handleSaveSecurity()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-gradient-gold px-3.5 text-xs font-semibold text-primary-foreground shadow-gold hover:brightness-110 cursor-pointer"
          >
            <Save className="size-3.5" /> حفظ
          </button>
        </div>
      </div>

      {/* Active Bans Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[820px] text-xs">
          <thead className="border-b border-border bg-surface-raised/60 text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-start font-semibold">العضو</th>
              <th className="px-3 py-2.5 text-start font-semibold">من قبل</th>
              <th className="px-3 py-2.5 text-start font-semibold">السبب</th>
              <th className="px-3 py-2.5 text-start font-semibold">الجهاز</th>
              <th className="px-3 py-2.5 text-start font-semibold">الأي بي</th>
              <th className="px-3 py-2.5 text-start font-semibold">الدولة</th>
              <th className="px-3 py-2.5 text-start font-semibold">تاريخ الإنتهاء</th>
              <th className="px-3 py-2.5 text-end font-semibold">فك الحظر</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {bans.map((b) => (
              <tr key={b.id} className="hover:bg-accent/25">
                <td className="px-3 py-2.5 font-semibold">{b.targetName}</td>
                <td className="px-3 py-2.5">{b.bannedBy}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{b.reason}</td>
                <td className="px-3 py-2.5 font-mono-tabular max-w-[160px] truncate" dir="ltr">
                  {b.device || '—'}
                </td>
                <td className="px-3 py-2.5 font-mono-tabular" dir="ltr">
                  {b.ip || '—'}
                </td>
                <td className="px-3 py-2.5">
                  {b.country ? `${countryToFlagEmoji(b.country)} ${b.country}` : '—'}
                </td>
                <td className="px-3 py-2.5 tabular-nums">
                  {b.expiresAt ? new Date(b.expiresAt).toLocaleDateString('ar') : 'دائم'}
                </td>
                <td className="px-3 py-2.5 text-end">
                  <button
                    type="button"
                    onClick={() => void handleUnban(b.id)}
                    className="rounded-lg border border-border bg-surface-raised px-2.5 py-1 text-emerald-400 hover:border-emerald-400"
                  >
                    فك الحظر
                  </button>
                </td>
              </tr>
            ))}
            {bans.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  لا يوجد محظورون حالياً
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmActionModal
        open={confirmClearAll}
        title="فك جميع المحظورين"
        message="هل تريد فك الحظر عن جميع الأعضاء والأجهزة وعناوين IP المحظورة حالياً؟"
        confirmLabel="فك الكل"
        onConfirm={() => void handleClearAllBans()}
        onCancel={() => setConfirmClearAll(false)}
      />
    </div>
  );
}

export function PowersTab({
  ranks,
  onReload,
  onNotify,
}: {
  ranks: RankRole[];
  onReload: () => void;
  onNotify: (msg: string, tone?: 'info' | 'success' | 'error') => void;
}) {
  const [selectedId, setSelectedId] = useState<string>(ranks[0]?.id ?? '');
  const selected = ranks.find((r) => r.id === selectedId) ?? ranks[0];

  const [name, setName] = useState(selected?.name ?? '');
  const [level, setLevel] = useState(String(selected?.level ?? 100));
  const [icon, setIcon] = useState<RankIcon>(selected?.icon ?? 'shield');
  const [color, setColor] = useState(selected?.color ?? '#38bdf8');
  const [permissions, setPermissions] = useState<PermissionKey[]>(selected?.permissions ?? []);
  const [isLocked, setIsLocked] = useState(selected?.isLocked ?? false);

  const [newName, setNewName] = useState('');

  function selectRank(r: RankRole) {
    setSelectedId(r.id);
    setName(r.name);
    setLevel(String(r.level));
    setIcon(r.icon);
    setColor(r.color);
    setPermissions(r.permissions);
    setIsLocked(r.isLocked);
  }

  async function handleSaveRank(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    try {
      await apiFetch('/api/cp/ranks', {
        method: 'POST',
        body: JSON.stringify({
          id: selected.id,
          name,
          level: Number(level),
          icon,
          color,
          permissions,
          isLocked,
        }),
      });
      onNotify(`تم حفظ صلاحية "${name}"`, 'success');
      onReload();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر حفظ الصلاحية', 'error');
    }
  }

  async function handleCreateRank() {
    if (!newName.trim()) return;
    try {
      const res = await apiFetch<{ rank: RankRole }>('/api/cp/ranks', {
        method: 'POST',
        body: JSON.stringify({
          name: newName.trim(),
          level: 300,
          icon: 'shield',
          color: '#38bdf8',
          permissions: ['access_cp'],
        }),
      });
      setNewName('');
      onReload();
      selectRank(res.rank);
      onNotify('تم إنشاء الصلاحية الجديدة', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر الإنشاء', 'error');
    }
  }

  async function handleDeleteRank() {
    if (!selected) return;
    try {
      await apiFetch(`/api/cp/ranks/${selected.id}`, { method: 'DELETE' });
      onNotify('تم حذف الصلاحية', 'info');
      onReload();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر الحذف', 'error');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">الصلاحيات والرتب</h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="اسم رتبة جديدة..."
            className="h-9 rounded-md border border-input bg-surface px-3 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <button
            type="button"
            onClick={() => void handleCreateRank()}
            className="inline-flex h-9 items-center gap-1 rounded-md bg-gradient-gold px-3 text-xs font-semibold text-primary-foreground shadow-gold hover:brightness-110 cursor-pointer"
          >
            <Plus className="size-3.5" /> إضافة
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <div className="rounded-xl border border-border bg-surface p-3 space-y-1.5">
          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">اختر الصلاحية</div>
          {ranks.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => selectRank(r)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs transition ${
                selected?.id === r.id
                  ? 'bg-accent text-foreground font-semibold border border-primary/40'
                  : 'hover:bg-surface-raised text-muted-foreground'
              }`}
            >
              <span className="flex items-center gap-2" style={{ color: r.color }}>
                <RankIconGlyph icon={r.icon} className="size-4" />
                {r.name}
              </span>
              <span className="tabular-nums opacity-80">{r.level}</span>
            </button>
          ))}
        </div>

        {selected && (
          <form onSubmit={handleSaveRank} className="rounded-xl border border-border bg-surface p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Shield className="size-4 text-primary" />
                <span className="font-semibold text-sm">{selected.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsLocked((v) => !v)}
                  title="قفل الصلاحية"
                  className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs ${
                    isLocked
                      ? 'border-destructive/40 bg-destructive/15 text-destructive'
                      : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                  }`}
                >
                  {isLocked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
                  {isLocked ? 'مقفلة' : 'مفتوحة'}
                </button>
                {!selected.isOwner && selected.id !== 'rank_member' && selected.id !== 'rank_guest' && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteRank()}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/15 px-2.5 text-xs text-destructive"
                  >
                    <Trash2 className="size-3.5" /> حذف
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">اسم الصلاحية</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">المستوى (0–999)</label>
                <input
                  type="number"
                  min={0}
                  max={999}
                  disabled={selected.isOwner}
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-xs shadow-sm tabular-nums disabled:opacity-60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">لون الرتبة</label>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-1 cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">أيقونة الصلاحية</label>
              <div className="flex flex-wrap gap-2">
                {ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setIcon(ic)}
                    className={`flex size-9 items-center justify-center rounded-lg border transition ${
                      icon === ic
                        ? 'border-primary bg-primary/20 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <RankIconGlyph icon={ic} className="size-4" />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-primary">أذونات الصلاحية</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {CP_PERMISSIONS.map((perm) => (
                  <label
                    key={perm.key}
                    className="flex items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 text-xs cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.isOwner || permissions.includes(perm.key)}
                      disabled={selected.isOwner}
                      onChange={(e) =>
                        setPermissions((prev) =>
                          e.target.checked
                            ? [...prev, perm.key]
                            : prev.filter((p) => p !== perm.key)
                        )
                      }
                      className="size-4 accent-primary"
                    />
                    <span>{perm.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-gradient-gold px-5 text-xs font-semibold text-primary-foreground shadow-gold hover:brightness-110 cursor-pointer"
              >
                <Save className="size-3.5" /> حفظ الصلاحية
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function RoomsTab({
  rooms,
  onReload,
  onNotify,
}: {
  rooms: Room[];
  onReload: () => void;
  onNotify: (msg: string, tone?: 'info' | 'success' | 'error') => void;
}) {
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">إدارة الغرف ({rooms.length})</h2>
        <button
          type="button"
          onClick={() => setCreatingNew(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-gradient-gold px-4 text-xs font-semibold text-primary-foreground shadow-gold hover:brightness-110 cursor-pointer"
        >
          <Plus className="size-4" /> إنشاء غرفة جديدة
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[680px] text-xs">
          <thead className="border-b border-border bg-surface-raised/60 text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-start font-semibold">الغرفة</th>
              <th className="px-3 py-2.5 text-start font-semibold">صاحب الغرفة</th>
              <th className="px-3 py-2.5 text-start font-semibold">السعة والمايكات</th>
              <th className="px-3 py-2.5 text-start font-semibold">الحالة</th>
              <th className="px-3 py-2.5 text-end font-semibold">الإعدادات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {rooms.map((r) => (
              <tr key={r.id} className="hover:bg-accent/25">
                <td className="px-3 py-2.5 font-semibold flex items-center gap-2">
                  <DoorOpen className="size-4 text-primary shrink-0" />
                  <span>{r.name}</span>
                </td>
                <td className="px-3 py-2.5">{r.ownerName}</td>
                <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                  {r.maxCapacity} عضو · {r.maxMics} مايك
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {r.isPinned ? 'مثبتة ' : ''}
                  {r.password ? '· محمية بكلمة مرور ' : ''}
                  {r.requiredLikes > 0 ? `· ${r.requiredLikes} لايك` : ''}
                </td>
                <td className="px-3 py-2.5 text-end">
                  <button
                    type="button"
                    onClick={() => setEditingRoom(r)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-3 py-1 hover:border-primary"
                  >
                    <Settings className="size-3.5" /> الإعدادات
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(editingRoom || creatingNew) && (
        <RoomEditorModal
          room={editingRoom}
          isNew={creatingNew}
          onClose={() => {
            setEditingRoom(null);
            setCreatingNew(false);
          }}
          onSaved={onReload}
          onNotify={onNotify}
        />
      )}
    </div>
  );
}
