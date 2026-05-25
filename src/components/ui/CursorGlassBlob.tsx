import { useEffect, useRef } from "react";
import GlassSurface from "./GlassSurface";

const BLOB_SIZE = 46;
const TOUCH_BLOB_SIZE = 40;

type PointerKind = "mouse" | "touch" | "pen";

export default function CursorGlassBlob() {
  const blobRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const pointerKindRef = useRef<PointerKind>("mouse");
  const hasPointerRef = useRef(false);

  useEffect(() => {
    const blob = blobRef.current;
    if (!blob) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const clearHideTimeout = () => {
      if (hideTimeoutRef.current) {
        window.clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    };

    const setBlobState = (visible: boolean, pointerKind: PointerKind) => {
      const size = pointerKind === "mouse" ? BLOB_SIZE : TOUCH_BLOB_SIZE;

      blob.style.width = `${size}px`;
      blob.style.height = `${size}px`;
      blob.style.opacity = visible ? "1" : "0";
      blob.style.setProperty("--cursor-glass-scale", visible ? "1" : "0.72");
    };

    const render = () => {
      const current = currentRef.current;
      const target = targetRef.current;
      const ease = reduceMotion ? 1 : 0.18;

      current.x += (target.x - current.x) * ease;
      current.y += (target.y - current.y) * ease;

      const size =
        pointerKindRef.current === "mouse" ? BLOB_SIZE : TOUCH_BLOB_SIZE;
      blob.style.transform = `translate3d(${current.x - size / 2}px, ${
        current.y - size / 2
      }px, 0) scale(var(--cursor-glass-scale, 1))`;

      rafRef.current = window.requestAnimationFrame(render);
    };

    const moveTo = (event: PointerEvent) => {
      pointerKindRef.current =
        event.pointerType === "touch" || event.pointerType === "pen"
          ? event.pointerType
          : "mouse";

      targetRef.current = { x: event.clientX, y: event.clientY };

      if (!hasPointerRef.current) {
        currentRef.current = targetRef.current;
        hasPointerRef.current = true;
      }

      clearHideTimeout();
      setBlobState(true, pointerKindRef.current);
    };

    const hideTouchBlob = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") {
        hideTimeoutRef.current = window.setTimeout(() => {
          setBlobState(false, pointerKindRef.current);
        }, 280);
      }
    };

    const hideMouseBlob = () => {
      setBlobState(false, pointerKindRef.current);
    };

    rafRef.current = window.requestAnimationFrame(render);
    window.addEventListener("pointermove", moveTo, { passive: true });
    window.addEventListener("pointerdown", moveTo, { passive: true });
    window.addEventListener("pointerup", hideTouchBlob, { passive: true });
    window.addEventListener("pointercancel", hideTouchBlob, { passive: true });
    document.addEventListener("mouseleave", hideMouseBlob);

    return () => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }
      clearHideTimeout();
      window.removeEventListener("pointermove", moveTo);
      window.removeEventListener("pointerdown", moveTo);
      window.removeEventListener("pointerup", hideTouchBlob);
      window.removeEventListener("pointercancel", hideTouchBlob);
      document.removeEventListener("mouseleave", hideMouseBlob);
    };
  }, []);

  return (
    <div
      ref={blobRef}
      className="pointer-events-none fixed left-0 top-0 z-[70] opacity-0 transition-opacity duration-200 ease-out will-change-transform"
      aria-hidden="true"
      style={{
        width: BLOB_SIZE,
        height: BLOB_SIZE,
        transform: "translate3d(-150px, -150px, 0) scale(0.72)",
      }}
    >
      <GlassSurface
        width="100%"
        height="100%"
        borderRadius={999}
        backgroundOpacity={0.12}
        saturation={1.7}
        borderWidth={0.08}
        brightness={68}
        opacity={0.72}
        blur={16}
        displace={0.06}
        distortionScale={-49}
        redOffset={1}
        greenOffset={2.4}
        blueOffset={4.8}
        className="h-full w-full rounded-full border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.34),inset_0_-10px_22px_rgba(255,255,255,0.08),0_18px_45px_rgba(0,0,0,0.32),0_0_28px_rgba(139,92,246,0.18)]"
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.025)",
        }}
      />
    </div>
  );
}
