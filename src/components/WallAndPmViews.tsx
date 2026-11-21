import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  Heart,
  Image as ImageIcon,
  Lock,
  MessageSquare,
  Reply,
  Send,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { uploadChatMediaFile } from '../lib/imageUpload.ts';
import { useChat } from '../lib/useChatClient.tsx';
import { buildPmContactsList, countUnreadPmFromPartner } from '../shared/chatHistory.ts';
import {
  canDeleteOwnedItem,
  inferMediaKind,
  PM_LOCKED_ERROR_MESSAGE,
} from '../shared/presenceStatus.ts';
import type { MediaKind } from '../shared/types.ts';
import { EmojiPickerButton } from './EmojiPickerButton.tsx';
import { RichMessageText } from './RichMessageText.tsx';
import { ActivityStatusBadge, UserAvatar, UserDisplayName } from './UserBadges.tsx';
import { YouTubeMiniPlayer } from './YouTubeMiniPlayer.tsx';
export { MemberProfileModal } from './MemberProfileModal.tsx';

export function WallView() {
  const {
    me,
    myRank,
    ranks,
    activeRoom,
    onlineUsers,
    wallPosts,
    siteSettings,
    setViewMode,
    setActiveDrawer,
    createWallPost,
    toggleWallLike,
    commentWallPost,
    deleteWallComment,
    toggleWallCommentLike,
    deleteWallPost,
    openMemberProfile,
    openImageLightbox,
    notify,
  } = useChat();

  const [body, setBody] = useState('');
  const [postMedia, setPostMedia] = useState<{ url: string; mediaType: MediaKind } | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [replyTargetByPost, setReplyTargetByPost] = useState<
    Record<string, { id: string; username: string; body: string } | null>
  >({});
  const [busy, setBusy] = useState(false);
  const wallImageInputRef = useRef<HTMLInputElement | null>(null);
  const commentInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  async function handleWallImagePick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImageBusy(true);
    try {
      const uploaded = await uploadChatMediaFile(file);
      setPostMedia(uploaded);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر تحميل الملف من الجهاز', 'error');
    } finally {
      setImageBusy(false);
    }
  }

  async function handlePost(e: FormEvent) {
    e.preventDefault();
    if (!body.trim() && !postMedia) return;
    setBusy(true);
    try {
      await createWallPost(body, postMedia?.url ?? null, postMedia?.mediaType ?? null);
      setBody('');
      setPostMedia(null);
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
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface/95 px-4 py-2.5 shadow-sm">
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
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface-raised/70 px-3.5 py-2 text-xs font-medium text-foreground backdrop-blur hover:bg-accent cursor-pointer transition-colors"
        >
          <ArrowRight className="size-4" />
          <span>العودة إلى الروم</span>
        </button>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
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
            className="w-full rounded-md border border-input bg-transparent p-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />

          {postMedia && (
            <div
              data-testid="wall-image-preview"
              className="relative inline-block overflow-hidden rounded-lg border border-border bg-background"
            >
              {postMedia.mediaType === 'video' ? (
                <video
                  src={postMedia.url}
                  controls
                  playsInline
                  preload="metadata"
                  className="max-h-56 max-w-full bg-black"
                />
              ) : (
                <img
                  src={postMedia.url}
                  alt="معاينة المرفق"
                  className="max-h-52 max-w-full object-contain"
                />
              )}
              <button
                type="button"
                aria-label="إزالة المرفق"
                onClick={() => setPostMedia(null)}
                className="absolute end-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/75 text-white hover:bg-destructive transition cursor-pointer"
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
                accept="image/*,video/*"
                data-testid="wall-image-upload-input"
                onChange={(e) => void handleWallImagePick(e)}
                className="hidden"
              />
              <button
                type="button"
                disabled={imageBusy}
                onClick={() => wallImageInputRef.current?.click()}
                aria-label="رفع صورة أو فيديو في الحائط"
                title="رفع صورة أو فيديو (حتى 30MB)"
                className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium cursor-pointer transition-colors disabled:opacity-50 ${
                  postMedia
                    ? 'border-primary/40 bg-primary text-primary-foreground'
                    : 'border-border bg-surface-raised/70 text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <ImageIcon className="size-4" />
                <span className="hidden sm:inline">صورة / فيديو</span>
              </button>
            </div>
            <button
              type="submit"
              disabled={busy || imageBusy || (!body.trim() && !postMedia)}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-gradient-gold px-5 text-sm font-semibold text-primary-foreground shadow-gold hover:brightness-110 cursor-pointer transition disabled:opacity-50"
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
          const canDel = canDeleteOwnedItem({
            actorId: me?.id,
            ownerId: post.userId,
            actorRank: myRank,
            allowSiteOwner: true,
          });
          const liveAuthor = onlineUsers.find((u) => u.id === post.userId);
          const postMediaKind = post.mediaUrl
            ? inferMediaKind(post.mediaUrl, post.mediaType)
            : null;
          return (
            <article
              key={post.id}
              data-wall-post={post.id}
              className="rounded-xl border border-border bg-surface p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => openMemberProfile(post.userId)}
                  className="flex items-center gap-2.5 text-start cursor-pointer"
                >
                  <div className="relative shrink-0">
                    <UserAvatar
                      user={{
                        username: post.username,
                        color: post.color,
                        avatarUrl: post.avatarUrl,
                      }}
                      size="md"
                    />
                    <ActivityStatusBadge
                      status={liveAuthor?.activityStatus}
                      targetUserId={post.userId}
                      currentUserId={me?.id}
                      online={Boolean(liveAuthor?.online)}
                    />
                  </div>
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
                    data-action="wall-post-delete"
                    onClick={() => void deleteWallPost(post.id)}
                    aria-label="حذف المنشور"
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition cursor-pointer"
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

              {post.mediaUrl && postMediaKind === 'video' && (
                <video
                  src={post.mediaUrl}
                  controls
                  playsInline
                  preload="metadata"
                  data-testid="wall-post-video"
                  className="max-h-80 w-auto max-w-full rounded-lg border border-border bg-black"
                />
              )}

              {post.mediaUrl && postMediaKind === 'image' && (
                <button
                  type="button"
                  onClick={() => openImageLightbox(post.mediaUrl!, post.topic || post.username)}
                  aria-label="تكبير صورة المنشور"
                  className="block overflow-hidden rounded-lg border border-border bg-background cursor-zoom-in transition hover:brightness-105"
                >
                  <img
                    src={post.mediaUrl}
                    alt="صورة منشور الحائط"
                    className="max-h-80 w-auto max-w-full object-contain"
                  />
                </button>
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
                    const canDelComment = canDeleteOwnedItem({
                      actorId: me?.id,
                      ownerId: c.userId,
                      actorRank: myRank,
                      allowSiteOwner: true,
                    });
                    return (
                      <div
                        key={c.id}
                        data-wall-comment={c.id}
                        className="rounded-lg bg-background/50 px-3 py-2 text-xs space-y-1.5"
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
                                className="shrink-0 hover:underline cursor-pointer"
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
                                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition tabular-nums cursor-pointer ${
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
                                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground hover:text-primary transition cursor-pointer"
                              >
                                <Reply className="size-3" />
                                <span>رد</span>
                              </button>
                              {canDelComment && (
                                <button
                                  type="button"
                                  data-action="wall-comment-delete"
                                  data-comment-delete={c.id}
                                  aria-label="حذف التعليق"
                                  onClick={() => void deleteWallComment(post.id, c.id)}
                                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground hover:text-destructive transition cursor-pointer"
                                >
                                  <Trash2 className="size-3" />
                                  <span>حذف</span>
                                </button>
                              )}
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
                      className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                    <button
                      type="submit"
                      className="h-9 rounded-md bg-secondary px-3.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 cursor-pointer transition-colors"
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
    pmPeers,
    privateMessages,
    selectedPmUserId,
    setSelectedPmUserId,
    setViewMode,
    setActiveDrawer,
    openPrivateChatWith,
    openMemberProfile,
    openImageLightbox,
    sendPrivateMessage,
    deletePrivateMessage,
    siteSettings,
    notify,
  } = useChat();

  const [text, setText] = useState('');
  const [pendingMedia, setPendingMedia] = useState<{ url: string; mediaType: MediaKind } | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const pmScrollRef = useRef<HTMLDivElement | null>(null);
  const pmInputRef = useRef<HTMLInputElement | null>(null);
  const pmFileInputRef = useRef<HTMLInputElement | null>(null);

  const contacts = useMemo(
    () =>
      buildPmContactsList({
        meId: me?.id,
        onlineUsers,
        pmPeers,
        privateMessages,
      }),
    [me?.id, onlineUsers, pmPeers, privateMessages]
  );

  const activeContact = useMemo(() => {
    if (!selectedPmUserId) return null;
    return contacts.find((c) => c.id === selectedPmUserId) ?? null;
  }, [contacts, selectedPmUserId]);

  const thread = useMemo(() => {
    if (!me || !activeContact) return [];
    return privateMessages.filter(
      (pm) =>
        (pm.fromUserId === me.id && pm.toUserId === activeContact.id) ||
        (pm.fromUserId === activeContact.id && pm.toUserId === me.id)
    );
  }, [privateMessages, me, activeContact]);

  const scrollPmToBottom = () => {
    const el = pmScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  useEffect(() => {
    if (!activeContact) return;
    const raf = window.requestAnimationFrame(scrollPmToBottom);
    return () => window.cancelAnimationFrame(raf);
  }, [activeContact?.id, thread.length]);

  const handleReturnToRoom = () => {
    setActiveDrawer('none');
    setViewMode('rooms');
  };

  async function handlePmMediaPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMediaBusy(true);
    try {
      const uploaded = await uploadChatMediaFile(file);
      setPendingMedia(uploaded);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر تحميل الملف من الجهاز', 'error');
    } finally {
      setMediaBusy(false);
    }
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!activeContact || (!text.trim() && !pendingMedia)) return;
    if (activeContact.lockPm) {
      notify(PM_LOCKED_ERROR_MESSAGE, 'error');
      return;
    }
    const draft = text;
    const draftMedia = pendingMedia;
    setText('');
    setPendingMedia(null);
    try {
      await sendPrivateMessage(activeContact.id, draft, {
        mediaUrl: draftMedia?.url ?? null,
        mediaType: draftMedia?.mediaType ?? null,
      });
      window.requestAnimationFrame(scrollPmToBottom);
    } catch (err) {
      setText((prev) => prev || draft);
      if (draftMedia) setPendingMedia(draftMedia);
      notify(err instanceof Error ? err.message : 'تعذر الإرسال', 'error');
    }
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl p-3 min-h-0">
      {!activeContact ? (
        <section
          data-testid="pm-contacts-view"
          className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-panel"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-raised/60 px-4 py-3">
            <div className="min-w-0">
              <h2 className="font-display text-lg sm:text-xl leading-tight">المحادثات الخاصة</h2>
              <p className="text-[11px] text-muted-foreground">
                اختر عضواً لفتح المحادثة الخاصة بكامل المساحة
              </p>
            </div>
            <button
              type="button"
              data-action="return-to-room-pm"
              onClick={handleReturnToRoom}
              title={activeRoom ? `العودة إلى ${activeRoom.name}` : 'العودة إلى الروم'}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface-raised/70 px-3.5 py-2 text-xs font-medium text-foreground backdrop-blur hover:bg-accent cursor-pointer transition-colors"
            >
              <ArrowRight className="size-4" />
              <span>العودة إلى الروم</span>
            </button>
          </div>
          <ul className="flex-1 divide-y divide-border/60 overflow-y-auto scrollbar-thin">
            {contacts.map((c) => {
              const rank = ranks.find((r) => r.id === c.rankId);
              const unread = countUnreadPmFromPartner(privateMessages, me?.id, c.id);
              return (
                <li key={c.id} data-pm-contact={c.id}>
                  <button
                    type="button"
                    onClick={() => openPrivateChatWith(c.id)}
                    className="group flex w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-accent/50 cursor-pointer transition-colors"
                  >
                    <div className="relative shrink-0">
                      <UserAvatar user={c} size="sm" />
                      {c.online ? (
                        <ActivityStatusBadge
                          status={c.activityStatus}
                          targetUserId={c.id}
                          currentUserId={me?.id}
                          online={c.online}
                        />
                      ) : (
                        <span className="absolute -bottom-0.5 -end-0.5 size-2.5 rounded-full bg-muted-foreground/60 ring-2 ring-surface" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <UserDisplayName user={c} rank={rank} showRankLabel className="text-sm" />
                      <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                        {c.lockPm ? (
                          <>
                            <Lock className="size-3 shrink-0 text-warning" />
                            <span>قفل الرسائل الخاصة</span>
                          </>
                        ) : c.online ? (
                          c.status || 'متصل الآن'
                        ) : (
                          'غير متصل — المحادثة محفوظة'
                        )}
                      </p>
                    </div>
                    {unread > 0 && (
                      <span className="flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[11px] font-bold text-destructive-foreground tabular-nums">
                        {unread}
                      </span>
                    )}
                    <ChevronLeft className="size-4 shrink-0 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100" />
                  </button>
                </li>
              );
            })}
            {contacts.length === 0 && (
              <li className="flex h-48 items-center justify-center p-4 text-sm text-muted-foreground">
                لا يوجد أعضاء أو محادثات خاصة حالياً
              </li>
            )}
          </ul>
        </section>
      ) : (
        <section
          data-testid="pm-conversation-view"
          className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-panel"
        >
          <header className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border bg-surface-raised/60 px-3.5 py-2.5 sm:px-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <button
                type="button"
                data-action="back-to-pm-contacts"
                onClick={() => setSelectedPmUserId(null)}
                title="الرجوع إلى قائمة الخاص"
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-border bg-surface/80 px-2.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer transition-colors"
              >
                <Users className="size-3.5" />
                <span className="hidden sm:inline">قائمة الخاص</span>
              </button>

              <button
                type="button"
                onClick={() => openMemberProfile(activeContact.id)}
                className="flex min-w-0 items-center gap-2.5 text-start hover:opacity-90 cursor-pointer"
              >
                <div className="relative shrink-0">
                  <UserAvatar user={activeContact} size="sm" />
                  <ActivityStatusBadge
                    status={activeContact.activityStatus}
                    targetUserId={activeContact.id}
                    currentUserId={me?.id}
                    online={activeContact.online}
                  />
                </div>
                <div className="min-w-0">
                  <UserDisplayName
                    user={activeContact}
                    rank={ranks.find((r) => r.id === activeContact.rankId)}
                    className="text-sm"
                  />
                  <p className="truncate text-[11px] text-muted-foreground">
                    {activeContact.online ? 'رسائل خاصة مباشرة' : 'غير متصل — سجل المحادثة محفوظ'}
                  </p>
                </div>
              </button>
            </div>

            <button
              type="button"
              data-action="return-to-room-pm"
              onClick={handleReturnToRoom}
              title={activeRoom ? `العودة إلى ${activeRoom.name}` : 'العودة إلى الروم'}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface-raised/80 px-3 text-xs font-medium text-foreground hover:bg-accent cursor-pointer transition-colors"
            >
              <ArrowRight className="size-3.5" />
              <span>العودة إلى الروم</span>
            </button>
          </header>

          <div
            ref={pmScrollRef}
            data-testid="pm-chat-stream"
            className="flex-1 overflow-y-auto p-4 space-y-2.5 scrollbar-thin"
          >
            {thread.map((pm) => {
              const mine = pm.fromUserId === me?.id;
              const pmMediaKind = pm.mediaUrl
                ? inferMediaKind(pm.mediaUrl, pm.mediaType)
                : null;
              return (
                <div
                  key={pm.id}
                  data-pm-message={pm.id}
                  className={`flex flex-col max-w-[78%] rounded-xl px-3.5 py-2 text-sm ${
                    mine
                      ? 'ms-auto bg-bubble-self text-bubble-self-foreground'
                      : 'me-auto bg-surface-raised text-foreground border border-border'
                  }`}
                >
                  {pm.body.trim().length > 0 && (
                    <p className="whitespace-pre-wrap break-words">
                      <RichMessageText text={pm.body} tone="default" />
                    </p>
                  )}

                  {pm.mediaUrl && pmMediaKind === 'video' && (
                    <video
                      src={pm.mediaUrl}
                      controls
                      playsInline
                      preload="metadata"
                      data-testid="pm-message-video"
                      className="mt-1.5 max-h-60 w-auto max-w-full rounded-lg border border-border bg-black"
                    />
                  )}

                  {pm.mediaUrl && pmMediaKind === 'image' && (
                    <button
                      type="button"
                      onClick={() => openImageLightbox(pm.mediaUrl!, activeContact.username)}
                      aria-label="تكبير الصورة"
                      className="mt-1.5 block overflow-hidden rounded-lg border border-border bg-background cursor-zoom-in transition hover:brightness-105"
                    >
                      <img
                        src={pm.mediaUrl}
                        alt="وسائط خاصة"
                        className="max-h-56 w-auto max-w-full object-contain"
                      />
                    </button>
                  )}

                  <div className="mt-1 flex items-center justify-end gap-2 text-[10px] opacity-80 tabular-nums">
                    {mine && (
                      <button
                        type="button"
                        data-action="pm-delete"
                        aria-label="حذف الرسالة الخاصة"
                        title="حذف الرسالة"
                        onClick={() => void deletePrivateMessage(pm.id)}
                        className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-current/80 hover:bg-black/20 hover:text-destructive transition cursor-pointer"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                    <span>
                      {new Date(pm.createdAt).toLocaleTimeString('ar', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {mine && siteSettings.pmReadReceiptEnabled && pm.readAt ? ' ✓✓' : ''}
                    </span>
                  </div>
                </div>
              );
            })}
            {thread.length === 0 && (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                ابدأ محادثة خاصة مع {activeContact.username}
              </div>
            )}
          </div>

          {pendingMedia && (
            <div
              data-testid="pm-media-preview"
              className="flex items-center justify-between gap-3 border-t border-border bg-surface-raised/60 px-3.5 py-2"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {pendingMedia.mediaType === 'video' ? (
                  <video
                    src={pendingMedia.url}
                    muted
                    playsInline
                    className="size-11 shrink-0 rounded-md border border-border object-cover bg-black"
                  />
                ) : (
                  <img
                    src={pendingMedia.url}
                    alt="معاينة المرفق"
                    className="size-11 shrink-0 rounded-md border border-border object-cover bg-surface"
                  />
                )}
                <div className="min-w-0 text-xs">
                  <p className="font-semibold text-foreground">
                    {pendingMedia.mediaType === 'video'
                      ? 'فيديو جاهز للإرسال بالخاص'
                      : 'صورة جاهزة للإرسال بالخاص'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="إزالة المرفق"
                onClick={() => setPendingMedia(null)}
                className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/15 px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/25 transition cursor-pointer"
              >
                <X className="size-3.5" />
                إزالة
              </button>
            </div>
          )}

          {activeContact.lockPm && (
            <div
              data-testid="pm-locked-banner"
              className="flex items-center justify-center gap-2 border-t border-warning/40 bg-warning/10 px-3.5 py-2 text-xs font-medium text-warning"
            >
              <Lock className="size-3.5 shrink-0" />
              <span>{PM_LOCKED_ERROR_MESSAGE}</span>
            </div>
          )}

          <form
            onSubmit={handleSend}
            className="flex items-center gap-2 border-t border-border bg-surface-raised/50 p-3"
          >
            <EmojiPickerButton
              align="start"
              onSelect={(emoji) => {
                setText((prev) => `${prev}${emoji}`);
                pmInputRef.current?.focus();
              }}
            />
            <input
              ref={pmFileInputRef}
              type="file"
              accept="image/*,video/*"
              data-testid="pm-media-upload-input"
              onChange={(e) => void handlePmMediaPick(e)}
              className="hidden"
            />
            <button
              type="button"
              disabled={mediaBusy}
              onClick={() => pmFileInputRef.current?.click()}
              aria-label="رفع صورة أو فيديو في الخاص"
              title="رفع صورة أو فيديو (حتى 30MB)"
              className={`flex size-9 shrink-0 items-center justify-center rounded-md border transition disabled:opacity-50 cursor-pointer ${
                pendingMedia
                  ? 'border-primary bg-accent text-primary'
                  : 'border-border bg-surface-raised/70 text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <ImageIcon className="size-4" />
            </button>
            <input
              ref={pmInputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={siteSettings.pmMaxChars}
              placeholder={`رسالة إلى ${activeContact.username}...`}
              className="h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <button
              type="submit"
              disabled={mediaBusy || (!text.trim() && !pendingMedia)}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-gradient-gold px-4 text-sm font-semibold text-primary-foreground shadow-gold hover:brightness-110 cursor-pointer disabled:opacity-50"
            >
              <Send className="size-4 -scale-x-100" />
              إرسال
            </button>
          </form>
        </section>
      )}
    </div>
  );
}

