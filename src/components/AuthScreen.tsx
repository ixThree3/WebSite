import { useRef, useState, type FormEvent } from 'react';
import {
  ArrowDown,
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
import { UserAvatar, UserDisplayName } from './UserBadges.tsx';

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
              <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-border bg-surface/80 px-3.5 py-1.5 text-xs font-medium text-secondary-foreground backdrop-blur">
                <Users className="size-3.5 text-success" />
                <span className="tabular-nums">متصل الآن {onlineUsers.length}</span>
              </div>
            )}
            <h1 className="font-display text-4xl sm:text-6xl font-bold text-primary drop-shadow">
              {front.siteName}
            </h1>
            <p className="mt-3 max-w-xl text-sm sm:text-base text-foreground/90">
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
              className="rounded-2xl border border-primary/45 bg-gradient-panel p-4 sm:p-5 shadow-xl space-y-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-bold text-primary">
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
                      className="rounded-xl border border-border bg-background/80 p-3 space-y-2.5"
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
                          className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition shrink-0"
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
                        className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 text-xs sm:text-sm font-bold text-primary-foreground hover:brightness-105 disabled:opacity-60 transition"
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
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface/80 px-4 text-xs font-semibold text-foreground hover:border-primary/60 hover:bg-surface-raised transition"
              >
                <ArrowDown className="size-3.5 text-primary" />
                <span>استعمال حساب آخر</span>
              </button>
            </section>
          )}

          <div
            ref={authFormRef}
            className="rounded-2xl border border-border bg-gradient-panel p-5 sm:p-6 shadow-2xl"
          >
            <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-background/70 p-1 border border-border/70">
              {regAllowed && (
                <button
                  type="button"
                  onClick={() => setTab('register')}
                  className={`rounded-lg py-2 text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
                    tab === 'register'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  تسجيل عضوية
                </button>
              )}
              <button
                type="button"
                onClick={() => setTab('member')}
                className={`rounded-lg py-2 text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
                  tab === 'member'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                دخول الأعضاء
              </button>
              {guestsAllowed && (
                <button
                  type="button"
                  onClick={() => setTab('guest')}
                  className={`rounded-lg py-2 text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
                    tab === 'guest'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  دخول الزوار
                </button>
              )}
            </div>

            {tab === 'register' && isLocalOwnerDevice && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-primary/35 bg-primary/10 px-3.5 py-2.5 text-xs leading-relaxed text-primary">
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
                  className="h-11 w-full rounded-xl border border-border bg-background/80 px-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
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
                    className="h-11 w-full rounded-xl border border-border bg-background/80 px-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
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
                      className="h-11 w-full rounded-xl border border-border bg-background/80 pe-3.5 ps-11 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      aria-label={showPass ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                      className="absolute start-1.5 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground"
                    >
                      {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold text-sm font-bold text-primary-foreground transition hover:brightness-105 disabled:opacity-60"
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

        <aside className="rounded-2xl border border-border bg-surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-display text-lg">المتواجدين الآن</h2>
            <span className="text-xs font-semibold text-primary tabular-nums">
              {onlineUsers.length} متصل
            </span>
          </div>
          <ul className="max-h-96 divide-y divide-border/60 overflow-y-auto scrollbar-thin">
            {onlineUsers.map((u) => {
              const rank = ranks.find((r) => r.id === u.rankId);
              return (
                <li key={u.id} className="flex items-center gap-3 px-4 py-2.5">
                  <UserAvatar user={u} size="sm" />
                  <div className="min-w-0 flex-1">
                    <UserDisplayName user={u} rank={rank} showRankLabel className="text-sm" />
                    <p className="truncate text-xs text-muted-foreground">
                      {u.status || 'متصل في الدردشة'}
                    </p>
                  </div>
                </li>
              );
            })}
            {onlineUsers.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                لا يوجد متواجدون حالياً
              </li>
            )}
          </ul>
        </aside>
      </main>
    </div>
  );
}
