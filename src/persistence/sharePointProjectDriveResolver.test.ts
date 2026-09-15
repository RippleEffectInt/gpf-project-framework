import { describe, expect, it, vi } from 'vitest'
import {
  SharePointProjectDriveResolutionError,
  SharePointProjectDriveResolver,
} from '../../api/sharePointProjectDriveResolver'
import type { SharePointProjectServerConfig } from '../../api/sharePointProjectSchema'
import { SharePointProjectRepository } from './sharePointProjectRepository'

const config: SharePointProjectServerConfig = {
  siteUrl: 'https://sendacow.sharepoint.com/sites/Projects',
  siteId:
    'sendacow.sharepoint.com,8a1523a5-679f-44df-ba39-a169cbef9e44,37826090-209d-4477-9654-5a3edd5fbba0',
  projectDesignsListId: 'aa3d80ac-739f-48a5-8f0c-d812b0942872',
  projectDesignFilesLibraryListId: '733df8ae-d910-4c5e-8e34-f4189ba7537d',
}

describe('SharePoint project drive resolution', () => {
  it('resolves the drive from the confirmed site and library list context', async () => {
    const get = vi.fn(async () => ({
      id: 'resolved-graph-drive-id',
      sharepointIds: {
        listId: '733df8ae-d910-4c5e-8e34-f4189ba7537d',
      },
    }))

    await expect(
      new SharePointProjectDriveResolver(config, { get }).resolveDriveId(),
    ).resolves.toBe('resolved-graph-drive-id')
    expect(get).toHaveBeenCalledWith(
      '/sites/sendacow.sharepoint.com%2C8a1523a5-679f-44df-ba39-a169cbef9e44%2C37826090-209d-4477-9654-5a3edd5fbba0/lists/733df8ae-d910-4c5e-8e34-f4189ba7537d/drive?$select=id,sharepointIds',
    )
  })

  it('fails explicitly when the configured library cannot be resolved', async () => {
    const resolver = new SharePointProjectDriveResolver(config, {
      get: vi.fn(async () => ({ value: [] })),
    })

    await expect(resolver.resolveDriveId()).rejects.toBeInstanceOf(
      SharePointProjectDriveResolutionError,
    )
  })

  it('reuses the resolved drive for the lifetime of the resolver', async () => {
    const get = vi.fn(async () => ({ id: 'resolved-graph-drive-id' }))
    const resolver = new SharePointProjectDriveResolver(config, { get })

    await resolver.warm()
    await expect(resolver.resolveDriveId()).resolves.toBe(
      'resolved-graph-drive-id',
    )
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('keeps drive resolution behind the browser repository API boundary', async () => {
    const fetchImplementation = vi.fn(
      async () =>
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    const repository = new SharePointProjectRepository(
      '/api/projects',
      fetchImplementation,
    )

    await repository.listProjects()

    expect(fetchImplementation).toHaveBeenCalledWith(
      '/api/projects',
      expect.objectContaining({ credentials: 'include' }),
    )
    expect(JSON.stringify(fetchImplementation.mock.calls)).not.toContain(
      'resolved-graph-drive-id',
    )
  })
})
