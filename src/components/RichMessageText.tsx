import { Fragment } from 'react';
import { ExternalLink } from 'lucide-react';
import { useChat } from '../lib/useChatClient.tsx';
import { tokenizeRichText } from '../shared/richText.ts';

export function RichMessageText({
  text,
  tone = 'default',
  className = '',
}: {
  text: string;
  tone?: 'default' | 'on-primary';
  className?: string;
}) {
  const { openExternalLink } = useChat();
  const tokens = tokenizeRichText(text);

  if (!text) return null;

  return (
    <span className={className}>
      {tokens.map((tok, idx) => {
        if (tok.type === 'link' && tok.href) {
          const href = tok.href;
          return (
            <button
              key={`${idx}-${href}`}
              type="button"
              dir="ltr"
              data-external-link={href}
              onClick={(e) => {
                e.stopPropagation();
                openExternalLink(href);
              }}
              className={`inline-flex max-w-full items-center gap-1 break-all rounded px-1 py-0.5 text-start font-medium underline underline-offset-2 transition cursor-pointer align-baseline ${
                tone === 'on-primary'
                  ? 'bg-black/10 text-slate-950 decoration-slate-950/60 hover:bg-black/20'
                  : 'bg-sky-500/10 text-sky-400 decoration-sky-400/50 hover:bg-sky-500/20 hover:text-sky-300'
              }`}
            >
              <ExternalLink className="size-3 shrink-0" />
              <span>{tok.value}</span>
            </button>
          );
        }
        return <Fragment key={idx}>{tok.value}</Fragment>;
      })}
    </span>
  );
}
