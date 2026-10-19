/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EMBED?: string;
  readonly VITE_DEMO?: string;
}

declare const __APP_VERSION__: string;
declare const __APP_BUILD__: string;
