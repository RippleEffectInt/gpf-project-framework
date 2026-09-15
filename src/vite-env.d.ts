/// <reference types="vite/client" />

declare const __GPF_CLIENT_REPOSITORY_MODE__: 'local' | 'sharepoint'

interface ImportMetaEnv {
  readonly VITE_PROJECT_REPOSITORY?: 'local' | 'sharepoint'
  readonly VITE_PROJECT_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
