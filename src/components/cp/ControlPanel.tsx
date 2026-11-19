import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Ban,
  Crown,
  DoorOpen,
  FileText,
  Filter,
  Globe,
  History,
  Layout,
  MailCheck,
  RefreshCw,
  Settings,
  Shield,
  ShieldAlert,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import { useChat } from '../../lib/useChatClient.tsx';
import { hasPermission } from '../../shared/permissions.ts';
import type { CpPayload, CpTabId, PermissionKey } from '../../shared/types.ts';
import { BansTab, PowersTab, RoomsTab } from './CpBansPowersRooms.tsx';
import {
  DomainsTab,
  FilterTab,
  FrontTab,
  MessagesTab,
  ShortcutsTab,
  SiteSettingsTab,
  SubsTab,
  SymbolsTab,
} from './CpContentAndSettings.tsx';
import { LogsTableTab, StatesTab, UsersTab } from './CpLogsAndUsers.tsx';

interface CpMenuItem {
  id: CpTabId;
  label: string;
  icon: typeof FileText;
  perm?: PermissionKey;
}

const CP_MENU: CpMenuItem[] = [
  { id: 'logs', label: 'السجل', icon: FileText, perm: 'view_logs' },
  { id: 'states', label: 'الحالات', icon: History, perm: 'view_states' },
  { id: 'banned_logs', label: 'المحظورون', icon: ShieldAlert, perm: 'view_logs' },
  { id: 'users', label: 'الأعضاء', icon: Users, perm: 'manage_members' },
  { id: 'bans', label: 'الحظر', icon: Ban, perm: 'ban_users' },
  { id: 'powers', label: 'الصلاحيات', icon: Shield, perm: 'manage_ranks' },
  { id: 'rooms', label: 'الغرف', icon: DoorOpen, perm: 'manage_rooms' },
  { id: 'shortcuts', label: 'الإختصارات', icon: Zap, perm: 'manage_shortcuts' },
  { id: 'subs', label: 'الإشتراكات', icon: Crown, perm: 'manage_subs' },
  { id: 'messages', label: 'الرسائل', icon: MailCheck, perm: 'manage_messages' },
  { id: 'front', label: 'الواجهة', icon: Layout, perm: 'manage_front' },
  { id: 'symbols', label: 'الرموز', icon: Sparkles, perm: 'manage_symbols' },
  { id: 'domains', label: 'النطاقات', icon: Globe, perm: 'manage_domains' },
  { id: 'settings', label: 'ادارة الموقع', icon: Settings, perm: 'manage_site_settings' },
  { id: 'filter', label: 'فلتر الكلمات', icon: Filter, perm: 'manage_filter' },
];

export function ControlPanel() {
  const {
    myRank,
    canAccessCp,
    cpVersion,
    fetchCpState,
    setViewMode,
    notify,
    refreshBootstrap,
  } = useChat();

  const [activeTab, setActiveTab] = useState<CpTabId>('logs');
  const [data, setData] = useState<CpPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchCpState();
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل لوحة التحكم');
    } finally {
      setLoading(false);
    }
  }, [fetchCpState]);

  useEffect(() => {
    if (canAccessCp) {
      void loadData();
    } else {
      setLoading(false);
    }
  }, [canAccessCp, cpVersion, loadData]);

  // Strict RBAC Gate: Only Owner, Supervisors, and Admins/Upgraded may view
  if (!canAccessCp) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/15 text-destructive">
          <ShieldAlert className="size-8" />
        </span>
        <h2 className="font-display text-2xl">لوحة التحكم مقيدة</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          الوصول إلى لوحة التحكم مقتصر فقط على المالك والمشرفين والأدمنية أصحاب الترقية.
        </p>
        <button
          type="button"
          onClick={() => setViewMode('rooms')}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-gold px-5 py-2.5 text-sm font-bold text-primary-foreground"
        >
          <ArrowRight className="size-4" /> العودة للرومات والدردشة
        </button>
      </div>
    );
  }

  const allowedMenu = CP_MENU.filter(
    (item) => !item.perm || hasPermission(myRank, item.perm)
  );
  const currentTab =
    allowedMenu.find((m) => m.id === activeTab) ?? allowedMenu[0] ?? CP_MENU[0]!;

  return (
    <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col md:flex-row min-h-0">
      {/* Tathkar Modernized Control Panel Sidebar */}
      <aside className="shrink-0 border-b border-border bg-surface md:w-60 md:border-b-0 md:border-e flex flex-col">
        <div className="hidden md:flex items-center justify-between border-b border-border px-4 py-3.5">
          <div>
            <h1 className="font-display text-xl text-primary">لوحة التحكم</h1>
            <p className="text-[11px] text-muted-foreground">{myRank?.name ?? 'إدارة الموقع'}</p>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            title="تحديث البيانات"
            className="rounded-lg border border-border bg-surface-raised p-2 text-muted-foreground hover:text-primary transition"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <nav className="flex gap-1 overflow-x-auto p-2 scrollbar-thin md:flex-1 md:flex-col md:overflow-y-auto">
          {allowedMenu.map((item) => {
            const active = currentTab.id === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium transition whitespace-nowrap ${
                  active
                    ? 'bg-primary text-primary-foreground font-semibold'
                    : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground'
                }`}
              >
                <Icon className="size-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background/50">
        {/* Top Bar Contract: Breadcrumb + Back to Chat Action */}
        <div className="flex items-center justify-between border-b border-border bg-surface/60 px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>لوحة التحكم</span>
            <span>/</span>
            <span className="font-semibold text-foreground">{currentTab.label}</span>
          </div>
          <button
            type="button"
            onClick={() => setViewMode('rooms')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium hover:border-primary transition whitespace-nowrap shrink-0"
          >
            <ArrowRight className="size-3.5" /> العودة للدردشة
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin">
          {error && (
            <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/15 px-4 py-3 text-xs text-destructive">
              {error}
            </div>
          )}

          {loading && !data ? (
            <div className="space-y-3">
              <div className="h-10 w-60 rounded-xl bg-surface animate-pulse" />
              <div className="h-64 w-full rounded-xl bg-surface animate-pulse" />
            </div>
          ) : data ? (
            <>
              {currentTab.id === 'logs' && (
                <LogsTableTab title="السجل العام للدخول" entries={data.logs} onNotify={notify} />
              )}
              {currentTab.id === 'states' && <StatesTab states={data.states} />}
              {currentTab.id === 'banned_logs' && (
                <LogsTableTab
                  title="سجل المحاولات المحظورة"
                  entries={data.bannedLogs}
                  onNotify={notify}
                />
              )}
              {currentTab.id === 'users' && (
                <UsersTab
                  users={data.users}
                  ranks={data.ranks}
                  onReload={() => {
                    void loadData();
                    void refreshBootstrap();
                  }}
                  onNotify={notify}
                />
              )}
              {currentTab.id === 'bans' && (
                <BansTab
                  bans={data.bans}
                  securityAllow={data.securityAllow}
                  onReload={() => void loadData()}
                  onNotify={notify}
                />
              )}
              {currentTab.id === 'powers' && (
                <PowersTab
                  ranks={data.ranks}
                  onReload={() => {
                    void loadData();
                    void refreshBootstrap();
                  }}
                  onNotify={notify}
                />
              )}
              {currentTab.id === 'rooms' && (
                <RoomsTab
                  rooms={data.rooms}
                  onReload={() => {
                    void loadData();
                    void refreshBootstrap();
                  }}
                  onNotify={notify}
                />
              )}
              {currentTab.id === 'shortcuts' && (
                <ShortcutsTab
                  shortcuts={data.shortcuts}
                  onReload={() => {
                    void loadData();
                    void refreshBootstrap();
                  }}
                  onNotify={notify}
                />
              )}
              {currentTab.id === 'subs' && (
                <SubsTab
                  users={data.users}
                  ranks={data.ranks}
                  onReload={() => {
                    void loadData();
                    void refreshBootstrap();
                  }}
                  onNotify={notify}
                />
              )}
              {currentTab.id === 'messages' && (
                <MessagesTab
                  autoMessages={data.autoMessages}
                  onReload={() => void loadData()}
                  onNotify={notify}
                />
              )}
              {currentTab.id === 'front' && (
                <FrontTab
                  front={data.front}
                  onReload={() => {
                    void loadData();
                    void refreshBootstrap();
                  }}
                  onNotify={notify}
                />
              )}
              {currentTab.id === 'symbols' && (
                <SymbolsTab
                  symbols={data.symbols}
                  onReload={() => {
                    void loadData();
                    void refreshBootstrap();
                  }}
                  onNotify={notify}
                />
              )}
              {currentTab.id === 'domains' && (
                <DomainsTab
                  domains={data.domains}
                  onReload={() => void loadData()}
                  onNotify={notify}
                />
              )}
              {currentTab.id === 'settings' && (
                <SiteSettingsTab
                  settings={data.siteSettings}
                  onReload={() => {
                    void loadData();
                    void refreshBootstrap();
                  }}
                  onNotify={notify}
                />
              )}
              {currentTab.id === 'filter' && (
                <FilterTab
                  filters={data.filters}
                  blockedHits={data.blockedHits}
                  onReload={() => void loadData()}
                  onNotify={notify}
                />
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
