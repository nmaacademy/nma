import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { type LucideIcon, LayoutDashboard, BookOpen, CreditCard, MonitorSmartphone, LogOut, Menu, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuth } from "../../context/AuthContext";
import { motion, AnimatePresence } from "motion/react";
import { NmaLogo } from "../ui/nma-logo";
import { GlassFilter } from "../ui/liquid-glass";
import { NmaGlassButton } from "../ui/nma-glass";
import GlassSurface from "../ui/GlassSurface";

type DashboardLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const DASHBOARD_LINKS: DashboardLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/courses", label: "Cursurile Mele", icon: BookOpen },
  { href: "/dashboard/billing", label: "Profil & Facturare", icon: CreditCard },
  { href: "/dashboard/devices", label: "Sesiuni & Dispozitive", icon: MonitorSmartphone },
];

const DASHBOARD_NAV_GLASS = {
  borderRadius: 18,
  backgroundOpacity: 0.08,
  saturation: 1.22,
  borderWidth: 0.03,
  brightness: 60,
  opacity: 0.84,
  blur: 10,
  displace: 0.1,
  distortionScale: -46,
  redOffset: 0,
  greenOffset: 1.8,
  blueOffset: 3.4,
};

const DASHBOARD_NAV_GLASS_MOBILE = {
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

const DASHBOARD_NAV_TRANSITION = {
  type: "spring" as const,
  stiffness: 360,
  damping: 38,
  mass: 0.78,
};

export function DashboardNavLinks({
  pathname,
  onNavigate,
  mobile = false,
}: {
  pathname: string;
  onNavigate?: () => void;
  mobile?: boolean;
}) {
  const navigate = useNavigate();
  const navRef = useRef<HTMLElement | null>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [pill, setPill] = useState({ top: 0, height: 0 });
  const [pillReady, setPillReady] = useState(false);

  const activeIndex = DASHBOARD_LINKS.findIndex((link) => pathname === link.href);
  const activeGlass = mobile ? DASHBOARD_NAV_GLASS_MOBILE : DASHBOARD_NAV_GLASS;
  const dragBounds = (() => {
    const nav = navRef.current;
    if (!nav || !pillReady) return { top: 0, bottom: 0 };

    return {
      top: 0 - pill.top,
      bottom: nav.scrollHeight - pill.top - pill.height,
    };
  })();

  const snapToClosestLink = useCallback(
    (dragOffsetY: number) => {
      const draggedCenter = pill.top + dragOffsetY + pill.height / 2;
      const closest = DASHBOARD_LINKS.reduce(
        (best, link, index) => {
          const el = linkRefs.current[index];
          if (!el) return best;

          const center = el.offsetTop + el.offsetHeight / 2;
          const distance = Math.abs(center - draggedCenter);
          return distance < best.distance ? { link, distance } : best;
        },
        { link: DASHBOARD_LINKS[0], distance: Number.POSITIVE_INFINITY },
      );

      if (closest.link.href !== pathname) {
        navigate(closest.link.href);
      }
      onNavigate?.();
    },
    [navigate, onNavigate, pathname, pill.height, pill.top],
  );

  const updatePill = useCallback(() => {
    const activeLink = linkRefs.current[activeIndex];
    if (!activeLink) return;

    setPill({ top: activeLink.offsetTop, height: activeLink.offsetHeight });
    setPillReady(true);
  }, [activeIndex]);

  useLayoutEffect(() => {
    updatePill();
  }, [updatePill]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const resizeObserver = new ResizeObserver(updatePill);
    resizeObserver.observe(nav);
    linkRefs.current.forEach((link) => link && resizeObserver.observe(link));

    return () => resizeObserver.disconnect();
  }, [updatePill]);

  return (
    <nav
      ref={navRef}
      className={cn(
        "relative flex-1 px-4 py-8 space-y-2",
        mobile && "overflow-y-auto",
      )}
    >
      {pillReady && activeIndex >= 0 && (
        <motion.div
          className="absolute left-4 right-4 z-20 cursor-grab rounded-2xl active:cursor-grabbing"
          initial={false}
          animate={{ top: pill.top, height: pill.height }}
          transition={DASHBOARD_NAV_TRANSITION}
          drag="y"
          dragConstraints={dragBounds}
          dragElastic={0.04}
          dragMomentum={false}
          dragSnapToOrigin
          onDragEnd={(_, info) => snapToClosestLink(info.offset.y)}
        >
          <span className="pointer-events-none absolute -inset-2 rounded-[1.35rem] bg-nma-purple/24 blur-xl" />
          <GlassSurface
            width="100%"
            height="100%"
            borderRadius={activeGlass.borderRadius}
            backgroundOpacity={activeGlass.backgroundOpacity}
            saturation={activeGlass.saturation}
            borderWidth={activeGlass.borderWidth}
            brightness={activeGlass.brightness}
            opacity={activeGlass.opacity}
            blur={activeGlass.blur}
            displace={activeGlass.displace}
            distortionScale={activeGlass.distortionScale}
            redOffset={activeGlass.redOffset}
            greenOffset={activeGlass.greenOffset}
            blueOffset={activeGlass.blueOffset}
            className="navbar-glass-surface pointer-events-none rounded-2xl"
            style={{
              backgroundColor: mobile
                ? "rgba(255, 255, 255, 0.025)"
                : "rgba(139, 92, 246, 0.055)",
              border: mobile
                ? "1px solid rgba(255, 255, 255, 0.2)"
                : "1px solid rgba(196, 181, 253, 0.28)",
              boxShadow: mobile
                ? "inset 0 1px 0 rgba(255,255,255,0.34), inset 0 -10px 22px rgba(255,255,255,0.08), 0 18px 45px rgba(0,0,0,0.32), 0 0 28px rgba(139,92,246,0.18)"
                : "0 0 22px rgba(139, 92, 246, 0.22), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(255,255,255,0.08)",
            }}
          />
        </motion.div>
      )}

      {DASHBOARD_LINKS.map((link, index) => {
        const isActive = pathname === link.href;
        const Icon = link.icon;

        return (
          <Link
            key={link.href}
            ref={(el) => {
              linkRefs.current[index] = el;
            }}
            to={link.href}
            onClick={onNavigate}
            className={cn(
              "relative z-30 flex items-center gap-3 px-4 rounded-xl transition-all text-sm font-medium border border-transparent",
              mobile ? "py-4" : "py-3",
              isActive
                ? "pointer-events-none text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.85)]"
                : "text-nma-silver-dark hover:text-white hover:bg-white/5",
            )}
          >
            <Icon className="w-5 h-5" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function DashboardLayout() {
  const location = useLocation();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-[100dvh] bg-nma-darker flex">
      <GlassFilter />
      {/* Sidebar - Desktop */}
      <aside className="w-[16rem] border-r border-white/5 bg-[#050506] hidden md:flex flex-col h-[100dvh] sticky top-0">
        <div className="h-20 flex items-center px-8 border-b border-white/5">
           <Link to="/" className="flex items-center gap-3">
            <NmaLogo imageClassName="w-16 opacity-95" />
            <span className="font-bold tracking-[0.1em] text-[0.875rem] text-white">ACADEMY</span>
          </Link>
        </div>

        <DashboardNavLinks pathname={location.pathname} />

        <div className="p-4 border-t border-white/5">
          <NmaGlassButton
            glow="danger"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium justify-start"
            contentClassName="justify-start"
          >
             <LogOut className="w-5 h-5" />
             Ieși din cont
          </NmaGlassButton>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-[100dvh] relative">
         <header className="h-20 border-b border-white/5 bg-[#050506]/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-6 md:px-10">
           <div className="flex items-center gap-4">
             <NmaGlassButton
               glow="neutral"
               size="icon"
               className="md:hidden w-10 h-10 rounded-xl"
               onClick={() => setMobileMenuOpen(true)}
             >
               <Menu className="w-5 h-5" />
             </NmaGlassButton>
             <div className="font-bold text-white text-lg hidden sm:block tracking-[0.05em] uppercase text-sm">NMA Academy</div>
           </div>
           
           <div className="flex items-center gap-4">
             <div className="w-8 h-8 rounded-full bg-gradient-to-br from-nma-purple to-nma-purple-dark border border-white/20 flex items-center justify-center text-white font-bold text-sm">
               A
             </div>
           </div>
         </header>
         
         <div className="flex-1 p-6 md:p-10">
           <Outlet />
         </div>
      </main>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-[80%] max-w-[20rem] bg-[#050506] border-r border-white/10 z-50 flex flex-col md:hidden shadow-[0_0_50px_rgba(139,92,246,0.15)]"
            >
               <div className="h-20 flex items-center justify-between px-6 border-b border-white/5">
                 <Link to="/" className="flex items-center gap-3" onClick={() => setMobileMenuOpen(false)}>
                  <NmaLogo imageClassName="w-14 opacity-95" />
                  <span className="font-bold tracking-[0.1em] text-[0.75rem] text-white">ACADEMY</span>
                </Link>
                <NmaGlassButton
                  glow="neutral"
                  size="icon"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-10 h-10 rounded-full"
                >
                  <X className="w-5 h-5" />
                </NmaGlassButton>
               </div>

               <DashboardNavLinks
                 pathname={location.pathname}
                 onNavigate={() => setMobileMenuOpen(false)}
                 mobile
               />

              <div className="p-4 border-t border-white/5 pb-8">
                <NmaGlassButton
                  glow="danger"
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }} 
                  className="w-full flex items-center gap-3 px-4 py-4 rounded-xl transition-all text-sm font-medium justify-start"
                  contentClassName="justify-start"
                >
                   <LogOut className="w-5 h-5" />
                   Ieși din cont
                </NmaGlassButton>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
