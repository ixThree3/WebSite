import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  DoorOpen,
  Image as ImageIcon,
  LogIn,
  Reply,
  Send,
  Smile,
  Trash2,
  X,
} from 'lucide-react';
import { readImageFileAsDataUrl } from '../lib/imageUpload.ts';
import { useChat } from '../lib/useChatClient.tsx';
import { hasPermission } from '../shared/permissions.ts';
import type { ChatMessage } from '../shared/types.ts';
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
    notify,
  } = useChat();

  const [text, setText] = useState('');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [showSymbols, setShowSymbols] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; username: string; body: string } | null>(null);
  const [sending, setSending] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const messages: ChatMessage[] = activeRoom ? messagesByRoom[activeRoom.id] ?? [] : [];
  const canDeleteAnyMsg = hasPermission(myRank, 'delete_messages');

  async function handleImagePick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImageBusy(true);
    try {
      const dataUrl = await readImageFileAsDataUrl(file, 1024, 0.82);
      setPendingImage(dataUrl);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر تحميل الصورة من الجهاز', 'error');
    } finally {
      setImageBusy(false);
    }
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!activeRoom || (!text.trim() && !pendingImage)) return;
    setSending(true);
    try {
      await sendRoomMessage(activeRoom.id, text, {
        mediaUrl: pendingImage || undefined,
        replyTo,
      });
      setText('');
      setPendingImage(null);
      setReplyTo(null);
      setShowSymbols(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر إرسال الرسالة', 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-[1400px] p-2 sm:p-3 min-h-0">
      {/* Center Focus Stage: Mic Circle first, followed directly by Chat Stream */}
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
        {activeRoom ? (
          <>
            {/* Majlis Mic Circle — First Element at Top */}
            <MicCircleStage room={activeRoom} />

            {/* Chat Stream (Full badges: rank icon, verification, streak flame) */}
            <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-4 space-y-2.5 scrollbar-thin">
              {messages.map((m) => {
                if (m.isSystem) {
                  const isLogin = m.systemKind === 'login';
                  const isLeave = m.systemKind === 'room_leave';
                  return (
                    <div
                      key={m.id}
                      data-system-notice={m.systemKind || 'generic'}
                      className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/55 px-3 py-1.5 text-xs"
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5 leading-relaxed">
                        {isLogin ? (
                          <LogIn className="size-3.5 shrink-0 text-emerald-400" />
                        ) : (
                          <DoorOpen
                            className={`size-3.5 shrink-0 ${
                              isLeave ? 'text-amber-400' : 'text-primary'
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
                const canDel = m.userId === me?.id || canDeleteAnyMsg;
                return (
                  <div
                    key={m.id}
                    className="group flex items-start gap-2.5 rounded-xl px-2.5 py-2 hover:bg-surface-raised/60 transition"
                  >
                    <button
                      type="button"
                      onClick={() => openMemberProfile(m.userId)}
                      className="shrink-0 mt-0.5"
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
                          className="text-start hover:underline"
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
                        <div className="ms-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition">
                          {siteSettings.roomReplyEnabled && (
                            <button
                              type="button"
                              title="رد"
                              onClick={() => {
                                setReplyTo({ id: m.id, username: m.username, body: m.body });
                                inputRef.current?.focus();
                              }}
                              className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                            >
                              <Reply className="size-3.5" />
                            </button>
                          )}
                          {canDel && (
                            <button
                              type="button"
                              title="حذف الرسالة"
                              onClick={() => void deleteRoomMessage(activeRoom.id, m.id)}
                              className="rounded p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {m.replyTo && (
                        <div className="mt-1 rounded-lg border-s-2 border-primary/60 bg-background/50 px-2.5 py-1 text-xs text-muted-foreground">
                          <span className="font-semibold text-primary">{m.replyTo.username}: </span>
                          <span className="line-clamp-1">{m.replyTo.body}</span>
                        </div>
                      )}

                      {m.body.trim().length > 0 && (
                        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/95">
                          <RichMessageText text={m.body} />
                        </p>
                      )}

                      {m.mediaUrl && (
                        <img
                          src={m.mediaUrl}
                          alt="وسائط"
                          className="mt-2 max-h-56 rounded-xl border border-border object-contain bg-background"
                        />
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
              <div className="flex items-center justify-between border-t border-border bg-background/70 px-3.5 py-1.5 text-xs">
                <div className="truncate">
                  <span className="text-primary font-semibold">رد على {replyTo.username}: </span>
                  <span className="text-muted-foreground">{replyTo.body}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            {pendingImage && !siteSettings.hideRoomMedia && (
              <div
                data-testid="room-image-preview"
                className="flex items-center justify-between gap-3 border-t border-border bg-background/70 px-3.5 py-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={pendingImage}
                    alt="معاينة الصورة المرفوعة"
                    className="size-12 shrink-0 rounded-lg border border-border object-cover bg-surface"
                  />
                  <div className="min-w-0 text-xs">
                    <p className="font-semibold text-foreground">صورة جاهزة للإرسال</p>
                    <p className="text-[11px] text-muted-foreground">
                      يمكنك إضافة نص مع الصورة أو إرسالها مباشرة
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="إزالة الصورة المحددة"
                  onClick={() => setPendingImage(null)}
                  className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/15 px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/25 transition"
                >
                  <X className="size-3.5" />
                  إزالة
                </button>
              </div>
            )}

            {showSymbols && (
              <div className="border-t border-border bg-background/85 px-3 py-2.5 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {symbols.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setText((prev) => `${prev}${prev ? ' ' : ''}${s.glyph}`)}
                      title={s.label}
                      className="rounded-lg border border-border bg-surface px-2.5 py-1 text-sm hover:border-primary transition"
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
                        className="rounded bg-surface-raised px-2 py-0.5 text-primary border border-border hover:border-primary"
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
              className="flex items-center gap-1.5 sm:gap-2 border-t border-border bg-surface-raised/60 p-2.5"
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
                className={`flex size-10 shrink-0 items-center justify-center rounded-xl border border-border transition ${
                  showSymbols
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background/70 text-muted-foreground hover:text-foreground'
                }`}
              >
                <Smile className="size-4" />
              </button>

              {!siteSettings.hideRoomMedia && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    data-testid="room-image-upload-input"
                    onChange={(e) => void handleImagePick(e)}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={imageBusy}
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="رفع صورة من الجهاز"
                    title="رفع صورة من الجهاز"
                    className={`flex size-10 shrink-0 items-center justify-center rounded-xl border border-border transition disabled:opacity-50 ${
                      pendingImage
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background/70 text-muted-foreground hover:text-foreground'
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
                className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background/80 px-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
              />

              <button
                type="submit"
                disabled={sending || imageBusy || (!text.trim() && !pendingImage)}
                aria-label="إرسال"
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-gradient-gold px-4 text-sm font-bold text-primary-foreground transition hover:brightness-105 disabled:opacity-50"
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
