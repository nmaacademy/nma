import React from "react";
import { Trophy, Medal, AlertTriangle, Lock, RefreshCw, CheckCircle2 } from "lucide-react";
import {
  leaderboardService,
  LeaderboardEntry,
  LeaderboardCurrentUser,
} from "../../services/leaderboardService";
import { ApiError } from "../../lib/apiClient";
import { cn } from "../../lib/utils";

// ─── Props ────────────────────────────────────────────────────────────────────

interface CourseLeaderboardProps {
  slug: string;
  courseTitle: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatJoinedDate(iso: string | null): string {
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

function formatCompletedDate(iso: string | null): string {
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

// ─── Rank badge ───────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="w-9 h-9 shrink-0 rounded-xl bg-yellow-500/15 border border-yellow-500/30 flex items-center justify-center">
        <Trophy className="w-4 h-4 text-yellow-400" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="w-9 h-9 shrink-0 rounded-xl bg-gray-400/10 border border-gray-400/20 flex items-center justify-center">
        <Medal className="w-4 h-4 text-gray-300" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="w-9 h-9 shrink-0 rounded-xl bg-amber-700/15 border border-amber-700/20 flex items-center justify-center">
        <Medal className="w-4 h-4 text-amber-600" />
      </div>
    );
  }
  return (
    <div className="w-9 h-9 shrink-0 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center">
      <span className="text-xs font-bold text-gray-500 font-mono">#{rank}</span>
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({
  initials,
  rank,
  isCurrentUser,
}: {
  initials: string;
  rank: number;
  isCurrentUser: boolean;
}) {
  const colorClass = isCurrentUser
    ? "from-nma-purple/50 to-nma-purple/30 border-nma-purple/40 text-nma-purple-light"
    : rank === 1
    ? "from-yellow-500/30 to-yellow-600/20 border-yellow-500/30 text-yellow-300"
    : rank === 2
    ? "from-gray-300/20 to-gray-400/10 border-gray-400/20 text-gray-200"
    : rank === 3
    ? "from-amber-600/20 to-amber-700/10 border-amber-600/20 text-amber-500"
    : "from-nma-purple/25 to-nma-purple/15 border-nma-purple/20 text-nma-purple-light";

  return (
    <div
      className={cn(
        "w-10 h-10 rounded-full bg-gradient-to-br border flex items-center justify-center shrink-0 text-sm font-bold select-none",
        colorClass,
      )}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({
  percent,
  rank,
  isCurrentUser,
}: {
  percent: number;
  rank: number;
  isCurrentUser: boolean;
}) {
  const barColor = isCurrentUser
    ? "from-nma-purple to-nma-purple-light"
    : rank === 1
    ? "from-yellow-500 to-yellow-400"
    : rank <= 3
    ? "from-nma-purple to-nma-purple-light"
    : "from-nma-purple/70 to-nma-purple-light/70";

  return (
    <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
      <div
        className={cn("h-full bg-gradient-to-r rounded-full transition-all duration-500", barColor)}
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LeaderboardSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 flex items-center gap-3 animate-pulse"
        >
          <div className="w-9 h-9 rounded-xl bg-white/10 shrink-0" />
          <div className="w-10 h-10 rounded-full bg-white/10 shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-3.5 bg-white/10 rounded w-40" />
            <div className="h-2.5 bg-white/5 rounded w-24" />
            <div className="h-1.5 bg-white/8 rounded-full w-full mt-1" />
          </div>
          <div className="w-12 text-right space-y-1 shrink-0">
            <div className="h-4 bg-white/10 rounded w-10 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Current-user summary card ────────────────────────────────────────────────

function CurrentUserCard({
  current,
  currentUserId,
  entries,
}: {
  current: LeaderboardCurrentUser;
  currentUserId?: number;
  entries: LeaderboardEntry[];
}) {
  const matchedEntry = entries.find((e) => e.user_id === currentUserId);
  const initials = matchedEntry?.initials ?? "TU";

  return (
    <div className="bg-nma-purple/[0.08] border border-nma-purple/25 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Rank badge */}
        <div className="w-9 h-9 shrink-0 rounded-xl bg-nma-purple/15 border border-nma-purple/30 flex items-center justify-center">
          <span className="text-xs font-bold text-nma-purple-light font-mono">
            #{current.rank}
          </span>
        </div>

        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-nma-purple/50 to-nma-purple/30 border border-nma-purple/40 flex items-center justify-center shrink-0 text-sm font-bold text-nma-purple-light select-none">
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold text-white">Progresul tău</p>
            {current.is_completed && (
              <span className="inline-flex items-center gap-1 text-[0.6rem] font-bold uppercase tracking-wider text-green-400 bg-green-500/10 border border-green-500/20 rounded px-1.5 py-0.5">
                <CheckCircle2 className="w-2.5 h-2.5" /> Finalizat
              </span>
            )}
          </div>
          <p className="text-[0.7rem] text-gray-500">
            {current.completed_videos_count}/{current.total_videos_count} lecții finalizate
          </p>
          {current.is_completed && current.completed_at_course && (
            <p className="text-[0.65rem] text-green-400/70 mt-0.5">
              Finalizat pe {formatCompletedDate(current.completed_at_course)}
            </p>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="sm:w-40 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Progres</span>
          <span className="text-nma-purple-light font-mono font-bold">
            {current.progress_percent}%
          </span>
        </div>
        <div className="h-2 bg-white/8 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-nma-purple to-nma-purple-light rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, current.progress_percent)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Leaderboard row ──────────────────────────────────────────────────────────

function LeaderboardRow({
  entry,
  isCurrentUser,
}: {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
}) {
  const isPodium = entry.rank <= 3;

  return (
    <div
      className={cn(
        "rounded-2xl p-4 border transition-colors flex flex-col sm:flex-row sm:items-center gap-3",
        isCurrentUser
          ? "bg-nma-purple/[0.07] border-nma-purple/20"
          : entry.rank === 1
          ? "bg-yellow-500/[0.04] border-yellow-500/15"
          : "bg-white/[0.03] border-white/5 hover:border-white/10",
      )}
    >
      {/* Left: rank + avatar */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <RankBadge rank={entry.rank} />

        <Avatar
          initials={entry.initials}
          rank={entry.rank}
          isCurrentUser={isCurrentUser}
        />

        {/* Name + dates */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <p
              className={cn(
                "text-sm font-semibold truncate",
                entry.rank === 1
                  ? "text-yellow-300"
                  : isCurrentUser
                  ? "text-nma-purple-light"
                  : "text-white",
              )}
            >
              {entry.name}
            </p>
            {isCurrentUser && (
              <span className="text-[0.6rem] font-bold uppercase tracking-wider text-nma-purple/80 bg-nma-purple/10 border border-nma-purple/20 rounded px-1.5 py-0.5">
                Tu
              </span>
            )}
            {entry.is_completed && (
              <span className="inline-flex items-center gap-1 text-[0.6rem] font-bold uppercase tracking-wider text-green-400 bg-green-500/10 border border-green-500/20 rounded px-1.5 py-0.5">
                <CheckCircle2 className="w-2.5 h-2.5" /> Curs finalizat
              </span>
            )}
          </div>

          {entry.joined_at && (
            <p className="text-[0.65rem] text-gray-600">
              Membru din {formatJoinedDate(entry.joined_at)}
            </p>
          )}
          {entry.is_completed && entry.completed_at_course && (
            <p className="text-[0.65rem] text-green-400/60 mt-0.5">
              Finalizat pe {formatCompletedDate(entry.completed_at_course)}
            </p>
          )}
        </div>
      </div>

      {/* Right: progress */}
      <div className={cn("space-y-1.5", isPodium || isCurrentUser ? "sm:w-44" : "sm:w-40")}>
        <div className="flex items-center justify-between text-[0.65rem]">
          <span className="text-gray-500">
            {entry.completed_videos_count}/{entry.total_videos_count} lecții
          </span>
          <span
            className={cn(
              "font-mono font-bold",
              entry.rank === 1
                ? "text-yellow-400"
                : isCurrentUser
                ? "text-nma-purple-light"
                : "text-gray-300",
            )}
          >
            {entry.progress_percent}%
          </span>
        </div>
        <ProgressBar
          percent={entry.progress_percent}
          rank={entry.rank}
          isCurrentUser={isCurrentUser}
        />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CourseLeaderboard({
  slug,
  courseTitle,
}: CourseLeaderboardProps) {
  const [entries, setEntries]       = React.useState<LeaderboardEntry[]>([]);
  const [currentUser, setCurrentUser] = React.useState<LeaderboardCurrentUser | null>(null);
  const [currentUserId, setCurrentUserId] = React.useState<number | undefined>(undefined);
  const [total, setTotal]           = React.useState(0);
  const [loading, setLoading]       = React.useState(true);
  const [error, setError]           = React.useState<"forbidden" | "notfound" | "network" | null>(null);
  const [page, setPage]             = React.useState(1);
  const [lastPage, setLastPage]     = React.useState(1);
  const [retryCount, setRetryCount] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await leaderboardService.getCourseLeaderboard(slug, {
          page,
          per_page: 20,
        });
        if (cancelled) return;

        const data = res.data;
        setEntries(data.leaderboard);
        setCurrentUser(data.current_user);
        setTotal(data.meta.total);
        setLastPage(data.meta.last_page);

        // Detect current user id from the leaderboard entries vs current_user rank
        if (data.current_user) {
          const matched = data.leaderboard.find(
            (e) => e.rank === data.current_user?.rank &&
              e.progress_percent === data.current_user?.progress_percent
          );
          if (matched) setCurrentUserId(matched.user_id);
        }
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

  // ── Error: forbidden ──────────────────────────────────────────────────────

  if (error === "forbidden") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <Lock className="w-6 h-6 text-gray-500" />
        </div>
        <div>
          <p className="text-white font-semibold mb-1">Acces restricționat</p>
          <p className="text-gray-500 text-sm max-w-xs">
            Ai nevoie de acces la curs pentru a vedea leaderboard-ul.
          </p>
        </div>
      </div>
    );
  }

  if (error === "notfound") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-gray-500" />
        </div>
        <div>
          <p className="text-white font-semibold mb-1">Cursul nu a fost găsit</p>
          <p className="text-gray-500 text-sm">Cursul nu mai este disponibil.</p>
        </div>
      </div>
    );
  }

  if (error === "network") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-red-400" />
        </div>
        <div>
          <p className="text-white font-semibold mb-1">Eroare de rețea</p>
          <p className="text-gray-500 text-sm">
            Nu am putut încărca leaderboard-ul. Verifică conexiunea.
          </p>
        </div>
        <button
          onClick={() => { setPage(1); setRetryCount((c) => c + 1); }}
          className="flex items-center gap-1.5 text-sm text-nma-purple hover:text-nma-purple-light transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Încearcă din nou
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
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            Leaderboard
          </h2>
          <p className="text-gray-500 text-sm mt-0.5">
            Vezi progresul membrilor și cine a terminat cursul.
          </p>
          {!loading && total > 0 && (
            <p className="text-gray-600 text-xs mt-1">
              {total} {total === 1 ? "participant" : "participanți"}
            </p>
          )}
        </div>

        {loading ? (
          <>
            {/* Current user skeleton */}
            <div className="bg-nma-purple/[0.05] border border-nma-purple/15 rounded-2xl p-4 animate-pulse h-20" />
            <LeaderboardSkeleton />
          </>
        ) : (
          <>
            {/* Current user card — always visible */}
            {currentUser && (
              <CurrentUserCard
                current={currentUser}
                currentUserId={currentUserId}
                entries={entries}
              />
            )}

            {/* Leaderboard list */}
            {entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-gray-600" />
                </div>
                <div>
                  <p className="text-white font-semibold mb-1">Leaderboard gol</p>
                  <p className="text-gray-500 text-sm max-w-xs">
                    Leaderboard-ul nu are membri încă. Fii primul care finalizează o lecție!
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {entries.map((entry) => (
                  <LeaderboardRow
                    key={entry.user_id}
                    entry={entry}
                    isCurrentUser={entry.user_id === currentUserId}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {lastPage > 1 && (
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
          </>
        )}

        {/* Bottom spacer for mobile */}
        <div className="h-4" />
      </div>
    </div>
  );
}
