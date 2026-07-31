import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing, Sequence, Audio, Video, Img } from "remotion";
import type { LyricBlock, BackgroundAsset } from "@/types/project";

type Props = {
  lyricBlocks: LyricBlock[];
  backgroundAsset: BackgroundAsset | null;
  audioUrl: string | null;
  audioDuration: number;
  karaokeEnabled: boolean;
  currentTime?: number;
  isPlaying?: boolean;
  visualizerEnabled?: boolean;
  particlesEnabled?: boolean;
  aspectRatio?: string;
};

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function getAnimationStyle(
  anim: LyricBlock["animation"]["in"],
  progress: number,
  type: "in" | "out",
  frame: number
) {
  const p = type === "out" ? 1 - progress : progress;

  switch (anim) {
    case "fade":
      return { opacity: interpolate(p, [0, 1], [0, 1]) };
    case "pop":
      return {
        opacity: interpolate(p, [0, 0.2, 1], [0, 1, 1]),
        transform: `scale(${interpolate(p, [0, 0.6, 1], [0.3, 1.15, 1], { easing: Easing.out(Easing.back(1.8)) })})`,
      };
    case "slideUp":
      return { opacity: p, transform: `translateY(${interpolate(p, [0, 1], [60, 0])}px)` };
    case "slideDown":
      return { opacity: p, transform: `translateY(${interpolate(p, [0, 1], [-60, 0])}px)` };
    case "slideLeft":
      return { opacity: p, transform: `translateX(${interpolate(p, [0, 1], [80, 0])}px)` };
    case "slideRight":
      return { opacity: p, transform: `translateX(${interpolate(p, [0, 1], [-80, 0])}px)` };
    case "zoom":
      return { opacity: p, transform: `scale(${interpolate(p, [0, 1], [1.8, 1])})` };
    case "bounce":
      return {
        transform: `translateY(${interpolate(p, [0, 0.3, 0.6, 0.8, 1], [40, -12, 6, -3, 0], { easing: Easing.bounce })}px)`,
        opacity: 1,
      };
    case "glitch": {
      const offsetX = p < 0.3 ? (pseudoRandom(frame * 1.5) - 0.5) * 12 : 0;
      const skewX = p < 0.4 ? (pseudoRandom(frame * 2.5) - 0.5) * 12 : 0;
      const hue = p < 0.35 ? pseudoRandom(frame * 3.5) * 60 : 0;
      return {
        opacity: p > 0.15 ? 1 : 0,
        transform: `translate(${offsetX}px, 0) skew(${skewX}deg)`,
        filter: hue ? `hue-rotate(${hue}deg)` : "none",
      };
    }
    case "typewriter":
      return { opacity: 1 };
    case "kinetic":
      return {
        transform: `rotate(${interpolate(p, [0, 1], [-8, 0])}deg) scale(${interpolate(p, [0, 1], [0.8, 1])})`,
        opacity: p,
      };
    default:
      return { opacity: p };
  }
}

function LyricBlockRender({
  block,
  absoluteFrame,
  fps,
  karaokeEnabled,
}: {
  block: LyricBlock;
  absoluteFrame: number;
  fps: number;
  karaokeEnabled: boolean;
}) {
  const blockStartFrame = Math.round(block.startTime * fps);
  const blockEndFrame = Math.round(block.endTime * fps);
  const localFrame = Math.max(0, absoluteFrame - blockStartFrame);

  const progressIn = Math.min(
    1,
    localFrame / Math.max(1, block.animation.durationIn * fps)
  );

  const progressOutDuration = Math.max(
    1,
    block.animation.durationOut * fps
  );

  const outStartFrame = blockEndFrame - progressOutDuration;
  const isOut = absoluteFrame >= outStartFrame;

  const progressOut = isOut
    ? Math.min(
        1,
        Math.max(
          0,
          (absoluteFrame - outStartFrame) /
            progressOutDuration
        )
      )
    : 0;

  const inStyle = getAnimationStyle(
    block.animation.in,
    progressIn,
    "in",
    absoluteFrame
  );

  const outStyle = isOut
    ? getAnimationStyle(
        block.animation.out,
        progressOut,
        "out",
        absoluteFrame
      )
    : {};

  const combined = {
    ...inStyle,
    ...(isOut ? outStyle : {}),
  };

  const currentTimeSec = absoluteFrame / fps;

  return (
    <div
      style={{
        position: "absolute",
        left: `${block.style.x}%`,
        top: `${block.style.y}%`,
        transform: `translate(-50%, -50%) ${combined.transform || ""}`,
        opacity: combined.opacity ?? 1,
        filter: combined.filter,
        textAlign: block.style.align,
        fontFamily: block.style.fontFamily,
        fontSize: `${block.style.fontSize}px`,
        fontWeight: block.style.bold ? 800 : 600,
        fontStyle: block.style.italic ? "italic" : "normal",
        textTransform: block.style.uppercase ? "uppercase" : "none",
        color: block.style.gradient?.enabled ? "transparent" : block.style.color,
        backgroundImage: block.style.gradient?.enabled
          ? `linear-gradient(${block.style.gradient.angle}deg, ${block.style.gradient.from}, ${block.style.gradient.to})`
          : undefined,
        WebkitBackgroundClip: block.style.gradient?.enabled ? "text" : undefined,
        backgroundClip: block.style.gradient?.enabled ? "text" : undefined,
        WebkitTextStroke:
          block.style.outlineWidth > 0 ? `${block.style.outlineWidth}px ${block.style.outlineColor}` : undefined,
        textShadow: [
          block.style.shadow ? `0 2px ${block.style.shadowBlur}px ${block.style.shadowColor}` : "",
          block.style.glow ? `0 0 20px ${block.style.glowColor}, 0 0 40px ${block.style.glowColor}` : "",
        ]
          .filter(Boolean)
          .join(", "),
        lineHeight: 1.15,
        maxWidth: "85%",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
      className="lyric-custom"
    >
      {block.style.backgroundBox?.enabled && (
        <div
          style={{
            position: "absolute",
            inset: `-${block.style.backgroundBox.padding}px`,
            background: block.style.backgroundBox.color,
            opacity: block.style.backgroundBox.opacity,
            borderRadius: block.style.backgroundBox.radius,
            zIndex: -1,
          }}
        />
      )}

      {karaokeEnabled && block.words.length > 0 ? (
        <span>
          {block.words.map((w, wi) => {
            const active = currentTimeSec >= w.start && currentTimeSec < w.end;
            const past = currentTimeSec >= w.end;
            return (
              <span
                key={wi}
                className="lyric-word"
                style={{
                  color: active ? "#FFD60A" : past ? block.style.color : `${block.style.color}B0`,
                  textShadow: active ? `0 0 18px #FFD60A` : undefined,
                  display: "inline-block",
                  marginRight: "0.25em",
                  transform: active ? "scale(1.12)" : "scale(1)",
                }}
              >
                {w.word}
              </span>
            );
          })}
        </span>
      ) : block.animation.in === "typewriter" ? (
        <span
          style={{
            display: "inline-block",
            overflow: "hidden",
            whiteSpace: "nowrap",
            width: `${Math.round(progressIn * 100)}%`,
          }}
        >
          {block.text}
        </span>
      ) : (
        <span>{block.text}</span>
      )}
    </div>
  );
}

function DeterministicParticles({ frame }: { frame: number }) {
  const particles = Array.from({ length: 60 }, (_, i) => {
    const seedX = i * 17.1;
    const seedY = i * 29.3;
    const speedX = (pseudoRandom(seedX) - 0.5) * 0.8;
    const speedY = (pseudoRandom(seedY) - 0.5) * 0.8;
    const posX = (pseudoRandom(seedX + 1) * 100 + frame * speedX) % 100;
    const posY = (pseudoRandom(seedY + 1) * 100 + frame * speedY) % 100;
    const opacity = 0.2 + pseudoRandom(i * 41.2) * 0.5;
    const size = 2 + pseudoRandom(i * 53.7) * 4;

    return (
      <div
        key={i}
        style={{
          position: "absolute",
          left: `${(posX + 100) % 100}%`,
          top: `${(posY + 100) % 100}%`,
          width: size,
          height: size,
          borderRadius: "50%",
          background: "white",
          opacity,
          pointerEvents: "none",
        }}
      />
    );
  });

  return <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>{particles}</div>;
}

export function LyricComposition({
  lyricBlocks,
  backgroundAsset,
  audioUrl,
  audioDuration: _audioDuration,
  karaokeEnabled,
  visualizerEnabled,
  particlesEnabled,
}: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      {/* Background */}
      {backgroundAsset ? (
        backgroundAsset.type === "video" ? (
          <Video
            src={backgroundAsset.url}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            loop
          />
        ) : backgroundAsset.type === "image" ? (
          <Img src={backgroundAsset.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : backgroundAsset.type === "gradient" ? (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: `linear-gradient(135deg, ${backgroundAsset.gradientColors?.[0] || "#FF00FF"}, ${
                backgroundAsset.gradientColors?.[1] || "#00FFAB"
              })`,
            }}
          />
        ) : backgroundAsset.type === "solid" ? (
          <div style={{ width: "100%", height: "100%", background: backgroundAsset.solidColor || "#0A0A0F" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "#0A0A0F" }} />
        )
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "radial-gradient(ellipse at center, #1A1A2E 0%, #0A0A0F 70%)",
          }}
        />
      )}

      {/* Dark overlay for contrast */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 50%, rgba(0,0,0,0.25) 100%)",
          pointerEvents: "none",
        }}
      />

      {particlesEnabled && <DeterministicParticles frame={frame} />}

      {/* Visualizer bars */}
      {visualizerEnabled && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 100,
            display: "flex",
            alignItems: "flex-end",
            gap: 3,
            padding: "0 20px",
            opacity: 0.6,
          }}
        >
          {Array.from({ length: 64 }).map((_, i) => {
            const h = 10 + Math.abs(Math.sin((frame / fps) * 3 + i * 0.3)) * 70;
            return <div key={i} style={{ flex: 1, height: h, background: "white", borderRadius: 4, opacity: 0.8 }} />;
          })}
        </div>
      )}

      {audioUrl && <Audio src={audioUrl} volume={1} />}

      {lyricBlocks.map((block) => (
        <Sequence
          key={block.id}
          from={Math.round(block.startTime * fps)}
          durationInFrames={Math.max(1, Math.round((block.endTime - block.startTime) * fps))}
        >
          <LyricBlockRender
            block={block}
            absoluteFrame={frame}
            fps={fps}
            karaokeEnabled={karaokeEnabled}
          />
        </Sequence>
      ))}

      {/* Safe area */}
      <div
        style={{
          position: "absolute",
          inset: "3%",
          border: "1px dashed rgba(255,255,255,0.08)",
          pointerEvents: "none",
          borderRadius: 12,
        }}
      />
    </AbsoluteFill>
  );
}
