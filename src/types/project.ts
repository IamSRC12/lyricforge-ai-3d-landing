export type WordTimestamp = {
  word: string;
  start: number;
  end: number;
};

export type LyricBlockStyle = {
  fontFamily: string;
  fontSize: number;
  color: string;
  outlineColor: string;
  outlineWidth: number;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  shadow: boolean;
  shadowColor: string;
  shadowBlur: number;
  glow: boolean;
  glowColor: string;
  bold: boolean;
  italic: boolean;
  uppercase: boolean;
  align: "left" | "center" | "right";
  gradient?: { enabled: boolean; from: string; to: string; angle: number };
  backgroundBox?: { enabled: boolean; color: string; opacity: number; padding: number; radius: number };
};

/** Any animation preset ID from ANIMATION_PRESETS, or a legacy camelCase name, or "none". */
export type LyricAnimationIn = string;

/** Any animation preset ID from ANIMATION_PRESETS, or a legacy camelCase name, or "none". */
export type LyricAnimationOut = string;

export type LyricAnimation = {
  in: LyricAnimationIn;
  out: LyricAnimationOut;
  durationIn: number; // seconds
  durationOut: number;
  customCSS: string | null;
  staggerWords: boolean;
};

export type LyricBlock = {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  words: WordTimestamp[];
  style: LyricBlockStyle;
  animation: LyricAnimation;
  emotion?: string;
  confidence?: number;
};

export type BackgroundAssetType = "video" | "image" | "gradient" | "particles" | "solid";

export type BackgroundAsset = {
  type: BackgroundAssetType;
  url: string;
  duration: number;
  fileName?: string;
  gradientColors?: string[];
  solidColor?: string;
};

export type Settings = {
  groqApiKey: string;
  nvidiaNimEndpoint: string;
  nvidiaNimApiKey: string;
  nvidiaNimModel: string;
};

export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5" | "21:9";

export type Resolution = "1280x720" | "1920x1080" | "3840x2160";

export type AISettings = {
  karaokeEnabled: boolean;
  autoAnimateEnabled: boolean;
  liveCssEnabled: boolean;
  visualizerEnabled: boolean;
  particlesEnabled: boolean;
  beatPulseEnabled: boolean;
};

export type HistoryState = {
  lyricBlocks: LyricBlock[];
  backgroundAsset: BackgroundAsset | null;
};

export type ProjectMeta = {
  id: string;
  name: string;
  updatedAt: number;
  data: {
    lyricBlocks: LyricBlock[];
    backgroundAsset: BackgroundAsset | null;
    audioName: string | null;
    audioDuration: number;
    aspectRatio?: AspectRatio;
    resolution?: Resolution;
  };
};

export type ProjectState = {
  audioFile: File | null;
  audioUrl: string | null;
  audioDuration: number;
  audioName: string | null;
  audioWaveform: number[];
  backgroundAsset: BackgroundAsset | null;
  lyricBlocks: LyricBlock[];
  settings: Settings;
  aiSettings: AISettings;
  selectedBlockId: string | null;
  currentTime: number;
  isPlaying: boolean;
  aspectRatio: AspectRatio;
  resolution: Resolution;
  fps: 30 | 60;
  history: HistoryState[];
  historyIndex: number;
  projects: ProjectMeta[];
};
