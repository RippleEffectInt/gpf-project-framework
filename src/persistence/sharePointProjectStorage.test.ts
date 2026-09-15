import { describe, expect, it, vi } from 'vitest'
import {
  PROJECT_DESIGNS_LIBRARY_FOLDER,
  PROJECT_DESIGNS_LIBRARY_NAME,
  PROJECT_DESIGNS_LIST_NAME,
  SharePointProjectFileStorage,
  SharePointProjectOrphanStorageError,
  SharePointProjectStorageConflictError,
  projectDesignFileName,
  projectDesignFilePath,
  type SharePointProjectDesignFile,
  type SharePointGraphProjectMetadataRecord,
  type SharePointProjectStorageGateway,
} from '../../api/sharePointProjectStorage'
import type { HumanProjectAuditFields } from '../../api/projectAuditPolicy'
import {
  serializeProjectDesignListFields,
  type ProjectDesignListFields,
} from '../../api/sharePointProjectSchema'
import type { PersistedProjectDesignV1 } from './types'

const audit: HumanProjectAuditFields = {
  CreatedByName: 'Creator',
  CreatedByEmail: 'creator@example.org',
  CreatedByObjectId: 'creator-object-id',
  ModifiedByName: 'Editor',
  ModifiedByEmail: 'editor@example.org',
  ModifiedByObjectId: 'editor-object-id',
}

function persistedProject(
  name = 'Authoritative project title',
): PersistedProjectDesignV1 {
  return {
    schemaVersion: 1,
    frameworkVersion: 'framework-1',
    frameworkSchemaVersion: '1',
    project: {
      id: 'PROJECT_123',
      name,
      country: 'Kenya',
      projectCode: 'P-123',
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

function listFields(
  project = persistedProject(),
  title = project.project.name,
): ProjectDesignListFields {
  return {
    Title: title,
    ProjectId: project.project.id,
    ProjectCode: project.project.projectCode,
    Country: project.project.country,
    ProjectStatus: project.project.status,
    FrameworkVersion: project.frameworkVersion,
    FrameworkSchemaVersion: project.frameworkSchemaVersion,
    ProjectSchemaVersion: project.schemaVersion,
    ProjectDesignFileId: 'graph-drive-item-id',
    ...audit,
  }
}

function designFile(
  project = persistedProject(),
  etag = '"file-9"',
): SharePointProjectDesignFile {
  return {
    driveItemId: 'graph-drive-item-id',
    fileName: 'ProjectDesign-PROJECT_123.json',
    webUrl: 'https://example.sharepoint.com/design-file',
    etag,
    content: JSON.stringify(project),
  }
}

function metadata(
  project = persistedProject(),
  etag = '"metadata-4"',
  title?: string,
): SharePointGraphProjectMetadataRecord {
  return {
    itemId: 'list-item-id',
    etag,
    fields: serializeProjectDesignListFields(listFields(project, title)),
  }
}

function storageGateway(
  overrides: Partial<SharePointProjectStorageGateway> = {},
): SharePointProjectStorageGateway {
  return {
    createDesignFile: vi.fn(async () => designFile()),
    createMetadataItem: vi.fn(async () => metadata()),
    deleteDesignFile: vi.fn(async () => undefined),
    getDesignFileByPath: vi.fn(async () => null),
    getMetadataByProjectId: vi.fn(async () => metadata()),
    getDesignFile: vi.fn(async () => designFile()),
    updateDesignFile: vi.fn(async () =>
      designFile(persistedProject(), '"file-10"'),
    ),
    updateMetadataItem: vi.fn(async () =>
      metadata(persistedProject(), '"metadata-5"'),
    ),
    ...overrides,
  }
}

describe('SharePoint project file storage contract', () => {
  it('uses a stable ProjectId-based JSON filename and file reference', () => {
    expect(projectDesignFileName('PROJECT_123')).toBe(
      'ProjectDesign-PROJECT_123.json',
    )
    expect(projectDesignFilePath('PROJECT_123')).toBe(
      'designs/ProjectDesign-PROJECT_123.json',
    )
    expect(PROJECT_DESIGNS_LIST_NAME).toBe('GPF - Project Designs')
    expect(PROJECT_DESIGNS_LIBRARY_NAME).toBe('GPF - Project Design Files')
    expect(PROJECT_DESIGNS_LIBRARY_FOLDER).toBe('designs')
    expect(listFields().ProjectDesignFileId).toBe('graph-drive-item-id')
    expect(listFields()).not.toHaveProperty('ProjectDesignJson')
  })

  it('rejects ProjectIds that could produce unsafe or ambiguous paths', () => {
    expect(() => projectDesignFileName('../project')).toThrow()
    expect(() => projectDesignFileName('project/title')).toThrow()
    expect(() => projectDesignFileName('')).toThrow()
  })

  it('saves the file first and then metadata with their separate ETags', async () => {
    const calls: string[] = []
    const gateway = storageGateway({
      updateDesignFile: vi.fn(async (input) => {
        calls.push(`file:${input.ifMatch}`)
        return designFile(persistedProject(), '"file-10"')
      }),
      updateMetadataItem: vi.fn(async (input) => {
        calls.push(`metadata:${input.ifMatch}`)
        return metadata(persistedProject(), '"metadata-5"')
      }),
    })

    const result = await new SharePointProjectFileStorage(gateway).update(
      persistedProject(),
      audit,
      {
        metadataEtag: '"metadata-4"',
        designFileEtag: '"file-9"',
      },
    )

    expect(result.status).toBe('saved')
    expect(calls).toEqual(['file:"file-9"', 'metadata:"metadata-4"'])
    expect(gateway.updateDesignFile).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: {
          ProjectId: 'PROJECT_123',
          FrameworkVersion: 'framework-1',
          FrameworkSchemaVersion: '1',
          ProjectSchemaVersion: 1,
        },
      }),
    )
    expect(gateway.updateMetadataItem).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: expect.objectContaining({
          field_1: 'PROJECT_123',
          field_8: 'graph-drive-item-id',
          field_14: 'editor-object-id',
        }),
      }),
    )
    if (result.status === 'saved') {
      expect(result.project.concurrency).toEqual({
        metadataEtag: '"metadata-5"',
        designFileEtag: '"file-10"',
      })
    }
  })

  it('leaves metadata untouched when the authoritative file save fails', async () => {
    const updateMetadataItem = vi.fn()
    const gateway = storageGateway({
      updateDesignFile: vi.fn(async () => {
        throw new SharePointProjectStorageConflictError()
      }),
      updateMetadataItem,
    })

    await expect(
      new SharePointProjectFileStorage(gateway).update(
        persistedProject(),
        audit,
        {
          metadataEtag: '"metadata-4"',
          designFileEtag: '"file-9"',
        },
      ),
    ).rejects.toBeInstanceOf(SharePointProjectStorageConflictError)
    expect(updateMetadataItem).not.toHaveBeenCalled()
  })

  it('validates both current ETags before starting either update', async () => {
    const updateDesignFile = vi.fn()
    const updateMetadataItem = vi.fn()
    const gateway = storageGateway({
      updateDesignFile,
      updateMetadataItem,
    })

    await expect(
      new SharePointProjectFileStorage(gateway).update(
        persistedProject(),
        audit,
        {
          metadataEtag: '"stale-metadata"',
          designFileEtag: '"file-9"',
        },
      ),
    ).rejects.toBeInstanceOf(SharePointProjectStorageConflictError)
    expect(updateDesignFile).not.toHaveBeenCalled()
    expect(updateMetadataItem).not.toHaveBeenCalled()
  })

  it('returns metadata-sync-required when file succeeds but metadata fails', async () => {
    const gateway = storageGateway({
      updateMetadataItem: vi.fn(async () => {
        throw new Error('metadata unavailable')
      }),
    })

    const result = await new SharePointProjectFileStorage(gateway).update(
      persistedProject(),
      audit,
      {
        metadataEtag: '"metadata-4"',
        designFileEtag: '"file-9"',
      },
    )

    expect(result.status).toBe('metadata-sync-required')
    if (result.status === 'metadata-sync-required') {
      expect(result.project.designFile.etag).toBe('"file-10"')
      expect(result.recovery).toEqual(
        expect.objectContaining({
          projectId: 'PROJECT_123',
          designFileId: 'graph-drive-item-id',
          designFileEtag: '"file-10"',
        }),
      )
    }
  })

  it('retries metadata only without rewriting project JSON', async () => {
    const updateDesignFile = vi.fn(async () =>
      designFile(persistedProject(), '"file-10"'),
    )
    const updateMetadataItem = vi
      .fn()
      .mockRejectedValueOnce(new Error('metadata unavailable'))
      .mockResolvedValueOnce(metadata(persistedProject(), '"metadata-5"'))
    const getDesignFile = vi
      .fn()
      .mockResolvedValueOnce(designFile())
      .mockResolvedValueOnce(designFile(persistedProject(), '"file-10"'))
    const gateway = storageGateway({
      updateDesignFile,
      updateMetadataItem,
      getDesignFile,
    })
    const storage = new SharePointProjectFileStorage(gateway)
    const partial = await storage.update(persistedProject(), audit, {
      metadataEtag: '"metadata-4"',
      designFileEtag: '"file-9"',
    })
    if (partial.status !== 'metadata-sync-required') {
      throw new Error('Expected metadata sync recovery.')
    }

    const retried = await storage.retryMetadataSync(partial.recovery)

    expect(retried.metadata.etag).toBe('"metadata-5"')
    expect(updateDesignFile).toHaveBeenCalledTimes(1)
    expect(updateMetadataItem).toHaveBeenCalledTimes(2)
  })

  it('cleans up a newly-created file when list creation fails', async () => {
    const metadataFailure = new Error('list creation failed')
    const deleteDesignFile = vi.fn(async () => undefined)
    const gateway = storageGateway({
      getMetadataByProjectId: vi.fn(async () => null),
      createMetadataItem: vi.fn(async () => {
        throw metadataFailure
      }),
      deleteDesignFile,
    })

    await expect(
      new SharePointProjectFileStorage(gateway).create(
        persistedProject(),
        audit,
      ),
    ).rejects.toBe(metadataFailure)
    expect(deleteDesignFile).toHaveBeenCalledWith('graph-drive-item-id')
  })

  it('surfaces and logs an orphan when cleanup also fails', async () => {
    const cleanupFailure = new Error('cleanup failed')
    const logger = { error: vi.fn() }
    const gateway = storageGateway({
      getMetadataByProjectId: vi.fn(async () => null),
      createMetadataItem: vi.fn(async () => {
        throw new Error('list creation failed')
      }),
      deleteDesignFile: vi.fn(async () => {
        throw cleanupFailure
      }),
    })

    await expect(
      new SharePointProjectFileStorage(gateway, logger).create(
        persistedProject(),
        audit,
      ),
    ).rejects.toBeInstanceOf(SharePointProjectOrphanStorageError)
    expect(logger.error).toHaveBeenCalledWith(
      'sharepoint-project-orphan-storage',
      expect.objectContaining({
        projectId: 'PROJECT_123',
        driveItemId: 'graph-drive-item-id',
        cleanupCause: cleanupFailure,
      }),
    )
  })

  it('does not create duplicates when create is retried by ProjectId', async () => {
    const createDesignFile = vi.fn(async () => designFile())
    const createMetadataItem = vi.fn(async () => metadata())
    const getMetadataByProjectId = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(metadata())
    const gateway = storageGateway({
      getMetadataByProjectId,
      createDesignFile,
      createMetadataItem,
    })
    const storage = new SharePointProjectFileStorage(gateway)

    await storage.create(persistedProject(), audit)
    await storage.create(persistedProject(), audit)

    expect(createDesignFile).toHaveBeenCalledTimes(1)
    expect(createMetadataItem).toHaveBeenCalledTimes(1)
  })

  it('reconciles list metadata from authoritative JSON without writing it', async () => {
    const authoritative = persistedProject('JSON title wins')
    const updateDesignFile = vi.fn()
    const updateMetadataItem = vi.fn(async (input) => ({
      ...metadata(authoritative, '"metadata-5"'),
      fields: input.fields,
    }))
    const gateway = storageGateway({
      getMetadataByProjectId: vi.fn(async () =>
        metadata(authoritative, '"metadata-4"', 'Stale list title'),
      ),
      getDesignFile: vi.fn(async () => designFile(authoritative)),
      updateDesignFile,
      updateMetadataItem,
    })

    const reconciled = await new SharePointProjectFileStorage(
      gateway,
    ).reconcile('PROJECT_123', audit)

    expect(reconciled.metadata.fields.Title).toBe('JSON title wins')
    expect(updateMetadataItem).toHaveBeenCalledWith(
      expect.objectContaining({
        ifMatch: '"metadata-4"',
        fields: expect.objectContaining({ Title: 'JSON title wins' }),
      }),
    )
    expect(updateDesignFile).not.toHaveBeenCalled()
  })
})
