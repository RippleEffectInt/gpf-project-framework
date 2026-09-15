/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PROJECT_REPOSITORY?: 'local' | 'sharepoint'
  readonly VITE_PROJECT_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
