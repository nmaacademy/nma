import React from "react";
import {
  Search,
  MessageSquare,
  Plus,
  X,
  ChevronLeft,
  AlertTriangle,
  Lock,
  Pin,
  Trash2,
  Send,
} from "lucide-react";
import {
  communityService,
  CommunityPostListItem,
  CommunityPost,
  CommunityReply,
} from "../../services/communityService";
import { ApiError } from "../../lib/apiClient";
import { useAuth } from "../../context/AuthContext";
import { cn } from "../../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type SortOption = "latest_activity" | "newest" | "most_replies" | "pinned_first";

interface CommunityProps {
  slug: string;
  courseTitle: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("ro-RO", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

function formatRelativeDate(iso: string | null): string {
  if (!iso) return "";
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    const hrs  = Math.floor(diff / 3_600_000);
    const days = Math.floor(diff / 86_400_000);
    if (mins < 2)  return "acum";
    if (mins < 60) return `acum ${mins} min`;
    if (hrs  < 24) return `acum ${hrs}h`;
    if (days < 7)  return `acum ${days} ${days === 1 ? "zi" : "zile"}`;
    return formatDate(iso);
  } catch {
    return "";
  }
}

function isOwned(authorUserId: number, currentUserId?: string): boolean {
  return !!currentUserId && String(authorUserId) === currentUserId;
}

function postToListItem(post: CommunityPost): CommunityPostListItem {
  const excerpt = post.body.length > 200 ? post.body.slice(0, 200) + "…" : post.body;
  return {
    id:            post.id,
    title:         post.title,
    body_excerpt:  excerpt,
    author:        post.author,
    replies_count: post.replies_count,
    is_pinned:     post.is_pinned,
    is_locked:     post.is_locked,
    last_reply_at: post.last_reply_at,
    created_at:    post.created_at,
  };
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ initials, size = "md" }: { initials: string; size?: "sm" | "md" }) {
  return (
    <div
      aria-hidden
      className={cn(
        "rounded-full bg-gradient-to-br from-nma-purple/40 to-nma-purple/20",
        "border border-nma-purple/30 flex items-center justify-center",
        "shrink-0 font-bold text-nma-purple-light select-none",
        size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm",
      )}
    >
      {initials || "?"}
    </div>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function PostCardSkeleton() {
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-white/10 shrink-0" />
        <div className="flex-1 space-y-2 pt-0.5">
          <div className="h-4 bg-white/10 rounded w-3/4" />
          <div className="h-3 bg-white/5 rounded w-full" />
          <div className="h-3 bg-white/5 rounded w-4/5" />
          <div className="h-2.5 bg-white/5 rounded w-1/3 mt-1" />
        </div>
      </div>
    </div>
  );
}

function ReplySkeleton() {
  return (
    <div className="flex items-start gap-3 py-4 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-white/10 shrink-0" />
      <div className="flex-1 space-y-2 pt-0.5">
        <div className="h-3 bg-white/10 rounded w-32" />
        <div className="h-3 bg-white/5 rounded w-full" />
        <div className="h-3 bg-white/5 rounded w-3/4" />
      </div>
    </div>
  );
}

// ─── Sort options ─────────────────────────────────────────────────────────────

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "latest_activity", label: "Activitate recentă" },
  { value: "newest",          label: "Cele mai noi" },
  { value: "most_replies",    label: "Multe răspunsuri" },
  { value: "pinned_first",    label: "Fixate" },
];

// ─── Create post form ─────────────────────────────────────────────────────────

function CreatePostForm({
  slug,
  onSuccess,
  onCancel,
}: {
  slug: string;
  onSuccess: (post: CommunityPostListItem) => void;
  onCancel: () => void;
}) {
  const [title,    setTitle]    = React.useState("");
  const [body,     setBody]     = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [errors,   setErrors]   = React.useState<Record<string, string[]>>({});
  const [genError, setGenError] = React.useState<string | null>(null);

  const titleLen   = title.length;
  const bodyLen    = body.length;
  const canSubmit  = title.trim().length >= 3 && body.trim().length >= 10 && !creating;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setCreating(true);
    setErrors({});
    setGenError(null);
    try {
      const res = await communityService.createCommunityPost(slug, {
        title: title.trim(),
        body:  body.trim(),
      });
      onSuccess(postToListItem(res.data.post));
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) {
          setErrors(err.data?.errors ?? {});
          if (!err.data?.errors) setGenError(err.data?.message ?? "Date invalide.");
        } else if (err.status === 429) {
          setGenError("Ai trimis prea multe mesaje. Încearcă din nou mai târziu.");
        } else if (err.status === 403) {
          setGenError("Nu ai permisiunea de a crea postări.");
        } else {
          setGenError("Eroare de rețea. Încearcă din nou.");
        }
      } else {
        setGenError("Eroare neașteptată. Încearcă din nou.");
      }
    } finally {
      setCreating(false);
    }
  };

  const fieldClass = "w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-nma-purple/50 focus:ring-1 focus:ring-nma-purple/20 transition-colors resize-none disabled:opacity-50";

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Postare nouă</h3>
        <button
          type="button"
          onClick={onCancel}
          disabled={creating}
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-white/5 transition-colors disabled:opacity-40"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* General error */}
      {genError && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {genError}
        </div>
      )}

      {/* Title */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-gray-500 font-medium">Titlu</label>
          <span className={cn("text-xs tabular-nums", titleLen > 140 ? "text-red-400" : "text-gray-600")}>
            {titleLen}/140
          </span>
        </div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={160}
          placeholder="Titlul postării tale…"
          disabled={creating}
          autoFocus
          className={cn(fieldClass, errors.title && "border-red-400/50")}
        />
        {errors.title && (
          <p className="text-xs text-red-400 mt-1">{errors.title[0]}</p>
        )}
      </div>

      {/* Body */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-gray-500 font-medium">Mesaj</label>
          <span className={cn("text-xs tabular-nums", bodyLen > 5000 ? "text-red-400" : "text-gray-600")}>
            {bodyLen}/5000
          </span>
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={5200}
          rows={6}
          placeholder="Scrie mesajul tău… (text simplu, fără imagini)"
          disabled={creating}
          className={cn(fieldClass, errors.body && "border-red-400/50")}
        />
        {errors.body && (
          <p className="text-xs text-red-400 mt-1">{errors.body[0]}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={creating}
          className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-40"
        >
          Anulează
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="px-4 py-2 text-sm font-semibold rounded-xl bg-nma-purple/20 border border-nma-purple/40 text-nma-purple-light hover:bg-nma-purple/30 transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          {creating ? "Se publică…" : "Publică postarea"}
        </button>
      </div>
    </form>
  );
}

// ─── Post card ────────────────────────────────────────────────────────────────

function PostCard({
  post,
  currentUserId,
  onOpen,
  onDeleteConfirmed,
}: {
  post: CommunityPostListItem;
  currentUserId?: string;
  onOpen: () => void;
  onDeleteConfirmed: (id: number) => Promise<void>;
}) {
  const [confirm,  setConfirm]  = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const owned = isOwned(post.author.user_id, currentUserId);

  const handleConfirm = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(true);
    try {
      await onDeleteConfirmed(post.id);
    } catch {
      setDeleting(false);
      setConfirm(false);
    }
  };

  return (
    <div
      onClick={onOpen}
      className="bg-white/[0.03] border border-white/5 hover:border-white/10 rounded-2xl p-4 transition-all cursor-pointer group"
    >
      <div className="flex items-start gap-3">
        <Avatar initials={post.author.initials} />

        <div className="flex-1 min-w-0">
          {/* Badges */}
          {(post.is_pinned || post.is_locked) && (
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {post.is_pinned && (
                <span className="inline-flex items-center gap-1 text-[0.6rem] font-bold uppercase tracking-wider text-nma-purple-light bg-nma-purple/10 border border-nma-purple/20 rounded px-1.5 py-0.5">
                  <Pin className="w-2.5 h-2.5" /> Fixat
                </span>
              )}
              {post.is_locked && (
                <span className="inline-flex items-center gap-1 text-[0.6rem] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded px-1.5 py-0.5">
                  <Lock className="w-2.5 h-2.5" /> Blocat
                </span>
              )}
            </div>
          )}

          {/* Title */}
          <h3 className="text-sm font-semibold text-white group-hover:text-nma-purple-light transition-colors line-clamp-2 leading-snug">
            {post.title}
          </h3>

          {/* Excerpt */}
          <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
            {post.body_excerpt}
          </p>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-2.5 text-[0.65rem] text-gray-600">
            <span className="text-gray-500 font-medium">{post.author.name}</span>
            <span>·</span>
            <span>{formatRelativeDate(post.created_at)}</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {post.replies_count}
            </span>
          </div>
        </div>

        {/* Delete — visible on hover for own posts */}
        {owned && (
          <div
            className="shrink-0 flex flex-col items-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            {confirm ? (
              <>
                <button
                  onClick={handleConfirm}
                  disabled={deleting}
                  className="text-[0.65rem] text-red-400 hover:text-red-300 font-medium transition-colors whitespace-nowrap disabled:opacity-50"
                >
                  {deleting ? "Se șterge…" : "Confirmă"}
                </button>
                {!deleting && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirm(false); }}
                    className="text-[0.65rem] text-gray-500 hover:text-gray-300 transition-colors whitespace-nowrap"
                  >
                    Anulează
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setConfirm(true); }}
                className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                title="Șterge postarea"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Post list view ───────────────────────────────────────────────────────────

function PostListView({
  slug,
  currentUserId,
  onOpenPost,
}: {
  slug: string;
  currentUserId?: string;
  onOpenPost: (id: number) => void;
}) {
  const [posts,      setPosts]      = React.useState<CommunityPostListItem[]>([]);
  const [total,      setTotal]      = React.useState(0);
  const [loading,    setLoading]    = React.useState(true);
  const [error,      setError]      = React.useState<"forbidden" | "rate_limit" | "network" | null>(null);
  const [search,     setSearch]     = React.useState("");
  const [debSearch,  setDebSearch]  = React.useState("");
  const [sort,       setSort]       = React.useState<SortOption>("latest_activity");
  const [page,       setPage]       = React.useState(1);
  const [lastPage,   setLastPage]   = React.useState(1);
  const [showForm,   setShowForm]   = React.useState(false);
  const [retryCount, setRetryCount] = React.useState(0);

  // Debounce search → reset to page 1
  React.useEffect(() => {
    const id = setTimeout(() => { setDebSearch(search); setPage(1); }, 350);
    return () => clearTimeout(id);
  }, [search]);

  // Reset page when sort changes
  React.useEffect(() => { setPage(1); }, [sort]);

  // Fetch
  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await communityService.getCommunityPosts(slug, {
          page,
          per_page: 10,
          search:   debSearch || undefined,
          sort,
        });
        if (cancelled) return;
        setPosts(res.data.posts);
        setTotal(res.data.meta.total);
        setLastPage(res.data.meta.last_page);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          if (err.status === 403)      setError("forbidden");
          else if (err.status === 429) setError("rate_limit");
          else                         setError("network");
        } else {
          setError("network");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [slug, debSearch, sort, page, retryCount]);

  const handleDeletePost = async (id: number) => {
    await communityService.deleteCommunityPost(slug, id);
    setPosts((prev) => prev.filter((p) => p.id !== id));
    setTotal((t) => Math.max(0, t - 1));
  };

  const handlePostCreated = (newPost: CommunityPostListItem) => {
    setPosts((prev) => [newPost, ...prev]);
    setTotal((t) => t + 1);
    setShowForm(false);
  };

  // ── Forbidden ─────────────────────────────────────────────────────────────

  if (error === "forbidden") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <Lock className="w-6 h-6 text-gray-500" />
        </div>
        <div>
          <p className="text-white font-semibold mb-1">Acces restricționat</p>
          <p className="text-gray-500 text-sm">
            Ai nevoie de acces la curs pentru a vedea comunitatea.
          </p>
        </div>
      </div>
    );
  }

  // ── Network error ──────────────────────────────────────────────────────────

  if (error === "network") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-red-400" />
        </div>
        <div>
          <p className="text-white font-semibold mb-1">Eroare de rețea</p>
          <p className="text-gray-500 text-sm">
            Nu am putut încărca postările. Verifică conexiunea.
          </p>
        </div>
        <button
          onClick={() => {
            setSearch("");
            setDebSearch("");
            setPage(1);
            setRetryCount((c) => c + 1);
          }}
          className="text-nma-purple hover:text-nma-purple-light text-sm transition-colors"
        >
          Încearcă din nou
        </button>
      </div>
    );
  }

  // ── Main UI ───────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-8 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">Comunitate</h2>
            <p className="text-gray-500 text-sm mt-0.5">
              Întreabă, răspunde și discută cu ceilalți membri ai cursului.
            </p>
            {!loading && (
              <p className="text-gray-600 text-xs mt-1">
                {total} {total === 1 ? "postare" : "postări"}
              </p>
            )}
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className={cn(
              "shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-xl border transition-colors",
              showForm
                ? "bg-white/5 border-white/10 text-gray-300"
                : "bg-nma-purple/20 border-nma-purple/40 text-nma-purple-light hover:bg-nma-purple/30",
            )}
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span className="hidden sm:inline">
              {showForm ? "Anulează" : "Creează postare"}
            </span>
          </button>
        </div>

        {/* Create post form */}
        {showForm && (
          <CreatePostForm
            slug={slug}
            onSuccess={handlePostCreated}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Caută postări…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-nma-purple/50 focus:ring-1 focus:ring-nma-purple/20 transition-colors"
          />
        </div>

        {/* Sort pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSort(opt.value)}
              className={cn(
                "shrink-0 text-xs px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap",
                sort === opt.value
                  ? "bg-nma-purple/20 border-nma-purple/40 text-nma-purple-light"
                  : "border-white/10 text-gray-500 hover:text-gray-300 hover:border-white/20",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Rate limit banner */}
        {error === "rate_limit" && (
          <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-xl px-3 py-2.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Ai trimis prea multe cereri. Încearcă din nou mai târziu.
          </div>
        )}

        {/* Posts list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <PostCardSkeleton key={i} />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <p className="text-white font-semibold mb-1">
                {debSearch ? "Niciun rezultat" : "Nicio postare încă"}
              </p>
              <p className="text-gray-500 text-sm">
                {debSearch
                  ? `Nu am găsit postări pentru „${debSearch}".`
                  : "Fii primul care începe o discuție!"}
              </p>
            </div>
            {debSearch && (
              <button
                onClick={() => setSearch("")}
                className="text-nma-purple hover:text-nma-purple-light text-sm transition-colors"
              >
                Șterge căutarea
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={currentUserId}
                onOpen={() => onOpenPost(post.id)}
                onDeleteConfirmed={handleDeletePost}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && lastPage > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              Anterior
            </button>
            <span className="text-xs text-gray-500 px-2">
              {page} / {lastPage}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              disabled={page === lastPage}
              className="px-4 py-2 text-sm rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              Următor
            </button>
          </div>
        )}

        {/* Bottom spacer for mobile */}
        <div className="h-4" />
      </div>
    </div>
  );
}

// ─── Post detail view ─────────────────────────────────────────────────────────

function PostDetailView({
  slug,
  postId,
  currentUserId,
  onBack,
}: {
  slug: string;
  postId: number;
  currentUserId?: string;
  onBack: () => void;
}) {
  const [post,              setPost]              = React.useState<CommunityPost | null>(null);
  const [replies,           setReplies]           = React.useState<CommunityReply[]>([]);
  const [loading,           setLoading]           = React.useState(true);
  const [error,             setError]             = React.useState<"notfound" | "forbidden" | "network" | null>(null);
  const [repliesPage,       setRepliesPage]       = React.useState(1);
  const [repliesLastPage,   setRepliesLastPage]   = React.useState(1);
  const [repliesLoading,    setRepliesLoading]    = React.useState(false);

  // Reply form
  const [replyBody,   setReplyBody]   = React.useState("");
  const [submitting,  setSubmitting]  = React.useState(false);
  const [replyErrors, setReplyErrors] = React.useState<Record<string, string[]>>({});
  const [replyGenErr, setReplyGenErr] = React.useState<string | null>(null);

  // Delete confirm
  const [confirmDeletePost,  setConfirmDeletePost]  = React.useState(false);
  const [deletingPost,       setDeletingPost]       = React.useState(false);
  const [confirmDeleteReply, setConfirmDeleteReply] = React.useState<number | null>(null);

  // Initial load
  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await communityService.getCommunityPost(slug, postId, 1);
        if (cancelled) return;
        setPost(res.data.post);
        setReplies(res.data.replies);
        setRepliesLastPage(res.data.replies_meta.last_page);
        setRepliesPage(1);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          if (err.status === 404)      setError("notfound");
          else if (err.status === 403) setError("forbidden");
          else                         setError("network");
        } else {
          setError("network");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [slug, postId]);

  // Load a different replies page (without re-fetching the post header)
  const loadRepliesPage = async (p: number) => {
    setRepliesLoading(true);
    try {
      const res = await communityService.getCommunityPost(slug, postId, p);
      setReplies(res.data.replies);
      setRepliesPage(p);
      setRepliesLastPage(res.data.replies_meta.last_page);
    } catch {
      // keep current replies on error
    } finally {
      setRepliesLoading(false);
    }
  };

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = replyBody.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setReplyErrors({});
    setReplyGenErr(null);
    try {
      const res = await communityService.createCommunityReply(slug, postId, { body: trimmed });
      setReplies((prev) => [...prev, res.data.reply]);
      setPost((p) => p ? { ...p, replies_count: res.data.post.replies_count } : p);
      setReplyBody("");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422) {
          if (err.data?.errors) {
            setReplyErrors(err.data.errors);
          } else {
            // e.g. "post is locked" message from backend
            setReplyGenErr(err.data?.message ?? "Date invalide.");
          }
        } else if (err.status === 429) {
          setReplyGenErr("Ai trimis prea multe mesaje. Încearcă din nou mai târziu.");
        } else {
          setReplyGenErr("Eroare la trimiterea răspunsului. Încearcă din nou.");
        }
      } else {
        setReplyGenErr("Eroare de rețea. Încearcă din nou.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePost = async () => {
    if (!post) return;
    setDeletingPost(true);
    try {
      await communityService.deleteCommunityPost(slug, post.id);
      onBack();
    } catch {
      setDeletingPost(false);
      setConfirmDeletePost(false);
    }
  };

  const handleDeleteReply = async (replyId: number) => {
    try {
      await communityService.deleteCommunityReply(slug, postId, replyId);
      setReplies((prev) => prev.filter((r) => r.id !== replyId));
      setPost((p) => p ? { ...p, replies_count: Math.max(0, p.replies_count - 1) } : p);
    } catch {
      // keep current state
    } finally {
      setConfirmDeleteReply(null);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 md:py-8 space-y-6 animate-pulse">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-white/10 rounded" />
            <div className="h-3 bg-white/10 rounded w-32" />
          </div>
          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 space-y-3">
            <div className="h-6 bg-white/10 rounded w-3/4" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/10" />
              <div className="space-y-1.5">
                <div className="h-3 bg-white/10 rounded w-28" />
                <div className="h-2.5 bg-white/5 rounded w-20" />
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <div className="h-3 bg-white/5 rounded w-full" />
              <div className="h-3 bg-white/5 rounded w-full" />
              <div className="h-3 bg-white/5 rounded w-4/5" />
            </div>
          </div>
          <div className="space-y-0 divide-y divide-white/5">
            {Array.from({ length: 3 }).map((_, i) => <ReplySkeleton key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-8"
          >
            <ChevronLeft className="w-4 h-4" /> Înapoi la comunitate
          </button>
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              {error === "notfound"
                ? <MessageSquare className="w-6 h-6 text-gray-600" />
                : <AlertTriangle className="w-6 h-6 text-red-400" />}
            </div>
            <div>
              <p className="text-white font-semibold mb-1">
                {error === "notfound"   ? "Postarea nu a fost găsită"
                  : error === "forbidden" ? "Acces restricționat"
                  : "Eroare de rețea"}
              </p>
              <p className="text-gray-500 text-sm">
                {error === "notfound"   ? "Postarea nu mai este disponibilă."
                  : error === "forbidden" ? "Nu ai permisiunea de a accesa această postare."
                  : "A apărut o eroare. Verifică conexiunea și încearcă din nou."}
              </p>
            </div>
            <button
              onClick={onBack}
              className="text-nma-purple hover:text-nma-purple-light text-sm transition-colors"
            >
              Înapoi la comunitate
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!post) return null;

  const postOwned  = isOwned(post.author.user_id, currentUserId);
  const canReply   = !post.is_locked;
  const replyValid = replyBody.trim().length >= 2 && replyBody.trim().length <= 3000 && !submitting;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-8 space-y-6">

        {/* Back */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Înapoi la comunitate
        </button>

        {/* Post body card */}
        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">

          {/* Badges */}
          {(post.is_pinned || post.is_locked) && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {post.is_pinned && (
                <span className="inline-flex items-center gap-1 text-[0.6rem] font-bold uppercase tracking-wider text-nma-purple-light bg-nma-purple/10 border border-nma-purple/20 rounded px-1.5 py-0.5">
                  <Pin className="w-2.5 h-2.5" /> Fixat
                </span>
              )}
              {post.is_locked && (
                <span className="inline-flex items-center gap-1 text-[0.6rem] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded px-1.5 py-0.5">
                  <Lock className="w-2.5 h-2.5" /> Blocat
                </span>
              )}
            </div>
          )}

          {/* Title */}
          <h1 className="text-lg font-bold text-white leading-snug mb-4">{post.title}</h1>

          {/* Author row */}
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <Avatar initials={post.author.initials} />
            <div>
              <p className="text-sm font-semibold text-white">{post.author.name}</p>
              <p className="text-xs text-gray-500">{formatDate(post.created_at)}</p>
            </div>

            {/* Delete own post */}
            {postOwned && (
              <div className="ml-auto flex items-center gap-2 flex-wrap">
                {confirmDeletePost ? (
                  <>
                    <button
                      onClick={handleDeletePost}
                      disabled={deletingPost}
                      className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {deletingPost ? "Se șterge…" : "Confirmă ștergerea"}
                    </button>
                    {!deletingPost && (
                      <button
                        onClick={() => setConfirmDeletePost(false)}
                        className="text-xs text-gray-500 hover:text-gray-300 transition-colors whitespace-nowrap"
                      >
                        Anulează
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmDeletePost(true)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Șterge postarea
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Body — plain text, preserves line breaks, never renders HTML */}
          <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap break-words">
            {post.body}
          </p>

          {/* Footer */}
          <div className="mt-5 pt-4 border-t border-white/5 flex items-center gap-1.5 text-xs text-gray-600">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>
              {post.replies_count} {post.replies_count === 1 ? "răspuns" : "răspunsuri"}
            </span>
          </div>
        </div>

        {/* Locked notice */}
        {post.is_locked && (
          <div className="flex items-center gap-2.5 text-sm text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-3">
            <Lock className="w-4 h-4 shrink-0" />
            Această discuție este blocată. Nu mai poți adăuga răspunsuri.
          </div>
        )}

        {/* Replies */}
        {(replies.length > 0 || repliesLoading) && (
          <div>
            <h2 className="text-sm font-semibold text-gray-400 mb-1">
              Răspunsuri ({post.replies_count})
            </h2>
            <div className="divide-y divide-white/5">
              {repliesLoading
                ? Array.from({ length: 3 }).map((_, i) => <ReplySkeleton key={i} />)
                : replies.map((reply) => {
                    const replyOwned     = isOwned(reply.author.user_id, currentUserId);
                    const isConfirming   = confirmDeleteReply === reply.id;

                    return (
                      <div key={reply.id} className="flex items-start gap-3 py-4 group">
                        <Avatar initials={reply.author.initials} size="sm" />

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <span className="text-xs font-semibold text-white">
                              {reply.author.name}
                            </span>
                            <span className="text-[0.65rem] text-gray-600">
                              {formatRelativeDate(reply.created_at)}
                            </span>
                          </div>
                          {/* Plain text — no dangerouslySetInnerHTML */}
                          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
                            {reply.body}
                          </p>
                        </div>

                        {/* Delete own reply */}
                        {replyOwned && (
                          <div className="shrink-0 flex flex-col items-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {isConfirming ? (
                              <>
                                <button
                                  onClick={() => handleDeleteReply(reply.id)}
                                  className="text-[0.65rem] text-red-400 hover:text-red-300 font-medium transition-colors whitespace-nowrap"
                                >
                                  Confirmă
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteReply(null)}
                                  className="text-[0.65rem] text-gray-500 hover:text-gray-300 transition-colors whitespace-nowrap"
                                >
                                  Anulează
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteReply(reply.id)}
                                className="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                title="Șterge răspunsul"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
            </div>

            {/* Replies pagination */}
            {repliesLastPage > 1 && !repliesLoading && (
              <div className="flex items-center justify-center gap-2 pt-3">
                <button
                  onClick={() => loadRepliesPage(Math.max(1, repliesPage - 1))}
                  disabled={repliesPage === 1}
                  className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  Anterior
                </button>
                <span className="text-xs text-gray-500 px-2">
                  {repliesPage} / {repliesLastPage}
                </span>
                <button
                  onClick={() => loadRepliesPage(Math.min(repliesLastPage, repliesPage + 1))}
                  disabled={repliesPage === repliesLastPage}
                  className="px-3 py-1.5 text-xs rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/20 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  Următor
                </button>
              </div>
            )}
          </div>
        )}

        {/* Empty replies + not locked */}
        {replies.length === 0 && !repliesLoading && !post.is_locked && (
          <div className="flex flex-col items-center gap-2 py-10 text-center border border-white/5 rounded-2xl">
            <MessageSquare className="w-6 h-6 text-gray-600" />
            <p className="text-gray-500 text-sm">Niciun răspuns încă. Fii primul!</p>
          </div>
        )}

        {/* Reply form */}
        {canReply && (
          <form onSubmit={handleSubmitReply} className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-400">Adaugă un răspuns</h2>

            {replyGenErr && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {replyGenErr}
              </div>
            )}

            <div>
              <div className="flex justify-end mb-1">
                <span className={cn("text-xs tabular-nums", replyBody.length > 3000 ? "text-red-400" : "text-gray-600")}>
                  {replyBody.length}/3000
                </span>
              </div>
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                maxLength={3200}
                rows={4}
                placeholder="Scrie răspunsul tău… (text simplu)"
                disabled={submitting}
                className={cn(
                  "w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5",
                  "text-sm text-white placeholder-gray-600 outline-none resize-none",
                  "focus:border-nma-purple/50 focus:ring-1 focus:ring-nma-purple/20 transition-colors",
                  "disabled:opacity-50",
                  replyErrors.body && "border-red-400/50",
                )}
              />
              {replyErrors.body && (
                <p className="text-xs text-red-400 mt-1">{replyErrors.body[0]}</p>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!replyValid}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-nma-purple/20 border border-nma-purple/40 text-nma-purple-light hover:bg-nma-purple/30 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <Send className="w-3.5 h-3.5" />
                {submitting ? "Se trimite…" : "Trimite răspunsul"}
              </button>
            </div>
          </form>
        )}

        {/* Bottom spacer for mobile */}
        <div className="h-4" />
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function CourseCommunity({ slug, courseTitle: _courseTitle }: CommunityProps) {
  const { user } = useAuth();
  const [view,         setView]         = React.useState<"list" | "detail">("list");
  const [activePostId, setActivePostId] = React.useState<number | null>(null);

  const openPost = (id: number) => { setActivePostId(id); setView("detail"); };
  const goBack   = ()           => { setView("list"); setActivePostId(null); };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {view === "list" ? (
        <PostListView
          slug={slug}
          currentUserId={user?.user_id}
          onOpenPost={openPost}
        />
      ) : (
        <PostDetailView
          slug={slug}
          postId={activePostId!}
          currentUserId={user?.user_id}
          onBack={goBack}
        />
      )}
    </div>
  );
}
