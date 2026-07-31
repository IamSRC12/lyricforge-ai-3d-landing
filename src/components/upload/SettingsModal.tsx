import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLyricStore } from "@/store/useLyricStore";
import { Button } from "@/components/ui/Button";
import { testGroqConnection } from "@/lib/groq";
import { testNvidiaNimConnection } from "@/lib/omniRouter";

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, setSettings } = useLyricStore();
  const [local, setLocal] = useState(settings);
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [showNimKey, setShowNimKey] = useState(false);
  const [testing, setTesting] = useState<"groq" | "nim" | null>(null);
  const [results, setResults] = useState<{ groq?: string; nim?: string }>({});

  // Sync state whenever modal opens
  useEffect(() => {
    if (open) {
      setLocal(settings);
      setResults({});
    }
  }, [open, settings]);

  // Escape key handler
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const save = () => {
    setSettings(local);
    onClose();
  };

  const testGroq = async () => {
    setTesting("groq");
    const r = await testGroqConnection(local.groqApiKey);
    setResults((prev) => ({ ...prev, groq: r.ok ? `✅ ${r.message}` : `❌ ${r.message}` }));
    setTesting(null);
  };

  const testNvidiaNim = async () => {
    setTesting("nim");
    const r = await testNvidiaNimConnection(local.nvidiaNimEndpoint || "https://integrate.api.nvidia.com", local.nvidiaNimApiKey || "");
    setResults((prev) => ({ ...prev, nim: r.ok ? `✅ ${r.message}` : `❌ ${r.message}` }));
    setTesting(null);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xl"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            role="dialog"
            aria-label="API Settings"
            aria-modal="true"
            className="fixed left-1/2 top-1/2 z-[101] w-[94%] max-w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-[24px] border border-white/10 bg-[#14141C] p-7 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">API Settings</h3>
                <p className="mt-1 text-xs text-white/50">NVIDIA NIM connects to the hosted API endpoint.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-white/60">
                  Groq API Key (Whisper Turbo)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showGroqKey ? "text" : "password"}
                      value={local.groqApiKey}
                      onChange={(e) => setLocal({ ...local, groqApiKey: e.target.value })}
                      placeholder="gsk_..."
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGroqKey(!showGroqKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40 hover:text-white"
                    >
                      {showGroqKey ? "Hide" : "Show"}
                    </button>
                  </div>
                  <Button size="sm" variant="secondary" loading={testing === "groq"} onClick={testGroq}>
                    Test
                  </Button>
                </div>
                {results.groq && <div className="mt-2 text-xs text-white/60">{results.groq}</div>}
                <div className="mt-2 text-[10px] text-white/40">
                  ⚠️ Note: Keys stored in browser memory are visible in client developer tools. Get key at console.groq.com.
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-white/60">
                  NVIDIA NIM Endpoint
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={local.nvidiaNimEndpoint || "https://integrate.api.nvidia.com"}
                    onChange={(e) => setLocal({ ...local, nvidiaNimEndpoint: e.target.value })}
                    placeholder="https://integrate.api.nvidia.com"
                    className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-white/20"
                  />
                  <Button size="sm" variant="secondary" loading={testing === "nim"} onClick={testNvidiaNim}>
                    Test
                  </Button>
                </div>
                {results.nim && <div className="mt-2 text-xs text-white/60">{results.nim}</div>}
                <div className="mt-2 text-[10px] text-white/30">NVIDIA NIM hosted API via integrate.api.nvidia.com</div>
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-white/60">
                  NVIDIA NIM API Key
                </label>
                <div className="relative">
                  <input
                    type={showNimKey ? "text" : "password"}
                    value={local.nvidiaNimApiKey || ""}
                    onChange={(e) => setLocal({ ...local, nvidiaNimApiKey: e.target.value })}
                    placeholder="nvapi-..."
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-white/20 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNimKey(!showNimKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40 hover:text-white"
                  >
                    {showNimKey ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-white/60">
                  Model
                </label>
                <input
                  type="text"
                  value={local.nvidiaNimModel || "minimaxai/minimax-m3"}
                  onChange={(e) => setLocal({ ...local, nvidiaNimModel: e.target.value })}
                  placeholder="minimaxai/minimax-m3"
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-white/20"
                />
                <div className="mt-2 text-[10px] text-white/30">Default: minimaxai/minimax-m3</div>
              </div>

              <div className="rounded-xl bg-white/[0.04] p-4">
                <div className="text-xs font-bold text-white">OpenAI-Compatible API 💡</div>
                <div className="mt-1 text-xs leading-relaxed text-white/50">
                  Uses the OpenAI chat completions format. Compatible with any endpoint that supports POST /v1/chat/completions with Bearer auth.
                </div>
              </div>
            </div>

            <div className="mt-7 flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={save}>Save & Close</Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
