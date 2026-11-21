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
        className={`flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-md border text-lg leading-none transition cursor-pointer ${
          open
            ? 'border-primary bg-accent text-primary'
            : 'border-border bg-surface-raised/70 hover:bg-accent'
        }`}
      >
        <span aria-hidden="true">😊</span>
      </button>

      {open && (
        <div
          className={`absolute bottom-11 z-50 w-72 sm:w-80 rounded-md border border-border bg-popover p-2 text-popover-foreground shadow-md space-y-2 animate-in fade-in zoom-in-95 ${
            align === 'end' ? 'end-0' : 'start-0'
          }`}
        >
          <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1 text-muted-foreground">
            {IPHONE_EMOJI_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCat(cat.id)}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition whitespace-nowrap cursor-pointer ${
                  activeCat === cat.id
                    ? 'bg-background text-foreground shadow'
                    : 'hover:text-foreground'
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
                className="flex aspect-square items-center justify-center rounded-sm text-xl hover:bg-accent active:scale-90 transition cursor-pointer"
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
