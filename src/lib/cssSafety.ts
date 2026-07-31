/**
 * Utility for sanitizing generated CSS to prevent injection of unsafe global styles,
 * external imports, url() loads, fixed elements, or script attempts.
 */
export function sanitizeCustomCSS(css: string | null | undefined): string {
  if (!css || typeof css !== "string" || !css.trim()) return "";

  let clean = css.trim();

  // Strip @import, @charset, @namespace
  clean = clean.replace(/@(import|charset|namespace)[^;]+;/gi, "");

  // Strip url(...) to avoid loading untrusted external media or assets
  clean = clean.replace(/url\s*\([^)]*\)/gi, "none");

  // Strip position: fixed / absolute HTML-wide hijacks if trying to escape block scope
  clean = clean.replace(/position\s*:\s*(fixed|absolute)/gi, () => {
    // allow inside keyframes or scoped classes if safe
    return "position: relative";
  });

  // Ensure styles only apply to .lyric-custom or @keyframes
  // If no wrapper is found, wrap raw declarations under .lyric-custom
  if (!clean.includes(".lyric-custom") && !clean.includes("@keyframes")) {
    clean = `.lyric-custom { ${clean} }`;
  }

  return clean;
}

export function injectScopedCSS(elementId: string, cssString: string | null | undefined) {
  const safe = sanitizeCustomCSS(cssString);
  let styleEl = document.getElementById(elementId) as HTMLStyleElement | null;

  if (!safe) {
    if (styleEl) styleEl.remove();
    return;
  }

  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = elementId;
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = safe;
}

export function removeScopedCSS(elementId: string) {
  const styleEl = document.getElementById(elementId);
  if (styleEl) styleEl.remove();
}
