import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import apiPackage from '../../api/package.json'
import hostConfig from '../../api/host.json'
import staticWebAppConfig from '../../staticwebapp.config.json'
import { readProjectRepositoryConfig } from './projectRepository'

describe('production Static Web Apps deployment', () => {
  it('uses Node 20 and packages registered Azure Functions', () => {
    expect(staticWebAppConfig.platform.apiRuntime).toBe('node:20')
    expect(apiPackage.engines.node).toBe('>=20')
    expect(apiPackage.main).toBe('dist/functions/*.js')
    expect(apiPackage.scripts.build).toContain('--outdir=dist/functions')
    expect(hostConfig).not.toHaveProperty('extensions')
    expect(hostConfig.version).toBe('2.0')
    expect(hostConfig.extensionBundle).toEqual({
      id: 'Microsoft.Azure.Functions.ExtensionBundle',
      version: '[4.*, 5.0.0)',
    })

    const registrations = source('api/functions/projects.ts')
    expect(registrations).toContain("app.http('projects-collection'")
    expect(registrations).toContain("route: 'projects'")
    expect(registrations).toContain("app.http('project-item'")
    expect(registrations).toContain("route: 'projects/{projectId}'")
    expect(registrations).toContain("app.http('project-metadata-sync'")
    expect(registrations).toContain(
      "route: 'projects/{projectId}/metadata-sync'",
    )
  })

  it('deploys a discoverable Functions v4 entry point instead of the SPA', () => {
    const workflowFiles = readdirSync(
      resolve(process.cwd(), '.github/workflows'),
    ).filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'))
    expect(workflowFiles).toEqual([
      'azure-static-web-apps-wonderful-wave-021ad9203.yml',
    ])

    const workflow = source(
      '.github/workflows/azure-static-web-apps-wonderful-wave-021ad9203.yml',
    )
    expect(workflow).toContain('app_location: "/"')
    expect(workflow).toContain('api_location: "api"')
    expect(workflow).not.toMatch(/api_location:\s*""/)
    expect(workflow).toContain('output_location: "dist"')
    expect(workflow).toContain(
      'app_build_command: npm ci --include=dev && npm run build',
    )
    expect(workflow).toContain(
      'api_build_command: npm ci --include=dev && npm run build',
    )
    expect(workflow).toContain("NODE_VERSION: '20'")
    expect(workflow).toContain(
      'azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN_WONDERFUL_WAVE_021AD9203 }}',
    )
    expect(workflow).toContain(
      'github_id_token: ${{ steps.idtoken.outputs.result }}',
    )
    expect(workflow).not.toContain('VITE_PROJECT_REPOSITORY')
    expect(workflow).not.toContain(
      'secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}',
    )

    expect(apiPackage.main).toBe('dist/functions/*.js')
    expect(apiPackage.type).toBe('module')

    const compiledEntry = resolve(
      process.cwd(),
      'api/dist/functions/projects.js',
    )
    if (existsSync(compiledEntry)) {
      const compiled = readFileSync(compiledEntry, 'utf8')
      expect(compiled).toContain('app.http("projects-collection"')
      expect(compiled).toContain('route: "projects"')
      expect(compiled).not.toContain('<!doctype html>')
    }

    expect(
      readProjectRepositoryConfig({ MODE: 'production', PROD: false }),
    ).toEqual({
      mode: 'sharepoint',
      apiBaseUrl: '/api/projects',
    })
  })

  it('does not let SPA fallback resolve /api/projects to index.html', () => {
    expect(staticWebAppConfig.navigationFallback.rewrite).toBe('/index.html')
    expect(staticWebAppConfig.navigationFallback.exclude).toEqual(
      expect.arrayContaining(['/api', '/api/*']),
    )
    expect(staticWebAppConfig.responseOverrides).toEqual({
      401: { rewrite: '/index.html' },
    })
    expect(staticWebAppConfig.responseOverrides['401']).not.toHaveProperty(
      'statusCode',
    )
    expect(staticWebAppConfig.responseOverrides).not.toHaveProperty('404')

    expect(wouldServeIndexHtml('/api/projects')).toBe(false)
    expect(wouldServeIndexHtml('/api/projects/PROJECT_1')).toBe(false)
    expect(wouldServeIndexHtml('/projects/new')).toBe(true)
  })
})

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

function wouldServeIndexHtml(pathname: string): boolean {
  const override = (
    staticWebAppConfig as {
      responseOverrides?: { '404'?: { rewrite?: string } }
    }
  ).responseOverrides?.['404']
  if (override?.rewrite === '/index.html' && pathname.startsWith('/api')) {
    return true
  }

  return (
    !matchesAnyExclude(
      pathname,
      staticWebAppConfig.navigationFallback.exclude,
    ) && staticWebAppConfig.navigationFallback.rewrite === '/index.html'
  )
}

function matchesAnyExclude(pathname: string, patterns: string[]): boolean {
  return patterns.some((pattern) => matchesExclude(pathname, pattern))
}

function matchesExclude(pathname: string, pattern: string): boolean {
  const regex = new RegExp(
    `^${pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')}$`,
  )
  return regex.test(pathname)
}
