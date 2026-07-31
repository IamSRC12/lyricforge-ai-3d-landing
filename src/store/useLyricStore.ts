import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  DEFAULT_KARAOKE_STYLE,
  DEFAULT_KARAOKE_SCENE,
} from "@/types/project";
import type {
  LyricBlock,
  LyricBlockStyle,
  LyricAnimation,
  WordTimestamp,
  BackgroundAsset,
  Settings,
  AISettings,
  AspectRatio,
  Resolution,
  ProjectState,
  ProjectMeta,
} from "@/types/project";
import {
  assertSegmentCount,
  revokeSegments,
  type AudioSegment,
  type SplitMode,
} from "@/lib/audioSplitter";
import { retimeBlock, r3 } from "@/lib/timeUtils";

export type {
  WordTimestamp,
  LyricBlockStyle,
  LyricAnimation,
  LyricBlock,
  BackgroundAsset,
  Settings,
  AISettings,
  AspectRatio,
  Resolution,
  ProjectState,
  ProjectMeta,
} from "@/types/project";

export const defaultStyle: LyricBlockStyle = {
  fontFamily: "Inter",
  fontSize: 64,
  color: "#FFFFFF",
  outlineColor: "#000000",
  outlineWidth: 3,
  x: 50,
  y: 75,
  shadow: true,
  shadowColor: "#000000",
  shadowBlur: 12,
  glow: false,
  glowColor: "#FF00FF",
  bold: true,
  italic: false,
  uppercase: false,
  align: "center",
  gradient: { enabled: false, from: "#FFFFFF", to: "#FF00AA", angle: 45 },
  backgroundBox: { enabled: false, color: "#000000", opacity: 0.5, padding: 16, radius: 12 },
};

export const defaultAnimation: LyricAnimation = {
  in: "pop",
  out: "fade",
  durationIn: 0.4,
  durationOut: 0.3,
  customCSS: null,
  staggerWords: false,
};

export function normalizeLyricBlock(block: any): LyricBlock {
  const style: LyricBlockStyle = {
    ...defaultStyle,
    ...(block?.style || {}),
    gradient: { ...defaultStyle.gradient!, ...(block?.style?.gradient || {}) },
    backgroundBox: { ...defaultStyle.backgroundBox!, ...(block?.style?.backgroundBox || {}) },
  };

  const animation: LyricAnimation = {
    ...defaultAnimation,
    ...(block?.animation || {}),
  };

  const rawStartTime = Number(block?.startTime);
  const startTime = Number.isFinite(rawStartTime) ? Math.max(0, rawStartTime) : 0;

  const rawEndTime = Number(block?.endTime);
  const endTime = Number.isFinite(rawEndTime)
    ? Math.max(startTime + 0.2, rawEndTime)
    : startTime + 2;

  // ⚠️ DO NOT enforce monotonic word order — Whisper is the timing authority.
  // Only sanitize invalid numbers; preserve original start/end exactly.
  const words: WordTimestamp[] = Array.isArray(block?.words)
    ? block.words
        .map((word: any) => {
          const rawStart = Number(word?.start);
          const rawEnd = Number(word?.end);

          if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) return null;

          // Clamp into block range only — never shift forward artificially.
          const start = Math.max(startTime, Math.min(endTime, rawStart));
          const end = Math.max(start + 0.02, Math.min(endTime, rawEnd));

          return {
            word: String(word?.word || "").trim(),
            start: Number(start.toFixed(3)),
            end: Number(end.toFixed(3)),
          };
        })
        .filter(
          (w: WordTimestamp | null): w is WordTimestamp =>
            w !== null && w.word.length > 0 && w.end > w.start
        )
    : [];

  return {
    id: String(block?.id || `block_${Math.random().toString(36).slice(2, 9)}`),
    text: String(block?.text || ""),
    startTime,
    endTime,
    words,
    style,
    animation,
    emotion: block?.emotion ? String(block.emotion) : undefined,
    isInstrumental: Boolean(block?.isInstrumental),
    locked: Boolean(block?.locked),
    confidence:
      typeof block?.confidence === "number" && Number.isFinite(block.confidence)
        ? block.confidence
        : undefined,
  };
}

export function normalizeBackgroundAsset(asset: any): BackgroundAsset | null {
  if (!asset || typeof asset !== "object" || !asset.type) return null;
  const isBlob = typeof asset.url === "string" && asset.url.startsWith("blob:");
  return {
    type: asset.type,
    url: isBlob ? "" : String(asset.url || ""),
    duration: Number(asset.duration) || 0,
    fileName: asset.fileName ? String(asset.fileName) : undefined,
    gradientColors: Array.isArray(asset.gradientColors) ? asset.gradientColors.map(String) : undefined,
    solidColor: asset.solidColor ? String(asset.solidColor) : undefined,
  };
}

type Actions = {
  setAudio: (file: File, url: string, duration: number, waveform: number[]) => void;
  setBackground: (asset: BackgroundAsset | null) => void;
  setLyricBlocks: (blocks: LyricBlock[]) => void;
  addLyricBlock: (block: LyricBlock) => void;
  updateLyricBlock: (id: string, patch: Partial<LyricBlock>) => void;
  updateLyricBlocks: (patches: { id: string; patch: Partial<LyricBlock> }[]) => void;
  updateBlockStyle: (id: string, stylePatch: Partial<LyricBlockStyle>) => void;
  updateBlockAnimation: (id: string, animPatch: Partial<LyricAnimation>) => void;
  applyStyleToAllBlocks: (stylePatch: Partial<LyricBlockStyle>) => void;
  applyAnimationToAllBlocks: (animPatch: Partial<LyricAnimation>) => void;
  deleteLyricBlock: (id: string) => void;
  duplicateBlock: (id: string) => void;
  splitBlock: (id: string, wordIndex: number) => void;
  setSelectedBlock: (id: string | null) => void;
  setCurrentTime: (t: number) => void;
  setIsPlaying: (p: boolean) => void;
  setSettings: (s: Partial<Settings>) => void;
  setAISettings: (s: Partial<AISettings>) => void;
  setAspectRatio: (r: AspectRatio) => void;
  setResolution: (r: Resolution) => void;
  setFps: (fps: 30 | 60) => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  loadProject: (data: Partial<ProjectState>) => void;
  resetProject: () => void;
  saveProjectMeta: (name: string) => void;
  setSplitMode: (mode: SplitMode) => void;
  setAudioSegments: (segments: AudioSegment[]) => void;
  clearAudioSegments: () => void;
  insertSegmentsIntoTimeline: (options?: {
    includeInstrumentalBlocks?: boolean;
    strict?: boolean;
  }) => void;
};

const initialSettings: Settings = {
  groqApiKey: "",
  nvidiaNimEndpoint: "https://integrate.api.nvidia.com",
  nvidiaNimApiKey: "",
  nvidiaNimModel: "minimaxai/minimax-m3",
};

const initialAISettings: AISettings = {
  karaokeEnabled: true,
  autoAnimateEnabled: true,
  liveCssEnabled: false,
  visualizerEnabled: false,
  particlesEnabled: false,
  beatPulseEnabled: true,
};

const initialState: ProjectState = {
  audioFile: null,
  audioUrl: null,
  audioDuration: 0,
  audioName: null,
  audioWaveform: [],
  audioSegments: [],
  splitMode: "tight",
  backgroundAsset: null,
  lyricBlocks: [],
  settings: initialSettings,
  aiSettings: initialAISettings,
  selectedBlockId: null,
  currentTime: 0,
  isPlaying: false,
  aspectRatio: "16:9",
  resolution: "1920x1080",
  fps: 60,
  history: [{ lyricBlocks: [], backgroundAsset: null }],
  historyIndex: 0,
  projects: [],
};

function snapshotState(lyricBlocks: LyricBlock[], backgroundAsset: BackgroundAsset | null) {
  return {
    lyricBlocks: JSON.parse(JSON.stringify(lyricBlocks)),
    backgroundAsset: backgroundAsset ? JSON.parse(JSON.stringify(backgroundAsset)) : null,
  };
}

export const useLyricStore = create<ProjectState & Actions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setAudio: (file, url, duration, waveform) => {
        const prevUrl = get().audioUrl;
        if (prevUrl && prevUrl.startsWith("blob:") && prevUrl !== url) {
          try { URL.revokeObjectURL(prevUrl); } catch {}
        }
        if (file) {
          import("@/lib/audioEngine").then(({ audioEngine }) => {
            audioEngine.load(file).catch(() => {});
          });
        }
        set({
          audioFile: file,
          audioUrl: url,
          audioDuration: Math.max(0, duration),
          audioName: file.name,
          audioWaveform: waveform,
        });
      },

      setBackground: (asset) => {
        const prev = get().backgroundAsset;
        if (prev?.url && prev.url.startsWith("blob:") && prev.url !== asset?.url) {
          try { URL.revokeObjectURL(prev.url); } catch {}
        }
        get().pushHistory();
        set({ backgroundAsset: asset });
      },

      setLyricBlocks: (blocks) => {
        const normalized = blocks.map(normalizeLyricBlock);
        get().pushHistory();
        set({
          lyricBlocks: normalized,
          selectedBlockId: normalized[0]?.id ?? null,
        });
      },

      addLyricBlock: (block) => {
        get().pushHistory();
        const normalized = normalizeLyricBlock(block);
        set({
          lyricBlocks: [...get().lyricBlocks, normalized],
          selectedBlockId: normalized.id,
        });
      },

      updateLyricBlock: (id, patch) => {
        set({
          lyricBlocks: get().lyricBlocks.map((b) => (b.id === id ? normalizeLyricBlock({ ...b, ...patch }) : b)),
        });
      },

      updateLyricBlocks: (patches) => {
        const patchMap = new Map(patches.map((p) => [p.id, p.patch]));
        set({
          lyricBlocks: get().lyricBlocks.map((b) => {
            const patch = patchMap.get(b.id);
            return patch ? normalizeLyricBlock({ ...b, ...patch }) : b;
          }),
        });
      },

      updateBlockStyle: (id, stylePatch) => {
        set({
          lyricBlocks: get().lyricBlocks.map((b) => {
            if (b.id !== id) return b;
            const updatedStyle: LyricBlockStyle = {
              ...b.style,
              ...stylePatch,
              gradient: stylePatch.gradient ? { ...b.style.gradient!, ...stylePatch.gradient } : b.style.gradient,
              backgroundBox: stylePatch.backgroundBox ? { ...b.style.backgroundBox!, ...stylePatch.backgroundBox } : b.style.backgroundBox,
            };
            return { ...b, style: updatedStyle };
          }),
        });
      },

      updateBlockAnimation: (id, animPatch) => {
        set({
          lyricBlocks: get().lyricBlocks.map((b) => (b.id === id ? { ...b, animation: { ...b.animation, ...animPatch } } : b)),
        });
      },

      applyStyleToAllBlocks: (stylePatch) => {
        get().pushHistory();
        set({
          lyricBlocks: get().lyricBlocks.map((b) => {
            const updatedStyle: LyricBlockStyle = {
              ...b.style,
              ...stylePatch,
              gradient: stylePatch.gradient ? { ...b.style.gradient!, ...stylePatch.gradient } : b.style.gradient,
              backgroundBox: stylePatch.backgroundBox ? { ...b.style.backgroundBox!, ...stylePatch.backgroundBox } : b.style.backgroundBox,
            };
            return { ...b, style: updatedStyle };
          }),
        });
      },

      applyAnimationToAllBlocks: (animPatch) => {
        get().pushHistory();
        set({
          lyricBlocks: get().lyricBlocks.map((b) => ({
            ...b,
            animation: { ...b.animation, ...animPatch },
          })),
        });
      },

      deleteLyricBlock: (id) => {
        get().pushHistory();
        const remaining = get().lyricBlocks.filter((b) => b.id !== id);
        const nextSelected = get().selectedBlockId === id ? remaining[0]?.id ?? null : get().selectedBlockId;
        set({ lyricBlocks: remaining, selectedBlockId: nextSelected });
      },

      duplicateBlock: (id) => {
        const block = get().lyricBlocks.find((b) => b.id === id);
        if (!block) return;
        get().pushHistory();
        const cloned: LyricBlock = JSON.parse(JSON.stringify(block));
        cloned.id = `block_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const duration = block.endTime - block.startTime;
        cloned.startTime = block.endTime + 0.1;
        cloned.endTime = cloned.startTime + Math.max(0.2, duration);
        const shift = cloned.startTime - block.startTime;
        cloned.words = cloned.words.map((w) => ({ ...w, start: w.start + shift, end: w.end + shift }));

        set({ lyricBlocks: [...get().lyricBlocks, cloned], selectedBlockId: cloned.id });
      },

      splitBlock: (id, wordIndex) => {
        const block = get().lyricBlocks.find((b) => b.id === id);
        if (!block || block.words.length <= 1) return;
        const splitIdx = Math.max(1, Math.min(wordIndex, block.words.length - 1));
        const firstWords = block.words.slice(0, splitIdx);
        const secondWords = block.words.slice(splitIdx);
        if (firstWords.length === 0 || secondWords.length === 0) return;

        get().pushHistory();

        const firstBlock: LyricBlock = JSON.parse(JSON.stringify(block));
        firstBlock.id = `block_${Date.now()}_a`;
        firstBlock.text = firstWords.map((w) => w.word).join(" ");
        firstBlock.words = firstWords;
        firstBlock.startTime = firstWords[0].start;
        firstBlock.endTime = firstWords[firstWords.length - 1].end;

        const secondBlock: LyricBlock = JSON.parse(JSON.stringify(block));
        secondBlock.id = `block_${Date.now()}_b`;
        secondBlock.text = secondWords.map((w) => w.word).join(" ");
        secondBlock.words = secondWords;
        secondBlock.startTime = secondWords[0].start;
        secondBlock.endTime = secondWords[secondWords.length - 1].end;

        const remaining = get().lyricBlocks.filter((b) => b.id !== id);
        const updated = [...remaining, firstBlock, secondBlock].sort((a, b) => a.startTime - b.startTime);
        set({ lyricBlocks: updated, selectedBlockId: firstBlock.id });
      },

      setSelectedBlock: (id) => set({ selectedBlockId: id }),
      setCurrentTime: (t) => set({ currentTime: Math.max(0, t) }),
      setIsPlaying: (p) => set({ isPlaying: p }),
      setSettings: (s) => set({ settings: { ...get().settings, ...s } }),
      setAISettings: (s) => set({ aiSettings: { ...get().aiSettings, ...s } }),
      setAspectRatio: (r) => set({ aspectRatio: r }),
      setResolution: (r) => set({ resolution: r }),
      setFps: (fps) => set({ fps }),

      pushHistory: () => {
        const { lyricBlocks, backgroundAsset, history, historyIndex } = get();
        const currentSnap = snapshotState(lyricBlocks, backgroundAsset);

        // Truncate redo branch
        const truncated = history.slice(0, Math.max(0, historyIndex + 1));
        truncated.push(currentSnap);

        if (truncated.length > 30) truncated.shift();
        set({ history: truncated, historyIndex: truncated.length - 1 });
      },

      undo: () => {
        const { history, historyIndex } = get();
        if (historyIndex <= 0) return;
        const targetIndex = historyIndex - 1;
        const target = history[targetIndex];
        set({
          lyricBlocks: JSON.parse(JSON.stringify(target.lyricBlocks)),
          backgroundAsset: target.backgroundAsset ? JSON.parse(JSON.stringify(target.backgroundAsset)) : null,
          historyIndex: targetIndex,
        });
      },

      redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex >= history.length - 1) return;
        const targetIndex = historyIndex + 1;
        const target = history[targetIndex];
        set({
          lyricBlocks: JSON.parse(JSON.stringify(target.lyricBlocks)),
          backgroundAsset: target.backgroundAsset ? JSON.parse(JSON.stringify(target.backgroundAsset)) : null,
          historyIndex: targetIndex,
        });
      },

      loadProject: (data) => {
        const blocks = (data.lyricBlocks || []).map(normalizeLyricBlock);
        const bg = normalizeBackgroundAsset(data.backgroundAsset);
        set({
          ...data,
          lyricBlocks: blocks,
          backgroundAsset: bg,
          selectedBlockId: blocks[0]?.id ?? null,
          history: [{ lyricBlocks: blocks, backgroundAsset: bg }],
          historyIndex: 0,
        } as any);
      },

      resetProject: () => {
        const prevUrl = get().audioUrl;
        if (prevUrl && prevUrl.startsWith("blob:")) {
          try { URL.revokeObjectURL(prevUrl); } catch {}
        }
        revokeSegments(get().audioSegments);
        set({
          ...initialState,
          settings: get().settings,
          history: [{ lyricBlocks: [], backgroundAsset: null }],
          historyIndex: 0,
        });
      },

      setSplitMode: (mode) => set({ splitMode: mode }),

      setAudioSegments: (segments) => {
        revokeSegments(get().audioSegments);
        set({ audioSegments: segments });
      },

      clearAudioSegments: () => {
        revokeSegments(get().audioSegments);
        set({ audioSegments: [] });
      },

      /**
       * Snaps the timeline to the verified split.
       * Uses retimeBlock(..., "trim") so word-level Whisper timings are NEVER
       * warped — only the visible window of each block moves.
       */
      insertSegmentsIntoTimeline: (options = {}) => {
        const { audioSegments, lyricBlocks, audioDuration } = get();
        if (audioSegments.length === 0) return;

        const lyricClips = audioSegments.filter((s) => !s.isInstrumental);
        if (options.strict !== false) {
          assertSegmentCount(audioSegments, lyricBlocks.filter((b) => !b.isInstrumental).length);
        }

        get().pushHistory();

        const byId = new Map(lyricClips.filter((s) => s.blockId).map((s) => [s.blockId!, s]));
        const next: LyricBlock[] = [];

        lyricBlocks
          .filter((b) => !b.isInstrumental)
          .forEach((block, i) => {
            const seg = byId.get(block.id) ?? lyricClips[i];
            if (!seg) {
              next.push(block);
              return;
            }
            next.push(
              normalizeLyricBlock({
                ...block,
                ...retimeBlock(block, seg.startTime, seg.endTime, "trim"),
              }),
            );
          });

        if (options.includeInstrumentalBlocks) {
          for (const seg of audioSegments.filter((s) => s.isInstrumental)) {
            next.push(
              normalizeLyricBlock({
                id: `inst_${seg.id}`,
                text: "",
                startTime: seg.startTime,
                endTime: seg.endTime,
                words: [],
                isInstrumental: true,
                locked: true,
              }),
            );
          }
        }

        const sorted = next.sort((a, b) => a.startTime - b.startTime);
        const lastEnd = sorted[sorted.length - 1]?.endTime ?? 0;

        set({
          lyricBlocks: sorted,
          selectedBlockId: sorted[0]?.id ?? null,
          currentTime: 0,
          audioDuration: Math.max(audioDuration, r3(lastEnd)),
        });
      },

      saveProjectMeta: (name) => {
        const cleanName = name.trim();
        if (!cleanName) return;

        const projects = get().projects;
        const existingIdx = projects.findIndex((p) => p.name === cleanName);

        const projectData = {
          lyricBlocks: get().lyricBlocks,
          backgroundAsset: get().backgroundAsset ? normalizeBackgroundAsset(get().backgroundAsset) : null,
          audioName: get().audioName,
          audioDuration: get().audioDuration,
          aspectRatio: get().aspectRatio,
          resolution: get().resolution,
        };

        if (existingIdx >= 0) {
          const updated = [...projects];
          updated[existingIdx] = {
            id: updated[existingIdx].id,
            name: cleanName,
            updatedAt: Date.now(),
            data: projectData,
          };
          set({ projects: updated });
        } else {
          const newMeta: ProjectMeta = {
            id: `proj_${Date.now()}`,
            name: cleanName,
            updatedAt: Date.now(),
            data: projectData,
          };
          set({ projects: [newMeta, ...projects].slice(0, 20) });
        }
      },
    }),
    {
      name: "lyrical-videopro-storage",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        settings: state.settings,
        aiSettings: state.aiSettings,
        lyricBlocks: state.lyricBlocks,
        backgroundAsset: state.backgroundAsset ? normalizeBackgroundAsset(state.backgroundAsset) : null,
        audioName: state.audioName,
        audioDuration: state.audioDuration,
        aspectRatio: state.aspectRatio,
        resolution: state.resolution,
        fps: state.fps,
        projects: state.projects,
        splitMode: state.splitMode,
      }),
      migrate: (persistedState: any, version: number) => {
        if (version < 2 || !persistedState) {
          return {
            ...initialState,
            settings: { ...initialSettings, ...(persistedState?.settings || {}) },
            aiSettings: { ...initialAISettings, ...(persistedState?.aiSettings || {}) },
            lyricBlocks: Array.isArray(persistedState?.lyricBlocks) ? persistedState.lyricBlocks.map(normalizeLyricBlock) : [],
            backgroundAsset: normalizeBackgroundAsset(persistedState?.backgroundAsset),
            aspectRatio: persistedState?.aspectRatio || "16:9",
            resolution: persistedState?.resolution || "1920x1080",
            fps: persistedState?.fps === 30 ? 30 : 60,
            splitMode: persistedState?.splitMode || "tight",
          };
        }
        return persistedState;
      },
    }
  )
);
