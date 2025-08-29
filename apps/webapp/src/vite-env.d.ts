/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GATEWAY_BASE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
