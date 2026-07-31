"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const ForgeScene = dynamic(() => import("./ForgeScene"), {
  ssr: false,
  loading: () => null,
});

/**
 * Lazily mounts the Three.js scene only when the hero is on screen, drops to a
 * low-poly profile on small viewports, and fully opts out for users who prefer
 * reduced motion (a CSS aurora is rendered instead).
 */
export default function SceneCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [quality, setQuality] = useState<"high" | "low" | "off">("high");

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.matchMedia("(max-width: 860px)").matches;
    const canWebGL = (() => {
      try {
        const canvas = document.createElement("canvas");
        return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
      } catch {
        return false;
      }
    })();

    if (reduced || !canWebGL) setQuality("off");
    else setQuality(small ? "low" : "high");
  }, []);

  useEffect(() => {
    const node = hostRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => setVisible(entries.some((entry) => entry.isIntersecting)),
      { rootMargin: "260px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={hostRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* CSS aurora poster — always painted, sits behind the WebGL canvas */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_-10%,rgba(124,58,237,0.30),transparent_60%),radial-gradient(80%_70%_at_85%_20%,rgba(6,182,212,0.18),transparent_65%),radial-gradient(70%_60%_at_10%_70%,rgba(59,130,246,0.20),transparent_60%)]" />
      <div className="grid-bg absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(70%_60%_at_50%_45%,black,transparent)]" />

      {quality !== "off" && visible ? (
        <div className="absolute inset-0">
          <ForgeScene quality={quality} />
        </div>
      ) : null}

      {/* vignette + bottom fade into the page background */}
      <div className="absolute inset-0 bg-[radial-gradient(85%_75%_at_50%_45%,transparent_40%,rgba(7,7,12,0.75)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#07070c]" />
    </div>
  );
}
