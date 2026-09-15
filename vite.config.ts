import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  define: {
    // Vite 7 sets import.meta.env.PROD from NODE_ENV === "production", which is
    // false during `vite build` when CI/Oryx/Vitest already set NODE_ENV. Bind
    // the client repository to the Vite command instead.
    __GPF_CLIENT_REPOSITORY_MODE__: JSON.stringify(
      command === 'build' ? 'sharepoint' : 'local',
    ),
  },
  build: {
    // The normalized read-only framework is intentionally shipped as one lazy chunk.
    chunkSizeWarningLimit: 550,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    pool: 'threads',
  },
}))
