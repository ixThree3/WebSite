import { useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Check,
  Globe,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { apiFetch } from '../../lib/device.ts';
import { validateSiteSettings } from '../../shared/permissions.ts';
import type {
  AutoMessage,
  DomainConfig,
  FilterCategory,
  FilterRule,
  FrontSettings,
  HitBlockedWord,
  RankRole,
  ShortcutItem,
  SiteSettings,
  SymbolItem,
  UserAccount,
} from '../../shared/types.ts';

export function ShortcutsTab({
  shortcuts,
  onReload,
  onNotify,
}: {
  shortcuts: ShortcutItem[];
  onReload: () => void;
  onNotify: (msg: string, tone?: 'info' | 'success' | 'error') => void;
}) {
  const [trigger, setTrigger] = useState('');
  const [expansion, setExpansion] = useState('');

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    try {
      await apiFetch('/api/cp/shortcuts', {
        method: 'POST',
        body: JSON.stringify({ trigger, expansion }),
      });
      setTrigger('');
      setExpansion('');
      onNotify('تمت إضافة الإختصار', 'success');
      onReload();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر الإضافة', 'error');
    }
  }

  async function handleDelete(id: string) {
    await apiFetch(`/api/cp/shortcuts/${id}`, { method: 'DELETE' });
    onReload();
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl">الإختصارات</h2>
      <form
        onSubmit={handleAdd}
        className="rounded-xl border border-border bg-surface p-4 flex flex-wrap items-center gap-2.5"
      >
        <input
          type="text"
          required
          value={trigger}
          onChange={(e) => setTrigger(e.target.value)}
          placeholder="الإختصار \ س1"
          className="h-9 w-44 rounded-md border border-input bg-transparent px-3 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <input
          type="text"
          required
          value={expansion}
          onChange={(e) => setExpansion(e.target.value)}
          placeholder="الزخرفة \ السلام عليكم"
          className="h-9 flex-1 min-w-[200px] rounded-md border border-input bg-transparent px-3 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <button
          type="submit"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-gradient-gold px-4 text-xs font-semibold text-primary-foreground shadow-gold hover:brightness-110 cursor-pointer"
        >
          <Check className="size-3.5" /> إضافة
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-xs">
          <thead className="border-b border-border bg-surface-raised/60 text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-start font-semibold">الإختصار</th>
              <th className="px-3 py-2.5 text-start font-semibold">الزخرفة</th>
              <th className="px-3 py-2.5 text-end font-semibold">حذف</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {shortcuts.map((s) => (
              <tr key={s.id} className="hover:bg-accent/25">
                <td className="px-3 py-2.5 font-semibold text-primary">{s.trigger}</td>
                <td className="px-3 py-2.5">{s.expansion}</td>
                <td className="px-3 py-2.5 text-end">
                  <button
                    type="button"
                    onClick={() => void handleDelete(s.id)}
                    className="rounded-lg p-1.5 text-destructive hover:bg-destructive/15"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SubsTab({
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
  const rankMap = useMemo(() => new Map(ranks.map((r) => [r.id, r])), [ranks]);

  const subs = useMemo(() => {
    const term = q.trim().toLowerCase();
    return users
      .filter((u) => {
        const rank = rankMap.get(u.rankId);
        return (rank && (rank.isOwner || rank.level > 0)) || u.subscriptionExpiresAt !== null;
      })
      .filter((u) => !term || u.username.toLowerCase().includes(term));
  }, [users, rankMap, q]);

  async function revokeSub(user: UserAccount) {
    await apiFetch(`/api/cp/users/${user.id}/update`, {
      method: 'POST',
      body: JSON.stringify({ rankId: 'rank_member', subscriptionDays: 0 }),
    });
    onNotify(`تم سحب إشتراك ${user.username}`, 'info');
    onReload();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">الإشتراكات والترقيات ({subs.length})</h2>
        <div className="relative w-64">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="البحث في الإشتراكات..."
            className="h-9 w-full rounded-md border border-input bg-surface pe-3 ps-8 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[720px] text-xs">
          <thead className="border-b border-border bg-surface-raised/60 text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-start font-semibold">الإشتراك</th>
              <th className="px-3 py-2.5 text-start font-semibold">العضو</th>
              <th className="px-3 py-2.5 text-start font-semibold">الزخرفة</th>
              <th className="px-3 py-2.5 text-start font-semibold">تاريخ الإنتهاء</th>
              <th className="px-3 py-2.5 text-start font-semibold">الأيام المتبقية</th>
              <th className="px-3 py-2.5 text-start font-semibold">تاريخ الترقية</th>
              <th className="px-3 py-2.5 text-end font-semibold">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {subs.map((u) => {
              const rank = rankMap.get(u.rankId);
              const daysLeft = u.subscriptionExpiresAt
                ? Math.max(0, Math.ceil((u.subscriptionExpiresAt - Date.now()) / 86_400_000))
                : null;
              return (
                <tr key={u.id} className="hover:bg-accent/25">
                  <td className="px-3 py-2.5 font-semibold" style={{ color: rank?.color }}>
                    {rank?.name}
                  </td>
                  <td className="px-3 py-2.5 font-semibold">{u.username}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{u.topic}</td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {u.subscriptionExpiresAt
                      ? new Date(u.subscriptionExpiresAt).toLocaleDateString('ar')
                      : 'دائم'}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">
                    {daysLeft !== null ? `${daysLeft} يوم` : '∞'}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                    {u.subscriptionGrantedAt
                      ? new Date(u.subscriptionGrantedAt).toLocaleDateString('ar')
                      : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-end">
                    {!rank?.isOwner && (
                      <button
                        type="button"
                        onClick={() => void revokeSub(u)}
                        className="rounded-lg border border-destructive/40 bg-destructive/15 px-2.5 py-1 text-destructive"
                      >
                        سحب
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function MessagesTab({
  autoMessages,
  onReload,
  onNotify,
}: {
  autoMessages: AutoMessage[];
  onReload: () => void;
  onNotify: (msg: string, tone?: 'info' | 'success' | 'error') => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  async function addMessage(type: 'welcome' | 'daily') {
    if (!title.trim() || !body.trim()) return;
    await apiFetch('/api/cp/auto-messages', {
      method: 'POST',
      body: JSON.stringify({ type, title, body }),
    });
    setTitle('');
    setBody('');
    onNotify(
      type === 'welcome' ? 'تمت إضافة رسالة الترحيب' : 'تمت إضافة الرسالة اليومية',
      'success'
    );
    onReload();
  }

  async function removeMessage(id: string) {
    await apiFetch(`/api/cp/auto-messages/${id}`, { method: 'DELETE' });
    onReload();
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl">الرسائل التلقائية والترحيب</h2>
      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="عنوان الرسالة"
          className="h-9 w-full max-w-sm rounded-md border border-input bg-transparent px-3 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={250}
          rows={3}
          placeholder="نص الرسالة (حتى 250 حرف)..."
          className="w-full rounded-md border border-input bg-transparent p-3 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void addMessage('welcome')}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 text-xs font-semibold text-white hover:bg-emerald-500 cursor-pointer"
          >
            <Check className="size-3.5" /> إضافة إلى رسائل الترحيب
          </button>
          <button
            type="button"
            onClick={() => void addMessage('daily')}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-gradient-gold px-3.5 text-xs font-semibold text-primary-foreground shadow-gold hover:brightness-110 cursor-pointer"
          >
            <Check className="size-3.5" /> إضافة إلى الرسائل اليومية
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-xs">
          <thead className="border-b border-border bg-surface-raised/60 text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-start font-semibold">التصنيف</th>
              <th className="px-3 py-2.5 text-start font-semibold">العنوان</th>
              <th className="px-3 py-2.5 text-start font-semibold">الرسالة</th>
              <th className="px-3 py-2.5 text-end font-semibold">حذف</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {autoMessages.map((m) => (
              <tr key={m.id} className="hover:bg-accent/25">
                <td className="px-3 py-2.5 font-semibold">
                  <span className={m.type === 'welcome' ? 'text-emerald-400' : 'text-amber-400'}>
                    {m.type === 'welcome' ? 'ترحيب' : 'يومية'}
                  </span>
                </td>
                <td className="px-3 py-2.5 font-medium">{m.title}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{m.body}</td>
                <td className="px-3 py-2.5 text-end">
                  <button
                    type="button"
                    onClick={() => void removeMessage(m.id)}
                    className="rounded-lg p-1.5 text-destructive hover:bg-destructive/15"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FilterTab({
  filters,
  blockedHits,
  onReload,
  onNotify,
}: {
  filters: FilterRule[];
  blockedHits: HitBlockedWord[];
  onReload: () => void;
  onNotify: (msg: string, tone?: 'info' | 'success' | 'error') => void;
}) {
  const [word, setWord] = useState('');

  async function addFilter(category: FilterCategory) {
    if (!word.trim()) return;
    await apiFetch('/api/cp/filters', {
      method: 'POST',
      body: JSON.stringify({ category, word }),
    });
    setWord('');
    onNotify('تم تحديث فلتر الكلمات', 'success');
    onReload();
  }

  async function delFilter(id: string) {
    await apiFetch(`/api/cp/filters/${id}`, { method: 'DELETE' });
    onReload();
  }

  const labelMap: Record<FilterCategory, { label: string; cls: string }> = {
    allowed: { label: 'مسموحة', cls: 'text-emerald-400' },
    blocked: { label: 'ممنوعة', cls: 'text-destructive' },
    monitored: { label: 'مراقبة', cls: 'text-amber-400' },
  };

  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl">فلتر الكلمات</h2>
      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="إضافة كلمة \ موقع"
          className="h-9 w-full max-w-md rounded-lg border border-border bg-background px-3 text-xs"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void addFilter('allowed')}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
          >
            إضافة إلى الكلمات المسموحة
          </button>
          <button
            type="button"
            onClick={() => void addFilter('blocked')}
            className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground"
          >
            إضافة إلى الكلمات الممنوعة
          </button>
          <button
            type="button"
            onClick={() => void addFilter('monitored')}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950"
          >
            إضافة إلى الكلمات المراقبة
          </button>
        </div>
      </div>

      {blockedHits.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-amber-300">
            <AlertTriangle className="size-4" /> آخر الكلمات الممنوعة المرصودة
          </div>
          <ul className="space-y-1">
            {blockedHits.slice(0, 8).map((h) => (
              <li key={h.id} className="text-foreground/90">
                <strong>{h.username}</strong> حاول كتابة «{h.word}» في {h.context}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-xs">
          <thead className="border-b border-border bg-surface-raised/60 text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-start font-semibold">التصنيف</th>
              <th className="px-3 py-2.5 text-start font-semibold">الكلمة</th>
              <th className="px-3 py-2.5 text-end font-semibold">حذف</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filters.map((f) => (
              <tr key={f.id}>
                <td className={`px-3 py-2.5 font-semibold ${labelMap[f.category].cls}`}>
                  {labelMap[f.category].label}
                </td>
                <td className="px-3 py-2.5">{f.word}</td>
                <td className="px-3 py-2.5 text-end">
                  <button
                    type="button"
                    onClick={() => void delFilter(f.id)}
                    className="rounded-lg p-1.5 text-destructive hover:bg-destructive/15"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FrontTab({
  front,
  onReload,
  onNotify,
}: {
  front: FrontSettings;
  onReload: () => void;
  onNotify: (msg: string, tone?: 'info' | 'success' | 'error') => void;
}) {
  const [form, setForm] = useState(front);

  async function save(e: FormEvent) {
    e.preventDefault();
    await apiFetch('/api/cp/front', {
      method: 'POST',
      body: JSON.stringify(form),
    });
    onNotify('تم حفظ إعدادات الواجهة', 'success');
    onReload();
  }

  return (
    <form onSubmit={save} className="space-y-4 max-w-2xl">
      <h2 className="font-display text-2xl">إعدادات الواجهة</h2>
      <div className="rounded-xl border border-border bg-surface p-4 space-y-3 text-xs">
        <div className="space-y-1">
          <label className="text-muted-foreground">اسم الموقع</label>
          <input
            type="text"
            value={form.siteName}
            onChange={(e) => setForm({ ...form, siteName: e.target.value })}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-muted-foreground">عنوان الواجهة</label>
          <input
            type="text"
            value={form.heroTitle}
            onChange={(e) => setForm({ ...form, heroTitle: e.target.value })}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-muted-foreground">الوصف الترحيبي</label>
          <input
            type="text"
            value={form.heroSubtitle}
            onChange={(e) => setForm({ ...form, heroSubtitle: e.target.value })}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label className="text-muted-foreground">شريط الإعلان العام المثبت</label>
          <input
            type="text"
            value={form.announcement}
            onChange={(e) => setForm({ ...form, announcement: e.target.value })}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div className="flex flex-wrap gap-4 pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.showHeroBanner}
              onChange={(e) => setForm({ ...form, showHeroBanner: e.target.checked })}
              className="size-4 accent-primary"
            />
            <span>إظهار خلفية ليل الخليج في صفحة الدخول</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.showOnlineCountPublic}
              onChange={(e) => setForm({ ...form, showOnlineCountPublic: e.target.checked })}
              className="size-4 accent-primary"
            />
            <span>إظهار عداد المتصلين للزوار</span>
          </label>
        </div>
        <div className="pt-2">
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-gradient-gold px-5 text-xs font-semibold text-primary-foreground shadow-gold hover:brightness-110 cursor-pointer"
          >
            <Save className="size-3.5" /> حفظ الواجهة
          </button>
        </div>
      </div>
    </form>
  );
}

export function SymbolsTab({
  symbols,
  onReload,
  onNotify,
}: {
  symbols: SymbolItem[];
  onReload: () => void;
  onNotify: (msg: string, tone?: 'info' | 'success' | 'error') => void;
}) {
  const [glyph, setGlyph] = useState('');
  const [label, setLabel] = useState('');
  const [code, setCode] = useState('');

  async function addSymbol(e: FormEvent) {
    e.preventDefault();
    await apiFetch('/api/cp/symbols', {
      method: 'POST',
      body: JSON.stringify({ glyph, label, code }),
    });
    setGlyph('');
    setLabel('');
    setCode('');
    onNotify('تمت إضافة الرمز', 'success');
    onReload();
  }

  async function delSymbol(id: string) {
    await apiFetch(`/api/cp/symbols/${id}`, { method: 'DELETE' });
    onReload();
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl">الرموز والفيسات</h2>
      <form
        onSubmit={addSymbol}
        className="rounded-xl border border-border bg-surface p-4 flex flex-wrap items-center gap-2.5"
      >
        <input
          type="text"
          required
          value={glyph}
          onChange={(e) => setGlyph(e.target.value)}
          placeholder="الرمز (مثال: 🦅)"
          className="h-9 w-28 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <input
          type="text"
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="الوصف"
          className="h-9 w-44 rounded-md border border-input bg-transparent px-3 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="الكود (:falcon:)"
          className="h-9 w-36 rounded-md border border-input bg-transparent px-3 text-xs font-mono shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <button
          type="submit"
          className="inline-flex h-9 items-center gap-1 rounded-md bg-gradient-gold px-4 text-xs font-semibold text-primary-foreground shadow-gold hover:brightness-110 cursor-pointer"
        >
          <Sparkles className="size-3.5" /> إضافة رمز
        </button>
      </form>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {symbols.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded-xl border border-border bg-surface px-3.5 py-2.5"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xl">{s.glyph}</span>
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold">{s.label}</div>
                <div className="truncate text-[10px] font-mono text-muted-foreground">{s.code}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void delSymbol(s.id)}
              className="p-1 text-destructive hover:bg-destructive/15 rounded"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DomainsTab({
  domains,
  onReload,
  onNotify,
}: {
  domains: DomainConfig[];
  onReload: () => void;
  onNotify: (msg: string, tone?: 'info' | 'success' | 'error') => void;
}) {
  const [domain, setDomain] = useState('');
  const [role, setRole] = useState<DomainConfig['role']>('mirror');
  const [notes, setNotes] = useState('');

  async function addDomain(e: FormEvent) {
    e.preventDefault();
    await apiFetch('/api/cp/domains', {
      method: 'POST',
      body: JSON.stringify({ domain, role, notes }),
    });
    setDomain('');
    setNotes('');
    onNotify('تمت إضافة النطاق', 'success');
    onReload();
  }

  async function removeDomain(id: string) {
    await apiFetch(`/api/cp/domains/${id}`, { method: 'DELETE' });
    onReload();
  }

  const roleLabels: Record<DomainConfig['role'], string> = {
    primary: 'النطاق الرئيسي',
    mic_server: 'خادم المايك',
    mirror: 'نطاق إضافي',
    invite_source: 'مصدر دعوة',
  };

  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl">النطاقات وإعدادات السيرفر</h2>
      <form
        onSubmit={addDomain}
        className="rounded-xl border border-border bg-surface p-4 flex flex-wrap items-center gap-2.5"
      >
        <input
          type="text"
          required
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="example.com"
          className="h-9 w-52 rounded-md border border-input bg-transparent px-3 text-xs font-mono shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as DomainConfig['role'])}
          className="h-9 rounded-md border border-input bg-surface px-3 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="primary">النطاق الرئيسي</option>
          <option value="mic_server">خادم المايك الصوتي</option>
          <option value="mirror">نطاق بديل</option>
          <option value="invite_source">مصدر دعوة</option>
        </select>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="ملاحظات"
          className="h-9 flex-1 min-w-[160px] rounded-md border border-input bg-transparent px-3 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <button
          type="submit"
          className="inline-flex h-9 items-center gap-1 rounded-md bg-gradient-gold px-4 text-xs font-semibold text-primary-foreground shadow-gold hover:brightness-110 cursor-pointer"
        >
          <Plus className="size-3.5" /> إضافة
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-xs">
          <thead className="border-b border-border bg-surface-raised/60 text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-start font-semibold">النطاق</th>
              <th className="px-3 py-2.5 text-start font-semibold">الدور</th>
              <th className="px-3 py-2.5 text-start font-semibold">ملاحظات</th>
              <th className="px-3 py-2.5 text-end font-semibold">حذف</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {domains.map((d) => (
              <tr key={d.id}>
                <td className="px-3 py-2.5 font-mono flex items-center gap-2">
                  <Globe className="size-3.5 text-primary" /> {d.domain}
                </td>
                <td className="px-3 py-2.5 font-semibold text-primary">{roleLabels[d.role]}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{d.notes}</td>
                <td className="px-3 py-2.5 text-end">
                  <button
                    type="button"
                    onClick={() => void removeDomain(d.id)}
                    className="rounded-lg p-1.5 text-destructive hover:bg-destructive/15"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SiteSettingsTab({
  settings,
  onReload,
  onNotify,
}: {
  settings: SiteSettings;
  onReload: () => void;
  onNotify: (msg: string, tone?: 'info' | 'success' | 'error') => void;
}) {
  const [form, setForm] = useState<SiteSettings>(settings);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const numField = (key: keyof SiteSettings, label: string, min = 0) => (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-foreground/90">{label}</label>
        <input
          type="number"
          min={min}
          value={Number(form[key])}
          onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
          className="h-8 w-24 rounded-lg border border-border bg-background px-2.5 text-xs text-center tabular-nums"
        />
      </div>
      {errors[key] && <p className="text-[11px] text-destructive">{errors[key]}</p>}
    </div>
  );

  const checkField = (key: keyof SiteSettings, label: string) => (
    <label className="flex items-center gap-2 text-xs cursor-pointer">
      <input
        type="checkbox"
        checked={Boolean(form[key])}
        onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
        className="size-4 accent-primary"
      />
      <span>{label}</span>
    </label>
  );

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const v = validateSiteSettings(form);
    if (!v.valid) {
      setErrors(v.errors);
      onNotify('يرجى تصحيح الحقول المحددة باللون الأحمر', 'error');
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await apiFetch('/api/cp/site-settings', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      onNotify('تم حفظ إعدادات الموقع بنجاح', 'success');
      onReload();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تعذر حفظ الإعدادات', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">إدارة الموقع والقيود</h2>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-gradient-gold px-5 text-xs font-semibold text-primary-foreground shadow-gold hover:brightness-110 cursor-pointer disabled:opacity-50"
        >
          <Save className="size-4" /> حفظ الإعدادات
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4 space-y-2.5">
          <h3 className="text-sm font-semibold text-primary border-b border-border pb-2">الحائط</h3>
          {numField('wallCooldownMin', 'المدة بين رسائل الحائط بالدقيقة')}
          {numField('wallMaxChars', 'عدد أحرف الرسالة المسموح بها في الحائط', 10)}
          {numField('wallMinLikes', 'عدد لايكات الحائط')}
          {numField('wallCommentMinLikes', 'عدد لايكات التعليق')}
          {numField('wallUploadMinLikes', 'عدد لايكات لإرسال ملف في الحائط')}
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 space-y-2.5">
          <h3 className="text-sm font-semibold text-primary border-b border-border pb-2">الخاص</h3>
          {numField('pmMaxChars', 'عدد أحرف الرسالة المسموح بها في الخاص', 10)}
          {numField('pmMinLikes', 'عدد لايكات إرسال رسالة في الخاص')}
          {numField('pmCallMinLikes', 'عدد اللايكات للإتصال في الخاص')}
          {numField('pmFileMinLikes', 'عدد لايكات إرسال ملف في الخاص')}
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 space-y-2.5">
          <h3 className="text-sm font-semibold text-primary border-b border-border pb-2">الغرف والمايكات</h3>
          {numField('roomMaxChars', 'عدد أحرف الرسالة المسموح بها في الغرف', 10)}
          {numField('dailyMsgIntervalMin', 'المدة بين الرسائل اليومية بالدقيقة', 1)}
          {numField('roomWriteMinLikes', 'عدد لايكات الكتابة في الغرف')}
          {numField('roomMediaMinLikes', 'عدد لايكات إرسال وسائط في الغرف')}
          {numField('micMinLikes', 'عدد لايكات الصعود على المايك')}
          {numField('alertMinLikes', 'عدد لايكات إرسال تنبيه')}
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 space-y-2.5">
          <h3 className="text-sm font-semibold text-primary border-b border-border pb-2">قيود الدخول والملف الشخصي</h3>
          {numField('maxAccountsPerUser', 'عدد العضويات المسموح الدخول بها لكل مستخدم', 2)}
          {numField('maxRegistrationsPerUser', 'عدد تسجيل العضويات المسموح بها للمستخدم', 2)}
          {numField('guestNameMinChars', 'عدد الأحرف لأسم الزائر', 1)}
          {numField('registerNameMinChars', 'عدد الأحرف لتسجيل اسم', 1)}
          {numField('nameChangeMinLikes', 'عدد لايكات تغيير الإسم')}
          {numField('picChangeMinLikes', 'عدد لايكات تغيير الصورة')}
        </div>
      </div>

      {/* 19 Hide Options */}
      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <h3 className="text-sm font-semibold text-primary border-b border-border pb-2">
          خيارات الإخفاء
        </h3>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {checkField('hideShields', 'إخفاء الدروع')}
          {checkField('hideStory', 'إخفاء الستوري')}
          {checkField('hideRoomMedia', 'إخفاء إرسال الوسائط والملصقات في الغرف')}
          {checkField('hideProfileViewers', 'إخفاء مشاهدين البروفايل')}
          {checkField('hideWallNotify', 'إخفاء إشعارات الحائط')}
          {checkField('hideVoiceRecord', 'إخفاء التسجيل الصوتي')}
          {checkField('hideProfileCover', 'إخفاء غلاف وإضافات البروفايل')}
          {checkField('hideProfileYoutube', 'إخفاء إضافة يوتيوب في الملف الشخصي')}
          {checkField('hideQuickChat', 'إخفاء الدردشة السريعة')}
          {checkField('hideGames', 'إخفاء الألعاب')}
          {checkField('hidePmDelete', 'إخفاء الحذف بالخاص')}
          {checkField('hidePmReply', 'إخفاء الرد بالخاص')}
          {checkField('hideLudoStar', 'إخفاء نجم Ludo')}
          {checkField('hideXoStar', 'إخفاء نجم X-O')}
          {checkField('hideWallCreator', 'إخفاء مبدع الحائط')}
          {checkField('hideWallTrend', 'إخفاء ترند الحائط')}
          {checkField('hideMicStar', 'إخفاء نجم المايك')}
          {checkField('hideNotifBox', 'إخفاء صندوق الإشعارات')}
          {checkField('disableNotifSound', 'تعطيل صوت الإشعارات')}
          {checkField('disableMention', 'تعطيل ميزة المنشن')}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4 space-y-2.5">
          <h3 className="text-sm font-semibold text-primary border-b border-border pb-2">
            التفاعل والحماية والدخول
          </h3>
          {checkField('contestBotEnabled', 'تشغيل البوت الآلي في غرفة المسابقات')}
          {checkField('roomReplyEnabled', 'تفعيل الرد في الغرف')}
          {checkField('wallCommentsEnabled', 'تفعيل التعليقات في الحائط')}
          {checkField('pmCallsEnabled', 'تفعيل المكالمات في الخاص')}
          {checkField('pmReadReceiptEnabled', 'تفعيل مؤشر رؤية الرسالة في الخاص')}
          {checkField('reconnectEnabled', 'تفعيل إعادة الإتصال')}
          {checkField('blockGuests', 'عدم السماح بدخول الزائر')}
          {checkField('blockRegistrations', 'عدم السماح بتسجيل عضوية')}
          {checkField('blockVpn', 'تفعيل عدم الدخول عبر VPN')}
          {checkField('stopAudioStay', 'إيقاف المقطع الصوتي للبقاء بالصفحة')}
          {checkField('outsideDesignEnabled', 'تفعيل تصميم العضوية خارج الموقع')}
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <h3 className="text-sm font-semibold text-primary border-b border-border pb-2">
            خيارات تثبيت النكات
          </h3>
          {checkField('offlinePinEnabled', 'تفعيل تثبيت النكات بعد انقطاع النت')}
          {checkField('pinInsideRoom', 'تثبيت النكات داخل الروم')}
          <div className="space-y-1 text-xs">
            <label className="text-muted-foreground block">لون نشاط الأعضاء غير المتصلين</label>
            <select
              value={form.offlineStatusColor}
              onChange={(e) =>
                setForm({
                  ...form,
                  offlineStatusColor: e.target.value as SiteSettings['offlineStatusColor'],
                })
              }
              className="h-9 w-40 rounded-lg border border-border bg-background px-3 text-xs"
            >
              <option value="s0">أخضر</option>
              <option value="s1">برتقالي</option>
              <option value="s2">أحمر</option>
              <option value="s3">رمادي</option>
            </select>
          </div>
          <div className="space-y-1 text-xs">
            <label className="text-muted-foreground block">مدة خروج النكات المثبتة بالساعة</label>
            <input
              type="text"
              value={form.offlinePinHours}
              onChange={(e) => setForm({ ...form, offlinePinHours: e.target.value })}
              className="h-9 w-32 rounded-lg border border-border bg-background px-3 text-xs font-mono-tabular"
            />
            <p className="text-[11px] text-muted-foreground">
              مثال: الساعة = 1 ، ساعتين = 2 ، خمس دقائق = 0:05
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-gradient-gold px-6 text-sm font-semibold text-primary-foreground shadow-gold hover:brightness-110 cursor-pointer disabled:opacity-50"
        >
          <Save className="size-4" /> حفظ جميع إعدادات الموقع
        </button>
      </div>
    </form>
  );
}
