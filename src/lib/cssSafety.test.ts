import { describe, it, expect } from "vitest";
import { sanitizeCustomCSS } from "./cssSafety";

describe("cssSafety", () => {
  it("sanitizes unsafe @import statements", () => {
    const rawCSS = '@import url("https://malicious.com/evil.css"); .lyric-custom { color: red; }';
    const sanitized = sanitizeCustomCSS(rawCSS);
    expect(sanitized).not.toContain("@import");
    expect(sanitized).toContain(".lyric-custom");
  });

  it("replaces url() calls with none", () => {
    const rawCSS = ".lyric-custom { background: url('https://evil.com/pic.jpg'); }";
    const sanitized = sanitizeCustomCSS(rawCSS);
    expect(sanitized).not.toContain("url(");
    expect(sanitized).toContain("background: none");
  });

  it("converts position: fixed to position: relative", () => {
    const rawCSS = ".lyric-custom { position: fixed; top: 0; }";
    const sanitized = sanitizeCustomCSS(rawCSS);
    expect(sanitized).not.toContain("position: fixed");
    expect(sanitized).toContain("position: relative");
  });

  it("wraps bare declarations into .lyric-custom", () => {
    const rawCSS = "font-size: 24px; color: blue;";
    const sanitized = sanitizeCustomCSS(rawCSS);
    expect(sanitized).toContain(".lyric-custom {");
    expect(sanitized).toContain("font-size: 24px;");
  });

  it("returns empty string for null or empty input", () => {
    expect(sanitizeCustomCSS(null)).toBe("");
    expect(sanitizeCustomCSS(undefined)).toBe("");
    expect(sanitizeCustomCSS("   ")).toBe("");
  });
});
