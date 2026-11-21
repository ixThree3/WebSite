import { useRef, useState, type FormEvent } from 'react';
import {
  ArrowDown,
  ChevronLeft,
  Crown,
  DoorOpen,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  Mic,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import gulfNightHero from '../assets/gulf-night.jpg';
import { useChat } from '../lib/useChatClient.tsx';
import { Logo, UserAvatar, UserDisplayName } from './UserBadges.tsx';

type AuthTab = 'member' | 'register' | 'guest';

export function AuthScreen() {
  const {
    front,
    siteSettings,
    onlineUsers,
    ranks,
    isLocalOwnerDevice,
    savedAccounts,
    quickLogin,
    deleteSavedAccount,
    loginAccount,
    registerAccount,
    loginGuest,
    notify,
  } = useChat();

  const [tab, setTab] = useState<AuthTab>('register');
  const [username, setUsername] = useState('');
  const [topic, setTopic] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const authFormRef = useRef<HTMLDivElement | null>(null);
  const usernameInputRef = useRef<HTMLInputElement | null>(null);

  const guestsAllowed = !siteSettings.blockGuests;
  const regAllowed = !siteSettings.blockRegistrations || isLocalOwnerDevice;

  function handleUseAnotherAccount() {
    setTab('member');
    authFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => usernameInputRef.current?.focus(), 200);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (tab === 'guest') {
        await loginGuest(username);
      } else if (tab === 'register') {
        await registerAccount(username, password, topic || username);
      } else {
        await loginAccount(username, password);
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر إتمام العملية', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      {front.showHeroBanner && (
        <section className="relative isolate overflow-hidden border-b border-border/60">
          <img
            src={gulfNightHero}
            alt="سفينة خليجية تحت قمر الليل"
            className="absolute inset-0 -z-20 h-full w-full object-cover opacity-55"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-night" />
          <div className="mx-auto flex max-w-6xl flex-col items-center px-4 pb-10 pt-14 text-center sm:pt-20">
            {front.showOnlineCountPublic && (
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground backdrop-blur">
                <span className="size-2 rounded-full bg-success" />
                <Users className="size-3.5" />
                <span className="tabular-nums">متصل الآن {onlineUsers.length}</span>
              </div>
            )}
            <h1 className="font-display text-4xl sm:text-6xl font-bold drop-shadow">
              <Logo siteName={front.siteName} />
            </h1>
            <p className="mt-3 max-w-xl text-sm sm:text-base text-muted-foreground">
              {front.heroSubtitle}
            </p>
          </div>
        </section>
      )}

      <main className="mx-auto w-full max-w-6xl flex-1 grid gap-6 px-4 py-8 lg:grid-cols-[1fr_22rem] items-start">
        <div className="mx-auto w-full max-w-md space-y-5">
          {savedAccounts.length > 0 && (
            <section
              data-testid="saved-accounts-prompt"
              className="rounded-xl border border-primary/40 bg-gradient-panel p-4 sm:p-5 shadow-panel space-y-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Sparkles className="size-4 shrink-0" />
                  <span>مرحباً بعودتك — الدخول السريع</span>
                </div>
                <span className="text-[11px] text-muted-foreground">حسابك محفوظ على هذا الجهاز</span>
              </div>

              <div className="space-y-2.5">
                {savedAccounts.map((acc) => {
                  const accRank = ranks.find((r) => r.id === acc.rankId);
                  return (
                    <div
                      key={acc.quickLoginToken}
                      className="rounded-lg border border-border bg-surface/80 p-3 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar user={acc} size="md" />
                          <div className="min-w-0">
                            <UserDisplayName
                              user={acc}
                              rank={accRank}
                              plain
                              className="text-sm"
                            />
                            <p className="truncate text-[11px] text-muted-foreground">
                              @{acc.username}
                              {accRank ? ` · ${accRank.name}` : ''}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          title="إزالة الحساب المحفوظ"
                          aria-label={`إزالة حساب ${acc.username}`}
                          onClick={() => void deleteSavedAccount(acc.quickLoginToken)}
                          className="rounded-md p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition shrink-0 cursor-pointer"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={busy}
                        data-action="quick-login"
                        data-username={acc.username}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await quickLogin(acc.quickLoginToken);
                          } catch (err) {
                            notify(
                              err instanceof Error ? err.message : 'تعذر الدخول السريع',
                              'error'
                            );
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-gradient-gold px-4 text-xs sm:text-sm font-semibold text-primary-foreground shadow-gold hover:brightness-110 disabled:opacity-50 transition cursor-pointer"
                      >
                        <LogIn className="size-4" />
                        <span>تسجيل دخول سريع للموقع</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                data-action="use-another-account"
                onClick={handleUseAnotherAccount}
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border bg-surface-raised/70 px-4 text-xs font-medium text-foreground backdrop-blur hover:bg-accent transition cursor-pointer"
              >
                <ArrowDown className="size-3.5 text-primary" />
                <span>استعمال حساب آخر</span>
              </button>
            </section>
          )}

          <div
            ref={authFormRef}
            className="rounded-xl border border-border bg-gradient-panel p-5 sm:p-6 shadow-panel"
          >
            {/* Tabs matching tabs.tsx */}
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 text-muted-foreground">
              {regAllowed && (
                <button
                  type="button"
                  onClick={() => setTab('register')}
                  className={`rounded-md px-2 py-1.5 text-xs sm:text-sm font-medium transition whitespace-nowrap cursor-pointer ${
                    tab === 'register'
                      ? 'bg-background text-foreground shadow'
                      : 'hover:text-foreground'
                  }`}
                >
                  تسجيل عضوية
                </button>
              )}
              <button
                type="button"
                onClick={() => setTab('member')}
                className={`rounded-md px-2 py-1.5 text-xs sm:text-sm font-medium transition whitespace-nowrap cursor-pointer ${
                  tab === 'member'
                    ? 'bg-background text-foreground shadow'
                    : 'hover:text-foreground'
                }`}
              >
                دخول الأعضاء
              </button>
              {guestsAllowed && (
                <button
                  type="button"
                  onClick={() => setTab('guest')}
                  className={`rounded-md px-2 py-1.5 text-xs sm:text-sm font-medium transition whitespace-nowrap cursor-pointer ${
                    tab === 'guest'
                      ? 'bg-background text-foreground shadow'
                      : 'hover:text-foreground'
                  }`}
                >
                  دخول الزوار
                </button>
              )}
            </div>

            {tab === 'register' && isLocalOwnerDevice && (
              <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-primary/35 bg-primary/10 px-3.5 py-2.5 text-xs leading-relaxed text-primary">
                <Crown className="size-4 shrink-0 mt-0.5" />
                <span>
                  أي عضوية تنشئها من جهازك هذا تأخذ ترقية <strong>المالك</strong> تلقائياً حتى
                  تتمكن من تجربة لوحة التحكم وكافة الصلاحيات.
                </span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="auth-username" className="block text-xs font-medium text-muted-foreground">
                  {tab === 'guest' ? 'الاسم المستعار' : 'اسم العضوية'}
                </label>
                <input
                  ref={usernameInputRef}
                  id="auth-username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={tab === 'guest' ? 'مثال: نجم الخليج' : 'اكتب اسمك...'}
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {tab === 'register' && (
                <div className="space-y-1.5">
                  <label htmlFor="auth-topic" className="block text-xs font-medium text-muted-foreground">
                    الزخرفة (اختياري)
                  </label>
                  <input
                    id="auth-topic"
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="مثال: ✦ اسمك ✦"
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              )}

              {tab !== 'guest' && (
                <div className="space-y-1.5">
                  <label htmlFor="auth-password" className="block text-xs font-medium text-muted-foreground">
                    كلمة المرور
                  </label>
                  <div className="relative">
                    <input
                      id="auth-password"
                      type={showPass ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••"
                      className="flex h-10 w-full rounded-md border border-input bg-transparent pe-3 ps-10 py-1 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      aria-label={showPass ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                      className="absolute start-1.5 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-gradient-gold px-6 text-sm font-semibold text-primary-foreground shadow-gold transition hover:brightness-110 disabled:opacity-50 cursor-pointer"
              >
                {tab === 'register' ? <UserPlus className="size-4" /> : <LogIn className="size-4" />}
                {busy
                  ? 'جاري الدخول...'
                  : tab === 'register'
                  ? 'تسجيل ودخول'
                  : tab === 'guest'
                  ? 'دخول كزائر'
                  : 'دخول'}
              </button>

              {tab === 'member' && (
                <p className="text-center text-xs text-muted-foreground">
                  للدخول السريع بحساب المالك التجريبي: الاسم <code className="font-mono text-foreground">أحمد</code> / كلمة المرور <code className="font-mono text-foreground">123456</code>
                </p>
              )}
              {tab === 'guest' && (
                <p className="text-center text-xs text-muted-foreground">
                  حساب الزائر لا يملك صلاحية الدخول للوحة التحكم
                </p>
              )}
            </form>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center text-xs text-muted-foreground">
            <div className="rounded-xl border border-border bg-surface p-3">
              <Mic className="mx-auto mb-1.5 size-5 text-primary" />
              حلقات المايكات
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <DoorOpen className="mx-auto mb-1.5 size-5 text-primary" />
              رومات وعامة
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <Lock className="mx-auto mb-1.5 size-5 text-primary" />
              خاص وحائط
            </div>
          </div>
        </div>

        {/* Online List matching OnlineList.tsx */}
        <aside className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <h2 className="font-display text-lg">المتواجدين الآن</h2>
            <span className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground tabular-nums">
              <span className="size-2 rounded-full bg-success" />
              {onlineUsers.length} متصل
            </span>
          </div>
          <ul className="max-h-96 divide-y divide-border/60 overflow-y-auto scrollbar-thin">
            {onlineUsers.map((u) => {
              const rank = ranks.find((r) => r.id === u.rankId);
              return (
                <li
                  key={u.id}
                  className="group flex w-full items-center gap-3 px-3 py-2 transition hover:bg-accent/50"
                >
                  <UserAvatar user={u} size="sm" />
                  <div className="min-w-0 flex-1 text-start">
                    <UserDisplayName user={u} rank={rank} showRankLabel className="text-sm" />
                    <p className="truncate text-xs text-muted-foreground">
                      {u.status || 'متصل في الدردشة'}
                    </p>
                  </div>
                  <ChevronLeft className="size-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                </li>
              );
            })}
            {onlineUsers.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                لا يوجد أحد متصل الآن
              </li>
            )}
          </ul>
        </aside>
      </main>
    </div>
  );
}
