import { ExternalLink, Play } from 'lucide-react';
import { useChat } from '../lib/useChatClient.tsx';
import { extractYouTubeVideosFromText } from '../shared/richText.ts';

export function YouTubeMiniPlayer({ text }: { text: string }) {
  const { openExternalLink } = useChat();
  const videos = extractYouTubeVideosFromText(text, 2);

  if (videos.length === 0) return null;

  return (
    <div className="space-y-2.5 pt-1">
      {videos.map((v) => (
        <div
          key={v.videoId}
          data-testid="youtube-mini-player"
          className="w-full max-w-sm overflow-hidden rounded-xl border border-border bg-background/85 shadow-sm"
        >
          <div className="aspect-video w-full bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${v.videoId}?rel=0`}
              title="مشغل يوتيوب مصغر"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
              data-youtube-embed={v.videoId}
              className="h-full w-full border-0"
            />
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-surface-raised/60 px-3 py-1.5 text-[11px]">
            <span className="inline-flex items-center gap-1.5 font-semibold text-rose-400">
              <Play className="size-3 fill-current" />
              فيديو يوتيوب مصغر
            </span>
            <button
              type="button"
              onClick={() => openExternalLink(v.url)}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition"
            >
              <span>فتح في يوتيوب</span>
              <ExternalLink className="size-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
