import React from "react";
import { Search, Users, AlertTriangle, Lock } from "lucide-react";
import { courseService, CourseMember } from "../../services/courseService";
import { ApiError } from "../../lib/apiClient";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatJoinedDate(iso: string | null): string {
  if (!iso) return "Membru NMA";
  try {
    return new Intl.DateTimeFormat("ro-RO", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "Membru NMA";
  }
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function MemberCardSkeleton() {
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex items-start gap-3 animate-pulse">
      <div className="w-11 h-11 rounded-full bg-white/10 shrink-0" />
      <div className="flex-1 space-y-2 pt-0.5">
        <div className="h-3.5 bg-white/10 rounded w-36" />
        <div className="h-2.5 bg-white/5 rounded w-24" />
        <div className="h-1.5 bg-white/8 rounded w-full mt-2" />
      </div>
    </div>
  );
}

// ─── Member card ──────────────────────────────────────────────────────────────

function MemberCard({ member }: { member: CourseMember }) {
  const hasProgress = member.progress_percent !== null;

  return (
    <div className="bg-white/[0.03] border border-white/5 hover:border-white/10 rounded-2xl p-4 flex items-start gap-3 transition-colors">
      {/* Avatar */}
      <div
        className="w-11 h-11 rounded-full bg-gradient-to-br from-nma-purple/40 to-nma-purple/20 border border-nma-purple/30 flex items-center justify-center shrink-0 text-sm font-bold text-nma-purple-light select-none"
        aria-hidden="true"
      >
        {member.initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{member.name}</p>
        <p className="text-[0.7rem] text-gray-500 mt-0.5">
          Membru din {formatJoinedDate(member.joined_at)}
        </p>

        {/* Progress */}
        {hasProgress && (
          <div className="mt-2.5 space-y-1">
            <div className="flex items-center justify-between text-[0.65rem]">
              <span className="text-gray-500">
                {member.completed_videos_count}/{member.total_videos_count} lecții finalizate
              </span>
              <span className="text-nma-purple-light font-mono font-bold">
                {member.progress_percent}%
              </span>
            </div>
            <div className="h-1 bg-white/8 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-nma-purple to-nma-purple-light rounded-full transition-all"
                style={{ width: `${member.progress_percent ?? 0}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CourseMembersProps {
  slug: string;
  courseTitle: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CourseMembers({ slug, courseTitle }: CourseMembersProps) {
  const [members, setMembers]       = React.useState<CourseMember[]>([]);
  const [total, setTotal]           = React.useState(0);
  const [loading, setLoading]       = React.useState(true);
  const [error, setError]           = React.useState<"forbidden" | "network" | null>(null);
  const [search, setSearch]         = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage]             = React.useState(1);
  const [lastPage, setLastPage]     = React.useState(1);

  // Debounce search input by 350 ms
  React.useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [search]);

  // Fetch whenever slug, debouncedSearch, or page changes
  React.useEffect(() => {
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      setError(null);
      try {
        const res = await courseService.getCourseMembers(slug, {
          search: debouncedSearch || undefined,
          page,
          perPage: 20,
        });
        if (cancelled) return;
        setMembers(res.data.members);
        setTotal(res.data.meta.total);
        setLastPage(res.data.meta.last_page);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 403) {
          setError("forbidden");
        } else {
          setError("network");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, [slug, debouncedSearch, page]);

  // ── Error states ─────────────────────────────────────────────────────────

  if (error === "forbidden") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <Lock className="w-6 h-6 text-gray-500" />
        </div>
        <div>
          <p className="text-white font-semibold mb-1">Acces restricționat</p>
          <p className="text-gray-500 text-sm">
            Ai nevoie de acces la curs pentru a vedea membrii.
          </p>
        </div>
      </div>
    );
  }

  if (error === "network") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-red-400" />
        </div>
        <div>
          <p className="text-white font-semibold mb-1">Eroare de rețea</p>
          <p className="text-gray-500 text-sm">
            Nu am putut încărca lista de membri. Verifică conexiunea.
          </p>
        </div>
        <button
          onClick={() => { setPage(1); setDebouncedSearch(""); setSearch(""); }}
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
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-8 space-y-6">

        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-white">Membrii cursului</h2>
          <p className="text-gray-500 text-sm mt-0.5 line-clamp-1">{courseTitle}</p>
          {!loading && (
            <p className="text-gray-600 text-xs mt-1">
              {total} {total === 1 ? "membru activ" : "membri activi"}
            </p>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Caută după nume…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-nma-purple/50 focus:ring-1 focus:ring-nma-purple/20 transition-colors"
          />
        </div>

        {/* Member grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <MemberCardSkeleton key={i} />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <p className="text-white font-semibold mb-1">
                {debouncedSearch ? "Niciun rezultat" : "Niciun membru"}
              </p>
              <p className="text-gray-500 text-sm">
                {debouncedSearch
                  ? `Nu am găsit niciun membru cu numele „${debouncedSearch}".`
                  : "Nu există membri activi pentru acest curs."}
              </p>
            </div>
            {debouncedSearch && (
              <button
                onClick={() => setSearch("")}
                className="text-nma-purple hover:text-nma-purple-light text-sm transition-colors"
              >
                Șterge căutarea
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {members.map((m) => (
              <MemberCard key={m.user_id} member={m} />
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
      </div>
    </div>
  );
}
