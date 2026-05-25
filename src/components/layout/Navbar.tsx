import React from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "framer-motion"; // Am adăugat AnimatePresence pentru ieșiri fluide
import { Menu, X } from "lucide-react";
import { NmaLogo } from "../ui/nma-logo";
import GlassSurface from "../ui/GlassSurface";
import { NmaGlassButton } from "../ui/nma-glass";
import { useAuth } from "../../context/AuthContext";

const NAVBAR_GLASS = {
  borderRadius: 56,
  backgroundOpacity: 0.068,
  saturation: 1.16,
  borderWidth: 0.023,
  brightness: 60,
  opacity: 0.82,
  blur: 10,
  displace: 0.052,
  distortionScale: -31,
  redOffset: 0,
  greenOffset: 1.6,
  blueOffset: 3.2,
};

const MOBILE_MENU_GLASS = {
  ...NAVBAR_GLASS,
  borderRadius: 24,
  backgroundOpacity: 0.095,
};

export default function Navbar() {
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const { user } = useAuth();
  const ctaLabel = user ? "Contul meu" : "Acces Exclusiv";
  const ctaHref  = user ? "/dashboard" : "/login";
  const navbarBackgroundOpacity = isScrolled
    ? Math.min(NAVBAR_GLASS.backgroundOpacity + 0.025, 0.2)
    : NAVBAR_GLASS.backgroundOpacity;
  const navbarBackgroundAlpha = isScrolled
    ? Math.min(NAVBAR_GLASS.backgroundOpacity + 0.01, 0.16)
    : Math.max(NAVBAR_GLASS.backgroundOpacity - 0.02, 0.01);

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      // Am optimizat durata la 0.6s și am folosit un ease mai "snappy" pentru a evita blocajele
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "fixed left-0 right-0 z-50 px-3 md:px-8",
        isScrolled ? "top-3" : "top-5",
      )}
    >
      <GlassSurface
        width="100%"
        height="auto"
        borderRadius={NAVBAR_GLASS.borderRadius}
        backgroundOpacity={navbarBackgroundOpacity}
        saturation={NAVBAR_GLASS.saturation}
        borderWidth={NAVBAR_GLASS.borderWidth}
        brightness={NAVBAR_GLASS.brightness}
        opacity={NAVBAR_GLASS.opacity}
        blur={NAVBAR_GLASS.blur}
        displace={NAVBAR_GLASS.displace}
        distortionScale={NAVBAR_GLASS.distortionScale}
        redOffset={NAVBAR_GLASS.redOffset}
        greenOffset={NAVBAR_GLASS.greenOffset}
        blueOffset={NAVBAR_GLASS.blueOffset}
        className={cn(
          "navbar-glass-surface mx-auto max-w-7xl cursor-default rounded-full border border-white/[0.08] max-md:border-white/15 transition-shadow duration-500",
        )}
        style={{
          backgroundColor: `rgba(255, 255, 255, ${navbarBackgroundAlpha})`,
          boxShadow: isScrolled
            ? "inset 0 1px 0 rgba(255,255,255,0.16), 0 18px 60px rgba(0,0,0,0.35)"
            : "inset 0 1px 0 rgba(255,255,255,0.14), 0 14px 46px rgba(0,0,0,0.22)",
        }}
      >
        <div
          className={cn(
            "relative flex w-full items-center justify-between overflow-hidden rounded-[inherit] px-4 transition-all duration-500 md:grid md:grid-cols-[20rem_minmax(0,1fr)_12rem] md:px-8",
            isScrolled ? "py-2.5 md:py-3" : "py-3 md:py-4",
          )}
        >
          <span className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(90deg,rgba(0,0,0,0.24),rgba(0,0,0,0.2),rgba(0,0,0,0.24))] opacity-80 [mask-image:linear-gradient(90deg,transparent,black_11%,black_89%,transparent)]" />

          <Link to="/" className="flex items-center gap-2 group justify-self-start">
            <NmaLogo
              className="transition-transform duration-500 group-hover:scale-105"
              imageClassName="w-[6rem] md:w-[7.5rem] opacity-95" // Am mărit logo-ul
            />
            {/* Am mărit textul ACADEMY (text-1.4rem) și am crescut tracking-ul */}
            <span className="relative font-bold tracking-[0.12em] text-[1.7rem] text-white hidden md:block [text-shadow:0_2px_10px_rgba(0,0,0,0.95),0_0_18px_rgba(0,0,0,0.62)]">ACADEMY</span>
          </Link>

          <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 font-bold tracking-[0.12em] text-[1.18rem] text-white md:hidden [text-shadow:0_2px_10px_rgba(0,0,0,0.95),0_0_18px_rgba(0,0,0,0.62)]">
            ACADEMY
          </span>

          {/* Meniul central: justify-end îl duce spre dreapta, gap-8 pentru apropiere optimă */}
          <div className="hidden md:flex items-center justify-end gap-8 pr-3 justify-self-stretch">
            <NavLink href="#manifesto">Metoda</NavLink>
            <NavLink href="#courses">Curriculum</NavLink>
            <NavLink href="#results">Sistem</NavLink>
            <NavLink href="#faq">Rezultate</NavLink>
          </div>

          <div className="hidden md:flex justify-end">
            <NmaGlassButton
              asChild
              glow="purple"
              className="px-6 py-2.5 text-[0.98rem] font-bold text-white transition-all duration-300 rounded-full uppercase tracking-[0.05em] [text-shadow:0_2px_10px_rgba(0,0,0,0.9),0_0_16px_rgba(0,0,0,0.5)]"
              contentClassName="whitespace-nowrap"
            >
              <Link to={ctaHref}>
                {ctaLabel}
              </Link>
            </NmaGlassButton>
          </div>

          <NmaGlassButton
            glow="neutral"
            size="icon"
            className="md:hidden h-11 w-11 rounded-full"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? "Închide meniul" : "Deschide meniul"}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </NmaGlassButton>
        </div>
      </GlassSurface>

      {/* Meniul Mobile cu animație "Liquid/Stretching" */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10, filter: "blur(10px)" }}
            animate={{ 
              opacity: 1, 
              scale: 1, 
              y: 0, 
              filter: "blur(0px)",
              transition: {
                type: "spring",
                stiffness: 300,
                damping: 20, // Acest damping mic creează efectul elastic (liquid)
                mass: 1
              }
            }}
            exit={{ opacity: 0, scale: 0.95, y: -10, filter: "blur(10px)" }}
            className="md:hidden absolute top-[calc(100%+0.6rem)] left-3 right-3 origin-top"
          >
            <GlassSurface
              width="100%"
              height="auto"
              borderRadius={MOBILE_MENU_GLASS.borderRadius}
              backgroundOpacity={MOBILE_MENU_GLASS.backgroundOpacity}
              saturation={MOBILE_MENU_GLASS.saturation}
              borderWidth={MOBILE_MENU_GLASS.borderWidth}
              brightness={MOBILE_MENU_GLASS.brightness}
              opacity={MOBILE_MENU_GLASS.opacity}
              blur={MOBILE_MENU_GLASS.blur}
              displace={MOBILE_MENU_GLASS.displace}
              distortionScale={MOBILE_MENU_GLASS.distortionScale}
              redOffset={MOBILE_MENU_GLASS.redOffset}
              greenOffset={MOBILE_MENU_GLASS.greenOffset}
              blueOffset={MOBILE_MENU_GLASS.blueOffset}
              className="navbar-glass-surface rounded-3xl border border-white/15"
              style={{
                backgroundColor: `rgba(5, 5, 6, ${Math.min(0.78 + MOBILE_MENU_GLASS.backgroundOpacity, 0.94)})`,
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.14), 0 24px 70px rgba(0,0,0,0.55)",
              }}
            >
              <div className="flex w-full flex-col gap-4 p-5">
                <MobileNavLink href="#manifesto" onClick={() => setIsMobileMenuOpen(false)}>Manifesto</MobileNavLink>
                <MobileNavLink href="#courses" onClick={() => setIsMobileMenuOpen(false)}>Cursuri</MobileNavLink>
                <MobileNavLink href="#results" onClick={() => setIsMobileMenuOpen(false)}>Rezultate</MobileNavLink>
                <MobileNavLink href="#faq" onClick={() => setIsMobileMenuOpen(false)}>FAQ</MobileNavLink>
                <NmaGlassButton
                  asChild
                  glow="purple"
                  className="w-full py-3 text-[0.98rem] font-bold text-white rounded-full uppercase tracking-[0.05em] mt-1"
                  contentClassName="whitespace-nowrap justify-center"
                >
                  <Link to={ctaHref} onClick={() => setIsMobileMenuOpen(false)}>
                    {ctaLabel}
                  </Link>
                </NmaGlassButton>
              </div>
            </GlassSurface>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

// NavLink-ul de desktop cu font mărit (0.9rem)
function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      className="text-[1.17rem] font-semibold text-white/90 hover:text-white transition-all hover:scale-105 active:scale-95 uppercase tracking-[0.12em] [text-shadow:0_2px_10px_rgba(0,0,0,0.95),0_0_18px_rgba(0,0,0,0.62)]"
    >
      {children}
    </a>
  );
}

function MobileNavLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick: () => void }) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    onClick();
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <a
      href={href}
      onClick={handleClick}
      className="text-[1.45rem] font-medium text-white/80 hover:text-white transition-colors py-3 border-b border-white/5 uppercase tracking-wide block"
    >
      {children}
    </a>
  );
}
