import { useEffect } from 'react';
import { ExternalLink, ShieldAlert, X } from 'lucide-react';
import { useChat } from '../lib/useChatClient.tsx';
import { normalizeSafeHttpUrl } from '../shared/richText.ts';

export function ExternalLinkWarningModal() {
  const { pendingExternalUrl, closeExternalLink } = useChat();

  useEffect(() => {
    if (!pendingExternalUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeExternalLink();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingExternalUrl, closeExternalLink]);

  if (!pendingExternalUrl) return null;

  const parsed = normalizeSafeHttpUrl(pendingExternalUrl);
  const safeHref = parsed?.href ?? pendingExternalUrl;
  const host = parsed?.displayHost ?? pendingExternalUrl;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="external-link-warning-title"
      data-testid="external-link-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeExternalLink();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-surface p-5 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <ShieldAlert className="size-5" />
            </span>
            <div>
              <h3 id="external-link-warning-title" className="font-display text-lg text-foreground">
                تنبيه أمان — مغادرة الموقع
              </h3>
              <p className="text-[11px] text-amber-300/90">
                أنت على وشك الانتقال إلى رابط خارجي
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeExternalLink}
            aria-label="إغلاق التنبيه"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-raised hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          هذا الرابط خارج شات الخليج ولا يتبع لإدارة الموقع. يرجى التأكد من موثوقية الموقع قبل المتابعة، ولا تشارك كلمة مرورك أو بياناتك الشخصية في مواقع غير موثوقة.
        </p>

        <div className="rounded-xl border border-border bg-background/70 p-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-muted-foreground">النطاق المستهدف:</span>
            <span
              dir="ltr"
              className="rounded-md bg-amber-500/15 px-2 py-0.5 font-mono-tabular font-semibold text-amber-300"
            >
              {host}
            </span>
          </div>
          <p
            dir="ltr"
            className="break-all rounded-lg bg-surface px-2.5 py-2 font-mono-tabular text-[11px] text-sky-300 border border-border/60"
          >
            {safeHref}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            data-action="cancel-external-link"
            onClick={closeExternalLink}
            className="rounded-xl border border-border bg-surface-raised px-4 py-2 text-xs font-semibold text-foreground hover:bg-accent transition"
          >
            رفض وإلغاء
          </button>
          <a
            href={safeHref}
            target="_blank"
            rel="noopener noreferrer"
            data-action="confirm-external-link"
            onClick={closeExternalLink}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-gold px-4 py-2 text-xs font-bold text-primary-foreground transition hover:brightness-105"
          >
            <ExternalLink className="size-3.5" />
            <span>موافق وفتح الرابط</span>
          </a>
        </div>
      </div>
    </div>
  );
}
