import { useEffect, useState } from 'react';
import { BellOff, Check, Lock, MailX, Minus, Moon, Shield, X } from 'lucide-react';
import { useChat } from '../lib/useChatClient.tsx';
import type { ActivityStatus } from '../shared/types.ts';

const STATUS_OPTIONS: Array<{
  value: ActivityStatus;
  label: string;
  description: string;
}> = [
  {
    value: 'online',
    label: 'متصل',
    description: 'الظهور كمتصل ونشط للآخرين',
  },
  {
    value: 'idle',
    label: 'خامل',
    description: 'الظهور بحالة خمول مؤقت',
  },
  {
    value: 'busy',
    label: 'مشغول',
    description: 'الظهور كمشغول حالياً',
  },
];

export function PrivacySettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { me, updatePrivacySettings, notify } = useChat();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !me) return null;

  const activeStatus: ActivityStatus =
    me.manualActivityStatus ?? me.activityStatus ?? 'online';

  async function handleStatusChange(nextStatus: ActivityStatus) {
    if (busyKey) return;
    setBusyKey(`status:${nextStatus}`);
    try {
      await updatePrivacySettings({ activityStatus: nextStatus });
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر تحديث حالة الاتصال', 'error');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleToggleLockPm() {
    if (!me || busyKey) return;
    setBusyKey('lockPm');
    try {
      await updatePrivacySettings({ lockPm: !me.lockPm });
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر تحديث إعداد الخاص', 'error');
    } finally {
      setBusyKey(null);
    }
  }

  async function handleToggleLockAlerts() {
    if (!me || busyKey) return;
    setBusyKey('lockAlerts');
    try {
      await updatePrivacySettings({ lockAlerts: !me.lockAlerts });
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر تحديث إعداد التنبيهات', 'error');
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div
      data-testid="privacy-settings-modal"
      role="dialog"
      aria-modal="true"
      aria-label="إعدادات الخصوصية"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 animate-in fade-in"
    >
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-gradient-panel shadow-panel">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Shield className="size-4" />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold leading-snug text-foreground">
                إعدادات الخصوصية
              </h2>
              <p className="text-[11px] text-muted-foreground">
                تحكم في حالة نشاطك واستقبال الخاص والتنبيهات
              </p>
            </div>
          </div>
          <button
            type="button"
            data-action="close-privacy-settings"
            aria-label="إغلاق إعدادات الخصوصية"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-5 p-5 text-start">
          {/* Manual Activity Status */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-foreground">
                حالة الاتصال والنشاط
              </h3>
              <span className="text-[11px] text-muted-foreground">
                تظهر للآخرين بجانب اسمك
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="حالة الاتصال">
              {STATUS_OPTIONS.map((opt) => {
                const selected = activeStatus === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    data-privacy-status={opt.value}
                    disabled={Boolean(busyKey)}
                    onClick={() => void handleStatusChange(opt.value)}
                    title={opt.description}
                    className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border px-2.5 py-3 text-center transition cursor-pointer disabled:opacity-60 ${
                      selected
                        ? 'border-primary bg-primary/15 text-foreground shadow-sm'
                        : 'border-border bg-surface-raised/60 text-muted-foreground hover:border-primary/40 hover:bg-accent/50 hover:text-foreground'
                    }`}
                  >
                    <span className="relative flex size-6 items-center justify-center rounded-full bg-background/80 border border-border/80">
                      {opt.value === 'online' && (
                        <span className="size-3 rounded-full bg-emerald-500" />
                      )}
                      {opt.value === 'idle' && (
                        <span className="flex size-3.5 items-center justify-center rounded-full bg-amber-500 text-slate-950">
                          <Moon className="size-2 fill-current" />
                        </span>
                      )}
                      {opt.value === 'busy' && (
                        <span className="flex size-3.5 items-center justify-center rounded-full bg-rose-500 text-white">
                          <Minus className="size-2.5 stroke-[3]" />
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-semibold">
                      {opt.label}
                      {selected && <Check className="size-3 text-primary" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Privacy Locks */}
          <section className="space-y-2.5">
            <h3 className="text-xs font-semibold text-foreground">
              أذونات التواصل
            </h3>

            {/* Lock Private Messages */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-raised/50 px-3.5 py-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-background/80 text-primary">
                  {me.lockPm ? <Lock className="size-4" /> : <MailX className="size-4 text-muted-foreground" />}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground">
                    قفل الرسائل الخاصة
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    منع الأعضاء الآخرين من فتح الخاص أو إرسال رسائل خاصة لك
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(me.lockPm)}
                aria-label="قفل الرسائل الخاصة"
                data-testid="toggle-lock-pm"
                disabled={Boolean(busyKey)}
                onClick={() => void handleToggleLockPm()}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition cursor-pointer disabled:opacity-60 ${
                  me.lockPm
                    ? 'border-primary bg-primary'
                    : 'border-border bg-background/80'
                }`}
              >
                <span
                  className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${
                    me.lockPm ? '-translate-x-5' : '-translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Lock Alerts */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-raised/50 px-3.5 py-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-background/80 text-primary">
                  <BellOff className={`size-4 ${me.lockAlerts ? 'text-primary' : 'text-muted-foreground'}`} />
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground">
                    قفل التنبيهات
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    منع الأعضاء الآخرين من إرسال رسائل التنبيه أو الردود لك
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(me.lockAlerts)}
                aria-label="قفل التنبيهات"
                data-testid="toggle-lock-alerts"
                disabled={Boolean(busyKey)}
                onClick={() => void handleToggleLockAlerts()}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition cursor-pointer disabled:opacity-60 ${
                  me.lockAlerts
                    ? 'border-primary bg-primary'
                    : 'border-border bg-background/80'
                }`}
              >
                <span
                  className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${
                    me.lockAlerts ? '-translate-x-5' : '-translate-x-1'
                  }`}
                />
              </button>
            </div>
          </section>
        </div>

        <div className="flex items-center justify-end border-t border-border bg-surface/60 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 items-center justify-center rounded-md bg-gradient-gold px-4 text-xs font-semibold text-primary-foreground shadow-gold hover:brightness-110 transition cursor-pointer"
          >
            تم
          </button>
        </div>
      </div>
    </div>
  );
}
