/** @vitest-environment node */
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build } from 'vite'
import { describe, expect, it } from 'vitest'

describe('production client repository selection', () => {
  it('builds SharePointProjectRepository and cannot resolve LocalProjectRepository', async () => {
    const outDir = await mkdtemp(join(tmpdir(), 'gpf-prod-repo-'))
    try {
      await build({
        configFile: join(process.cwd(), 'vite.config.ts'),
        logLevel: 'error',
        build: { outDir, emptyOutDir: true },
      })
      const assetDir = join(outDir, 'assets')
      const files = await readdir(assetDir)
      const javascript = (
        await Promise.all(
          files
            .filter((file) => file.endsWith('.js'))
            .map((file) => readFile(join(assetDir, file), 'utf8')),
        )
      ).join('\n')

      const hasSharePointMode = javascript.includes(
        '[gpf] repositoryMode:sharepoint',
      )
      const hasSharePointMarker = javascript.includes(
        'gpf-repository-mode:sharepoint',
      )
      const hasLocalMode = javascript.includes('[gpf] repositoryMode:local')
      const hasLocalMarker = javascript.includes('gpf-repository-mode:local')
      const hasProjectsApi = javascript.includes('/api/projects')
      const hasLocalStoragePrefix = javascript.includes(
        'project-framework:project:',
      )

      expect({
        hasSharePointMode,
        hasSharePointMarker,
        hasLocalMode,
        hasLocalMarker,
        hasProjectsApi,
        hasLocalStoragePrefix,
      }).toEqual({
        hasSharePointMode: true,
        hasSharePointMarker: true,
        hasLocalMode: false,
        hasLocalMarker: false,
        hasProjectsApi: true,
        hasLocalStoragePrefix: false,
      })
    } finally {
      await rm(outDir, { recursive: true, force: true })
    }
  }, 120_000)
})
