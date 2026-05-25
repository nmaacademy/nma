import React from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  CheckCircle2,
  Circle,
  Play,
  BookOpen,
  AlertTriangle,
  Clock,
  Menu,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "../../lib/utils";
import { courseService } from "../../services/courseService";
import { Course, Lesson } from "../../types";
import ProtectedVideoPlayer from "../../components/ProtectedVideoPlayer";
import { VideoPlaybackProgress } from "../../services/videoPlaybackService";
import Aurora from "../../components/ui/Aurora";
import LogoLoader from "../../components/ui/LogoLoader";
import GlassSurface from "../../components/ui/GlassSurface";
import { NmaLogo } from "../../components/ui/nma-logo";
import { NmaGlassButton } from "../../components/ui/nma-glass";
import CourseMembers from "./CourseMembers";
import CourseCommunity from "./CourseCommunity";
import CourseAnnouncements from "./CourseAnnouncements";
import CourseLeaderboard from "./CourseLeaderboard";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = "lectii" | "membri" | "comunitate" | "anunturi" | "leaderboard";

interface TabDef {
  id: TabId;
  label: string;
  implemented: boolean;
  placeholder?: string;
}

const TABS: TabDef[] = [
  { id: "lectii",      label: "Lecții",      implemented: true },
  { id: "membri",      label: "Membri",      implemented: true },
  { id: "comunitate",  label: "Comunitate",  implemented: true },
  { id: "anunturi",    label: "Anunțuri",    implemented: true },
  { id: "leaderboard", label: "Leaderboard", implemented: true },
];

const COURSE_AURORA_COLORS: [string, string, string] = ["#3b0764", "#7C3AED", "#d9d8f1"];

const TAB_GLASS = {
  borderRadius: 24,
  backgroundOpacity: 0.08,
  saturation: 1.28,
  borderWidth: 0.036,
  brightness: 64,
  opacity: 0.9,
  blur: 11,
  displace: 0.12,
  distortionScale: -58,
  redOffset: 0,
  greenOffset: 0,
  blueOffset: 0,
};

const MOBILE_TAB_GLASS = {
  borderRadius: 18,
  backgroundOpacity: 0.12,
  saturation: 1.7,
  borderWidth: 0.08,
  brightness: 68,
  opacity: 0.72,
  blur: 16,
  displace: 0.06,
  distortionScale: -49,
  redOffset: 1,
  greenOffset: 2.4,
  blueOffset: 4.8,
};

const TAB_SLIDER_TRANSITION = {
  type: "spring" as const,
  stiffness: 365,
  damping: 39,
  mass: 0.82,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSeconds(s: number): string {
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

function TabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId;
  onTabChange: (t: TabId) => void;
}) {
  const tabsTrackRef = React.useRef<HTMLDivElement | null>(null);
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const [pill, setPill] = React.useState({ left: 0, width: 0 });
  const [pillReady, setPillReady] = React.useState(false);
  const dragBounds = React.useMemo(() => {
    const tabsTrack = tabsTrackRef.current;
    if (!tabsTrack || !pillReady) return { left: 0, right: 0 };

    return {
      left: 0 - pill.left,
      right: tabsTrack.scrollWidth - pill.left - pill.width,
    };
  }, [pill.left, pill.width, pillReady]);

  const snapToClosestTab = React.useCallback(
    (dragOffsetX: number) => {
      const draggedCenter = pill.left + dragOffsetX + pill.width / 2;
      const closest = TABS.reduce(
        (best, tab, index) => {
          const btn = tabRefs.current[index];
          if (!btn) return best;

          const center = btn.offsetLeft + btn.offsetWidth / 2;
          const distance = Math.abs(center - draggedCenter);
          return distance < best.distance ? { tab, distance } : best;
        },
        { tab: TABS[0], distance: Number.POSITIVE_INFINITY },
      );

      onTabChange(closest.tab.id);
    },
    [onTabChange, pill.left, pill.width],
  );

  const updatePill = React.useCallback(() => {
    const idx = TABS.findIndex((t) => t.id === activeTab);
    const btn = tabRefs.current[idx];
    if (!btn) return;

    setPill({ left: btn.offsetLeft, width: btn.offsetWidth });
    setPillReady(true);
  }, [activeTab]);

  React.useLayoutEffect(() => {
    updatePill();
  }, [updatePill]);

  React.useEffect(() => {
    const tabsTrack = tabsTrackRef.current;
    if (!tabsTrack) return;

    const resizeObserver = new ResizeObserver(updatePill);
    resizeObserver.observe(tabsTrack);
    tabRefs.current.forEach((tab) => tab && resizeObserver.observe(tab));

    return () => resizeObserver.disconnect();
  }, [updatePill]);

  React.useEffect(() => {
    const idx = TABS.findIndex((t) => t.id === activeTab);
    tabRefs.current[idx]?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [activeTab]);

  return (
    <nav className="relative grid shrink-0 grid-cols-[1fr_auto_1fr] items-center bg-[#030305]/95 backdrop-blur-md border-b border-white/[0.06] px-4 py-3 shadow-[0_1px_0_rgba(139,92,246,0.1),0_4px_20px_rgba(0,0,0,0.4)] max-md:hidden">
      <Link
        to="/dashboard"
        className="relative z-30 inline-flex shrink-0 items-center justify-self-start gap-2 rounded-xl border border-red-400/35 bg-red-500/15 px-4 py-3 text-[0.82rem] font-bold uppercase tracking-[0.08em] text-red-100 shadow-[0_0_20px_rgba(239,68,68,0.2),inset_0_1px_0_rgba(255,255,255,0.16)] transition hover:border-red-300/55 hover:bg-red-500/22 hover:text-white hover:shadow-[0_0_28px_rgba(239,68,68,0.28),inset_0_1px_0_rgba(255,255,255,0.2)] max-md:hidden"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M14.5 5.5L8 12l6.5 6.5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Înapoi la cont
      </Link>

      <div className="relative col-start-2 flex min-w-0 justify-center overflow-visible -translate-x-72 max-xl:-translate-x-56 max-lg:-translate-x-36 max-md:flex-1 max-md:translate-x-0">
        <div
          ref={tabsTrackRef}
          className="relative flex max-w-full items-center justify-center gap-2 overflow-visible max-md:justify-start max-md:overflow-x-auto max-md:no-scrollbar"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {pillReady && (
            <motion.div
              className="absolute top-0 bottom-0 z-20 cursor-grab rounded-[1.5rem] active:cursor-grabbing"
              initial={false}
              animate={{ left: pill.left, width: pill.width }}
              transition={TAB_SLIDER_TRANSITION}
              drag="x"
              dragConstraints={dragBounds}
              dragElastic={0.04}
              dragMomentum={false}
              dragSnapToOrigin
              onDragEnd={(_, info) => snapToClosestTab(info.offset.x)}
            >
              <span className="pointer-events-none absolute -inset-x-4 -inset-y-3 rounded-[1.75rem] bg-nma-purple/35 blur-2xl" />
              <GlassSurface
                width="100%"
                height="100%"
                borderRadius={TAB_GLASS.borderRadius}
                backgroundOpacity={TAB_GLASS.backgroundOpacity}
                saturation={TAB_GLASS.saturation}
                borderWidth={TAB_GLASS.borderWidth}
                brightness={TAB_GLASS.brightness}
                opacity={TAB_GLASS.opacity}
                blur={TAB_GLASS.blur}
                displace={TAB_GLASS.displace}
                distortionScale={TAB_GLASS.distortionScale}
                redOffset={TAB_GLASS.redOffset}
                greenOffset={TAB_GLASS.greenOffset}
                blueOffset={TAB_GLASS.blueOffset}
                className="navbar-glass-surface pointer-events-none"
                style={{
                  backgroundColor: "rgba(139, 92, 246, 0.06)",
                  border: "1px solid rgba(216, 204, 255, 0.38)",
                  boxShadow:
                    "0 0 30px rgba(139, 92, 246, 0.42), 0 0 68px rgba(139, 92, 246, 0.18), inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -1px 0 rgba(255,255,255,0.12)",
                }}
              />
            </motion.div>
          )}

          {TABS.map((tab, index) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => { tabRefs.current[index] = el; }}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "relative z-10 shrink-0 px-5 py-3 text-[0.95rem] font-bold transition-colors duration-200 whitespace-nowrap rounded-full uppercase tracking-[0.08em]",
                  isActive
                    ? "text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.85)]"
                    : tab.implemented
                    ? "text-nma-silver-dark/70 hover:text-white"
                    : "text-nma-silver-dark/30 cursor-pointer hover:text-nma-silver-dark/50",
                )}
              >
                {tab.label}
                {!tab.implemented && (
                  <span className="ml-1.5 text-[0.5rem] font-bold uppercase tracking-widest text-nma-purple/40 align-middle">
                    soon
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

// ─── Coming-soon placeholder ──────────────────────────────────────────────────

function CourseMobileNavbar({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const navRef = React.useRef<HTMLElement | null>(null);
  const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const [pill, setPill] = React.useState({ top: 0, height: 0 });
  const [pillReady, setPillReady] = React.useState(false);
  const activeIndex = TABS.findIndex((tab) => tab.id === activeTab);

  const updatePill = React.useCallback(() => {
    const activeItem = itemRefs.current[activeIndex];
    if (!activeItem) return;

    setPill({ top: activeItem.offsetTop, height: activeItem.offsetHeight });
    setPillReady(true);
  }, [activeIndex]);

  React.useLayoutEffect(() => {
    if (mobileMenuOpen) updatePill();
  }, [mobileMenuOpen, updatePill]);

  React.useEffect(() => {
    if (!mobileMenuOpen || !navRef.current) return;

    const resizeObserver = new ResizeObserver(updatePill);
    resizeObserver.observe(navRef.current);
    itemRefs.current.forEach((item) => item && resizeObserver.observe(item));

    return () => resizeObserver.disconnect();
  }, [mobileMenuOpen, updatePill]);

  const handleTabSelect = (tab: TabId) => {
    onTabChange(tab);
    setMobileMenuOpen(false);
  };

  return (
    <div className="shrink-0 md:hidden">
      <header className="relative z-40 flex h-16 items-center justify-between border-b border-white/[0.06] bg-[#050506]/90 px-4 backdrop-blur-md shadow-[0_1px_0_rgba(139,92,246,0.08),0_10px_30px_rgba(0,0,0,0.35)]">
        <NmaGlassButton
          glow="neutral"
          size="icon"
          className="h-10 w-10 rounded-xl"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Deschide meniul contului"
        >
          <Menu className="h-5 w-5" />
        </NmaGlassButton>

        <Link
          to="/dashboard"
          className="absolute left-1/2 flex -translate-x-1/2 items-center gap-2"
        >
          <NmaLogo imageClassName="w-14 opacity-95" />
          <span className="font-bold tracking-[0.1em] text-[0.78rem] text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.9)]">
            ACADEMY
          </span>
        </Link>

        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-gradient-to-br from-nma-purple to-nma-purple-dark text-sm font-bold text-white shadow-[0_0_22px_rgba(139,92,246,0.25)]">
          A
        </div>
      </header>

      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 flex w-[80%] max-w-[20rem] flex-col border-r border-white/10 bg-[#050506] shadow-[0_0_50px_rgba(139,92,246,0.15)] md:hidden"
            >
              <div className="flex h-20 items-center justify-between border-b border-white/5 px-6">
                <Link
                  to="/dashboard"
                  className="flex items-center gap-3"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <NmaLogo imageClassName="w-14 opacity-95" />
                  <span className="font-bold tracking-[0.1em] text-[0.75rem] text-white">
                    ACADEMY
                  </span>
                </Link>
                <NmaGlassButton
                  glow="neutral"
                  size="icon"
                  onClick={() => setMobileMenuOpen(false)}
                  className="h-10 w-10 rounded-full"
                  aria-label="Inchide meniul contului"
                >
                  <X className="h-5 w-5" />
                </NmaGlassButton>
              </div>

              <nav ref={navRef} className="relative flex-1 space-y-2 overflow-y-auto px-4 py-8">
                {pillReady && activeIndex >= 0 && (
                  <motion.div
                    className="absolute left-4 right-4 z-20 rounded-2xl"
                    initial={false}
                    animate={{ top: pill.top, height: pill.height }}
                    transition={TAB_SLIDER_TRANSITION}
                  >
                    <span className="pointer-events-none absolute -inset-2 rounded-[1.35rem] bg-nma-purple/24 blur-xl" />
                    <GlassSurface
                      width="100%"
                      height="100%"
                      borderRadius={MOBILE_TAB_GLASS.borderRadius}
                      backgroundOpacity={MOBILE_TAB_GLASS.backgroundOpacity}
                      saturation={MOBILE_TAB_GLASS.saturation}
                      borderWidth={MOBILE_TAB_GLASS.borderWidth}
                      brightness={MOBILE_TAB_GLASS.brightness}
                      opacity={MOBILE_TAB_GLASS.opacity}
                      blur={MOBILE_TAB_GLASS.blur}
                      displace={MOBILE_TAB_GLASS.displace}
                      distortionScale={MOBILE_TAB_GLASS.distortionScale}
                      redOffset={MOBILE_TAB_GLASS.redOffset}
                      greenOffset={MOBILE_TAB_GLASS.greenOffset}
                      blueOffset={MOBILE_TAB_GLASS.blueOffset}
                      className="navbar-glass-surface pointer-events-none rounded-2xl"
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.025)",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        boxShadow:
                          "inset 0 1px 0 rgba(255,255,255,0.34), inset 0 -10px 22px rgba(255,255,255,0.08), 0 18px 45px rgba(0,0,0,0.32), 0 0 28px rgba(139,92,246,0.18)",
                      }}
                    />
                  </motion.div>
                )}

                {TABS.map((tab, index) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      ref={(el) => {
                        itemRefs.current[index] = el;
                      }}
                      type="button"
                      onClick={() => handleTabSelect(tab.id)}
                      className={cn(
                        "relative z-30 flex w-full items-center rounded-xl border border-transparent px-4 py-4 text-left text-sm font-bold uppercase tracking-[0.08em] transition-all",
                        isActive
                          ? "text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.85)]"
                          : "text-nma-silver-dark hover:bg-white/5 hover:text-white",
                      )}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </nav>

              <div className="border-t border-white/5 p-4 pb-8">
                <NmaGlassButton
                  asChild
                  glow="green"
                  className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-4 text-sm font-bold uppercase tracking-[0.08em]"
                  contentClassName="justify-center"
                >
                  <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                    <ChevronLeft className="h-5 w-5" />
                    Inapoi la cont
                  </Link>
                </NmaGlassButton>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function ComingSoon({ message }: { message: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
        <Clock className="w-6 h-6 text-nma-silver-dark/40" />
      </div>
      <div>
        <p className="text-white font-semibold mb-1">În curând</p>
        <p className="text-nma-silver-dark/60 text-sm max-w-xs">{message}</p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CoursePlayer() {
  const { slug } = useParams<{ slug: string }>();

  const [searchParams, setSearchParams] = useSearchParams();

  // Derive active tab from query param; default to "lectii"
  const rawTab  = searchParams.get("tab") as TabId | null;
  const activeTab: TabId = TABS.some((t) => t.id === rawTab) ? rawTab! : "lectii";

  const setTab = React.useCallback(
    (tab: TabId) => {
      setSearchParams(tab === "lectii" ? {} : { tab }, { replace: false });
    },
    [setSearchParams],
  );

  // Course data (always loaded — needed for title, sidebar, progress counter)
  const [course, setCourse]             = React.useState<Course | null>(null);
  const [activeLesson, setActiveLesson] = React.useState<Lesson | null>(null);
  const [loading, setLoading]           = React.useState(true);
  const [apiError, setApiError]         = React.useState(false);
  const [completedIds, setCompletedIds] = React.useState<Set<string>>(new Set());
  const [resumePositions, setResumePositions] = React.useState<Map<string, number>>(new Map());

  React.useEffect(() => {
    async function load() {
      setLoading(true);
      setApiError(false);
      if (!slug) { setLoading(false); return; }

      try {
        const c = await courseService.getCourseDetailForUser(slug);
        if (c) {
          setCourse(c);

          const initCompleted = new Set<string>();
          const initResume    = new Map<string, number>();
          for (const mod of c.modules ?? []) {
            for (const lesson of mod.lessons) {
              if (lesson.is_completed) initCompleted.add(lesson.lesson_id);
              if ((lesson.last_position_seconds ?? 0) > 0) {
                initResume.set(lesson.lesson_id, lesson.last_position_seconds!);
              }
            }
          }
          setCompletedIds(initCompleted);
          setResumePositions(initResume);

          const allSorted = (c.modules ?? [])
            .slice().sort((a, b) => a.order - b.order)
            .flatMap((m) => m.lessons.slice().sort((a, b) => a.order - b.order));
          const firstIncomplete = allSorted.find((l) => l.video_id !== undefined && !l.is_completed);
          const firstPlayable   = allSorted.find((l) => l.video_id !== undefined);
          setActiveLesson(firstIncomplete ?? firstPlayable ?? null);
        } else {
          setApiError(true);
        }
      } catch {
        setApiError(true);
      }
      setLoading(false);
    }
    load();
  }, [slug]);

  const handleProgressSaved = React.useCallback(
    (progress: VideoPlaybackProgress, lesson: Lesson) => {
      if (progress.is_completed) {
        setCompletedIds((prev) => new Set(prev).add(lesson.lesson_id));
      }
      if (progress.last_position_seconds > 0) {
        setResumePositions((prev) => new Map(prev).set(lesson.lesson_id, progress.last_position_seconds));
      }
    },
    [],
  );

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-[100dvh] bg-[#020202] flex items-center justify-center">
        <LogoLoader minHeight={0} />
      </div>
    );
  }

  // ── Error / not found ──────────────────────────────────────────────────────

  if (!course || apiError) {
    return (
      <div className="h-[100dvh] bg-[#020202] flex flex-col items-center justify-center gap-5 text-center p-6">
        <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          {apiError ? (
            <AlertTriangle className="w-7 h-7 text-red-400" />
          ) : (
            <BookOpen className="w-7 h-7 text-nma-silver-dark/40" />
          )}
        </div>
        <div>
          <p className="text-white font-bold text-lg mb-1">
            {apiError ? "Eroare la încărcarea cursului" : "Cursul nu a fost găsit"}
          </p>
          <p className="text-nma-silver-dark/60 text-sm">
            {apiError
              ? "A apărut o eroare de rețea. Verifică conexiunea și încearcă din nou."
              : "Cursul pe care îl cauți nu există sau nu este disponibil."}
          </p>
        </div>
        <Link
          to="/dashboard/courses"
          className="flex items-center gap-2 text-nma-purple hover:text-white transition-colors text-sm font-medium"
        >
          <ChevronLeft className="w-4 h-4" /> Înapoi la cursuri
        </Link>
      </div>
    );
  }

  const sortedModules   = (course.modules ?? []).slice().sort((a, b) => a.order - b.order);
  const allLessons      = sortedModules.flatMap((m) => m.lessons);
  const videoLessons    = allLessons.filter((l) => l.video_id !== undefined);
  const completedCount  = completedIds.size;
  const totalVideoCount = videoLessons.length;
  const progressPct     = totalVideoCount > 0
    ? Math.round((completedCount / totalVideoCount) * 100)
    : 0;

  const activeResumePos = activeLesson
    ? (resumePositions.get(activeLesson.lesson_id) ?? 0)
    : 0;

  // ── Tab placeholder content ────────────────────────────────────────────────

  const currentTab = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="relative h-[100dvh] flex flex-col bg-[#020202] text-white overflow-hidden">
      <div className="pointer-events-none absolute inset-0 z-0 opacity-80">
        <Aurora
          colorStops={COURSE_AURORA_COLORS}
          blend={0.45}
          amplitude={1.0}
          speed={0.5}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[#020202]/35" />

      <div className="relative z-10 flex h-full min-h-0 flex-col">
        <CourseMobileNavbar activeTab={activeTab} onTabChange={setTab} />

      {/* ── Tab navigation ──────────────────────────────────────────────────── */}
      <TabBar activeTab={activeTab} onTabChange={setTab} />

      {/* ── Tab content ─────────────────────────────────────────────────────── */}

      {activeTab === "lectii" ? (
        /* ── Lecții: existing two-panel video + sidebar layout ──────────────── */
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">

          {/* Main video area — flex-1 so it takes all remaining space above the sidebar on mobile */}
          <div className="flex-1 min-h-0 flex flex-col relative w-full overflow-hidden">

            {/* Header */}
            <header className="absolute top-0 left-0 right-0 p-4 md:p-6 z-20 flex items-center justify-end bg-gradient-to-b from-black/80 to-transparent">
              {totalVideoCount > 0 && (
                <div className="flex items-center gap-3 bg-black/60 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/[0.12] text-xs">
                  <span className="text-nma-silver-dark font-medium">{completedCount}/{totalVideoCount}</span>
                  <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-nma-purple to-nma-purple-light rounded-full transition-all duration-700"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="text-nma-purple-light font-mono font-bold">{progressPct}%</span>
                </div>
              )}
            </header>

            {/* Player */}
            <div className="flex-1 relative bg-black/35 backdrop-blur-[1px] flex items-center justify-center overflow-hidden w-full h-full p-4 md:p-6 pt-16 md:pt-20">
              {activeLesson && activeLesson.video_id !== undefined ? (
                <div key={activeLesson.lesson_id} className="w-full max-w-4xl">
                  <ProtectedVideoPlayer
                    videoId={activeLesson.video_id}
                    title={activeLesson.title}
                    durationSeconds={(activeLesson.duration_minutes ?? 0) * 60}
                    isLocked={false}
                    courseSlug={slug}
                    onProgressSaved={(p) => handleProgressSaved(p, activeLesson)}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 text-center p-8">
                  <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                    <Play className="w-6 h-6 text-nma-silver-dark/40" />
                  </div>
                  <div>
                    <p className="text-nma-silver-dark text-sm font-medium">Selectează o lecție din sidebar</p>
                    <p className="text-nma-silver-dark/40 text-xs mt-1">pentru a începe vizionarea</p>
                  </div>
                </div>
              )}

            </div>

            {/* Bottom info bar */}
            <div className="bg-[#030305]/95 backdrop-blur-md border-t border-white/[0.06] px-4 md:px-8 py-3 flex items-center justify-between z-10 w-full shrink-0 shadow-[0_-1px_0_rgba(139,92,246,0.08)]">
              <div className="min-w-0">
                <h2 className="text-sm md:text-base font-bold text-white mb-0 line-clamp-1">
                  {activeLesson?.title ?? "Alege o lecție"}
                </h2>
                {activeLesson && activeResumePos > 0 && !completedIds.has(activeLesson.lesson_id) && (
                  <p className="text-[0.65rem] text-nma-purple/70 mt-0.5">
                    Reluare din: {formatSeconds(activeResumePos)}
                  </p>
                )}
                {activeLesson && completedIds.has(activeLesson.lesson_id) && (
                  <p className="text-[0.65rem] text-green-500/70 mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Finalizat · poți revedea oricând
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Sidebar — fixed 45vh on mobile, fixed width on desktop ───────── */}
          <div className="shrink-0 h-[45vh] md:h-auto w-full md:w-80 lg:w-[22rem] border-l border-white/[0.07] bg-[#030305]/95 backdrop-blur-md flex flex-col overflow-hidden">

            {/* Sidebar header */}
            <div className="p-4 md:p-5 border-b border-white/[0.06] bg-[#050508] shrink-0">
              <h3 className="font-bold text-sm text-white mb-3 line-clamp-2 leading-snug">{course.title}</h3>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-nma-silver-dark/60 font-medium">
                    {completedCount} / {totalVideoCount} lecții finalizate
                  </span>
                  <span className="text-nma-purple-light font-mono font-bold">{progressPct}%</span>
                </div>
                <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-nma-purple to-nma-purple-light rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Module + lesson list */}
            <div className="flex-1 overflow-y-auto py-2">
              {sortedModules.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
                  <BookOpen className="w-8 h-8 text-nma-silver-dark/25" />
                  <p className="text-nma-silver-dark/60 text-sm">Nicio lecție disponibilă.</p>
                </div>
              ) : (
                sortedModules.map((mod) => {
                  const sortedLessons = mod.lessons.slice().sort((a, b) => a.order - b.order);
                  const modCompleted  = sortedLessons.filter((l) => completedIds.has(l.lesson_id)).length;

                  return (
                    <div key={mod.module_id} className="mb-1">
                      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                        <h4 className="text-[0.6rem] font-bold text-nma-purple/50 uppercase tracking-[0.18em] flex-1 pr-2 leading-tight">
                          {mod.title}
                        </h4>
                        {modCompleted > 0 && (
                          <span className="shrink-0 text-[0.6rem] text-nma-purple/60 font-mono whitespace-nowrap">
                            {modCompleted}/{sortedLessons.length}
                          </span>
                        )}
                      </div>

                      <div className="space-y-0.5 px-2">
                        {sortedLessons.map((lesson) => {
                          const isActive    = activeLesson?.lesson_id === lesson.lesson_id;
                          const isCompleted = completedIds.has(lesson.lesson_id);
                          const hasVideo    = lesson.video_id !== undefined;
                          const resumePos   = resumePositions.get(lesson.lesson_id) ?? 0;

                          return (
                            <button
                              key={lesson.lesson_id}
                              onClick={() => hasVideo && setActiveLesson(lesson)}
                              disabled={!hasVideo}
                              className={cn(
                                "w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all",
                                isActive
                                  ? "bg-nma-purple/15 border border-nma-purple/30"
                                  : hasVideo
                                  ? "hover:bg-white/5 border border-transparent"
                                  : "border border-transparent cursor-default opacity-40",
                              )}
                            >
                              <div className="mt-0.5 shrink-0">
                                {isCompleted ? (
                                  <CheckCircle2 className="w-4 h-4 text-nma-purple" />
                                ) : isActive ? (
                                  <Play className="w-4 h-4 text-nma-purple-light fill-nma-purple-light" />
                                ) : hasVideo ? (
                                  <Circle className="w-4 h-4 text-nma-silver-dark/40" />
                                ) : (
                                  <Circle className="w-4 h-4 text-nma-silver-dark/20" />
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div
                                  className={cn(
                                    "text-xs font-semibold leading-snug line-clamp-2",
                                    isActive
                                      ? "text-nma-purple-light"
                                      : isCompleted
                                      ? "text-nma-silver/70"
                                      : hasVideo
                                      ? "text-nma-silver/90"
                                      : "text-nma-silver-dark/30",
                                  )}
                                >
                                  {lesson.title}
                                </div>

                                <div className="flex items-center gap-2 mt-1 text-[0.6rem] text-nma-silver-dark/40">
                                  {lesson.duration_minutes > 0 && (
                                    <span>{lesson.duration_minutes} min</span>
                                  )}
                                  {isCompleted && (
                                    <span className="text-green-500/60 flex items-center gap-0.5">
                                      · <CheckCircle2 className="w-2.5 h-2.5 inline" /> finalizat
                                    </span>
                                  )}
                                  {!isCompleted && resumePos > 0 && isActive && (
                                    <span className="text-nma-purple/60">
                                      · reia din {formatSeconds(resumePos)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : activeTab === "membri" ? (
        /* ── Membri ──────────────────────────────────────────────────────────── */
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <CourseMembers slug={slug!} courseTitle={course.title} />
        </div>
      ) : activeTab === "comunitate" ? (
        /* ── Comunitate ──────────────────────────────────────────────────────── */
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <CourseCommunity slug={slug!} courseTitle={course.title} />
        </div>
      ) : activeTab === "anunturi" ? (
        /* ── Anunțuri ────────────────────────────────────────────────────────── */
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <CourseAnnouncements slug={slug!} courseTitle={course.title} />
        </div>
      ) : activeTab === "leaderboard" ? (
        /* ── Leaderboard ─────────────────────────────────────────────────────── */
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <CourseLeaderboard slug={slug!} courseTitle={course.title} />
        </div>
      ) : (
        /* ── Coming soon placeholder ──────────────────────────────────────────── */
        <div className="flex-1 min-h-0 flex flex-col">
          <ComingSoon message={currentTab.placeholder ?? "Această secțiune va fi disponibilă în curând."} />
        </div>
      )}
      </div>
    </div>
  );
}
