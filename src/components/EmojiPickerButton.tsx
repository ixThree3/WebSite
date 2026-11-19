import { useEffect, useRef, useState } from 'react';

interface EmojiCategory {
  id: string;
  label: string;
  emojis: string[];
}

const IPHONE_EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'faces',
    label: 'وجوه',
    emojis: [
      '😀', '😄', '😁', '😆', '🥹', '😂', '🤣', '😊',
      '😇', '🙂', '😉', '😌', '😍', '🥰', '😘', '😋',
      '😎', '🤩', '🥳', '😏', '😒', '😔', '🥺', '😭',
      '😤', '😡', '🤯', '😳', '🫣', '🤭', '🤫', '🤔',
      '🫡', '🤗', '😴', '🤧',
    ],
  },
  {
    id: 'hearts',
    label: 'قلوب',
    emojis: [
      '❤️', '🩷', '🧡', '💛', '💚', '🩵', '💙', '💜',
      '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❣️', '💕', '💞',
      '💓', '💗', '💖', '💘', '💝', '🫶', '🌹', '🥀',
    ],
  },
  {
    id: 'gulf',
    label: 'فخامة وخليجي',
    emojis: [
      '👑', '🔥', '✨', '🌟', '💫', '⚡', '💎', '🏆',
      '🥇', '☕', '🫖', '🌴', '🐪', '🦅', '🌙', '⛵',
      '🎤', '🎧', '🎶', '🎵', '🎙️', '🧿', '🕌', '🪷',
    ],
  },
  {
    id: 'gestures',
    label: 'تفاعل',
    emojis: [
      '👍', '👎', '👏', '🙌', '🤝', '🙏', '✌️', '🤞',
      '👌', '🤌', '💪', '🎉', '🎊', '🎈', '🎁', '💯',
      '✅', '❌', '⚠️', '🔔', '💬', '👀', '🫶', '🔥',
    ],
  },
];

export function EmojiPickerButton({
  onSelect,
  align = 'start',
}: {
  onSelect: (emoji: string) => void;
  align?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const [activeCat, setActiveCat] = useState<string>('faces');
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const current =
    IPHONE_EMOJI_CATEGORIES.find((c) => c.id === activeCat) ?? IPHONE_EMOJI_CATEGORIES[0]!;

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="إيموجيات آيفون"
        title="إيموجيات آيفون"
        data-action="emoji-picker"
        className={`flex size-10 shrink-0 items-center justify-center rounded-xl border text-lg leading-none transition ${
          open
            ? 'border-primary bg-primary/20 shadow-sm'
            : 'border-border bg-background/70 hover:border-primary/60'
        }`}
      >
        <span aria-hidden="true">😊</span>
      </button>

      {open && (
        <div
          className={`absolute bottom-12 z-50 w-72 sm:w-80 rounded-2xl border border-border bg-surface shadow-2xl p-2.5 space-y-2 ${
            align === 'end' ? 'end-0' : 'start-0'
          }`}
        >
          <div className="flex items-center justify-between gap-1 border-b border-border/70 pb-2">
            {IPHONE_EMOJI_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCat(cat.id)}
                className={`flex-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition whitespace-nowrap ${
                  activeCat === cat.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto scrollbar-thin">
            {current.emojis.map((em, idx) => (
              <button
                key={`${current.id}-${idx}-${em}`}
                type="button"
                onClick={() => onSelect(em)}
                className="flex aspect-square items-center justify-center rounded-lg text-xl hover:bg-surface-raised active:scale-90 transition"
              >
                {em}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
