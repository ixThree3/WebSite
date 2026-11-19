import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ArrowRight,
  Heart,
  Image as ImageIcon,
  MessageSquare,
  Reply,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { readImageFileAsDataUrl } from '../lib/imageUpload.ts';
import { useChat } from '../lib/useChatClient.tsx';
import { hasPermission } from '../shared/permissions.ts';
import { EmojiPickerButton } from './EmojiPickerButton.tsx';
import { RichMessageText } from './RichMessageText.tsx';
import { UserAvatar, UserDisplayName } from './UserBadges.tsx';
import { YouTubeMiniPlayer } from './YouTubeMiniPlayer.tsx';
export { MemberProfileModal } from './MemberProfileModal.tsx';

export function WallView() {
  const {
    me,
    myRank,
    ranks,
    activeRoom,
    wallPosts,
    siteSettings,
    setViewMode,
    setActiveDrawer,
    createWallPost,
    toggleWallLike,
    commentWallPost,
    toggleWallCommentLike,
    deleteWallPost,
    openMemberProfile,
    notify,
  } = useChat();

  const [body, setBody] = useState('');
  const [postImage, setPostImage] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [replyTargetByPost, setReplyTargetByPost] = useState<
    Record<string, { id: string; username: string; body: string } | null>
  >({});
  const [busy, setBusy] = useState(false);
  const wallImageInputRef = useRef<HTMLInputElement | null>(null);
  const commentInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const canDeleteAny = hasPermission(myRank, 'delete_messages');

  async function handleWallImagePick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImageBusy(true);
    try {
      const dataUrl = await readImageFileAsDataUrl(file, 1024, 0.82);
      setPostImage(dataUrl);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر تحميل الصورة من الجهاز', 'error');
    } finally {
      setImageBusy(false);
    }
  }

  async function handlePost(e: FormEvent) {
    e.preventDefault();
    if (!body.trim() && !postImage) return;
    setBusy(true);
    try {
      await createWallPost(body, postImage);
      setBody('');
      setPostImage(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر النشر', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleComment(postId: string, e: FormEvent) {
    e.preventDefault();
    const txt = (commentText[postId] ?? '').trim();
    if (!txt) return;
    const replyTo = replyTargetByPost[postId] ?? null;
    try {
      await commentWallPost(postId, txt, replyTo);
      setCommentText((prev) => ({ ...prev, [postId]: '' }));
      setReplyTargetByPost((prev) => ({ ...prev, [postId]: null }));
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر إضافة التعليق', 'error');
    }
  }

  async function handleToggleCommentLike(postId: string, commentId: string) {
    try {
      await toggleWallCommentLike(postId, commentId);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر الإعجاب بالتعليق', 'error');
    }
  }

  return (
    <div className="mx-auto h-full w-full max-w-3xl overflow-y-auto px-3 py-4 sm:px-4 space-y-4 scrollbar-thin">
      {/* Sticky Return-to-Room Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-surface/95 px-4 py-2.5 shadow-sm">
        <div className="min-w-0">
          <h1 className="font-display text-xl sm:text-2xl leading-tight">الحائط العام</h1>
          {activeRoom && (
            <p className="truncate text-[11px] text-muted-foreground">
              أنت ما زلت متواجداً في غرفة:{' '}
              <span className="font-semibold text-primary">{activeRoom.name}</span>
            </p>
          )}
        </div>
        <button
          type="button"
          data-action="return-to-room"
          onClick={() => {
            setActiveDrawer('none');
            setViewMode('rooms');
          }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/15 px-3.5 py-2 text-xs font-bold text-primary hover:bg-primary/25 transition"
        >
          <ArrowRight className="size-4" />
          <span>العودة إلى الروم</span>
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">منشور جديد</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            الحد الأقصى: {siteSettings.wallMaxChars} حرف
          </span>
        </div>
        <form onSubmit={handlePost} className="space-y-3">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={siteSettings.wallMaxChars}
            rows={3}
            placeholder="شارك خاطرة، صورة، أو رابط يوتيوب على حائط شات الخليج..."
            className="w-full rounded-xl border border-border bg-background/80 p-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
          />

          {postImage && (
            <div
              data-testid="wall-image-preview"
              className="relative inline-block overflow-hidden rounded-xl border border-border bg-background"
            >
              <img
                src={postImage}
                alt="معاينة صورة المنشور"
                className="max-h-52 max-w-full object-contain"
              />
              <button
                type="button"
                aria-label="إزالة صورة المنشور"
                onClick={() => setPostImage(null)}
                className="absolute end-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/75 text-white hover:bg-destructive transition"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <EmojiPickerButton
                align="start"
                onSelect={(emoji) => setBody((prev) => `${prev}${emoji}`)}
              />
              <input
                ref={wallImageInputRef}
                type="file"
                accept="image/*"
                data-testid="wall-image-upload-input"
                onChange={(e) => void handleWallImagePick(e)}
                className="hidden"
              />
              <button
                type="button"
                disabled={imageBusy}
                onClick={() => wallImageInputRef.current?.click()}
                aria-label="رفع صورة في الحائط"
                title="رفع صورة من الجهاز"
                className={`inline-flex h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-medium transition disabled:opacity-50 ${
                  postImage
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background/70 text-muted-foreground hover:text-foreground'
                }`}
              >
                <ImageIcon className="size-4" />
                <span className="hidden sm:inline">رفع صورة</span>
              </button>
            </div>
            <button
              type="submit"
              disabled={busy || imageBusy || (!body.trim() && !postImage)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-gold px-5 py-2 text-sm font-bold text-primary-foreground transition hover:brightness-105 disabled:opacity-50"
            >
              <Send className="size-4 -scale-x-100" />
              نشر في الحائط
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        {wallPosts.map((post) => {
          const rank = ranks.find((r) => r.id === post.rankId);
          const likedByMe = me ? post.likes.includes(me.id) : false;
          const canDel = post.userId === me?.id || canDeleteAny;
          return (
            <article
              key={post.id}
              className="rounded-2xl border border-border bg-surface p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => openMemberProfile(post.userId)}
                  className="flex items-center gap-2.5 text-start"
                >
                  <UserAvatar
                    user={{
                      username: post.username,
                      color: post.color,
                      avatarUrl: post.avatarUrl,
                    }}
                    size="md"
                  />
                  <div>
                    <UserDisplayName
                      user={{
                        username: post.username,
                        topic: post.topic,
                        color: post.color,
                        nameStyle: post.nameStyle,
                        fontFamily: post.fontFamily,
                        streak: post.streak,
                        streakLastDay: post.streakLastDay,
                      }}
                      rank={rank}
                      showRankLabel
                      className="text-sm"
                    />
                    <time className="block text-[11px] text-muted-foreground">
                      {new Date(post.createdAt).toLocaleString('ar')}
                    </time>
                  </div>
                </button>

                {canDel && (
                  <button
                    type="button"
                    onClick={() => void deleteWallPost(post.id)}
                    aria-label="حذف المنشور"
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>

              {post.body.trim().length > 0 && (
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                  <RichMessageText text={post.body} />
                </p>
              )}

              {post.body.trim().length > 0 && <YouTubeMiniPlayer text={post.body} />}

              {post.mediaUrl && (
                <img
                  src={post.mediaUrl}
                  alt="صورة منشور الحائط"
                  className="max-h-80 w-auto max-w-full rounded-xl border border-border bg-background object-contain"
                />
              )}

              <div className="flex items-center gap-4 border-t border-border/70 pt-2.5 text-xs">
                <button
                  type="button"
                  onClick={() => void toggleWallLike(post.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition tabular-nums ${
                    likedByMe
                      ? 'bg-rose-500/15 text-rose-400 font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Heart className={`size-4 ${likedByMe ? 'fill-current' : ''}`} />
                  {post.likes.length} إعجاب
                </button>
                <span className="inline-flex items-center gap-1.5 text-muted-foreground tabular-nums">
                  <MessageSquare className="size-4" />
                  {post.comments.length} تعليق
                </span>
              </div>

              {siteSettings.wallCommentsEnabled && (
                <div className="space-y-2 border-t border-border/50 pt-2.5">
                  {post.comments.map((c) => {
                    const commentLikes = c.likes ?? [];
                    const commentLikedByMe = me ? commentLikes.includes(me.id) : false;
                    return (
                      <div
                        key={c.id}
                        data-wall-comment={c.id}
                        className="rounded-xl bg-background/50 px-3 py-2 text-xs space-y-1.5"
                      >
                        {c.replyTo && (
                          <div className="rounded-lg border-s-2 border-primary/60 bg-surface/70 px-2 py-1 text-[11px] text-muted-foreground">
                            <span className="font-semibold text-primary">
                              رد على {c.replyTo.username}:{' '}
                            </span>
                            <span className="line-clamp-1">{c.replyTo.body}</span>
                          </div>
                        )}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openMemberProfile(c.userId)}
                                className="shrink-0 hover:underline"
                              >
                                <UserDisplayName
                                  user={{
                                    username: c.username,
                                    color: c.color,
                                    nameStyle: c.nameStyle,
                                    fontFamily: c.fontFamily,
                                    streak: c.streak,
                                    streakLastDay: c.streakLastDay,
                                  }}
                                  className="text-xs"
                                />
                              </button>
                              <span className="break-words text-foreground/90">
                                <RichMessageText text={c.body} />
                              </span>
                            </div>

                            <div className="flex items-center gap-3 pt-0.5 text-[11px]">
                              <button
                                type="button"
                                data-comment-like={c.id}
                                onClick={() => void handleToggleCommentLike(post.id, c.id)}
                                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition tabular-nums ${
                                  commentLikedByMe
                                    ? 'bg-rose-500/15 text-rose-400 font-semibold'
                                    : 'text-muted-foreground hover:text-rose-400'
                                }`}
                              >
                                <Heart
                                  className={`size-3 ${commentLikedByMe ? 'fill-current' : ''}`}
                                />
                                <span>{commentLikes.length}</span>
                                <span>إعجاب</span>
                              </button>
                              <button
                                type="button"
                                data-comment-reply={c.id}
                                onClick={() => {
                                  setReplyTargetByPost((prev) => ({
                                    ...prev,
                                    [post.id]: {
                                      id: c.id,
                                      username: c.username,
                                      body: c.body,
                                    },
                                  }));
                                  commentInputRefs.current[post.id]?.focus();
                                }}
                                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground hover:text-primary transition"
                              >
                                <Reply className="size-3" />
                                <span>رد</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {replyTargetByPost[post.id] && (
                    <div
                      data-testid={`wall-reply-banner-${post.id}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-primary/35 bg-primary/10 px-2.5 py-1.5 text-[11px]"
                    >
                      <div className="truncate">
                        <span className="font-semibold text-primary">
                          رد على تعليق {replyTargetByPost[post.id]!.username}:{' '}
                        </span>
                        <span className="text-muted-foreground">
                          {replyTargetByPost[post.id]!.body}
                        </span>
                      </div>
                      <button
                        type="button"
                        aria-label="إلغاء الرد"
                        onClick={() =>
                          setReplyTargetByPost((prev) => ({ ...prev, [post.id]: null }))
                        }
                        className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  )}

                  <form onSubmit={(e) => void handleComment(post.id, e)} className="flex gap-2">
                    <EmojiPickerButton
                      align="start"
                      onSelect={(emoji) =>
                        setCommentText((prev) => ({
                          ...prev,
                          [post.id]: `${prev[post.id] ?? ''}${emoji}`,
                        }))
                      }
                    />
                    <input
                      ref={(el) => {
                        commentInputRefs.current[post.id] = el;
                      }}
                      type="text"
                      value={commentText[post.id] ?? ''}
                      onChange={(e) =>
                        setCommentText((prev) => ({ ...prev, [post.id]: e.target.value }))
                      }
                      placeholder={
                        replyTargetByPost[post.id]
                          ? `اكتب ردك على ${replyTargetByPost[post.id]!.username}...`
                          : 'أضف تعليقاً...'
                      }
                      className="h-10 flex-1 rounded-xl border border-border bg-background/70 px-3 text-xs focus:border-primary focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="rounded-xl bg-secondary px-3.5 text-xs font-semibold text-secondary-foreground hover:bg-accent transition"
                    >
                      {replyTargetByPost[post.id] ? 'إرسال الرد' : 'تعليق'}
                    </button>
                  </form>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function PrivateChatView() {
  const {
    me,
    ranks,
    activeRoom,
    onlineUsers,
    privateMessages,
    selectedPmUserId,
    setViewMode,
    setActiveDrawer,
    openPrivateChatWith,
    openMemberProfile,
    sendPrivateMessage,
    siteSettings,
    notify,
  } = useChat();

  const [text, setText] = useState('');

  const contacts = useMemo(() => {
    return onlineUsers.filter((u) => u.id !== me?.id);
  }, [onlineUsers, me]);

  const activeContact =
    contacts.find((c) => c.id === selectedPmUserId) ?? contacts[0] ?? null;

  const thread = useMemo(() => {
    if (!me || !activeContact) return [];
    return privateMessages.filter(
      (pm) =>
        (pm.fromUserId === me.id && pm.toUserId === activeContact.id) ||
        (pm.fromUserId === activeContact.id && pm.toUserId === me.id)
    );
  }, [privateMessages, me, activeContact]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!activeContact || !text.trim()) return;
    try {
      await sendPrivateMessage(activeContact.id, text);
      setText('');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر الإرسال', 'error');
    }
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl gap-3 p-3 min-h-0">
      <aside className="w-64 shrink-0 overflow-hidden rounded-2xl border border-border bg-surface flex flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
          <span className="font-display text-base sm:text-lg">المحادثات الخاصة</span>
          <button
            type="button"
            data-action="return-to-room-pm"
            onClick={() => {
              setActiveDrawer('none');
              setViewMode('rooms');
            }}
            title={activeRoom ? `العودة إلى ${activeRoom.name}` : 'العودة إلى الروم'}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-primary/40 bg-primary/15 px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary/25 transition"
          >
            <ArrowRight className="size-3.5" />
            <span>الروم</span>
          </button>
        </div>
        <ul className="flex-1 divide-y divide-border/50 overflow-y-auto scrollbar-thin">
          {contacts.map((c) => {
            const rank = ranks.find((r) => r.id === c.rankId);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => openPrivateChatWith(c.id)}
                  className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-start hover:bg-accent/50 transition ${
                    activeContact?.id === c.id ? 'bg-accent/70' : ''
                  }`}
                >
                  <UserAvatar user={c} size="sm" />
                  <div className="min-w-0 flex-1">
                    <UserDisplayName user={c} rank={rank} className="text-xs" />
                  </div>
                </button>
              </li>
            );
          })}
          {contacts.length === 0 && (
            <li className="p-4 text-xs text-muted-foreground">لا يوجد أعضاء متصلون حالياً</li>
          )}
        </ul>
      </aside>

      <section className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-surface">
        {activeContact ? (
          <>
            <header className="flex items-center justify-between gap-3 border-b border-border bg-surface-raised/60 px-4 py-3">
              <button
                type="button"
                onClick={() => openMemberProfile(activeContact.id)}
                className="flex items-center gap-3 text-start hover:opacity-90"
              >
                <UserAvatar user={activeContact} size="sm" />
                <div>
                  <UserDisplayName
                    user={activeContact}
                    rank={ranks.find((r) => r.id === activeContact.rankId)}
                    className="text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">رسائل خاصة مباشرة</p>
                </div>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 scrollbar-thin">
              {thread.map((pm) => {
                const mine = pm.fromUserId === me?.id;
                return (
                  <div
                    key={pm.id}
                    className={`flex flex-col max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${
                      mine
                        ? 'ms-auto bg-primary text-primary-foreground'
                        : 'me-auto bg-surface-raised text-foreground border border-border'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">
                      <RichMessageText
                        text={pm.body}
                        tone={mine ? 'on-primary' : 'default'}
                      />
                    </p>
                    <span className="mt-1 text-[10px] opacity-75 self-end tabular-nums">
                      {new Date(pm.createdAt).toLocaleTimeString('ar', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {mine && siteSettings.pmReadReceiptEnabled && pm.readAt ? ' ✓✓' : ''}
                    </span>
                  </div>
                );
              })}
              {thread.length === 0 && (
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  ابدأ محادثة خاصة مع {activeContact.username}
                </div>
              )}
            </div>

            <form
              onSubmit={handleSend}
              className="flex items-center gap-2 border-t border-border bg-surface-raised/50 p-3"
            >
              <EmojiPickerButton
                align="start"
                onSelect={(emoji) => setText((prev) => `${prev}${emoji}`)}
              />
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={siteSettings.pmMaxChars}
                placeholder={`رسالة إلى ${activeContact.username}...`}
                className="h-10 flex-1 rounded-xl border border-border bg-background px-3.5 text-sm focus:border-primary focus:outline-none"
              />
              <button
                type="submit"
                disabled={!text.trim()}
                className="flex h-10 items-center gap-1.5 rounded-xl bg-gradient-gold px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                <Send className="size-4 -scale-x-100" />
                إرسال
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            اختر عضواً لبدء الدردشة الخاصة
          </div>
        )}
      </section>
    </div>
  );
}

