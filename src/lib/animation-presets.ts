export type PresetCategory = "basic" | "bounce" | "zoom" | "rotate" | "special" | "karaoke";

export type AnimationPreset = {
  id: string;
  name: string;
  category: PresetCategory;
  duration: number;
  easing: string;
  /** CSS keyframes body used for the live gallery preview. */
  keyframes: string;
  /** One-line description of what the canvas renderer does. */
  detail: string;
};

/**
 * 32 presets. Each one maps 1:1 to a canvas-side implementation in
 * `engines/canvasRenderer` — the CSS here is only the marketing preview.
 */
export const ANIMATION_PRESETS: AnimationPreset[] = [
  { id: "fade-in", name: "Fade In", category: "basic", duration: 0.6, easing: "ease-out", detail: "opacity 0 → 1", keyframes: "from{opacity:0}to{opacity:1}" },
  { id: "fade-out", name: "Fade Out", category: "basic", duration: 0.5, easing: "ease-in", detail: "opacity 1 → 0", keyframes: "from{opacity:1}to{opacity:0}" },
  { id: "slide-up", name: "Slide Up", category: "basic", duration: 0.55, easing: "cubic-bezier(.22,1,.36,1)", detail: "translateY 40px → 0", keyframes: "from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}" },
  { id: "slide-down", name: "Slide Down", category: "basic", duration: 0.55, easing: "cubic-bezier(.22,1,.36,1)", detail: "translateY -40px → 0", keyframes: "from{opacity:0;transform:translateY(-40px)}to{opacity:1;transform:none}" },
  { id: "slide-left", name: "Slide Left", category: "basic", duration: 0.5, easing: "ease-out", detail: "translateX 60px → 0", keyframes: "from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:none}" },
  { id: "slide-right", name: "Slide Right", category: "basic", duration: 0.5, easing: "ease-out", detail: "translateX -60px → 0", keyframes: "from{opacity:0;transform:translateX(-60px)}to{opacity:1;transform:none}" },
  { id: "blur-in", name: "Blur In", category: "basic", duration: 0.7, easing: "ease-out", detail: "blur 18px → 0", keyframes: "from{opacity:0;filter:blur(18px)}to{opacity:1;filter:blur(0)}" },
  { id: "soft-rise", name: "Soft Rise", category: "basic", duration: 0.9, easing: "cubic-bezier(.16,1,.3,1)", detail: "rise + fade, no overshoot", keyframes: "from{opacity:0;transform:translateY(18px) scale(.98)}to{opacity:1;transform:none}" },
  { id: "pop-in", name: "Pop In", category: "bounce", duration: 0.45, easing: "cubic-bezier(.34,1.56,.64,1)", detail: "scale .6 → 1.08 → 1", keyframes: "0%{opacity:0;transform:scale(.6)}60%{opacity:1;transform:scale(1.12)}100%{transform:scale(1)}" },
  { id: "bounce-in", name: "Bounce In", category: "bounce", duration: 0.8, easing: "cubic-bezier(.28,1.6,.5,1)", detail: "3-stage vertical bounce", keyframes: "0%{opacity:0;transform:translateY(-70px)}55%{opacity:1;transform:translateY(12px)}75%{transform:translateY(-6px)}100%{transform:none}" },
  { id: "elastic-in", name: "Elastic", category: "bounce", duration: 1, easing: "cubic-bezier(.16,1.8,.3,1)", detail: "spring stiffness 180", keyframes: "0%{opacity:0;transform:scaleX(.3) scaleY(1.6)}45%{opacity:1;transform:scaleX(1.15) scaleY(.85)}75%{transform:scaleX(.95) scaleY(1.05)}100%{transform:none}" },
  { id: "swing", name: "Swing", category: "bounce", duration: 0.9, easing: "ease-in-out", detail: "rotate ±14° damped", keyframes: "0%{opacity:0;transform:rotate(-14deg)}40%{opacity:1;transform:rotate(9deg)}70%{transform:rotate(-4deg)}100%{transform:none}" },
  { id: "shake-in", name: "Shake", category: "bounce", duration: 0.6, easing: "linear", detail: "x jitter 8px @ 24Hz", keyframes: "0%{opacity:0;transform:translateX(0)}20%{opacity:1;transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(4px)}100%{transform:none}" },
  { id: "scale-in", name: "Scale In", category: "zoom", duration: 0.5, easing: "ease-out", detail: "scale .85 → 1", keyframes: "from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}" },
  { id: "zoom-out", name: "Zoom Out", category: "zoom", duration: 0.5, easing: "ease-in", detail: "scale 1 → 1.4 + fade", keyframes: "from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(1.4)}" },
  { id: "punch-zoom", name: "Punch Zoom", category: "zoom", duration: 0.4, easing: "cubic-bezier(.2,1.4,.4,1)", detail: "beat-locked scale punch", keyframes: "0%{opacity:0;transform:scale(1.6)}55%{opacity:1;transform:scale(.94)}100%{transform:scale(1)}" },
  { id: "depth-push", name: "Depth Push", category: "zoom", duration: 0.7, easing: "ease-out", detail: "perspective Z −400px", keyframes: "from{opacity:0;transform:perspective(600px) translateZ(-260px)}to{opacity:1;transform:none}" },
  { id: "spin-in", name: "Spin In", category: "rotate", duration: 0.7, easing: "cubic-bezier(.22,1,.36,1)", detail: "rotate 180° + scale", keyframes: "from{opacity:0;transform:rotate(180deg) scale(.5)}to{opacity:1;transform:none}" },
  { id: "flip-x", name: "Flip X", category: "rotate", duration: 0.65, easing: "ease-out", detail: "rotateX 90° → 0", keyframes: "from{opacity:0;transform:perspective(700px) rotateX(90deg)}to{opacity:1;transform:none}" },
  { id: "flip-y", name: "Flip Y", category: "rotate", duration: 0.65, easing: "ease-out", detail: "rotateY −90° → 0", keyframes: "from{opacity:0;transform:perspective(700px) rotateY(-90deg)}to{opacity:1;transform:none}" },
  { id: "tilt-reveal", name: "Tilt Reveal", category: "rotate", duration: 0.8, easing: "cubic-bezier(.16,1,.3,1)", detail: "rotateX 24° + rise", keyframes: "from{opacity:0;transform:perspective(800px) rotateX(24deg) translateY(30px)}to{opacity:1;transform:none}" },
  { id: "typewriter", name: "Typewriter", category: "special", duration: 1.2, easing: "steps(18,end)", detail: "clip-path per character", keyframes: "from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}" },
  { id: "mask-wipe", name: "Mask Wipe", category: "special", duration: 0.7, easing: "cubic-bezier(.65,0,.35,1)", detail: "linear gradient mask sweep", keyframes: "from{clip-path:polygon(0 0,0 0,0 100%,0 100%)}to{clip-path:polygon(0 0,100% 0,100% 100%,0 100%)}" },
  { id: "split-reveal", name: "Split Reveal", category: "special", duration: 0.75, easing: "cubic-bezier(.22,1,.36,1)", detail: "two-half counter slide", keyframes: "0%{opacity:0;letter-spacing:.7em;filter:blur(6px)}100%{opacity:1;letter-spacing:normal;filter:blur(0)}" },
  { id: "glitch-in", name: "Glitch", category: "special", duration: 0.6, easing: "steps(6,end)", detail: "RGB split + slice offset", keyframes: "0%{opacity:0;transform:translateX(-6px) skewX(12deg);text-shadow:3px 0 #06b6d4,-3px 0 #ef4444}35%{opacity:1;transform:translateX(6px) skewX(-9deg)}70%{transform:translateX(-2px) skewX(4deg)}100%{transform:none;text-shadow:none}" },
  { id: "neon-flicker", name: "Neon Flicker", category: "special", duration: 1.1, easing: "linear", detail: "randomised glow gate", keyframes: "0%{opacity:.1}10%{opacity:1}14%{opacity:.25}22%{opacity:1}30%{opacity:.4}45%{opacity:1}100%{opacity:1;text-shadow:0 0 18px rgba(6,182,212,.9)}" },
  { id: "wave", name: "Wave", category: "special", duration: 1.2, easing: "ease-in-out", detail: "per-letter sine offset", keyframes: "0%{transform:translateY(0)}25%{transform:translateY(-10px)}50%{transform:translateY(0)}75%{transform:translateY(8px)}100%{transform:translateY(0)}" },
  { id: "pulse", name: "Pulse", category: "special", duration: 0.9, easing: "ease-in-out", detail: "scale pulse on beat", keyframes: "0%{transform:scale(1)}50%{transform:scale(1.08)}100%{transform:scale(1)}" },
  { id: "burst-out", name: "Burst Out", category: "special", duration: 0.5, easing: "ease-in", detail: "scatter letters + fade", keyframes: "from{opacity:1;transform:none;filter:blur(0)}to{opacity:0;transform:scale(1.3) translateY(-18px);filter:blur(10px)}" },
  { id: "karaoke-fill", name: "Karaoke Fill", category: "karaoke", duration: 0, easing: "linear", detail: "gradient fill locked to word timing", keyframes: "from{background-size:0% 100%}to{background-size:100% 100%}" },
  { id: "word-by-word", name: "Word by Word", category: "karaoke", duration: 0, easing: "linear", detail: "stagger by word start time", keyframes: "0%{opacity:.25}100%{opacity:1}" },
  { id: "letter-fade", name: "Letter by Letter", category: "karaoke", duration: 0.9, easing: "ease-out", detail: "stagger 28ms per glyph", keyframes: "0%{opacity:0;transform:translateY(6px)}100%{opacity:1;transform:none}" },
];

export const PRESET_CATEGORIES: Array<{ id: PresetCategory | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "basic", label: "Basic" },
  { id: "bounce", label: "Bounce" },
  { id: "zoom", label: "Zoom" },
  { id: "rotate", label: "Rotate" },
  { id: "special", label: "Special" },
  { id: "karaoke", label: "Karaoke" },
];
