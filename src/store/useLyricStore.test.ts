import { describe, it, expect, beforeEach } from "vitest";
import { useLyricStore, defaultStyle, defaultAnimation } from "./useLyricStore";
import type { LyricBlock } from "./useLyricStore";

describe("useLyricStore", () => {
  beforeEach(() => {
    useLyricStore.getState().resetProject();
  });

  it("initializes with default state", () => {
    const state = useLyricStore.getState();
    expect(state.lyricBlocks.length).toBe(0);
    expect(state.isPlaying).toBe(false);
    expect(state.currentTime).toBe(0);
    expect(state.audioUrl).toBeNull();
  });

  it("can set audio and add lyric blocks", () => {
    const mockFile = new File(["dummy"], "audio.mp3", { type: "audio/mp3" });
    const sampleBlock: LyricBlock = {
      id: "b1",
      text: "Test Lyric",
      startTime: 1.0,
      endTime: 3.0,
      words: [{ word: "Test", start: 1.0, end: 1.8 }],
      style: { ...defaultStyle },
      animation: { ...defaultAnimation },
    };

    useLyricStore.getState().setAudio(mockFile, "blob:test-audio", 180, [0.1, 0.5, 0.8]);
    useLyricStore.getState().addLyricBlock(sampleBlock);

    const updatedState = useLyricStore.getState();
    expect(updatedState.audioUrl).toBe("blob:test-audio");
    expect(updatedState.lyricBlocks.length).toBe(1);
    expect(updatedState.lyricBlocks[0].text).toBe("Test Lyric");
  });

  it("supports undo and redo functionality", () => {
    const sampleBlock: LyricBlock = {
      id: "b1",
      text: "Block 1",
      startTime: 0,
      endTime: 2,
      words: [],
      style: { ...defaultStyle },
      animation: { ...defaultAnimation },
    };

    useLyricStore.getState().addLyricBlock(sampleBlock);
    useLyricStore.getState().pushHistory();
    expect(useLyricStore.getState().lyricBlocks.length).toBe(1);

    useLyricStore.getState().undo();
    expect(useLyricStore.getState().lyricBlocks.length).toBe(0);

    useLyricStore.getState().redo();
    expect(useLyricStore.getState().lyricBlocks.length).toBe(1);
  });

  it("resets project state cleanly", () => {
    const sampleBlock: LyricBlock = {
      id: "b1",
      text: "Block 1",
      startTime: 0,
      endTime: 2,
      words: [],
      style: { ...defaultStyle },
      animation: { ...defaultAnimation },
    };

    useLyricStore.getState().addLyricBlock(sampleBlock);
    useLyricStore.getState().resetProject();

    const state = useLyricStore.getState();
    expect(state.lyricBlocks.length).toBe(0);
    expect(state.audioUrl).toBeNull();
  });
});
