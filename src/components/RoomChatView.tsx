import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  DoorOpen,
  Image as ImageIcon,
  LogIn,
  Reply,
  Send,
  Smile,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { uploadChatMediaFile } from '../lib/imageUpload.ts';
import { useChat } from '../lib/useChatClient.tsx';
import { canDeleteOwnedItem, inferMediaKind } from '../shared/presenceStatus.ts';
import type { ChatMessage, MediaKind } from '../shared/types.ts';
import { MicCircleStage } from './MicCircleStage.tsx';
import { EmojiPickerButton } from './EmojiPickerButton.tsx';
import { RichMessageText } from './RichMessageText.tsx';
import { UserAvatar, UserDisplayName } from './UserBadges.tsx';

export function RoomChatView() {
  const {
    me,
    myRank,
    ranks,
    activeRoom,
    messagesByRoom,
    shortcuts,
    symbols,
    siteSettings,
    sendRoomMessage,
    deleteRoomMessage,
    openMemberProfile,
    openImageLightbox,
    notify,
  } = useChat();

  const [text, setText] = useState('');
  const [pendingMedia, setPendingMedia] = useState<{ url: string; mediaType: MediaKind } | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [showSymbols, setShowSymbols] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; username: string; body: string } | null>(null);
  const [sending, setSending] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const messages: ChatMessage[] = activeRoom ? messagesByRoom[activeRoom.id] ?? [] : [];

  const scrollToBottom = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    const raf = window.requestAnimationFrame(scrollToBottom);
    return () => window.cancelAnimationFrame(raf);
  }, [activeRoom?.id, messages.length]);

  async function handleImagePick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImageBusy(true);
    try {
      const uploaded = await uploadChatMediaFile(file);
      setPendingMedia(uploaded);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر تحميل الملف من الجهاز', 'error');
    } finally {
      setImageBusy(false);
    }
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!activeRoom || (!text.trim() && !pendingMedia)) return;
    const draftText = text;
    const draftMedia = pendingMedia;
    const draftReply = replyTo;
    setText('');
    setPendingMedia(null);
    setReplyTo(null);
    setShowSymbols(false);
    setSending(true);
    try {
      await sendRoomMessage(activeRoom.id, draftText, {
        mediaUrl: draftMedia?.url || undefined,
        mediaType: draftMedia?.mediaType || undefined,
        replyTo: draftReply,
      });
      window.requestAnimationFrame(scrollToBottom);
    } catch (err) {
      setText((prev) => prev || draftText);
      if (draftMedia) setPendingMedia(draftMedia);
      if (draftReply) setReplyTo(draftReply);
      notify(err instanceof Error ? err.message : 'تعذر إرسال الرسالة', 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl p-2 sm:p-4 min-h-0">
      {/* Center Focus Stage: Mic Circle first, followed directly by Chat Stream */}
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-panel">
        {activeRoom ? (
          <>
            {/* Majlis Mic Circle */}
            <MicCircleStage room={activeRoom} />

            {/* Chat Stream */}
            <div
              ref={messagesContainerRef}
              data-testid="room-chat-stream"
              className="flex-1 overflow-y-auto px-3 py-3 sm:px-4 space-y-2 scrollbar-thin"
            >
              {messages.map((m) => {
                if (m.isSystem) {
                  const isLogin = m.systemKind === 'login';
                  const isLeave = m.systemKind === 'room_leave';
                  return (
                    <div
                      key={m.id}
                      data-system-notice={m.systemKind || 'generic'}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-surface-raised/50 px-3 py-1.5 text-xs"
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5 leading-relaxed">
                        {isLogin ? (
                          <LogIn className="size-3.5 shrink-0 text-success" />
                        ) : (
                          <DoorOpen
                            className={`size-3.5 shrink-0 ${
                              isLeave ? 'text-warning' : 'text-primary'
                            }`}
                          />
                        )}
                        <button
                          type="button"
                          data-system-user={m.userId}
                          onClick={() => openMemberProfile(m.userId)}
                          className="inline-flex items-center gap-1.5 font-bold hover:underline cursor-pointer"
                          style={{ color: m.color || '#f5c451' }}
                        >
                          <UserAvatar
                            user={{
                              username: m.username,
                              color: m.color,
                              avatarUrl: m.avatarUrl,
                            }}
                            size="xs"
                          />
                          <span>{m.topic || m.username}</span>
                        </button>
                        <span className="text-muted-foreground">{m.body}</span>
                      </div>
                      <time className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                        {new Date(m.createdAt).toLocaleTimeString('ar', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>
                  );
                }

                const rank = ranks.find((r) => r.id === m.rankId);
                const canDel = canDeleteOwnedItem({
                  actorId: me?.id,
                  ownerId: m.userId,
                  actorRank: myRank,
                  allowSiteOwner: true,
                });
                const mediaKind = m.mediaUrl ? inferMediaKind(m.mediaUrl, m.mediaType) : null;
                return (
                  <div
                    key={m.id}
                    data-room-message={m.id}
                    className="group flex items-start gap-2.5 rounded-lg px-2.5 py-2 hover:bg-accent/40 transition"
                  >
                    <button
                      type="button"
                      onClick={() => openMemberProfile(m.userId)}
                      className="shrink-0 mt-0.5 cursor-pointer"
                    >
                      <UserAvatar
                        user={{
                          username: m.username,
                          color: m.color,
                          avatarUrl: m.avatarUrl,
                        }}
                        size="sm"
                      />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openMemberProfile(m.userId)}
                          className="text-start hover:underline cursor-pointer"
                        >
                          <UserDisplayName
                            user={{
                              username: m.username,
                              topic: m.topic,
                              color: m.color,
                              nameStyle: m.nameStyle,
                              fontFamily: m.fontFamily,
                              verified: m.verified,
                              streak: m.streak,
                              streakLastDay: m.streakLastDay,
                            }}
                            rank={rank}
                            className="text-sm"
                          />
                        </button>
                        <time className="text-[11px] text-muted-foreground tabular-nums">
                          {new Date(m.createdAt).toLocaleTimeString('ar', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </time>
                        <div className="ms-auto flex shrink-0 items-center gap-1">
                          {siteSettings.roomReplyEnabled && (
                            <button
                              type="button"
                              data-action="room-reply"
                              aria-label="رد"
                              title="رد"
                              onClick={() => {
                                setReplyTo({ id: m.id, username: m.username, body: m.body });
                                inputRef.current?.focus();
                              }}
                              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
                            >
                              <Reply className="size-3.5" />
                            </button>
                          )}
                          {canDel && (
                            <button
                              type="button"
                              data-action="room-delete"
                              aria-label="حذف الرسالة"
                              title="حذف الرسالة"
                              onClick={() => void deleteRoomMessage(activeRoom.id, m.id)}
                              className="rounded-md p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive cursor-pointer"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {m.replyTo && (
                        <div className="mt-1 rounded-md border-s-2 border-primary/60 bg-background/50 px-2.5 py-1 text-xs text-muted-foreground">
                          <span className="font-semibold text-primary">{m.replyTo.username}: </span>
                          <span className="line-clamp-1">{m.replyTo.body}</span>
                        </div>
                      )}

                      {m.body.trim().length > 0 && (
                        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                          <RichMessageText text={m.body} />
                        </p>
                      )}

                      {m.mediaUrl && mediaKind === 'video' && (
                        <video
                          src={m.mediaUrl}
                          controls
                          playsInline
                          preload="metadata"
                          data-testid="room-message-video"
                          className="mt-2 max-h-64 w-auto max-w-full rounded-lg border border-border bg-black"
                        />
                      )}

                      {m.mediaUrl && mediaKind === 'image' && (
                        <button
                          type="button"
                          onClick={() => openImageLightbox(m.mediaUrl!, m.topic || m.username)}
                          aria-label="تكبير الصورة"
                          className="mt-2 block overflow-hidden rounded-lg border border-border bg-background cursor-zoom-in transition hover:brightness-105"
                        >
                          <img
                            src={m.mediaUrl}
                            alt="وسائط"
                            className="max-h-56 w-auto max-w-full object-contain"
                          />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 && (
                <div className="flex h-40 flex-col items-center justify-center text-sm text-muted-foreground">
                  لا توجد رسائل بعد في هذه الغرفة — ابدأ المحادثة الآن!
                </div>
              )}
            </div>

            {/* Reply / Media / Symbols Popovers */}
            {replyTo && (
              <div className="flex items-center justify-between border-t border-border bg-surface-raised/60 px-3.5 py-1.5 text-xs">
                <div className="truncate">
                  <span className="text-primary font-semibold">رد على {replyTo.username}: </span>
                  <span className="text-muted-foreground">{replyTo.body}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            {pendingMedia && !siteSettings.hideRoomMedia && (
              <div
                data-testid="room-image-preview"
                className="flex items-center justify-between gap-3 border-t border-border bg-surface-raised/60 px-3.5 py-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {pendingMedia.mediaType === 'video' ? (
                    <video
                      src={pendingMedia.url}
                      muted
                      playsInline
                      className="size-12 shrink-0 rounded-md border border-border object-cover bg-black"
                    />
                  ) : (
                    <img
                      src={pendingMedia.url}
                      alt="معاينة الملف المرفوع"
                      className="size-12 shrink-0 rounded-md border border-border object-cover bg-surface"
                    />
                  )}
                  <div className="min-w-0 text-xs">
                    <p className="flex items-center gap-1 font-semibold text-foreground">
                      {pendingMedia.mediaType === 'video' && <Video className="size-3.5 text-primary" />}
                      <span>
                        {pendingMedia.mediaType === 'video'
                          ? 'فيديو جاهز للإرسال'
                          : 'صورة جاهزة للإرسال'}
                      </span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      يمكنك إضافة نص مع المرفق أو إرساله مباشرة
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="إزالة الملف المحدد"
                  onClick={() => setPendingMedia(null)}
                  className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/15 px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/25 transition cursor-pointer"
                >
                  <X className="size-3.5" />
                  إزالة
                </button>
              </div>
            )}

            {showSymbols && (
              <div className="border-t border-border bg-popover px-3 py-2.5 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {symbols.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setText((prev) => `${prev}${prev ? ' ' : ''}${s.glyph}`)}
                      title={s.label}
                      className="rounded-md border border-border bg-surface px-2.5 py-1 text-sm hover:border-primary hover:bg-accent transition cursor-pointer"
                    >
                      {s.glyph}
                    </button>
                  ))}
                </div>
                {shortcuts.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/50 text-[11px] text-muted-foreground">
                    <span>اختصارات سريعة:</span>
                    {shortcuts.map((sc) => (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => setText((prev) => `${prev}${prev ? ' ' : ''}${sc.trigger}`)}
                        className="rounded-md bg-surface-raised px-2 py-0.5 text-primary border border-border hover:border-primary cursor-pointer"
                      >
                        {sc.trigger}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Composer */}
            <form
              onSubmit={handleSend}
              className="flex items-center gap-1.5 sm:gap-2 border-t border-border bg-surface-raised/50 p-2.5"
            >
              <EmojiPickerButton
                align="start"
                onSelect={(emoji) => {
                  setText((prev) => `${prev}${emoji}`);
                  inputRef.current?.focus();
                }}
              />

              <button
                type="button"
                onClick={() => setShowSymbols((v) => !v)}
                aria-label="الرموز والاختصارات"
                title="الزخارف والاختصارات"
                className={`flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-md border transition cursor-pointer ${
                  showSymbols
                    ? 'border-primary bg-accent text-primary'
                    : 'border-border bg-surface-raised/70 text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <Smile className="size-4" />
              </button>

              {!siteSettings.hideRoomMedia && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    data-testid="room-image-upload-input"
                    onChange={(e) => void handleImagePick(e)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={imageBusy}
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="رفع صورة أو فيديو من الجهاز"
                    title="رفع صورة أو فيديو (حتى 30MB)"
                    className={`flex size-9 sm:size-10 shrink-0 items-center justify-center rounded-md border transition disabled:opacity-50 cursor-pointer ${
                      pendingMedia
                        ? 'border-primary bg-accent text-primary'
                        : 'border-border bg-surface-raised/70 text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    <ImageIcon className="size-4" />
                  </button>
                </>
              )}

              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={siteSettings.roomMaxChars}
                placeholder={
                  me?.silencedUntil && me.silencedUntil > Date.now()
                    ? 'أنت مسكت حالياً...'
                    : `اكتب رسالتك في ${activeRoom.name}...`
                }
                disabled={Boolean(
                  me?.silencedUntil && me.silencedUntil > Date.now() && !myRank?.isOwner
                )}
                className="h-9 sm:h-10 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
              />

              <button
                type="submit"
                disabled={sending || imageBusy || (!text.trim() && !pendingMedia)}
                aria-label="إرسال"
                className="inline-flex h-9 sm:h-10 shrink-0 items-center gap-1.5 rounded-md bg-gradient-gold px-4 text-sm font-semibold text-primary-foreground shadow-gold transition hover:brightness-110 disabled:opacity-50 cursor-pointer"
              >
                <Send className="size-4 -scale-x-100" />
                <span className="hidden sm:inline">إرسال</span>
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            اختر غرفة للدخول
          </div>
        )}
      </section>
    </div>
  );
}
