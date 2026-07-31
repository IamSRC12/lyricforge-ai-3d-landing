/// <reference types="vite/client" />

interface LyricalVideoProNativeResult {
  blob?: Blob;
  fileName?: string;
  filePath?: string;
}

interface Window {
  lyricalVideoProRenderer?: {
    render(input: unknown): Promise<LyricalVideoProNativeResult>;
  };
}