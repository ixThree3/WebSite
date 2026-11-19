import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react';
import { apiFetch, copyText, countryToFlagEmoji } from '../../lib/device.ts';
import { formatRelativeArabic, type PurgeRangeKey } from '../../shared/permissions.ts';
import type {
  AccessLogEntry,
  ActionStateLog,
  RankRole,
  UserAccount,
} from '../../shared/types.ts';
import { ConfirmActionModal } from '../UserBadges.tsx';
import { EditUserModal, InspectFingerprintModal } from './CpModals.tsx';

function RelativeTimeBadge({ ts }: { ts: number }) {
  const rel = formatRelativeArabic(ts);
  const toneColor =
    rel.tone === 'now'
      ? 'text-emerald-400'
      : rel.tone === 'min'
      ? 'text-sky-400'
      : rel.tone === 'hour'
      ? 'text-amber-400'
      : 'text-muted-foreground';
  return (
    <span className={`font-medium tabular-nums whitespace-nowrap ${toneColor}`}>
      {rel.value} {rel.unit}
    </span>
  );
}

export function LogsTableTab({
  title,
  entries,
  onNotify,
}: {
  title: string;
  entries: AccessLogEntry[];
  onNotify: (msg: string, tone?: 'info' | 'success' | 'error') => void;
}) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [inspectEntry, setInspectEntry] = useState<AccessLogEntry | null>(null);
  const pageSize = 25;

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return entries;
    return entries.filter(
      (e) =>
        e.username.toLowerCase().includes(term) ||
        e.topic.toLowerCase().includes(term) ||
        e.ip.toLowerCase().includes(term) ||
        e.device.toLowerCase().includes(term) ||
        e.state.toLowerCase().includes(term)
    );
  }, [entries, q]);

  const slice = filtered.slice(page * pageSize, (page + 1) * pageSize);

  async function copy(val: string) {
    if (await copyText(val)) onNotify('تم النسخ إلى الحافظة', 'info');
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">{title}</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-surface px-2.5 text-xs tabular-nums disabled:opacity-40"
            >
              <ChevronRight className="size-3.5" />
              {page * pageSize}
            </button>
            <button
              type="button"
              disabled={(page + 1) * pageSize >= filtered.length}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-surface px-2.5 text-xs tabular-nums disabled:opacity-40"
            >
              {(page + 1) * pageSize}
              <ChevronLeft className="size-3.5" />
            </button>
          </div>
          <div className="relative w-56 sm:w-64">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="البحث..."
              className="h-9 w-full rounded-lg border border-border bg-surface pe-3 ps-8 text-xs focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[820px] text-xs">
          <thead className="border-b border-border bg-surface-raised/60 text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-start font-semibold">الحالة</th>
              <th className="px-3 py-2.5 text-start font-semibold">العضو</th>
              <th className="px-3 py-2.5 text-start font-semibold">الزخرفة</th>
              <th className="px-3 py-2.5 text-start font-semibold">الأي بي</th>
              <th className="px-3 py-2.5 text-start font-semibold">الدولة</th>
              <th className="px-3 py-2.5 text-start font-semibold">الجهاز</th>
              <th className="px-3 py-2.5 text-start font-semibold">الوقت</th>
              <th className="px-3 py-2.5 text-start font-semibold">الدعوة</th>
              <th className="px-3 py-2.5 text-end font-semibold">فحص</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {slice.map((row) => (
              <tr key={row.id} className="hover:bg-accent/25 transition">
                <td className="px-3 py-2.5 font-medium whitespace-nowrap">
                  <span
                    className={
                      row.state.includes('محظور')
                        ? 'text-destructive'
                        : row.state === 'المالك'
                        ? 'text-primary'
                        : 'text-foreground'
                    }
                  >
                    {row.state}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    {row.username}
                    <button
                      type="button"
                      onClick={() => void copy(row.username)}
                      title="نسخ"
                      className="text-muted-foreground hover:text-primary"
                    >
                      <Copy className="size-3" />
                    </button>
                  </span>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{row.topic}</td>
                <td className="px-3 py-2.5">
                  <span className="inline-flex items-center gap-1.5 font-mono-tabular" dir="ltr">
                    {row.ip}
                    <button
                      type="button"
                      onClick={() => void copy(row.ip)}
                      title="نسخ الأي بي"
                      className="text-muted-foreground hover:text-primary"
                    >
                      <Copy className="size-3" />
                    </button>
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {countryToFlagEmoji(row.country)} {row.country}
                </td>
                <td className="px-3 py-2.5 max-w-[240px]">
                  <span className="inline-flex items-center gap-1 font-mono-tabular truncate max-w-[210px]" dir="ltr">
                    <span className="truncate text-sky-300/90">{row.device}</span>
                    <button
                      type="button"
                      onClick={() => void copy(row.device)}
                      title="نسخ البصمة"
                      className="shrink-0 text-muted-foreground hover:text-primary"
                    >
                      <Copy className="size-3" />
                    </button>
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <RelativeTimeBadge ts={row.createdAt} />
                </td>
                <td className="px-3 py-2.5 text-muted-foreground font-mono-tabular" dir="ltr">
                  {row.referrer || '*'}
                </td>
                <td className="px-3 py-2.5 text-end">
                  <button
                    type="button"
                    onClick={() => setInspectEntry(row)}
                    className="inline-flex size-7 items-center justify-center rounded-lg border border-border bg-surface-raised text-primary hover:border-primary"
                    title="فحص البصمة"
                  >
                    <Search className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {slice.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  لا توجد سجلات مطابقة
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <InspectFingerprintModal entry={inspectEntry} onClose={() => setInspectEntry(null)} />
    </div>
  );
}

export function StatesTab({ states }: { states: ActionStateLog[] }) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return states;
    return states.filter(
      (s) =>
        s.action.toLowerCase().includes(term) ||
        s.actorName.toLowerCase().includes(term) ||
        s.targetName.toLowerCase().includes(term) ||
        s.roomOrDetail.toLowerCase().includes(term)
    );
  }, [states, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">سجل الحالات الإدارية</h2>
        <div className="relative w-64">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="البحث في الحالات..."
            className="h-9 w-full rounded-lg border border-border bg-surface pe-3 ps-8 text-xs focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[740px] text-xs">
          <thead className="border-b border-border bg-surface-raised/60 text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-start font-semibold">الحالة</th>
              <th className="px-3 py-2.5 text-start font-semibold">العضو</th>
              <th className="px-3 py-2.5 text-start font-semibold">العضو الثاني</th>
              <th className="px-3 py-2.5 text-start font-semibold">الغرفة / التفاصيل</th>
              <th className="px-3 py-2.5 text-start font-semibold">الأي بي</th>
              <th className="px-3 py-2.5 text-start font-semibold">الوقت</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filtered.slice(0, 100).map((s) => (
              <tr key={s.id} className="hover:bg-accent/25 transition">
                <td className="px-3 py-2.5 font-semibold text-primary whitespace-nowrap">{s.action}</td>
                <td className="px-3 py-2.5 font-medium">{s.actorName}</td>
                <td className="px-3 py-2.5 text-foreground/90">{s.targetName}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{s.roomOrDetail || '—'}</td>
                <td className="px-3 py-2.5 font-mono-tabular" dir="ltr">
                  {s.ip}
                </td>
                <td className="px-3 py-2.5">
                  <RelativeTimeBadge ts={s.createdAt} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function UsersTab({
  users,
  ranks,
  onReload,
  onNotify,
}: {
  users: UserAccount[];
  ranks: RankRole[];
  onReload: () => void;
  onNotify: (msg: string, tone?: 'info' | 'success' | 'error') => void;
}) {
  const [q, setQ] = useState('');
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [cleanerOpen, setCleanerOpen] = useState(false);
  const [purgeRange, setPurgeRange] = useState<PurgeRangeKey>('m:6');
  const [purgePreviewText, setPurgePreviewText] = useState<string | null>(null);
  const [confirmPurgeOpen, setConfirmPurgeOpen] = useState(false);

  const rankMap = useMemo(() => new Map(ranks.map((r) => [r.id, r])), [ranks]);
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(term) ||
        u.topic.toLowerCase().includes(term) ||
        u.ip.toLowerCase().includes(term)
    );
  }, [users, q]);

  async function handlePreviewPurge() {
    try {
      const res = await apiFetch<{ count: number; usernames: string[] }>(
        '/api/cp/users/purge-preview',
        {
          method: 'POST',
          body: JSON.stringify({ range: purgeRange }),
        }
      );
      setPurgePreviewText(`عدد العضويات المرشحة للحذف: ${res.count} عضوية`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر المعاينة', 'error');
    }
  }

  async function handleExecutePurge() {
    setConfirmPurgeOpen(false);
    try {
      const res = await apiFetch<{ deletedCount: number }>('/api/cp/users/purge-execute', {
        method: 'POST',
        body: JSON.stringify({ range: purgeRange }),
      });
      setPurgePreviewText(`تم حذف ${res.deletedCount} عضوية غير نشطة`);
      onNotify(`تم تنظيف ${res.deletedCount} عضوية خاملة`, 'success');
      onReload();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر الحذف', 'error');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">الأعضاء ({users.length})</h2>
        <div className="relative w-64">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="البحث في الأعضاء..."
            className="h-9 w-full rounded-lg border border-border bg-surface pe-3 ps-8 text-xs focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Inactive Member Cleaner Card (uc-cleaner-card) */}
      <div className="rounded-xl border border-border bg-surface">
        <button
          type="button"
          onClick={() => setCleanerOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-surface-raised/50 transition"
        >
          <span className="flex items-center gap-2 text-rose-400">
            <Trash2 className="size-4" />
            حذف العضويات التي لم تسجل دخول
          </span>
          <ChevronDown
            className={`size-4 text-muted-foreground transition ${cleanerOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {cleanerOpen && (
          <div className="border-t border-border px-4 py-3 flex flex-wrap items-center gap-3 text-xs">
            <label className="text-muted-foreground font-medium">المدة:</label>
            <select
              value={purgeRange}
              onChange={(e) => setPurgeRange(e.target.value as PurgeRangeKey)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs"
            >
              <option value="m:1">1 شهر</option>
              <option value="d:45">1 شهر ونصف</option>
              <option value="m:2">2 شهر</option>
              <option value="m:3">3 شهر</option>
              <option value="m:5">5 شهر</option>
              <option value="m:6">6 شهر</option>
              <option value="y:1">1 سنة</option>
            </select>
            <button
              type="button"
              onClick={() => void handlePreviewPurge()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-3 font-medium hover:border-primary"
            >
              <Eye className="size-3.5" /> معاينة
            </button>
            <button
              type="button"
              onClick={() => setConfirmPurgeOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-destructive px-3 font-semibold text-destructive-foreground hover:opacity-90"
            >
              <Trash2 className="size-3.5" /> حذف
            </button>
            {purgePreviewText && (
              <span className="text-amber-300 font-medium">{purgePreviewText}</span>
            )}
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[820px] text-xs">
          <thead className="border-b border-border bg-surface-raised/60 text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-start font-semibold">العضو</th>
              <th className="px-3 py-2.5 text-start font-semibold">الزخرفة</th>
              <th className="px-3 py-2.5 text-start font-semibold">الأي بي</th>
              <th className="px-3 py-2.5 text-start font-semibold">الجهاز</th>
              <th className="px-3 py-2.5 text-start font-semibold">الصلاحية</th>
              <th className="px-3 py-2.5 text-start font-semibold">اللايكات</th>
              <th className="px-3 py-2.5 text-start font-semibold">آخر تواجد</th>
              <th className="px-3 py-2.5 text-end font-semibold">تعديل</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filtered.map((u) => {
              const rank = rankMap.get(u.rankId);
              return (
                <tr key={u.id} className="hover:bg-accent/25 transition">
                  <td className="px-3 py-2.5 font-semibold" style={{ color: u.color }}>
                    {u.username}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{u.topic}</td>
                  <td className="px-3 py-2.5 font-mono-tabular" dir="ltr">
                    {u.ip}
                  </td>
                  <td className="px-3 py-2.5 max-w-[180px] truncate font-mono-tabular text-sky-300/80" dir="ltr">
                    {u.device}
                  </td>
                  <td className="px-3 py-2.5 font-semibold" style={{ color: rank?.color }}>
                    {rank?.name ?? 'عضو'}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{u.likes.toLocaleString('en-US')}</td>
                  <td className="px-3 py-2.5">
                    <RelativeTimeBadge ts={u.lastSeen} />
                  </td>
                  <td className="px-3 py-2.5 text-end">
                    <button
                      type="button"
                      onClick={() => setEditingUser(u)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-raised px-2.5 py-1 hover:border-primary text-xs"
                    >
                      <Pencil className="size-3" /> تعديل
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <EditUserModal
          user={editingUser}
          ranks={ranks}
          onClose={() => setEditingUser(null)}
          onSaved={onReload}
          onNotify={onNotify}
        />
      )}

      <ConfirmActionModal
        open={confirmPurgeOpen}
        title="تأكيد حذف العضويات الخاملة"
        message="سيتم حذف الحسابات غير النشطة التي تتجاوز المدة المحددة نهائياً (مع حماية حسابات الإدارة والمالك)."
        confirmLabel="تأكيد الحذف"
        danger
        onConfirm={() => void handleExecutePurge()}
        onCancel={() => setConfirmPurgeOpen(false)}
      />
    </div>
  );
}
