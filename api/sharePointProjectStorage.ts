import type { HumanProjectAuditFields } from './projectAuditPolicy'
import { parsePersistedProjectDocument } from '../src/persistence/projectSerialization'
import type { PersistedProjectDesignV1 } from '../src/persistence/types'
import {
  SHAREPOINT_PROJECT_RESOURCE_SCHEMA,
  deserializeProjectDesignListFields,
  serializeProjectDesignLibraryFields,
  serializeProjectDesignListFields,
  type ProjectDesignListFields,
  type SharePointGraphFields,
} from './sharePointProjectSchema'

export const PROJECT_DESIGNS_LIST_NAME =
  SHAREPOINT_PROJECT_RESOURCE_SCHEMA.listDisplayName
export const PROJECT_DESIGNS_LIBRARY_NAME =
  SHAREPOINT_PROJECT_RESOURCE_SCHEMA.libraryDisplayName
export const PROJECT_DESIGNS_LIBRARY_FOLDER = 'designs'

export interface SharePointProjectMetadataRecord {
  itemId: string
  etag: string
  fields: ProjectDesignListFields
}

export interface SharePointGraphProjectMetadataRecord {
  itemId: string
  etag: string
  fields: SharePointGraphFields
}

export interface SharePointProjectDesignFile {
  driveItemId: string
  fileName: string
  webUrl: string
  etag: string
  content: string
}

/**
 * Returned to the browser as one opaque ProjectRecord.etag. The API retains
 * both SharePoint ETags and requires both to match before an update.
 */
export interface SharePointProjectConcurrencyToken {
  metadataEtag: string
  designFileEtag: string
}

export interface SharePointProjectStorageGateway {
  createDesignFile(input: {
    path: string
    content: string
    fields: SharePointGraphFields
  }): Promise<SharePointProjectDesignFile>
  createMetadataItem(
    fields: SharePointGraphFields,
  ): Promise<SharePointGraphProjectMetadataRecord>
  deleteDesignFile(driveItemId: string): Promise<void>
  getDesignFileByPath(path: string): Promise<SharePointProjectDesignFile | null>
  getMetadataByProjectId(
    projectId: string,
  ): Promise<SharePointGraphProjectMetadataRecord | null>
  getDesignFile(
    driveItemId: string,
  ): Promise<SharePointProjectDesignFile | null>
  updateDesignFile(input: {
    driveItemId: string
    content: string
    ifMatch: string
    fields: SharePointGraphFields
  }): Promise<SharePointProjectDesignFile>
  updateMetadataItem(input: {
    itemId: string
    fields: SharePointGraphFields
    ifMatch: string
  }): Promise<SharePointGraphProjectMetadataRecord>
}

export interface SharePointStoredProject {
  metadata: SharePointProjectMetadataRecord
  designFile: SharePointProjectDesignFile
  concurrency: SharePointProjectConcurrencyToken
}

export interface SharePointMetadataSyncRecovery {
  projectId: string
  metadataItemId: string
  designFileId: string
  designFileEtag: string
  fields: ProjectDesignListFields
}

export type SharePointProjectStorageUpdateResult =
  | {
      status: 'saved'
      project: SharePointStoredProject
    }
  | {
      status: 'metadata-sync-required'
      project: SharePointStoredProject
      recovery: SharePointMetadataSyncRecovery
    }

export interface SharePointProjectStorageLogger {
  error(
    event: 'sharepoint-project-orphan-storage',
    context: {
      projectId: string
      driveItemId: string
      path: string
      metadataCause: unknown
      cleanupCause?: unknown
      verificationCause?: unknown
    },
  ): void
}

export class SharePointProjectStorageConflictError extends Error {
  constructor() {
    super('The SharePoint project changed after it was loaded.')
    this.name = 'SharePointProjectStorageConflictError'
  }
}

export class SharePointProjectStorageNotFoundError extends Error {
  constructor() {
    super('The SharePoint project or its design file was not found.')
    this.name = 'SharePointProjectStorageNotFoundError'
  }
}

export class SharePointProjectOrphanStorageError extends Error {
  readonly projectId: string
  readonly designFile: SharePointProjectDesignFile

  constructor(
    projectId: string,
    designFile: SharePointProjectDesignFile,
    cause: unknown,
  ) {
    super(
      'The project file was created without a discoverable metadata record and requires administrative reconciliation.',
      { cause },
    )
    this.name = 'SharePointProjectOrphanStorageError'
    this.projectId = projectId
    this.designFile = designFile
  }
}

/**
 * Server-side aggregate storage. The browser continues to use ProjectRepository
 * and never handles list items, drive items, or either underlying ETag.
 */
export class SharePointProjectFileStorage {
  constructor(
    private readonly gateway: SharePointProjectStorageGateway,
    private readonly logger: SharePointProjectStorageLogger = {
      error: () => undefined,
    },
  ) {}

  async create(
    project: PersistedProjectDesignV1,
    audit: HumanProjectAuditFields,
  ): Promise<SharePointStoredProject> {
    const projectId = project.project.id
    const existingMetadataRaw =
      await this.gateway.getMetadataByProjectId(projectId)
    if (existingMetadataRaw) {
      const existingMetadata = metadataRecord(existingMetadataRaw)
      const existingFile = await this.gateway.getDesignFile(
        existingMetadata.fields.ProjectDesignFileId,
      )
      if (!existingFile) throw new SharePointProjectStorageNotFoundError()
      return storedProject(existingMetadata, existingFile)
    }

    const path = projectDesignFilePath(projectId)
    let designFile = await this.gateway.getDesignFileByPath(path)
    let createdThisAttempt = false
    if (!designFile) {
      try {
        designFile = await this.gateway.createDesignFile({
          path,
          content: JSON.stringify(project),
          fields: serializeProjectDesignLibraryFields(
            projectDesignLibraryFields(project),
          ),
        })
        createdThisAttempt = true
      } catch (reason) {
        designFile = await this.gateway.getDesignFileByPath(path)
        if (!designFile) throw reason
      }
    }

    try {
      const metadata = metadataRecord(
        await this.gateway.createMetadataItem(
          serializeProjectDesignListFields(
            projectDesignListFields(project, audit, designFile.driveItemId),
          ),
        ),
      )
      return storedProject(metadata, designFile)
    } catch (reason) {
      let racedMetadataRaw: SharePointGraphProjectMetadataRecord | null
      try {
        racedMetadataRaw = await this.gateway.getMetadataByProjectId(projectId)
      } catch (verificationCause) {
        throw this.orphanStorageError(
          projectId,
          path,
          designFile,
          reason,
          undefined,
          verificationCause,
        )
      }
      const racedMetadata = racedMetadataRaw
        ? metadataRecord(racedMetadataRaw)
        : null
      if (
        racedMetadata?.fields.ProjectDesignFileId === designFile.driveItemId
      ) {
        return storedProject(racedMetadata, designFile)
      }

      if (createdThisAttempt) {
        try {
          await this.gateway.deleteDesignFile(designFile.driveItemId)
        } catch (cleanupReason) {
          throw this.orphanStorageError(
            projectId,
            path,
            designFile,
            reason,
            cleanupReason,
          )
        }
        throw reason
      }
      throw this.orphanStorageError(projectId, path, designFile, reason)
    }
  }

  async load(projectId: string): Promise<SharePointStoredProject> {
    const metadataRaw = await this.gateway.getMetadataByProjectId(projectId)
    if (!metadataRaw) throw new SharePointProjectStorageNotFoundError()
    const metadata = metadataRecord(metadataRaw)
    const designFile = await this.gateway.getDesignFile(
      metadata.fields.ProjectDesignFileId,
    )
    if (!designFile) throw new SharePointProjectStorageNotFoundError()
    return storedProject(metadata, designFile)
  }

  async update(
    project: PersistedProjectDesignV1,
    audit: HumanProjectAuditFields,
    expected: SharePointProjectConcurrencyToken,
  ): Promise<SharePointProjectStorageUpdateResult> {
    const current = await this.load(project.project.id)
    if (
      current.metadata.etag !== expected.metadataEtag ||
      current.designFile.etag !== expected.designFileEtag
    ) {
      throw new SharePointProjectStorageConflictError()
    }

    const designFile = await this.gateway.updateDesignFile({
      driveItemId: current.designFile.driveItemId,
      content: JSON.stringify(project),
      ifMatch: expected.designFileEtag,
      fields: serializeProjectDesignLibraryFields(
        projectDesignLibraryFields(project),
      ),
    })
    const fields = projectDesignListFields(
      project,
      audit,
      current.designFile.driveItemId,
    )
    try {
      const metadata = metadataRecord(
        await this.gateway.updateMetadataItem({
          itemId: current.metadata.itemId,
          fields: serializeProjectDesignListFields(fields),
          ifMatch: expected.metadataEtag,
        }),
      )
      return { status: 'saved', project: storedProject(metadata, designFile) }
    } catch {
      return {
        status: 'metadata-sync-required',
        project: storedProject(current.metadata, designFile),
        recovery: {
          projectId: project.project.id,
          metadataItemId: current.metadata.itemId,
          designFileId: designFile.driveItemId,
          designFileEtag: designFile.etag,
          fields,
        },
      }
    }
  }

  async retryMetadataSync(
    recovery: SharePointMetadataSyncRecovery,
  ): Promise<SharePointStoredProject> {
    const metadataRaw = await this.gateway.getMetadataByProjectId(
      recovery.projectId,
    )
    const metadata = metadataRaw ? metadataRecord(metadataRaw) : null
    if (
      !metadata ||
      metadata.itemId !== recovery.metadataItemId ||
      metadata.fields.ProjectDesignFileId !== recovery.designFileId
    ) {
      throw new SharePointProjectStorageConflictError()
    }
    const designFile = await this.gateway.getDesignFile(recovery.designFileId)
    if (!designFile) throw new SharePointProjectStorageNotFoundError()
    if (designFile.etag !== recovery.designFileEtag) {
      throw new SharePointProjectStorageConflictError()
    }
    const updatedMetadata = metadataRecord(
      await this.gateway.updateMetadataItem({
        itemId: metadata.itemId,
        fields: serializeProjectDesignListFields(recovery.fields),
        ifMatch: metadata.etag,
      }),
    )
    return storedProject(updatedMetadata, designFile)
  }

  async reconcile(
    projectId: string,
    audit: HumanProjectAuditFields,
  ): Promise<SharePointStoredProject> {
    const metadataRaw = await this.gateway.getMetadataByProjectId(projectId)
    const metadata = metadataRaw ? metadataRecord(metadataRaw) : null
    const designFile = metadata
      ? await this.gateway.getDesignFile(metadata.fields.ProjectDesignFileId)
      : await this.gateway.getDesignFileByPath(projectDesignFilePath(projectId))
    if (!designFile) throw new SharePointProjectStorageNotFoundError()

    const project = parseProjectFile(designFile.content)
    if (project.project.id !== projectId) {
      throw new SharePointProjectStorageConflictError()
    }
    const fields = projectDesignListFields(
      project,
      audit,
      designFile.driveItemId,
    )
    const reconciledMetadata = metadataRecord(
      metadata
        ? await this.gateway.updateMetadataItem({
            itemId: metadata.itemId,
            fields: serializeProjectDesignListFields(fields),
            ifMatch: metadata.etag,
          })
        : await this.gateway.createMetadataItem(
            serializeProjectDesignListFields(fields),
          ),
    )
    return storedProject(reconciledMetadata, designFile)
  }

  private orphanStorageError(
    projectId: string,
    path: string,
    designFile: SharePointProjectDesignFile,
    metadataCause: unknown,
    cleanupCause?: unknown,
    verificationCause?: unknown,
  ): SharePointProjectOrphanStorageError {
    this.logger.error('sharepoint-project-orphan-storage', {
      projectId,
      driveItemId: designFile.driveItemId,
      path,
      metadataCause,
      cleanupCause,
      verificationCause,
    })
    return new SharePointProjectOrphanStorageError(projectId, designFile, {
      metadataCause,
      cleanupCause,
      verificationCause,
    })
  }
}

export function projectDesignFileName(projectId: string): string {
  const normalized = projectId.trim()
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(normalized)) {
    throw new Error('ProjectId cannot be converted to a safe design filename.')
  }
  return `ProjectDesign-${normalized}.json`
}

export function projectDesignFilePath(projectId: string): string {
  return `${PROJECT_DESIGNS_LIBRARY_FOLDER}/${projectDesignFileName(projectId)}`
}

function storedProject(
  metadata: SharePointProjectMetadataRecord,
  designFile: SharePointProjectDesignFile,
): SharePointStoredProject {
  return {
    metadata,
    designFile,
    concurrency: {
      metadataEtag: metadata.etag,
      designFileEtag: designFile.etag,
    },
  }
}

function metadataRecord(
  raw: SharePointGraphProjectMetadataRecord,
): SharePointProjectMetadataRecord {
  return {
    itemId: raw.itemId,
    etag: raw.etag,
    fields: deserializeProjectDesignListFields(raw.fields),
  }
}

function parseProjectFile(content: string): PersistedProjectDesignV1 {
  try {
    return parsePersistedProjectDocument(JSON.parse(content) as unknown)
  } catch (reason) {
    if (reason instanceof SyntaxError) {
      return parsePersistedProjectDocument(null)
    }
    throw reason
  }
}

function projectDesignListFields(
  project: PersistedProjectDesignV1,
  audit: HumanProjectAuditFields,
  projectDesignFileId: string,
): ProjectDesignListFields {
  return {
    Title: project.project.name,
    ProjectId: project.project.id,
    ProjectCode: project.project.projectCode,
    Country: project.project.country,
    ProjectStatus: project.project.status,
    FrameworkVersion: project.frameworkVersion,
    FrameworkSchemaVersion: project.frameworkSchemaVersion,
    ProjectSchemaVersion: project.schemaVersion,
    ProjectDesignFileId: projectDesignFileId,
    ...audit,
  }
}

function projectDesignLibraryFields(project: PersistedProjectDesignV1) {
  return {
    ProjectId: project.project.id,
    FrameworkVersion: project.frameworkVersion,
    FrameworkSchemaVersion: project.frameworkSchemaVersion,
    ProjectSchemaVersion: project.schemaVersion,
  }
}
