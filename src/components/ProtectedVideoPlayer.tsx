import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Code2,
  Lock,
  LogIn,
  Pause,
  Play,
  RotateCcw,
  ShoppingCart,
  Terminal,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  videoPlaybackService,
  VideoPlaybackAccess,
  VideoPlaybackData,
  VideoPlaybackProgress,
} from "../services/videoPlaybackService";
import { watchService } from "../services/watchService";
import { ApiError } from "../lib/apiClient";
import { useAuth } from "../context/AuthContext";
import { NmaGlassButton } from "./ui/nma-glass";
import LogoLoader from "./ui/LogoLoader";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VideoMeta {
  id: number;
  title: string;
  duration_seconds: number | null;
  thumbnail_url: string | null;
}

export interface ProtectedVideoPlayerProps {
  videoId: number;
  title: string;
  durationSeconds?: number | null;
  /** Client-side lock hint — skips the API call and shows paywall immediately. */
  isLocked?: boolean;
  /** Parent course slug for the "buy" CTA in locked/no-access states. */
  courseSlug?: string;
  onProgressSaved?: (progress: VideoPlaybackProgress) => void;
}

type PlayerStatus =
  | "idle"
  | "loading"
  | "ready"
  | "needs_auth"
  | "needs_auth_to_play"
  | "no_access"
  | "conflict"
  | "session_displaced"
  | "error";

type PauseReason = "user_pause" | "visibility_hidden" | "video_changed" | "page_exit";

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatSeconds(s: number): string {
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ─── Watermark ────────────────────────────────────────────────────────────────

/**
 * Renders the per-user forensic watermark.
 *
 * Security layers:
 * 1. Text includes name, email, date, and session ID — uniquely identifies the source.
 * 2. Position moves randomly every 25–40 s; each move is logged server-side.
 * 3. Parent component watches for DOM removal via MutationObserver → pauses video.
 * 4. pointer-events:none + select-none prevents interaction / CSS highlight copying.
 * 5. data-wm attribute allows the MutationObserver to target it precisely.
 */
function WatermarkOverlay({
  text,
  pos,
  watermarkRef,
}: {
  text: string;
  pos: { x: number; y: number };
  watermarkRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={watermarkRef}
      data-wm="1"
      aria-hidden="true"
      className="absolute pointer-events-none select-none z-20 transition-all duration-[3000ms] ease-in-out"
      style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%, -50%)" }}
    >
      <p
        className="text-white font-mono text-[0.5rem] leading-tight whitespace-nowrap"
        style={{ opacity: 0.13 }}
      >
        {text}
      </p>
    </div>
  );
}

// ─── Dev Placeholder ─────────────────────────────────────────────────────────

interface DevPlaceholderProps {
  meta: VideoMeta;
  duration: number;
  progress: VideoPlaybackProgress | null;
  isPlaying: boolean;
  watchSessionId: number | null;
  devCurrentTime: number;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (t: number) => void;
  onManualHeartbeat: () => void;
  onManualSaveProgress: () => void;
  saving: boolean;
  actionFeedback: { ok: boolean; msg: string } | null;
  visibilityPaused: boolean;
}

function DevPlaceholder({
  meta,
  duration,
  progress,
  isPlaying,
  watchSessionId,
  devCurrentTime,
  onPlay,
  onPause,
  onSeek,
  onManualHeartbeat,
  onManualSaveProgress,
  saving,
  actionFeedback,
  visibilityPaused,
}: DevPlaceholderProps) {
  const [showDebug, setShowDebug] = useState(false);

  const progressPct = duration > 0 ? Math.min(100, (devCurrentTime / duration) * 100) : 0;
  const isCompleted = progress?.is_completed ?? false;
  const hasResume   = (progress?.last_position_seconds ?? 0) > 0 && !isCompleted && !isPlaying;

  return (
    <div className="w-full bg-[#09090c] rounded-2xl border border-amber-500/20 flex flex-col overflow-hidden">
      <div className="bg-amber-500/6 border-b border-amber-500/20 px-4 py-2 flex items-center gap-2 shrink-0">
        <Code2 className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
        <span className="text-amber-400/80 text-[0.6rem] font-mono font-bold uppercase tracking-widest flex-1">
          Dev Mode — Cloudflare Stream nu este configurat
        </span>
        {isPlaying && (
          <span className="flex items-center gap-1.5 text-green-400 text-[0.6rem] font-mono shrink-0">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            LIVE
          </span>
        )}
      </div>

      <div className="flex flex-col items-center gap-4 p-5 text-center">
        <div className="space-y-1.5">
          <h3 className="text-white font-bold text-sm leading-snug">{meta.title}</h3>
          <div className="flex flex-wrap items-center justify-center gap-3 text-[0.62rem] text-gray-500 font-mono">
            {duration > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" /> {formatSeconds(duration)}
              </span>
            )}
            {isCompleted && (
              <span className="flex items-center gap-1 text-green-400">
                <CheckCircle2 className="w-2.5 h-2.5" /> Finalizat
              </span>
            )}
          </div>
        </div>

        {duration > 0 && (
          <div className="w-full max-w-sm space-y-1.5">
            <div className="flex justify-between text-[0.62rem] font-mono">
              <span className={isPlaying ? "text-white" : "text-gray-400"}>
                {formatSeconds(devCurrentTime)}
              </span>
              <span className="text-gray-600">{formatSeconds(duration)}</span>
            </div>
            <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`absolute left-0 top-0 h-full rounded-full ${
                  isCompleted ? "bg-green-500" : "bg-nma-purple"
                } ${isPlaying ? "transition-all duration-1000 ease-linear" : "transition-all duration-300"}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {hasResume && (
              <p className="text-[0.58rem] text-gray-600 text-left">
                Reluare din: {formatSeconds(progress!.last_position_seconds)}
                {" · "}{progress!.progress_percent.toFixed(1)}%
              </p>
            )}
          </div>
        )}

        {duration > 0 && (
          <input
            type="range"
            min={0}
            max={duration}
            step={1}
            value={devCurrentTime}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="w-full max-w-sm h-1 appearance-none bg-white/10 rounded-full accent-nma-purple cursor-pointer"
          />
        )}

        {isCompleted && !isPlaying && (
          <p className="text-[0.68rem] text-green-400/70 flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            Video finalizat — îl poți revedea oricând.
          </p>
        )}

        <NmaGlassButton
          glow={isPlaying ? "neutral" : "purple"}
          onClick={isPlaying ? onPause : onPlay}
          className="flex items-center gap-2 px-7 py-2.5 rounded-xl font-bold text-sm transition-all"
        >
          {isPlaying ? (
            <><Pause className="w-4 h-4" /> Pauză</>
          ) : isCompleted ? (
            <><RotateCcw className="w-4 h-4" /> Revizionează</>
          ) : hasResume ? (
            <><Play className="w-4 h-4" /> Reia</>
          ) : (
            <><Play className="w-4 h-4" /> Redă</>
          )}
        </NmaGlassButton>

        <div className="text-[0.62rem]">
          {watchSessionId !== null ? (
            <span className="flex items-center gap-1.5 text-green-400">
              <Wifi className="w-3 h-3" />
              Sesiune activă #{watchSessionId}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-gray-600">
              <WifiOff className="w-3 h-3" /> Nicio sesiune
            </span>
          )}
        </div>

        {visibilityPaused && (
          <div className="w-full max-w-sm px-3 py-2 rounded-lg bg-yellow-500/8 border border-yellow-500/20 text-yellow-400/90 text-xs text-left">
            ⚠ Redarea a fost oprită când ai părăsit pagina.
          </div>
        )}

        {actionFeedback && (
          <div
            className={`w-full max-w-sm text-xs px-3 py-2 rounded-lg font-mono text-left ${
              actionFeedback.ok
                ? "bg-green-500/8 text-green-400 border border-green-500/20"
                : "bg-red-500/8 text-red-400 border border-red-500/20"
            }`}
          >
            {actionFeedback.ok ? "✓" : "✗"} {actionFeedback.msg}
          </div>
        )}

        <div className="w-full max-w-sm">
          <button
            onClick={() => setShowDebug((v) => !v)}
            className="w-full text-[0.58rem] text-gray-700 hover:text-gray-500 font-mono uppercase tracking-widest flex items-center justify-center gap-1 py-1 transition-colors"
          >
            <Code2 className="w-2.5 h-2.5" />
            {showDebug ? "Ascunde debug" : "Debug API"}
          </button>
          {showDebug && (
            <div className="mt-2 flex flex-wrap gap-1.5 justify-center">
              <button
                onClick={onManualHeartbeat}
                disabled={watchSessionId === null}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-500/30 text-amber-400/75 text-[0.62rem] hover:bg-amber-500/10 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
              >
                <Zap className="w-3 h-3" /> Heartbeat
              </button>
              <button
                onClick={onManualSaveProgress}
                disabled={saving}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-green-500/30 text-green-400/75 text-[0.62rem] hover:bg-green-500/10 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
              >
                <CheckCircle2 className="w-3 h-3" />
                {saving ? "..." : "Salvează +30s"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ProtectedVideoPlayer({
  videoId,
  title,
  durationSeconds,
  isLocked = false,
  courseSlug,
  onProgressSaved,
}: ProtectedVideoPlayerProps) {
  const { user } = useAuth();

  // ── Status + API data ────────────────────────────────────────────────────
  const [status,         setStatus]         = useState<PlayerStatus>(isLocked ? "no_access" : "idle");
  const [videoMeta,      setVideoMeta]       = useState<VideoMeta | null>(null);
  const [playbackData,   setPlaybackData]    = useState<VideoPlaybackData | null>(null);
  const [accessInfo,     setAccessInfo]      = useState<VideoPlaybackAccess | null>(null);
  const [progress,       setProgress]        = useState<VideoPlaybackProgress | null>(null);
  const [errorMessage,   setErrorMessage]    = useState<string | null>(null);

  // ── Playback UI state ────────────────────────────────────────────────────
  const [isPlaying,        setIsPlaying]         = useState(false);
  const [devCurrentTime,   setDevCurrentTime]     = useState(0);
  const [watchSessionId,   setWatchSessionId]     = useState<number | null>(null);
  const [actionFeedback,   setActionFeedback]     = useState<{ ok: boolean; msg: string } | null>(null);
  const [saving,           setSaving]             = useState(false);
  const [visibilityPaused, setVisibilityPaused]   = useState(false);

  // ── Watermark state ──────────────────────────────────────────────────────
  const [watermarkPos, setWatermarkPos] = useState({ x: 15, y: 25 });

  // ── Refs ─────────────────────────────────────────────────────────────────
  const sessionRef           = useRef<number | null>(null);
  const videoIdRef           = useRef<number>(videoId);
  const isPlayingRef         = useRef<boolean>(false);
  const devCurrentTimeRef    = useRef<number>(0);
  const durRef               = useRef<number>(0);
  const completedRef         = useRef<boolean>(false);
  const userRef              = useRef(user);
  const onProgressSavedRef   = useRef(onProgressSaved);
  const tickRef              = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastHeartbeatRef     = useRef<number>(0);
  const lastProgressRef      = useRef<number>(0);
  const watermarkTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef         = useRef<HTMLDivElement>(null);
  const watermarkRef         = useRef<HTMLDivElement | null>(null);
  const playbackDataRef      = useRef<VideoPlaybackData | null>(null);
  const playbackTokenRef     = useRef<string | null>(null);
  const devtoolsTimerRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleCompleteRef   = useRef<() => void>(() => {});
  const handlePauseRef      = useRef<(r?: PauseReason) => void>(() => {});
  const handleDisplacedRef  = useRef<() => void>(() => {});
  const logEventRef         = useRef<(action: string, pos?: number, meta?: Record<string, unknown>) => void>(() => {});

  // ── Ref syncs ────────────────────────────────────────────────────────────
  useEffect(() => { videoIdRef.current       = videoId; },        [videoId]);
  useEffect(() => { isPlayingRef.current     = isPlaying; },      [isPlaying]);
  useEffect(() => { devCurrentTimeRef.current = devCurrentTime; }, [devCurrentTime]);
  useEffect(() => { sessionRef.current       = watchSessionId; }, [watchSessionId]);
  useEffect(() => { userRef.current          = user; },           [user]);
  useEffect(() => { onProgressSavedRef.current = onProgressSaved; }, [onProgressSaved]);
  useEffect(() => { playbackDataRef.current  = playbackData; },   [playbackData]);

  // ─── Screen Capture API override ──────────────────────────────────────────
  // Overrides navigator.mediaDevices.getDisplayMedia globally while the player is mounted.
  // Chromium-based browsers honour this; Firefox/Safari do not implement the API to block.
  // This runs once on mount and restores the original on unmount.
  useEffect(() => {
    const nav = navigator.mediaDevices as MediaDevices & { getDisplayMedia?: unknown };
    if (!nav || typeof nav.getDisplayMedia !== "function") return;

    const original = nav.getDisplayMedia.bind(nav);
    nav.getDisplayMedia = async () => {
      logEventRef.current("screen_capture_blocked");
      throw new DOMException("Screen capture is not permitted on this page.", "NotAllowedError");
    };

    return () => {
      nav.getDisplayMedia = original;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── DevTools detection ───────────────────────────────────────────────────
  // Probes the difference between outer and inner window dimensions.
  // A gap > 160 px strongly suggests DevTools is open (docked horizontally or vertically).
  // Triggers a pause and logs the event — does NOT prevent the user from opening DevTools.
  // Runs only while the player is in "ready" state to avoid false positives before load.
  useEffect(() => {
    if (status !== "ready") return;

    const THRESHOLD = 160;
    let alreadyDetected = false;

    devtoolsTimerRef.current = setInterval(() => {
      const heightGap = window.outerHeight - window.innerHeight;
      const widthGap  = window.outerWidth  - window.innerWidth;
      const isOpen    = heightGap > THRESHOLD || widthGap > THRESHOLD;

      if (isOpen && !alreadyDetected) {
        alreadyDetected = true;
        logEventRef.current("devtools_detected", Math.floor(devCurrentTimeRef.current));

        if (isPlayingRef.current) {
          handlePauseRef.current("user_pause");
          showFeedback(false, "Redarea a fost oprită: DevTools detectat.");
        }
      }

      if (!isOpen) {
        alreadyDetected = false; // reset so re-open is detected again
      }
    }, 2_000);

    return () => {
      if (devtoolsTimerRef.current) clearInterval(devtoolsTimerRef.current);
    };
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Watermark MutationObserver ───────────────────────────────────────────
  // Watches for watermark removal / hiding from the DOM.
  // If removed: pauses video + logs event.
  // Runs while player is ready and a watch session is active.
  useEffect(() => {
    if (status !== "ready" || !containerRef.current) return;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Detect removal of the watermark node
        if (mutation.type === "childList") {
          for (const removed of mutation.removedNodes) {
            if (
              removed instanceof HTMLElement &&
              (removed.dataset.wm === "1" || removed.querySelector("[data-wm='1']"))
            ) {
              logEventRef.current("watermark_removed", Math.floor(devCurrentTimeRef.current));
              if (isPlayingRef.current) {
                handlePauseRef.current("user_pause");
                showFeedback(false, "Redarea a fost oprită: watermark eliminat.");
              }
              return;
            }
          }
        }
        // Detect style/attribute changes that hide the watermark (display:none, visibility:hidden, opacity:0)
        if (
          mutation.type === "attributes" &&
          mutation.target instanceof HTMLElement &&
          mutation.target.dataset.wm === "1"
        ) {
          const el    = mutation.target;
          const style = window.getComputedStyle(el);
          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            parseFloat(style.opacity) < 0.001
          ) {
            logEventRef.current("watermark_removed", Math.floor(devCurrentTimeRef.current));
            if (isPlayingRef.current) {
              handlePauseRef.current("user_pause");
              showFeedback(false, "Redarea a fost oprită: watermark ascuns.");
            }
          }
        }
      }
    });

    observer.observe(containerRef.current, {
      childList:  true,
      subtree:    true,
      attributes: true,
      attributeFilter: ["style", "class", "hidden"],
    });

    return () => observer.disconnect();
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Watermark positioning + server logging ───────────────────────────────
  // Moves every 25–40 s. Each position change is logged server-side so that
  // if leaked footage is discovered, the frame timestamp can be cross-referenced
  // with the log to identify the account.
  useEffect(() => {
    const schedule = () => {
      const delay = 25_000 + Math.random() * 15_000;
      watermarkTimerRef.current = setTimeout(() => {
        const newPos = { x: 8 + Math.random() * 70, y: 8 + Math.random() * 70 };
        setWatermarkPos(newPos);

        // Log server-side — fire-and-forget.
        if (userRef.current) {
          logEventRef.current("watermark_moved", Math.floor(devCurrentTimeRef.current), {
            x:                newPos.x,
            y:                newPos.y,
            watch_session_id: sessionRef.current,
            timestamp_ms:     Date.now(),
          });
        }

        schedule();
      }, delay);
    };
    schedule();
    return () => {
      if (watermarkTimerRef.current !== null) clearTimeout(watermarkTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Token refresh loop ───────────────────────────────────────────────────
  // Schedules a token refresh at `refresh_at_seconds` (typically 75% of TTL ≈ 90 s).
  // After refreshing, reschedules for the next cycle.
  // Does nothing in dev mode (no real token to refresh).
  const scheduleTokenRefresh = useCallback((pb: VideoPlaybackData) => {
    if (tokenRefreshTimerRef.current) clearTimeout(tokenRefreshTimerRef.current);

    if (pb.type !== "signed" || pb.refresh_at_seconds == null) return;

    const delayMs = pb.refresh_at_seconds * 1_000;

    tokenRefreshTimerRef.current = setTimeout(async () => {
      const sid = sessionRef.current;
      const vid = videoIdRef.current;
      if (sid === null) return;

      try {
        const newPb = await videoPlaybackService.refreshPlaybackToken(vid, sid);
        setPlaybackData(newPb);
        playbackDataRef.current = newPb;
        // Reschedule for the next cycle with the new token's refresh window.
        scheduleTokenRefresh(newPb);
      } catch {
        // Token refresh failed — not fatal; Cloudflare will reject the old token at expiry.
        // Next heartbeat or user action will trigger a new session if needed.
      }
    }, delayMs);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function stopTick() {
    if (tickRef.current !== null) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }

  function showFeedback(ok: boolean, msg: string) {
    setActionFeedback({ ok, msg });
    setTimeout(() => setActionFeedback(null), 4_000);
  }

  // ─── Event logger (fire-and-forget) ─────────────────────────────────────
  const logEvent = useCallback(
    (action: string, positionSeconds?: number, metadata?: Record<string, unknown>) => {
      if (!userRef.current) return;
      videoPlaybackService
        .logEvent(videoIdRef.current, {
          action: action as Parameters<typeof videoPlaybackService.logEvent>[1]["action"],
          position_seconds: positionSeconds !== undefined ? Math.floor(positionSeconds) : undefined,
          metadata,
        })
        .catch(() => {});
    },
    [],
  );

  useEffect(() => { logEventRef.current = logEvent; }, [logEvent]);

  // ─── Tick — 1 s interval while playing ───────────────────────────────────

  function startTick() {
    stopTick();
    lastHeartbeatRef.current = Date.now();
    lastProgressRef.current  = Date.now();

    tickRef.current = setInterval(() => {
      if (!isPlayingRef.current) { stopTick(); return; }

      const dur = durRef.current;
      if (dur <= 0) return;

      const prev    = devCurrentTimeRef.current;
      const newTime = Math.min(prev + 1, dur);
      devCurrentTimeRef.current = newTime;
      setDevCurrentTime(newTime);

      const now = Date.now();

      // Heartbeat every 30 s
      if (now - lastHeartbeatRef.current >= 30_000) {
        lastHeartbeatRef.current = now;
        const sid = sessionRef.current;
        if (sid !== null) {
          watchService
            .heartbeatWatchSession(
              videoIdRef.current,
              sid,
              Math.floor(newTime),
              playbackTokenRef.current ?? undefined,
            )
            .catch((err) => {
              if (
                err instanceof ApiError &&
                err.status === 403 &&
                err.data?.data?.reason === "DISPLACED_BY_NEW_SESSION"
              ) {
                handleDisplacedRef.current();
              }
            });
        }
      }

      // Auto progress save every 12 s
      if (now - lastProgressRef.current >= 12_000) {
        lastProgressRef.current = now;
        videoPlaybackService
          .saveProgress(videoIdRef.current, {
            current_time_seconds: Math.floor(newTime),
            duration_seconds:     dur,
          })
          .then((saved) => {
            setProgress(saved);
            onProgressSavedRef.current?.(saved);
          })
          .catch(() => {});
      }

      if (newTime >= dur && !completedRef.current) {
        handleCompleteRef.current();
      }
    }, 1_000);
  }

  // ─── handleComplete ──────────────────────────────────────────────────────

  const handleComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;

    stopTick();
    setIsPlaying(false);
    isPlayingRef.current = false;
    if (tokenRefreshTimerRef.current) clearTimeout(tokenRefreshTimerRef.current);

    const dur = durRef.current;
    const sid = sessionRef.current;

    if (dur > 0) {
      videoPlaybackService
        .saveProgress(videoIdRef.current, {
          current_time_seconds: dur,
          duration_seconds:     dur,
          is_completed:         true,
        })
        .then((saved) => {
          setProgress(saved);
          onProgressSavedRef.current?.(saved);
        })
        .catch(() => {});
    }

    logEventRef.current("complete", dur);

    if (sid !== null) {
      watchService
        .endWatchSession(videoIdRef.current, sid, {
          endedReason: "completed",
          currentTimeSecs: dur,
          durationSecs:    dur > 0 ? dur : undefined,
        })
        .catch(() => {});
      setWatchSessionId(null);
      sessionRef.current       = null;
      playbackTokenRef.current = null;
    }

    showFeedback(true, `Video finalizat! Progres salvat (100%).`);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { handleCompleteRef.current = handleComplete; }, [handleComplete]);

  // ─── handlePause ─────────────────────────────────────────────────────────

  const handlePause = useCallback((reason: PauseReason = "user_pause") => {
    if (!isPlayingRef.current) return;

    stopTick();
    setIsPlaying(false);
    isPlayingRef.current = false;
    if (tokenRefreshTimerRef.current) clearTimeout(tokenRefreshTimerRef.current);

    const sid         = sessionRef.current;
    const currentTime = Math.floor(devCurrentTimeRef.current);
    const dur         = durRef.current;

    logEventRef.current(
      reason === "visibility_hidden" ? "visibility_hidden" : "pause",
      currentTime,
    );

    if (reason === "visibility_hidden") {
      setVisibilityPaused(true);
      showFeedback(false, "Redarea a fost oprită când ai părăsit pagina.");
    }

    if (dur > 0 && currentTime > 0) {
      videoPlaybackService
        .saveProgress(videoIdRef.current, {
          current_time_seconds: currentTime,
          duration_seconds:     dur,
        })
        .then((saved) => {
          setProgress(saved);
          onProgressSavedRef.current?.(saved);
        })
        .catch(() => {});
    }

    if (sid !== null) {
      const endedReason =
        reason === "user_pause"        ? "paused"       :
        reason === "visibility_hidden" ? "paused"       :
        reason === "video_changed"     ? "video_changed":
        "page_exit";

      watchService
        .endWatchSession(videoIdRef.current, sid, {
          endedReason,
          currentTimeSecs: currentTime,
          durationSecs:    dur > 0 ? dur : undefined,
        })
        .catch(() => {});

      setWatchSessionId(null);
      sessionRef.current       = null;
      playbackTokenRef.current = null;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { handlePauseRef.current = handlePause; }, [handlePause]);

  // ─── handleDisplaced ─────────────────────────────────────────────────────

  const handleDisplaced = useCallback(() => {
    stopTick();
    setIsPlaying(false);
    isPlayingRef.current = false;
    if (tokenRefreshTimerRef.current) clearTimeout(tokenRefreshTimerRef.current);
    setWatchSessionId(null);
    sessionRef.current = null;
    playbackTokenRef.current = null;
    setStatus("session_displaced");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { handleDisplacedRef.current = handleDisplaced; }, [handleDisplaced]);

  // ─── handlePlay ──────────────────────────────────────────────────────────

  const handlePlay = async () => {
    if (isPlayingRef.current) return;

    if (!userRef.current) {
      setStatus("needs_auth_to_play");
      return;
    }

    // Re-entering from displaced state: playback data is still loaded; just reset UI.
    if (status === "session_displaced") {
      setStatus("ready");
    }

    setActionFeedback(null);
    setVisibilityPaused(false);

    if (completedRef.current) {
      completedRef.current = false;
      devCurrentTimeRef.current = 0;
      setDevCurrentTime(0);
    }

    try {
      const res = await watchService.startWatchSession(videoIdRef.current);
      if (!res.success) return;

      const sid   = res.data.watch_session_id;
      const token = res.data.playback_session_token ?? null;
      setWatchSessionId(sid);
      sessionRef.current       = sid;
      playbackTokenRef.current = token;

      // In signed mode, re-fetch the playback token now that we have a watch session.
      // In dev mode this is a no-op since the provider ignores the session.
      const currentPb = playbackDataRef.current;
      if (currentPb && (currentPb.type === "requires_watch_session" || currentPb.type === "signed")) {
        try {
          const pb = await videoPlaybackService.getVideoPlayback(videoIdRef.current, {
            watchSessionId: sid,
          });
          setPlaybackData(pb.data.playback);
          playbackDataRef.current = pb.data.playback;
          scheduleTokenRefresh(pb.data.playback);
        } catch {
          // Non-fatal — proceed in dev mode
        }
      } else if (currentPb) {
        // Dev mode: schedule no-op refresh (type !== 'signed')
        scheduleTokenRefresh(currentPb);
      }

      setIsPlaying(true);
      isPlayingRef.current = true;
      startTick();

      logEventRef.current("play", Math.floor(devCurrentTimeRef.current));
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setStatus("conflict");
      } else {
        showFeedback(
          false,
          err instanceof ApiError ? (err.data?.message ?? "Eroare la pornire") : "Eroare de rețea",
        );
      }
    }
  };

  // ─── handleSeek ──────────────────────────────────────────────────────────

  const handleSeek = (newTime: number) => {
    devCurrentTimeRef.current = newTime;
    setDevCurrentTime(newTime);
    logEventRef.current("seek", newTime, {
      watch_session_id: sessionRef.current,
    });
  };

  // ─── Manual debug helpers ─────────────────────────────────────────────────

  const handleManualHeartbeat = async () => {
    const sid = sessionRef.current;
    if (sid === null) { showFeedback(false, "Nicio sesiune activă."); return; }
    try {
      await watchService.heartbeatWatchSession(
        videoIdRef.current, sid, Math.floor(devCurrentTimeRef.current),
      );
      showFeedback(true, `Heartbeat: ${formatSeconds(Math.floor(devCurrentTimeRef.current))}`);
    } catch (err) {
      showFeedback(false, err instanceof ApiError ? (err.data?.message ?? "Eroare") : "Eroare");
    }
  };

  const handleManualSaveProgress = async () => {
    const dur = durRef.current;
    if (!dur) { showFeedback(false, "Durata nu este disponibilă."); return; }
    setSaving(true);
    try {
      const newTime = Math.min(devCurrentTimeRef.current + 30, dur);
      devCurrentTimeRef.current = newTime;
      setDevCurrentTime(newTime);
      const saved = await videoPlaybackService.saveProgress(videoIdRef.current, {
        current_time_seconds: newTime,
        duration_seconds:     dur,
      });
      setProgress(saved);
      onProgressSavedRef.current?.(saved);
      showFeedback(
        true,
        `Progres salvat: ${formatSeconds(newTime)} / ${formatSeconds(dur)} (${saved.progress_percent.toFixed(1)}%)`,
      );
    } catch (err) {
      showFeedback(false, err instanceof ApiError ? (err.data?.message ?? "Eroare") : "Eroare");
    } finally {
      setSaving(false);
    }
  };

  // ─── Fetch playback data ──────────────────────────────────────────────────

  const fetchPlayback = useCallback(async () => {
    if (isLocked) { setStatus("no_access"); return; }

    if (isPlayingRef.current) {
      handlePauseRef.current("video_changed");
    }

    setStatus("loading");
    setErrorMessage(null);
    setIsPlaying(false);
    setVisibilityPaused(false);
    completedRef.current = false;
    if (tokenRefreshTimerRef.current) clearTimeout(tokenRefreshTimerRef.current);

    try {
      const res = await videoPlaybackService.getVideoPlayback(videoId);

      setVideoMeta(res.data.video);
      setPlaybackData(res.data.playback);
      playbackDataRef.current = res.data.playback;
      setAccessInfo(res.data.access);
      setProgress(res.data.progress);

      const initialTime = res.data.progress?.last_position_seconds ?? 0;
      setDevCurrentTime(initialTime);
      devCurrentTimeRef.current = initialTime;

      durRef.current = res.data.video.duration_seconds ?? durationSeconds ?? 0;

      setStatus("ready");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401)      setStatus("needs_auth");
        else if (err.status === 403) setStatus("no_access");
        else {
          setStatus("error");
          setErrorMessage(err.data?.message ?? "Eroare la încărcarea videoclipului.");
        }
      } else {
        setStatus("error");
        setErrorMessage("Eroare de rețea. Încearcă din nou.");
      }
    }
  }, [videoId, isLocked]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchPlayback(); }, [videoId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (durRef.current === 0 && durationSeconds) {
      durRef.current = durationSeconds;
    }
  }, [durationSeconds]);

  // ─── Picture-in-Picture disable ──────────────────────────────────────────
  // Sets disablePictureInPicture on any <video> element inside the container
  // and blocks the enterpictureinpicture event. Re-runs whenever the player
  // content changes (status changes mean new DOM).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const applyPiPBlock = () => {
      container.querySelectorAll("video").forEach((v) => {
        v.disablePictureInPicture = true;
        v.addEventListener("enterpictureinpicture", (e) => {
          e.preventDefault();
          logEventRef.current("pip_blocked", Math.floor(devCurrentTimeRef.current));
        }, { once: true });
      });
    };

    applyPiPBlock();
    // Re-apply when child DOM changes (e.g., HLS.js adds a <video> element later)
    const pipObserver = new MutationObserver(applyPiPBlock);
    pipObserver.observe(container, { childList: true, subtree: true });
    return () => pipObserver.disconnect();
  }, [status]);

  // ─── Tab/window visibility protection ────────────────────────────────────
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden" && isPlayingRef.current) {
        handlePauseRef.current("visibility_hidden");
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  // ─── Keyboard shortcut protection ────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isPlayingRef.current) return;

      const isBlocked =
        e.key === "F12" ||
        (e.ctrlKey && !e.shiftKey && ["s", "u", "S", "U"].includes(e.key)) ||
        (e.ctrlKey && e.shiftKey  && ["i", "I", "j", "J", "c", "C"].includes(e.key));

      if (isBlocked) {
        e.preventDefault();
        logEventRef.current("shortcut_blocked", undefined, { key: e.key });
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // ─── Unmount cleanup ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (watermarkTimerRef.current)    clearTimeout(watermarkTimerRef.current);
      if (tokenRefreshTimerRef.current) clearTimeout(tokenRefreshTimerRef.current);
      if (devtoolsTimerRef.current)     clearInterval(devtoolsTimerRef.current);
      stopTick();

      const sid = sessionRef.current;
      const vid = videoIdRef.current;
      const cur = Math.floor(devCurrentTimeRef.current);
      const dur = durRef.current;

      if (isPlayingRef.current && dur > 0 && cur > 0) {
        videoPlaybackService
          .saveProgress(vid, { current_time_seconds: cur, duration_seconds: dur })
          .catch(() => {});
      }

      if (sid !== null) {
        watchService
          .endWatchSession(vid, sid, { endedReason: "page_exit", currentTimeSecs: cur })
          .catch(() => {});
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Context menu / drag protection ─────────────────────────────────────

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    logEventRef.current("right_click_blocked", Math.floor(devCurrentTimeRef.current));
  };

  // ─── Pre-ready renders ───────────────────────────────────────────────────

  if (status === "idle" || status === "loading") {
    return (
      <div className="aspect-video w-full bg-[#09090c] rounded-2xl border border-white/5 flex items-center justify-center">
        <LogoLoader size={96} minHeight={0} />
      </div>
    );
  }

  if (status === "needs_auth") {
    return (
      <div className="aspect-video w-full bg-[#09090c] rounded-2xl border border-white/5 flex flex-col items-center justify-center gap-5 p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-nma-purple/10 border border-nma-purple/20 flex items-center justify-center">
          <LogIn className="w-7 h-7 text-nma-purple" />
        </div>
        <div>
          <p className="text-white font-bold text-base mb-1">Autentificare necesară</p>
          <p className="text-gray-400 text-sm">Trebuie să fii autentificat pentru a viziona acest videoclip.</p>
        </div>
        <NmaGlassButton asChild glow="purple" className="px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
          <Link to="/login"><LogIn className="w-4 h-4" /> Autentifică-te</Link>
        </NmaGlassButton>
      </div>
    );
  }

  if (status === "needs_auth_to_play") {
    return (
      <div className="aspect-video w-full bg-[#09090c] rounded-2xl border border-white/5 flex flex-col items-center justify-center gap-5 p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-nma-purple/10 border border-nma-purple/20 flex items-center justify-center">
          <LogIn className="w-7 h-7 text-nma-purple" />
        </div>
        <div>
          <p className="text-white font-bold text-base mb-1">Cont necesar</p>
          <p className="text-gray-400 text-sm max-w-xs">
            Ai nevoie de un cont pentru a viziona preview-urile gratuite.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <NmaGlassButton asChild glow="purple" className="px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
            <Link to="/login"><LogIn className="w-4 h-4" /> Autentifică-te</Link>
          </NmaGlassButton>
          <NmaGlassButton asChild glow="neutral" className="px-6 py-2.5 rounded-xl font-bold text-sm transition-all">
            <Link to="/register">Creează cont gratuit</Link>
          </NmaGlassButton>
        </div>
      </div>
    );
  }

  if (status === "no_access") {
    return (
      <div className="aspect-video w-full bg-[#09090c] rounded-2xl border border-white/5 flex flex-col items-center justify-center gap-5 p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
          <Lock className="w-7 h-7 text-yellow-400" />
        </div>
        <div>
          <p className="text-white font-bold text-base mb-1">{title}</p>
          <p className="text-gray-400 text-sm">Acest videoclip face parte din conținutul plătit al cursului.</p>
        </div>
        <NmaGlassButton asChild glow="purple" className="px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
          <Link to={courseSlug ? `/checkout/${courseSlug}` : "/"}>
            <ShoppingCart className="w-4 h-4" /> Deblochează Cursul
          </Link>
        </NmaGlassButton>
      </div>
    );
  }

  if (status === "conflict") {
    return (
      <div className="aspect-video w-full bg-[#09090c] rounded-2xl border border-red-500/20 flex flex-col items-center justify-center gap-5 p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <WifiOff className="w-7 h-7 text-red-400" />
        </div>
        <div>
          <p className="text-white font-bold text-base mb-1">Dispozitiv activ detectat</p>
          <p className="text-gray-400 text-sm">
            Acest cont vizionează deja un videoclip pe alt dispozitiv.
            <br />
            Oprește redarea pe celălalt dispozitiv, apoi încearcă din nou.
          </p>
        </div>
        <NmaGlassButton glow="danger" onClick={fetchPlayback} className="px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
          <RotateCcw className="w-4 h-4" /> Încearcă din nou
        </NmaGlassButton>
      </div>
    );
  }

  if (status === "session_displaced") {
    const today  = new Date().toISOString().slice(0, 10);
    const wmText = user
      ? `${user.name} · ${user.email} · ${today} · #–`
      : "NMA Academy Preview";

    return (
      <div
        ref={containerRef}
        className="w-full space-y-3 select-none"
        style={{ WebkitUserSelect: "none" } as React.CSSProperties}
        onContextMenu={handleContextMenu}
        onDragStart={(e) => e.preventDefault()}
      >
        <div className="aspect-video w-full bg-[#09090c] rounded-2xl border border-red-500/30 flex flex-col items-center justify-center gap-5 p-8 text-center relative">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <WifiOff className="w-7 h-7 text-red-400" />
          </div>
          <div>
            <p className="text-white font-bold text-base mb-1">Sesiune preluată de alt dispozitiv</p>
            <p className="text-gray-400 text-sm max-w-xs">
              Contul tău a început redarea pe un alt dispozitiv.
              <br />
              Redarea a fost oprită pe acest dispozitiv.
            </p>
          </div>
          <NmaGlassButton glow="danger" onClick={handlePlay} className="px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
            <Play className="w-4 h-4" /> Reia pe acest dispozitiv
          </NmaGlassButton>
          <WatermarkOverlay text={wmText} pos={watermarkPos} watermarkRef={watermarkRef} />
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="aspect-video w-full bg-[#09090c] rounded-2xl border border-white/5 flex flex-col items-center justify-center gap-5 p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-red-400" />
        </div>
        <div>
          <p className="text-white font-bold text-base mb-1">Eroare la încărcare</p>
          <p className="text-gray-400 text-sm">{errorMessage ?? "Eroare necunoscută"}</p>
        </div>
        <NmaGlassButton glow="neutral" onClick={fetchPlayback} className="px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
          <RotateCcw className="w-4 h-4" /> Reîncarcă
        </NmaGlassButton>
      </div>
    );
  }

  // ─── status === 'ready' ──────────────────────────────────────────────────

  const meta      = videoMeta!;
  const pb        = playbackData!;
  const acc       = accessInfo!;
  const dur       = durRef.current;
  const isDevMode = pb.type === "development";

  // Watermark text: name + email + date + session ID — uniquely identifies the account and session.
  const today   = new Date().toISOString().slice(0, 10);
  const wmText  = user
    ? `${user.name} · ${user.email} · ${today} · #${watchSessionId ?? "–"}`
    : "NMA Academy Preview";

  return (
    <div
      ref={containerRef}
      className="w-full space-y-3 select-none"
      style={{ WebkitUserSelect: "none" } as React.CSSProperties}
      onContextMenu={handleContextMenu}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* ── Player box with watermark overlay ──────────────────────────── */}
      {isDevMode ? (
        <div className="relative">
          <DevPlaceholder
            meta={meta}
            duration={dur}
            progress={progress}
            isPlaying={isPlaying}
            watchSessionId={watchSessionId}
            devCurrentTime={devCurrentTime}
            onPlay={handlePlay}
            onPause={() => handlePause("user_pause")}
            onSeek={handleSeek}
            onManualHeartbeat={handleManualHeartbeat}
            onManualSaveProgress={handleManualSaveProgress}
            saving={saving}
            actionFeedback={actionFeedback}
            visibilityPaused={visibilityPaused}
          />
          <WatermarkOverlay text={wmText} pos={watermarkPos} watermarkRef={watermarkRef} />
        </div>
      ) : pb.url !== null ? (
        pb.url.endsWith(".m3u8") ? (
          // Signed HLS — HLS.js integration pending
          <div className="aspect-video w-full bg-black rounded-2xl border border-white/5 relative flex flex-col items-center justify-center gap-4 p-8 text-center">
            <Terminal className="w-10 h-10 text-nma-purple opacity-60" />
            <div>
              <p className="text-white font-semibold mb-1">Player HLS</p>
              <p className="text-gray-400 text-sm">Token semnat disponibil. HLS.js va fi integrat în faza următoare.</p>
            </div>
            {pb.expires_at && (
              <p className="text-xs text-gray-600 font-mono">
                Expiră: {new Date(pb.expires_at).toLocaleTimeString("ro")}
              </p>
            )}
            <WatermarkOverlay text={wmText} pos={watermarkPos} watermarkRef={watermarkRef} />
          </div>
        ) : (
          // iframe embed
          <div className="aspect-video w-full rounded-2xl overflow-hidden border border-white/5 relative">
            <iframe
              src={pb.url}
              allow="accelerometer; gyroscope; autoplay; encrypted-media"
              className="w-full h-full border-0"
              title={meta.title}
              // picture-in-picture intentionally omitted from allow attribute
            />
            <WatermarkOverlay text={wmText} pos={watermarkPos} watermarkRef={watermarkRef} />
          </div>
        )
      ) : pb.type === "requires_watch_session" ? (
        // Signed provider configured but no watch session yet — show play button
        <div className="aspect-video w-full bg-[#09090c] rounded-2xl border border-white/5 relative flex flex-col items-center justify-center gap-4 p-8 text-center">
          <NmaGlassButton
            glow="purple"
            onClick={handlePlay}
            className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-base"
          >
            <Play className="w-5 h-5" /> Redă
          </NmaGlassButton>
          {actionFeedback && (
            <p className={`text-xs font-mono ${actionFeedback.ok ? "text-green-400" : "text-red-400"}`}>
              {actionFeedback.ok ? "✓" : "✗"} {actionFeedback.msg}
            </p>
          )}
        </div>
      ) : (
        <div className="aspect-video w-full bg-[#09090c] rounded-2xl border border-white/5 flex items-center justify-center">
          <p className="text-gray-500 text-sm">URL de redare indisponibil.</p>
        </div>
      )}

      {/* ── Metadata strip ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 text-[0.68rem] text-gray-600">
        {acc.is_free_preview && (
          <span className="px-2 py-0.5 bg-nma-purple/10 text-nma-purple-light border border-nma-purple/20 rounded-full font-semibold uppercase tracking-wider">
            Preview Gratuit
          </span>
        )}
        {acc.user_has_course_access && (
          <span className="flex items-center gap-1 text-green-500/80">
            <CheckCircle2 className="w-3 h-3" /> Acces activ
          </span>
        )}
        {pb.expires_at && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Expiră: {new Date(pb.expires_at).toLocaleTimeString("ro")}
          </span>
        )}
        {isDevMode && (
          <span className="flex items-center gap-1 text-amber-500/60">
            <Code2 className="w-3 h-3" /> development
          </span>
        )}
      </div>
    </div>
  );
}
