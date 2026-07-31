import { useLyricStore } from "@/store/useLyricStore";
import { useState, useMemo } from "react";
import { loadCustomFont } from "@/lib/audioUtils";
import type { LyricBlockStyle, LyricAnimationIn, LyricAnimationOut, AISettings } from "@/types/project";
import { ANIMATION_PRESETS, PRESET_CATEGORIES, type PresetCategory } from "@/lib/animation-presets";

const FONTS = [
  "Inter",
  "Space Grotesk",
  "Bebas Neue",
  "Anton",
  "Montserrat",
  "Poppins",
  "Oswald",
  "Playfair Display",
  "JetBrains Mono",
  "Syne",
  "Clash Display",
  "General Sans",
];


type StyleTemplate = {
  name: string;
  style: Partial<LyricBlockStyle>;
};

const TEMPLATES: StyleTemplate[] = [
  {
    name: "Neon Glow",
    style: {
      color: "#FFFFFF",
      outlineColor: "#FF00FF",
      outlineWidth: 2,
      glow: true,
      glowColor: "#FF00FF",
      fontFamily: "Space Grotesk",
      fontSize: 72,
    },
  },
  {
    name: "Vintage Vinyl",
    style: {
      color: "#FFD93D",
      outlineColor: "#000000",
      outlineWidth: 3,
      shadow: true,
      shadowColor: "#000000",
      fontFamily: "Bebas Neue",
      fontSize: 84,
      uppercase: true,
    },
  },
  {
    name: "Minimal Mono",
    style: {
      color: "#FFFFFF",
      outlineWidth: 0,
      fontFamily: "JetBrains Mono",
      fontSize: 56,
      shadow: false,
    },
  },
  {
    name: "Kinetic Pop",
    style: {
      color: "#00FFAB",
      outlineColor: "#000000",
      outlineWidth: 4,
      bold: true,
      fontFamily: "Anton",
      fontSize: 88,
    },
  },
  {
    name: "Cinematic",
    style: {
      color: "#FFFFFF",
      outlineColor: "#000000",
      outlineWidth: 2,
      shadow: true,
      shadowBlur: 24,
      fontFamily: "Playfair Display",
      fontSize: 64,
      backgroundBox: { enabled: true, color: "#000000", opacity: 0.4, padding: 16, radius: 12 },
    },
  },
  {
    name: "Cyberpunk",
    style: {
      color: "#00FFFF",
      outlineColor: "#FF00FF",
      outlineWidth: 2,
      glow: true,
      glowColor: "#FF00FF",
      gradient: { enabled: true, from: "#00FFFF", to: "#FF00FF", angle: 45 },
      fontFamily: "Syne",
      fontSize: 70,
    },
  },
];

function ensureHexColor(color: string | undefined, fallback = "#FFFFFF"): string {
  if (!color || typeof color !== "string") return fallback;
  const trimmed = color.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9A-Fa-f]{3}$/.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }
  return fallback;
}

export function PropertiesPanel() {
  const {
    lyricBlocks,
    selectedBlockId,
    updateBlockStyle,
    updateBlockAnimation,
    updateLyricBlock,
    deleteLyricBlock,
    duplicateBlock,
    splitBlock,
    aiSettings,
    setAISettings,
    setBackground,
    backgroundAsset,
    pushHistory,
  } = useLyricStore();

  const selected = lyricBlocks.find((b) => b.id === selectedBlockId);
  const [customFonts, setCustomFonts] = useState<string[]>([]);
  const [fontError, setFontError] = useState<string | null>(null);
  const [animPickerTarget, setAnimPickerTarget] = useState<"in" | "out" | null>(null);
  const [animCategory, setAnimCategory] = useState<PresetCategory | "all">("all");
  const [hoveredPreset, setHoveredPreset] = useState<string | null>(null);

  const presetKeyframeSheet = useMemo(
    () => ANIMATION_PRESETS.map((pr) => `@keyframes lf-${pr.id}{${pr.keyframes}}`).join("\n"),
    [],
  );

  const visiblePresets = useMemo(
    () => animCategory === "all" ? ANIMATION_PRESETS : ANIMATION_PRESETS.filter((pr) => pr.category === animCategory),
    [animCategory],
  );

  const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFontError(null);
    try {
      const name = await loadCustomFont(file);
      if (!customFonts.includes(name)) {
        setCustomFonts((f) => [...f, name]);
      }
      if (selected) {
        pushHistory();
        updateBlockStyle(selected.id, { fontFamily: name });
      }
    } catch (err: any) {
      setFontError(err.message || "Font load failed");
    }
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const type = file.type.startsWith("video") ? "video" : "image";

    if (type === "video") {
      const tempVideo = document.createElement("video");
      tempVideo.preload = "metadata";
      tempVideo.src = url;
      tempVideo.onloadedmetadata = () => {
        const dur = Number.isFinite(tempVideo.duration) ? tempVideo.duration : 5;
        setBackground({ type, url, duration: dur, fileName: file.name });
      };
      tempVideo.onerror = () => {
        setBackground({ type, url, duration: 5, fileName: file.name });
      };
    } else {
      setBackground({ type, url, duration: 0, fileName: file.name });
    }
  };

  const applyTemplate = (tplStyle: Partial<LyricBlockStyle>) => {
    if (!selected) return;
    pushHistory();
    updateBlockStyle(selected.id, tplStyle);
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto pr-1">
      <style dangerouslySetInnerHTML={{ __html: presetKeyframeSheet }} />
      {/* Background */}
      <div className="rounded-[16px] border border-white/10 bg-[#14141C] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/60">Background</h3>
          <span className="text-[10px] text-white/40 uppercase">{backgroundAsset?.type || "none"}</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(["image", "video", "gradient"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                if (t === "gradient") {
                  setBackground({ type: "gradient", url: "", duration: 0, gradientColors: ["#FF00FF", "#00FFAB"] });
                }
              }}
              className={`rounded-xl border px-2 py-2 text-[11px] capitalize ${
                backgroundAsset?.type === t
                  ? "border-white bg-white text-black font-bold"
                  : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <label className="mt-3 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/[0.03] px-3 py-3 text-xs text-white/60 hover:bg-white/[0.06]">
          <input type="file" accept="image/*,video/*" className="hidden" onChange={handleBgUpload} />
          Upload BG Image/Video
        </label>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setBackground({ type: "solid", url: "", duration: 0, solidColor: "#0A0A0F" })}
            className={`rounded-lg bg-[#0A0A0F] border py-2 text-[11px] ${
              backgroundAsset?.type === "solid" ? "border-white text-white font-bold" : "border-white/10 text-white/60"
            }`}
          >
            Solid #0A0A0F
          </button>
          <button
            type="button"
            onClick={() => setBackground({ type: "particles", url: "", duration: 0 })}
            className={`rounded-lg bg-purple-500/20 border py-2 text-[11px] ${
              backgroundAsset?.type === "particles" ? "border-purple-400 text-purple-200 font-bold" : "border-purple-500/30 text-purple-300"
            }`}
          >
            Particles
          </button>
        </div>

        {backgroundAsset?.type === "gradient" && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[10px] text-white/40">Colors:</span>
            <input
              type="color"
              value={ensureHexColor(backgroundAsset?.gradientColors?.[0], "#FF00FF")}
              onChange={(e) =>
                setBackground({
                  ...backgroundAsset!,
                  gradientColors: [e.target.value, backgroundAsset?.gradientColors?.[1] || "#00FFAB"],
                })
              }
              className="h-8 w-8 rounded cursor-pointer border border-white/10 bg-transparent"
            />
            <input
              type="color"
              value={ensureHexColor(backgroundAsset?.gradientColors?.[1], "#00FFAB")}
              onChange={(e) =>
                setBackground({
                  ...backgroundAsset!,
                  gradientColors: [backgroundAsset?.gradientColors?.[0] || "#FF00FF", e.target.value],
                })
              }
              className="h-8 w-8 rounded cursor-pointer border border-white/10 bg-transparent"
            />
          </div>
        )}
      </div>


      {/* Selected block */}
      {selected ? (
        <>
          <div className="rounded-[16px] border border-white/10 bg-[#14141C] p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-white/60">Text Block</h3>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => duplicateBlock(selected.id)}
                  className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] hover:bg-white/20"
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => deleteLyricBlock(selected.id)}
                  className="rounded-full bg-red-500/20 px-2.5 py-1 text-[10px] text-red-300 hover:bg-red-500/30"
                >
                  Delete
                </button>
              </div>
            </div>

            <textarea
              value={selected.text}
              onChange={(e) => updateLyricBlock(selected.id, { text: e.target.value })}
              onBlur={() => pushHistory()}
              className="mt-3 min-h-[60px] w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
            />

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => splitBlock(selected.id, 1)}
                disabled={selected.words.length <= 1}
                className="flex-1 rounded-lg bg-white/10 py-2 text-[11px] hover:bg-white/20 disabled:opacity-40"
              >
                Split after 1st word
              </button>
              <button
                type="button"
                onClick={() => {
                  pushHistory();
                  updateLyricBlock(selected.id, { text: selected.text.toUpperCase() });
                }}
                className="flex-1 rounded-lg bg-white/10 py-2 text-[11px] hover:bg-white/20"
              >
                UPPERCASE
              </button>
            </div>

            {/* Timing */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-white/40">Start (s)</label>
                <input
                  type="number"
                  step={0.05}
                  min={0}
                  value={Number(selected.startTime.toFixed(2))}
                  onChange={(e) => {
                    const val = Math.max(0, parseFloat(e.target.value) || 0);
                    updateLyricBlock(selected.id, { startTime: val });
                  }}
                  onBlur={() => pushHistory()}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/40">End (s)</label>
                <input
                  type="number"
                  step={0.05}
                  min={selected.startTime + 0.1}
                  value={Number(selected.endTime.toFixed(2))}
                  onChange={(e) => {
                    const val = Math.max(selected.startTime + 0.1, parseFloat(e.target.value) || selected.startTime + 0.5);
                    updateLyricBlock(selected.id, { endTime: val });
                  }}
                  onBlur={() => pushHistory()}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-xs text-white"
                />
              </div>
            </div>
          </div>

          <div className="rounded-[16px] border border-white/10 bg-[#14141C] p-4">
            <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-white/60">Style Controls</h3>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] text-white/50">Font Family</label>
                <select
                  value={selected.style.fontFamily}
                  onChange={(e) => {
                    pushHistory();
                    updateBlockStyle(selected.id, { fontFamily: e.target.value });
                  }}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/50 px-2 py-2 text-xs text-white"
                >
                  {[...FONTS, ...customFonts].map((f) => (
                    <option key={f} value={f} style={{ fontFamily: f }}>
                      {f}
                    </option>
                  ))}
                </select>
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] text-white/60">
                  <input type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={handleFontUpload} />
                  <span className="rounded-full bg-white/10 px-3 py-1 hover:bg-white/20">+ Custom .ttf/.otf</span>
                </label>
                {fontError && <div className="mt-1 text-[10px] text-red-400">{fontError}</div>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-white/50">Size ({selected.style.fontSize}px)</label>
                  <input
                    type="range"
                    min={20}
                    max={160}
                    value={selected.style.fontSize}
                    onChange={(e) => updateBlockStyle(selected.id, { fontSize: parseInt(e.target.value, 10) })}
                    onMouseUp={() => pushHistory()}
                    onTouchEnd={() => pushHistory()}
                    className="w-full accent-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-white/50">Outline ({selected.style.outlineWidth}px)</label>
                  <input
                    type="range"
                    min={0}
                    max={12}
                    value={selected.style.outlineWidth}
                    onChange={(e) => updateBlockStyle(selected.id, { outlineWidth: parseInt(e.target.value, 10) })}
                    onMouseUp={() => pushHistory()}
                    onTouchEnd={() => pushHistory()}
                    className="w-full accent-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] text-white/50">Fill</label>
                  <input
                    type="color"
                    value={ensureHexColor(selected.style.color, "#FFFFFF")}
                    onChange={(e) => updateBlockStyle(selected.id, { color: e.target.value })}
                    onBlur={() => pushHistory()}
                    className="mt-1 h-8 w-full rounded border border-white/10 bg-transparent cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-white/50">Stroke</label>
                  <input
                    type="color"
                    value={ensureHexColor(selected.style.outlineColor, "#000000")}
                    onChange={(e) => updateBlockStyle(selected.id, { outlineColor: e.target.value })}
                    onBlur={() => pushHistory()}
                    className="mt-1 h-8 w-full rounded border border-white/10 bg-transparent cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-white/50">Shadow</label>
                  <input
                    type="color"
                    value={ensureHexColor(selected.style.shadowColor, "#000000")}
                    onChange={(e) => updateBlockStyle(selected.id, { shadowColor: e.target.value })}
                    onBlur={() => pushHistory()}
                    className="mt-1 h-8 w-full rounded border border-white/10 bg-transparent cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { key: "bold", label: "B" },
                  { key: "italic", label: "I" },
                  { key: "uppercase", label: "AA" },
                  { key: "shadow", label: "Shadow" },
                  { key: "glow", label: "Glow" },
                ].map((f) => {
                  const isActive = Boolean((selected.style as any)[f.key]);
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => {
                        pushHistory();
                        updateBlockStyle(selected.id, { [f.key]: !isActive });
                      }}
                      className={`rounded-full px-3 py-1.5 text-[11px] font-bold border ${
                        isActive
                          ? "bg-white text-black border-white"
                          : "bg-white/10 text-white/60 border-white/10 hover:bg-white/20"
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="text-[11px] text-white/50">Align</label>
                <div className="mt-1 grid grid-cols-3 gap-1">
                  {(["left", "center", "right"] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => {
                        pushHistory();
                        updateBlockStyle(selected.id, { align: a });
                      }}
                      className={`rounded-lg py-1.5 text-[11px] capitalize ${
                        selected.style.align === a ? "bg-white text-black font-bold" : "bg-white/10 text-white/60"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.style.gradient?.enabled || false}
                  onChange={(e) => {
                    pushHistory();
                    updateBlockStyle(selected.id, {
                      gradient: {
                        enabled: e.target.checked,
                        from: selected.style.gradient?.from || "#FFFFFF",
                        to: selected.style.gradient?.to || "#FF00AA",
                        angle: selected.style.gradient?.angle || 45,
                      },
                    });
                  }}
                />
                <span className="text-[11px] text-white/60">Gradient Fill</span>
                {selected.style.gradient?.enabled && (
                  <div className="flex gap-1 ml-auto">
                    <input
                      type="color"
                      value={ensureHexColor(selected.style.gradient.from, "#FFFFFF")}
                      onChange={(e) =>
                        updateBlockStyle(selected.id, {
                          gradient: { ...selected.style.gradient!, from: e.target.value },
                        })
                      }
                      onBlur={() => pushHistory()}
                      className="h-6 w-6 rounded border border-white/10 bg-transparent cursor-pointer"
                    />
                    <input
                      type="color"
                      value={ensureHexColor(selected.style.gradient.to, "#FF00AA")}
                      onChange={(e) =>
                        updateBlockStyle(selected.id, {
                          gradient: { ...selected.style.gradient!, to: e.target.value },
                        })
                      }
                      onBlur={() => pushHistory()}
                      className="h-6 w-6 rounded border border-white/10 bg-transparent cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[16px] border border-white/10 bg-[#14141C] p-4">
            <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-white/60">Animation</h3>

            {/* In / Out selector buttons */}
            <div className="grid grid-cols-2 gap-2">
              {(["in", "out"] as const).map((dir) => {
                const currentAnim = dir === "in" ? selected.animation.in : selected.animation.out;
                const isOpen = animPickerTarget === dir;
                return (
                  <div key={dir}>
                    <label className="text-[11px] text-white/50 capitalize">{dir}</label>
                    <button
                      type="button"
                      onClick={() => setAnimPickerTarget(isOpen ? null : dir)}
                      className={`mt-1 flex w-full items-center justify-between gap-1 rounded-lg border px-2 py-2 text-left text-xs transition ${
                        isOpen
                          ? "border-white/40 bg-white/10 text-white"
                          : "border-white/10 bg-black/50 text-white/70 hover:border-white/20"
                      }`}
                    >
                      <span className="truncate">{currentAnim || "none"}</span>
                      <span className="shrink-0 text-[10px] text-white/40">{isOpen ? "▲" : "▼"}</span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Visual preset picker */}
            {animPickerTarget && (
              <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-[#0C0C16]">
                {/* Category tabs */}
                <div className="flex flex-wrap gap-1 border-b border-white/5 p-2">
                  {PRESET_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setAnimCategory(cat.id)}
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition ${
                        animCategory === cat.id
                          ? "bg-white/20 text-white"
                          : "text-white/40 hover:text-white/70"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Preset grid */}
                <div className="grid max-h-[320px] grid-cols-2 gap-1.5 overflow-y-auto p-2">
                  {/* None option */}
                  <button
                    type="button"
                    onClick={() => {
                      pushHistory();
                      updateBlockAnimation(selected.id, { [animPickerTarget]: "none" } as any);
                      setAnimPickerTarget(null);
                    }}
                    className={`rounded-lg border p-2 text-left transition ${
                      (animPickerTarget === "in" ? selected.animation.in : selected.animation.out) === "none"
                        ? "border-white/50 bg-white/10"
                        : "border-white/5 bg-white/[0.02] hover:border-white/20"
                    }`}
                  >
                    <div className="grid h-9 place-items-center rounded bg-white/5 text-sm text-white/30">—</div>
                    <div className="mt-1 text-[10px] font-medium text-white">None</div>
                    <div className="text-[9px] text-white/30">no animation</div>
                  </button>

                  {visiblePresets.map((preset) => {
                    const currentVal = animPickerTarget === "in" ? selected.animation.in : selected.animation.out;
                    const isActive = currentVal === preset.id;
                    const isHovered = hoveredPreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onMouseEnter={() => setHoveredPreset(preset.id)}
                        onMouseLeave={() => setHoveredPreset(null)}
                        onClick={() => {
                          pushHistory();
                          updateBlockAnimation(selected.id, { [animPickerTarget]: preset.id } as any);
                          setAnimPickerTarget(null);
                        }}
                        className={`rounded-lg border p-2 text-left transition ${
                          isActive
                            ? "border-purple-400/60 bg-purple-500/15"
                            : "border-white/5 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]"
                        }`}
                      >
                        <div className="grid h-9 place-items-center overflow-hidden rounded bg-[radial-gradient(circle_at_50%_60%,rgba(124,58,237,0.25),transparent)]">
                          <span
                            key={`${preset.id}-${isHovered}`}
                            style={{
                              animation: isHovered
                                ? `lf-${preset.id} ${preset.duration || 1.4}s ${preset.easing} infinite`
                                : undefined,
                              ...(preset.id === "karaoke-fill"
                                ? {
                                    backgroundImage: "linear-gradient(90deg,#06b6d4,#a78bfa)",
                                    backgroundClip: "text",
                                    WebkitBackgroundClip: "text",
                                    color: "transparent",
                                    backgroundSize: "100% 100%",
                                  }
                                : {}),
                            }}
                            className="text-sm font-bold text-white will-change-transform"
                          >
                            Aa
                          </span>
                        </div>
                        <div className="mt-1 truncate text-[10px] font-medium text-white">{preset.name}</div>
                        <div className="truncate text-[9px] text-white/30">{preset.detail}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Duration controls */}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-white/50">Duration In (s)</label>
                <input
                  type="number"
                  step={0.1}
                  min={0.1}
                  max={3}
                  value={selected.animation.durationIn}
                  onChange={(e) => updateBlockAnimation(selected.id, { durationIn: parseFloat(e.target.value) || 0.4 })}
                  onBlur={() => pushHistory()}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-white/50">Duration Out (s)</label>
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  max={3}
                  value={selected.animation.durationOut}
                  onChange={(e) => updateBlockAnimation(selected.id, { durationOut: parseFloat(e.target.value) || 0.3 })}
                  onBlur={() => pushHistory()}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-2 text-xs text-white"
                />
              </div>
            </div>


          </div>
        </>
      ) : (
        <div className="rounded-[16px] border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-white/40">
          Select a lyric block on preview or timeline to edit
        </div>
      )}

      {/* AI toggles */}
      <div className="rounded-[16px] border border-white/10 bg-[#14141C] p-4">
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-white/60">AI Enhancements</h3>
        <div className="space-y-3">
          {[
            { key: "karaokeEnabled" as keyof AISettings, label: "Karaoke Word Highlight", desc: "Per-word sync using Whisper" },
            { key: "visualizerEnabled" as keyof AISettings, label: "Audio Visualizer", desc: "Reactive waveform bars" },
            { key: "beatPulseEnabled" as keyof AISettings, label: "Beat Pulse", desc: "Scale punch on word start" },
            { key: "autoAnimateEnabled" as keyof AISettings, label: "Auto Animations", desc: "AI picks in/out per segment" },
          ].map((t) => (
            <label key={t.key} className="flex items-start gap-3 rounded-xl bg-white/[0.03] p-3 hover:bg-white/[0.06] cursor-pointer">
              <input
                type="checkbox"
                checked={aiSettings[t.key]}
                onChange={(e) => setAISettings({ [t.key]: e.target.checked })}
                className="mt-0.5"
              />
              <div>
                <div className="text-xs font-medium text-white">{t.label}</div>
                <div className="text-[11px] text-white/40">{t.desc}</div>
              </div>
            </label>
          ))}

          {/* Particle Background — multi-style picker */}
          <div className="rounded-xl bg-white/[0.03] p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-white">Particle Background</div>
                <div className="text-[11px] text-white/40">Choose a particle style</div>
              </div>
              {aiSettings.particlesEnabled && (
                <button
                  type="button"
                  onClick={() => setAISettings({ particlesEnabled: false })}
                  className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50 hover:bg-white/20"
                >
                  Off
                </button>
              )}
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {([
                { id: "dust",          label: "Dust",          icon: "·····",   colors: "from-white/20 to-white/5" },
                { id: "stars",         label: "Stars",         icon: "✦✦✦",     colors: "from-yellow-300/30 to-indigo-400/20" },
                { id: "rain",          label: "Rain",          icon: "│││││",   colors: "from-cyan-400/30 to-blue-500/20" },
                { id: "fireflies",     label: "Firefly",       icon: "⬤⬤⬤",     colors: "from-lime-300/30 to-emerald-400/20" },
                { id: "constellation", label: "Cosmo",         icon: "✦—✦",     colors: "from-violet-400/30 to-pink-400/20" },
              ] as const).map((style) => {
                const isActive = aiSettings.particlesEnabled && (aiSettings as any).particleStyle === style.id;
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setAISettings({ particlesEnabled: true, particleStyle: style.id } as any)}
                    className={`flex flex-col items-center gap-1 rounded-xl border p-2 transition ${
                      isActive
                        ? "border-white/50 bg-white/15"
                        : "border-white/5 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.07]"
                    }`}
                  >
                    <div className={`grid h-8 w-full place-items-center rounded-lg bg-gradient-to-br ${style.colors} text-[13px]`}>
                      {style.icon}
                    </div>
                    <span className="text-[9px] text-white/50">{style.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
