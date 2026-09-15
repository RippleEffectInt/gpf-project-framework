import { describe, expect, it, vi } from 'vitest'
import {
  SharePointGraphStorageGateway,
  type SharePointGraphRequestClient,
} from '../../api/sharePointGraphStorageGateway'
import type { SharePointProjectServerConfig } from '../../api/sharePointProjectSchema'

const config: SharePointProjectServerConfig = {
  siteUrl: 'https://sendacow.sharepoint.com/sites/Projects',
  siteId: 'tenant,site,web',
  projectDesignsListId: 'project-list-id',
  projectDesignFilesLibraryListId: 'library-list-id',
}

describe('SharePoint Graph storage gateway', () => {
  it('queries projects using the confirmed internal ProjectId field', async () => {
    const get = vi.fn(async () => ({
      value: [
        {
          id: 'item-id',
          eTag: '"metadata-etag"',
          fields: graphListFields(),
        },
      ],
    }))
    const gateway = new SharePointGraphStorageGateway(
      config,
      graphClient({ get }),
      { resolveDriveId: async () => 'drive-id' },
    )

    const record = await gateway.getMetadataByProjectId("PROJECT_'_1")

    expect(record?.itemId).toBe('item-id')
    const requestedPath = String(
      (get.mock.calls as unknown as Array<[string]>)[0]?.[0] ?? '',
    )
    const query = new URLSearchParams(requestedPath.split('?')[1] ?? '')
    expect(query.get('$filter')).toBe(
      "fields/field_1 eq 'PROJECT_''_1'",
    )
  })

  it('uses the process-resolved drive for authoritative file reads', async () => {
    const resolveDriveId = vi.fn(async () => 'resolved-drive-id')
    const get = vi.fn(async () => ({
      id: 'file-id',
      name: 'ProjectDesign-PROJECT_1.json',
      webUrl: 'https://example.sharepoint.com/file',
      eTag: '"file-etag"',
      lastModifiedDateTime: '2026-09-15T17:00:00.000Z',
    }))
    const requestText = vi.fn(async () => '{"schemaVersion":1}')
    const gateway = new SharePointGraphStorageGateway(
      config,
      graphClient({ get, requestText }),
      { resolveDriveId },
    )

    await gateway.getDesignFile('file-id')

    expect(resolveDriveId).toHaveBeenCalledTimes(1)
    expect(get).toHaveBeenCalledWith(
      expect.stringContaining('/drives/resolved-drive-id/items/file-id'),
    )
    expect(requestText).toHaveBeenCalledWith(
      '/drives/resolved-drive-id/items/file-id/content',
    )
  })
})

function graphClient(
  overrides: Partial<SharePointGraphRequestClient> = {},
): SharePointGraphRequestClient {
  return {
    get: vi.fn(async () => null),
    request: vi.fn(async () => null),
    requestText: vi.fn(async () => ''),
    ...overrides,
  }
}

function graphListFields() {
  return {
    Title: 'Project',
    field_1: 'PROJECT_1',
    field_4: 'Draft',
    field_5: 'framework-1',
    field_6: '1',
    ProjectSchemaVersion: 1,
    field_8: 'file-id',
    field_9: 'Creator',
    field_10: 'creator@example.org',
    field_11: 'creator-id',
    field_12: 'Editor',
    field_13: 'editor@example.org',
    field_14: 'editor-id',
    Created: '2026-09-15T16:00:00.000Z',
    Modified: '2026-09-15T17:00:00.000Z',
  }
}
