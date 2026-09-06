/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENLEARN_MODE?: 'static' | 'connected';
  readonly VITE_OPENLEARN_SERVICE_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
