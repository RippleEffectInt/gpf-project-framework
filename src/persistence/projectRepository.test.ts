import { describe, expect, it } from 'vitest'
import staticWebAppConfig from '../../staticwebapp.config.json'
import { LocalProjectRepository } from './localProjectRepository'
import { parseProjectRecord } from './projectRecord'
import { SharePointProjectRepository } from './sharePointProjectRepository'
import type { PersistedProjectDesignV1 } from './types'

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

function project(id: string, name = 'Test project'): PersistedProjectDesignV1 {
  return {
    schemaVersion: 1,
    frameworkVersion: 'framework-1',
    frameworkSchemaVersion: '1',
    project: {
      id,
      name,
      status: 'Draft',
    },
    design: {
      metadata: {
        donor: '',
        fundingReference: '',
        projectManager: '',
        plannedStartDate: '',
        plannedEndDate: '',
        description: '',
      },
      selectedFinalOutcomeIds: [],
      finalOutcomeSelectionSources: {},
      projectPathways: [],
      outcomePathwayLinks: [],
      customInnovation: null,
    },
  }
}

describe('LocalProjectRepository', () => {
  it('creates a new project and includes it in the project list', async () => {
    const repository = new LocalProjectRepository({
      storage: new MemoryStorage(),
      now: () => '2026-09-14T21:00:00.000Z',
    })

    const created = await repository.createProject(project('PROJECT_1'))
    const projects = await repository.listProjects()

    expect(created.etag).toBe('"1"')
    expect(projects).toEqual([
      expect.objectContaining({
        id: 'PROJECT_1',
        name: 'Test project',
        modifiedAt: '2026-09-14T21:00:00.000Z',
      }),
    ])
  })

  it('updates an existing project using its ETag', async () => {
    let timestamp = '2026-09-14T21:00:00.000Z'
    const repository = new LocalProjectRepository({
      storage: new MemoryStorage(),
      now: () => timestamp,
    })
    const created = await repository.createProject(project('PROJECT_1'))
    timestamp = '2026-09-14T21:30:00.000Z'

    const updated = await repository.updateProject(
      project('PROJECT_1', 'Renamed project'),
      created.etag,
    )

    expect(updated.project.project.name).toBe('Renamed project')
    expect(updated.etag).toBe('"2"')
    expect(updated.modifiedAt).toBe(timestamp)
  })

  it('rejects a concurrent update without overwriting the latest record', async () => {
    const repository = new LocalProjectRepository({
      storage: new MemoryStorage(),
    })
    const created = await repository.createProject(project('PROJECT_1'))
    await repository.updateProject(
      project('PROJECT_1', 'First editor'),
      created.etag,
    )

    await expect(
      repository.updateProject(
        project('PROJECT_1', 'Stale second editor'),
        created.etag,
      ),
    ).rejects.toEqual(expect.objectContaining({ code: 'conflict' }))
    await expect(repository.getProject('PROJECT_1')).resolves.toEqual(
      expect.objectContaining({
        project: expect.objectContaining({
          project: expect.objectContaining({ name: 'First editor' }),
        }),
      }),
    )
  })
})

describe('SharePointProjectRepository', () => {
  it('keeps audit identity out of browser create requests and reads server-derived audit metadata', async () => {
    const document = project('PROJECT_1')
    const auditIdentity = {
      objectId: 'entra-object-id',
      name: 'Human User',
      email: 'human.user@example.org',
    }
    let requestBody = ''
    const repository = new SharePointProjectRepository(
      '/api/projects',
      async (_input, init) => {
        requestBody = String(init?.body ?? '')
        return new Response(
          JSON.stringify({
            project: document,
            etag: '"1"',
            createdAt: '2026-09-14T21:00:00.000Z',
            modifiedAt: '2026-09-14T21:00:00.000Z',
            createdBy: auditIdentity,
            modifiedBy: auditIdentity,
          }),
          {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      },
    )

    const record = await repository.createProject(document)
    if ('status' in record) throw new Error('Expected a complete save.')
    const body = JSON.parse(requestBody) as Record<string, unknown>

    expect(body).not.toHaveProperty('createdBy')
    expect(body).not.toHaveProperty('modifiedBy')
    expect(body).not.toHaveProperty('CreatedByName')
    expect(body).not.toHaveProperty('ModifiedByName')
    expect(record.createdBy).toEqual(auditIdentity)
    expect(record.modifiedBy).toEqual(auditIdentity)
  })

  it('rejects incomplete audit metadata in API records', () => {
    expect(() =>
      parseProjectRecord({
        project: project('PROJECT_1'),
        etag: '"1"',
        createdAt: '2026-09-14T21:00:00.000Z',
        modifiedAt: '2026-09-14T21:00:00.000Z',
        createdBy: { objectId: 'entra-object-id', name: 'Human User' },
      }),
    ).toThrowError(expect.objectContaining({ code: 'malformed-data' }))
  })

  it('protects both project API route forms with the authenticated SWA role', () => {
    expect(staticWebAppConfig.routes).toEqual(
      expect.arrayContaining([
        {
          route: '/api/projects',
          allowedRoles: ['authenticated'],
        },
        {
          route: '/api/projects/*',
          allowedRoles: ['authenticated'],
        },
      ]),
    )
  })

  it('maps SharePoint precondition failures to a safe conflict error', async () => {
    const repository = new SharePointProjectRepository(
      '/api/projects',
      async () => new Response(null, { status: 412 }),
    )

    await expect(
      repository.updateProject(project('PROJECT_1'), '"1"'),
    ).rejects.toEqual(expect.objectContaining({ code: 'conflict' }))
  })

  it('forwards the opaque list-and-file concurrency token unchanged', async () => {
    const document = project('PROJECT_1')
    const concurrencyToken = '"opaque-list-and-file-token"'
    let ifMatch = ''
    const repository = new SharePointProjectRepository(
      '/api/projects',
      async (_input, init) => {
        ifMatch = new Headers(init?.headers).get('If-Match') ?? ''
        return new Response(
          JSON.stringify({
            project: document,
            etag: '"next-opaque-token"',
            createdAt: '2026-09-14T21:00:00.000Z',
            modifiedAt: '2026-09-15T09:00:00.000Z',
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              ETag: '"next-opaque-token"',
            },
          },
        )
      },
    )

    const updated = await repository.updateProject(document, concurrencyToken)
    if ('status' in updated) throw new Error('Expected a complete save.')

    expect(ifMatch).toBe(concurrencyToken)
    expect(updated.etag).toBe('"next-opaque-token"')
  })

  it('parses partial saves and retries metadata without sending project JSON', async () => {
    const document = project('PROJECT_1')
    const requests: Array<{ url: string; body: string }> = []
    const repository = new SharePointProjectRepository(
      '/api/projects',
      async (input, init) => {
        requests.push({
          url: String(input),
          body: String(init?.body ?? ''),
        })
        const record = {
          project: document,
          etag: '"combined-token"',
          createdAt: '2026-09-14T21:00:00.000Z',
          modifiedAt: '2026-09-15T09:00:00.000Z',
        }
        if (String(input).endsWith('/metadata-sync')) {
          return new Response(JSON.stringify(record), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return new Response(
          JSON.stringify({
            status: 'metadata-sync-required',
            record,
            metadataSyncToken: 'opaque-sync-token',
          }),
          {
            status: 202,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      },
    )

    const partial = await repository.updateProject(document, '"previous-token"')
    expect(partial).toEqual(
      expect.objectContaining({
        status: 'metadata-sync-required',
        metadataSyncToken: 'opaque-sync-token',
      }),
    )

    const retried = await repository.retryMetadataSync(
      'PROJECT_1',
      'opaque-sync-token',
    )
    expect(retried).toEqual(
      expect.objectContaining({ etag: '"combined-token"' }),
    )
    expect(requests[1]).toEqual({
      url: '/api/projects/PROJECT_1/metadata-sync',
      body: JSON.stringify({ metadataSyncToken: 'opaque-sync-token' }),
    })
    expect(requests[1]?.body).not.toContain('frameworkVersion')
  })

  it('maps authentication and permission responses without exposing raw errors', async () => {
    const unauthenticated = new SharePointProjectRepository(
      '/api/projects',
      async () => new Response(null, { status: 401 }),
    )
    const forbidden = new SharePointProjectRepository(
      '/api/projects',
      async () => new Response(null, { status: 403 }),
    )

    await expect(unauthenticated.listProjects()).rejects.toEqual(
      expect.objectContaining({
        code: 'authentication',
      }),
    )
    await expect(forbidden.listProjects()).rejects.toEqual(
      expect.objectContaining({ code: 'permission' }),
    )
  })
})
