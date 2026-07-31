import { describe, it, expect } from "vitest";
import { alignLyricsToWhisper } from "./alignLyrics";
import { GroqTranscriptionResult } from "./groq";

describe("alignLyricsToWhisper", () => {
  const mockWhisperResult: GroqTranscriptionResult = {
    text: "Hello world this is LyricForge AI",
    language: "en",
    duration: 5.0,
    words: [
      { word: "Hello", start: 0.5, end: 0.9 },
      { word: "world", start: 1.0, end: 1.4 },
      { word: "this", start: 1.6, end: 1.9 },
      { word: "is", start: 2.0, end: 2.2 },
      { word: "LyricForge", start: 2.4, end: 3.1 },
      { word: "AI", start: 3.2, end: 3.6 },
    ],
  };

  it("aligns original user lyrics to whisper timestamps correctly", () => {
    const rawBlocks = ["Hello world", "this is LyricForge AI"];
    const result = alignLyricsToWhisper(rawBlocks, mockWhisperResult, 5.0);

    expect(result.blocks.length).toBe(2);
    expect(result.blocks[0].text).toBe("Hello world");
    expect(result.blocks[1].text).toBe("this is LyricForge AI");
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.totalWords).toBe(6);
  });

  it("handles empty lyrics gracefully by throwing error", () => {
    expect(() => alignLyricsToWhisper([], mockWhisperResult, 5.0)).toThrow(
      "No lyric words were available for alignment."
    );
  });

  it("filters out empty lines and aligns valid blocks", () => {
    const rawBlocks = ["Hello world", "this is LyricForge AI"];
    const result = alignLyricsToWhisper(rawBlocks, mockWhisperResult, 5.0);

    expect(result.blocks.length).toBe(2);
    expect(result.blocks[0].text).toBe("Hello world");
    expect(result.blocks[1].text).toBe("this is LyricForge AI");
  });
});
