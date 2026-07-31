export type WordTimestamp = {
  word: string;
  start: number;
  end: number;
  /** 0..1 — how sure the aligner is about this word's position. */
  confidence?: number;
  /** true when the timestamp came from a real Whisper match (not interpolated). */
  anchored?: boolean;
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
  letterSpacing?: number;
  lineHeight?: number;
  gradient?: { enabled: boolean; from: string; to: string; angle: number };
  backgroundBox?: {
    enabled: boolean;
    color: string;
    opacity: number;
    padding: number;
    radius: number;
  };
};

export type LyricAnimationIn = string;
export type LyricAnimationOut = string;

export type LyricAnimation = {
  in: LyricAnimationIn;
  out: LyricAnimationOut;
  durationIn: number;
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
  /** locked blocks are never moved by ripple/auto-adjust operations */
  locked?: boolean;
  /** instrumental / music-break placeholder */
  isInstrumental?: boolean;
};

/* ------------------------------------------------------------------ *
 * Karaoke highlighting
 * ------------------------------------------------------------------ */

export type KaraokeMode =
  | "off"
  /** gradient/solid sweep left→right across the active word */
  | "sweep"
  /** whole word switches colour the instant it starts */
  | "wordSwap"
  /** sweep + colour swap + glow + pop */
  | "both";

export type KaraokeStyle = {
  mode: KaraokeMode;
  /** colour of the word being sung right now */
  activeColor: string;
  /** second stop for a gradient sweep; set equal to activeColor for flat fill */
  activeColor2: string;
  activeGlowColor: string;
  /** 0..1 */
  glowStrength: number;
  /** words already sung */
  sungColor: string;
  /** keep sungColour after the word finishes (false = revert to base fill) */
  holdSung: boolean;
  /** words not yet reached */
  unsungColor: string;
  unsungOpacity: number;
  /** extra scale punch on the active word, 0..0.4 */
  scalePop: number;
  /** start the highlight this many ms before the word's timestamp */
  leadInMs: number;
  /** underline that grows with the word */
  underline: boolean;
  underlineColor: string;
  underlineThickness: number;
};

export const DEFAULT_KARAOKE_STYLE: KaraokeStyle = {
  mode: "both",
  activeColor: "#FFD60A",
  activeColor2: "#FF7A18",
  activeGlowColor: "#FFD60A",
  glowStrength: 0.85,
  sungColor: "#FFFFFF",
  holdSung: true,
  unsungColor: "#FFFFFF",
  unsungOpacity: 0.42,
  scalePop: 0.08,
  leadInMs: 0,
  underline: false,
  underlineColor: "#FFD60A",
  underlineThickness: 4,
};

/* ------------------------------------------------------------------ *
 * Karaoke scene (background image + cover art + scrolling lyrics)
 * ------------------------------------------------------------------ */

export type KaraokeSceneSettings = {
  enabled: boolean;
  backgroundUrl: string | null;
  backgroundName?: string | null;
  coverUrl: string | null;
  coverName?: string | null;
  title: string;
  artist: string;
  /** 0..40 px at 1080p */
  backgroundBlur: number;
  /** 0..1 */
  backgroundDim: number;
  /** ken-burns drift amount, 0..0.15 */
  backgroundZoom: number;
  showCover: boolean;
  /** cover height as % of frame height */
  coverSize: number;
  coverRadius: number;
  coverGlow: boolean;
  layout: "cover-left" | "cover-top" | "lyrics-only";
  /** how many lyric lines are visible in the scroll column */
  linesVisible: number;
  lineGap: number;
  /** where the active line sits vertically, % of height */
  focusY: number;
  /** seconds the scroll takes to settle on a new line */
  scrollSettle: number;
  activeLineScale: number;
  /** opacity of lines above/below the active one */
  pastOpacity: number;
  futureOpacity: number;
  showProgressBar: boolean;
  showCountdown: boolean;
  accentColor: string;
  panelOpacity: number;
};

export const DEFAULT_KARAOKE_SCENE: KaraokeSceneSettings = {
  enabled: false,
  backgroundUrl: null,
  backgroundName: null,
  coverUrl: null,
  coverName: null,
  title: "",
  artist: "",
  backgroundBlur: 18,
  backgroundDim: 0.55,
  backgroundZoom: 0.06,
  showCover: true,
  coverSize: 34,
  coverRadius: 18,
  coverGlow: true,
  layout: "cover-left",
  linesVisible: 5,
  lineGap: 0.42,
  focusY: 52,
  scrollSettle: 0.42,
  activeLineScale: 1.14,
  pastOpacity: 0.28,
  futureOpacity: 0.42,
  showProgressBar: true,
  showCountdown: true,
  accentColor: "#7C3AED",
  panelOpacity: 0.32,
};

export type BackgroundAssetType =
  | "video"
  | "image"
  | "gradient"
  | "particles"
  | "solid";

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
export type ParticleStyle =
  | "dust"
  | "stars"
  | "rain"
  | "fireflies"
  | "constellation";

export type AISettings = {
  karaokeEnabled: boolean;
  autoAnimateEnabled: boolean;
  liveCssEnabled: boolean;
  visualizerEnabled: boolean;
  particlesEnabled: boolean;
  particleStyle: ParticleStyle;
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
    karaokeStyle?: KaraokeStyle;
    karaokeScene?: KaraokeSceneSettings;
    globalOffsetMs?: number;
  };
};

export type ProjectState = {
  audioFile: File | null;
  audioUrl: string | null;
  audioDuration: number;
  audioName: string | null;
  audioWaveform: number[];
  rawLyrics: string;
  backgroundAsset: BackgroundAsset | null;
  lyricBlocks: LyricBlock[];
  settings: Settings;
  aiSettings: AISettings;
  karaokeStyle: KaraokeStyle;
  karaokeScene: KaraokeSceneSettings;
  /** non-destructive global nudge applied to ALL lyrics at render time (ms) */
  globalOffsetMs: number;
  /** measured/declared audio output latency compensation (ms) */
  latencyMs: number;
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
