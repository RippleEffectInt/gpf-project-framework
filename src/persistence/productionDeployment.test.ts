import { readFileSync } from 'node:fs'
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
    expect(hostConfig).not.toHaveProperty('extensions')

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

  it('deploys the API folder without a SharePoint repository-mode build variable', () => {
    const workflow = source('.github/workflows/azure-static-web-apps.yml')
    expect(workflow).toContain("NODE_VERSION: '20'")
    expect(workflow).toContain('api_location: api')
    expect(workflow).toContain('api_build_command: npm ci && npm run build')
    expect(workflow).not.toContain('VITE_PROJECT_REPOSITORY')
    expect(
      readProjectRepositoryConfig({ MODE: 'production', PROD: false }),
    ).toEqual({
      mode: 'sharepoint',
      apiBaseUrl: '/api/projects',
    })
  })
})

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}
