import React from "react";
import { Pin, AlertTriangle, Lock, RefreshCw, Megaphone } from "lucide-react";
import {
  announcementService,
  Announcement,
} from "../../services/announcementService";
import { ApiError } from "../../lib/apiClient";
import { cn } from "../../lib/utils";

// ─── Props ────────────────────────────────────────────────────────────────────

interface CourseAnnouncementsProps {
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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function AnnouncementSkeleton() {
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-white/10 shrink-0 mt-0.5" />
        <div className="flex-1 space-y-3">
          <div className="h-4 bg-white/10 rounded w-2/3" />
          <div className="space-y-1.5">
            <div className="h-3 bg-white/5 rounded w-full" />
            <div className="h-3 bg-white/5 rounded w-full" />
            <div className="h-3 bg-white/5 rounded w-4/5" />
          </div>
          <div className="h-2.5 bg-white/5 rounded w-28" />
        </div>
      </div>
    </div>
  );
}

// ─── Announcement card ────────────────────────────────────────────────────────

function AnnouncementCard({ item }: { item: Announcement }) {
  return (
    <div
      className={cn(
        "rounded-2xl p-5 border transition-all",
        item.is_pinned
          ? "bg-nma-purple/[0.07] border-nma-purple/25"
          : "bg-white/[0.03] border-white/5",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={cn(
            "shrink-0 w-9 h-9 rounded-xl flex items-center justify-center mt-0.5",
            item.is_pinned
              ? "bg-nma-purple/20 border border-nma-purple/30"
              : "bg-white/5 border border-white/10",
          )}
        >
          {item.is_pinned ? (
            <Pin className="w-4 h-4 text-nma-purple-light" />
          ) : (
            <Megaphone className="w-4 h-4 text-gray-500" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Pinned badge */}
          {item.is_pinned && (
            <div className="mb-2">
              <span className="inline-flex items-center gap-1 text-[0.6rem] font-bold uppercase tracking-wider text-nma-purple-light bg-nma-purple/10 border border-nma-purple/20 rounded px-1.5 py-0.5">
                <Pin className="w-2.5 h-2.5" /> Important
              </span>
            </div>
          )}

          {/* Title */}
          <h3
            className={cn(
              "text-sm font-bold leading-snug mb-2.5",
              item.is_pinned ? "text-white" : "text-white/90",
            )}
          >
            {item.title}
          </h3>

          {/* Body — plain text, preserves line breaks, never renders HTML */}
          <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap break-words">
            {item.body}
          </p>

          {/* Date */}
          <p className="text-[0.65rem] text-gray-600 mt-3">
            {formatDate(item.published_at ?? item.created_at)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CourseAnnouncements({
  slug,
}: CourseAnnouncementsProps) {
  const [announcements, setAnnouncements] = React.useState<Announcement[]>([]);
  const [total,         setTotal]         = React.useState(0);
  const [loading,       setLoading]       = React.useState(true);
  const [error, setError] = React.useState<
    "forbidden" | "notfound" | "network" | null
  >(null);
  const [page,       setPage]       = React.useState(1);
  const [lastPage,   setLastPage]   = React.useState(1);
  const [retryCount, setRetryCount] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await announcementService.getCourseAnnouncements(slug, {
          page,
          per_page: 10,
        });
        if (cancelled) return;
        setAnnouncements(res.data.announcements);
        setTotal(res.data.meta.total);
        setLastPage(res.data.meta.last_page);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          if (err.status === 403)      setError("forbidden");
          else if (err.status === 404) setError("notfound");
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
  }, [slug, page, retryCount]);

  // ── Forbidden ──────────────────────────────────────────────────────────────

  if (error === "forbidden") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <Lock className="w-6 h-6 text-gray-500" />
        </div>
        <div>
          <p className="text-white font-semibold mb-1">Acces restricționat</p>
          <p className="text-gray-500 text-sm max-w-xs">
            Ai nevoie de acces la curs pentru a vedea anunțurile.
          </p>
        </div>
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────

  if (error === "notfound") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-gray-500" />
        </div>
        <div>
          <p className="text-white font-semibold mb-1">Cursul nu a fost găsit</p>
          <p className="text-gray-500 text-sm">
            Cursul nu mai este disponibil.
          </p>
        </div>
      </div>
    );
  }

  // ── Network error ──────────────────────────────────────────────────────────

  if (error === "network") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-red-400" />
        </div>
        <div>
          <p className="text-white font-semibold mb-1">Eroare de rețea</p>
          <p className="text-gray-500 text-sm">
            Nu am putut încărca anunțurile. Verifică conexiunea.
          </p>
        </div>
        <button
          onClick={() => {
            setPage(1);
            setRetryCount((c) => c + 1);
          }}
          className="flex items-center gap-1.5 text-sm text-nma-purple hover:text-nma-purple-light transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Încearcă din nou
        </button>
      </div>
    );
  }

  // ── Main UI ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-8 space-y-5">

        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-white">Anunțuri</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            Noutăți și informații importante transmise de echipa NMA Academy.
          </p>
          {!loading && total > 0 && (
            <p className="text-gray-600 text-xs mt-1">
              {total} {total === 1 ? "anunț" : "anunțuri"}
            </p>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <AnnouncementSkeleton key={i} />
            ))}
          </div>
        ) : announcements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <Megaphone className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <p className="text-white font-semibold mb-1">Niciun anunț momentan</p>
              <p className="text-gray-500 text-sm max-w-xs">
                Nu există anunțuri momentan. Revino mai târziu.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {announcements.map((item) => (
              <AnnouncementCard key={item.id} item={item} />
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
