import { ProjectPersistenceError } from '../src/persistence/errors'
import { parsePersistedProjectDocument } from '../src/persistence/projectSerialization'
import type { ProjectRecord, ProjectSummary } from '../src/persistence/types'
import {
  MicrosoftGraphDataError,
  MicrosoftGraphForbiddenError,
  MicrosoftGraphUnauthorizedError,
} from './microsoftGraphClient'
import {
  auditFieldsForProjectCreate,
  auditFieldsForProjectUpdate,
  authorizeProjectRepositoryOperation,
  UnauthenticatedProjectRequestError,
  type ProjectRepositoryOperation,
  type VerifiedStaticWebAppsPrincipal,
} from './projectAuditPolicy'
import { getSharePointGraphServices } from './sharePointGraphServices'
import { SharePointGraphStorageGateway } from './sharePointGraphStorageGateway'
import {
  SHAREPOINT_PROJECT_RESOURCE_SCHEMA,
  deserializeProjectDesignListFields,
} from './sharePointProjectSchema'
import {
  SharePointProjectFileStorage,
  SharePointProjectOrphanStorageError,
  SharePointProjectStorageConflictError,
  SharePointProjectStorageNotFoundError,
  type SharePointProjectConcurrencyToken,
  type SharePointStoredProject,
} from './sharePointProjectStorage'
import { SharePointProjectDriveResolutionError } from './sharePointProjectDriveResolver'
import { GraphTokenAcquisitionError } from './graphCertificateAuth'

export interface ProjectApiResponse {
  status: number
  body?: unknown
  headers?: Record<string, string>
}

export class ProjectApiService {
  constructor(
    private readonly storage: SharePointProjectFileStorage,
    private readonly gateway: SharePointGraphStorageGateway,
  ) {}

  async list(
    principal: VerifiedStaticWebAppsPrincipal | null,
  ): Promise<ProjectApiResponse> {
    authorizeProjectRepositoryOperation(principal, 'list')
    const records = await this.gateway.listMetadataItems()
    const summaries = records.map((record) => {
      const fields = deserializeProjectDesignListFields(record.fields)
      return {
        id: fields.ProjectId,
        name: fields.Title,
        projectCode: fields.ProjectCode,
        country: fields.Country,
        status: projectStatus(fields.ProjectStatus),
        frameworkVersion: fields.FrameworkVersion,
        schemaVersion: fields.ProjectSchemaVersion,
        modifiedAt: nativeTimestamp(record.fields, 'Modified'),
        createdBy: {
          objectId: fields.CreatedByObjectId,
          name: fields.CreatedByName,
          email: fields.CreatedByEmail,
        },
        modifiedBy: {
          objectId: fields.ModifiedByObjectId,
          name: fields.ModifiedByName,
          email: fields.ModifiedByEmail,
        },
      } satisfies ProjectSummary
    })
    return { status: 200, body: summaries }
  }

  async create(
    principal: VerifiedStaticWebAppsPrincipal | null,
    rawProject: unknown,
  ): Promise<ProjectApiResponse> {
    const authenticated = authorizeProjectRepositoryOperation(
      principal,
      'create',
    )
    const project = parsePersistedProjectDocument(rawProject)
    const stored = await this.storage.create(
      project,
      auditFieldsForProjectCreate(authenticated),
    )
    return projectRecordResponse(stored, 201)
  }

  async get(
    principal: VerifiedStaticWebAppsPrincipal | null,
    projectId: string,
  ): Promise<ProjectApiResponse> {
    authorizeProjectRepositoryOperation(principal, 'read')
    return projectRecordResponse(await this.storage.load(projectId), 200)
  }

  async update(
    principal: VerifiedStaticWebAppsPrincipal | null,
    projectId: string,
    rawProject: unknown,
    rawEtag: string | null,
  ): Promise<ProjectApiResponse> {
    const authenticated = authorizeProjectRepositoryOperation(
      principal,
      'update',
    )
    const project = parsePersistedProjectDocument(rawProject)
    if (project.project.id !== projectId) {
      throw new ProjectPersistenceError('malformed-data')
    }
    const current = await this.storage.load(projectId)
    const result = await this.storage.update(
      project,
      auditFieldsForProjectUpdate(current.metadata.fields, authenticated),
      decodeConcurrencyToken(rawEtag),
    )
    if (result.status === 'saved') {
      return projectRecordResponse(result.project, 200)
    }
    const response = projectRecordResponse(result.project, 202)
    return {
      ...response,
      body: {
        status: 'metadata-sync-required',
        record: response.body,
        metadataSyncToken: encodeConcurrencyToken(result.project.concurrency),
      },
    }
  }

  async retryMetadataSync(
    principal: VerifiedStaticWebAppsPrincipal | null,
    projectId: string,
    metadataSyncToken: unknown,
  ): Promise<ProjectApiResponse> {
    const authenticated = authorizeProjectRepositoryOperation(
      principal,
      'update',
    )
    if (typeof metadataSyncToken !== 'string') {
      throw new ProjectPersistenceError('malformed-data')
    }
    const expected = decodeConcurrencyToken(metadataSyncToken)
    const current = await this.storage.load(projectId)
    if (current.designFile.etag !== expected.designFileEtag) {
      throw new SharePointProjectStorageConflictError()
    }
    const reconciled = await this.storage.reconcile(
      projectId,
      auditFieldsForProjectUpdate(current.metadata.fields, authenticated),
    )
    return projectRecordResponse(reconciled, 200)
  }
}

let processApiService: ProjectApiService | null = null

export function getProjectApiService(): ProjectApiService {
  if (processApiService) return processApiService
  const services = getSharePointGraphServices()
  const gateway = new SharePointGraphStorageGateway(
    services.config,
    services.graphClient,
    services.driveResolver,
  )
  processApiService = new ProjectApiService(
    new SharePointProjectFileStorage(gateway),
    gateway,
  )
  return processApiService
}

export type ClientPrincipalParseFailure =
  | 'missing-header'
  | 'malformed-encoding'
  | 'claims-not-array'
  | 'missing-identity-fields'

export interface ClientPrincipalParseDiagnostic {
  hasHeader: boolean
  headerLength: number
  identityProvider: string | null
  hasUserId: boolean
  hasUserDetails: boolean
  claimsIsArray: boolean
  claimCount: number
  parseFailure: ClientPrincipalParseFailure | null
}

export function inspectStaticWebAppsPrincipal(
  encodedPrincipal: string | null,
): {
  principal: VerifiedStaticWebAppsPrincipal | null
  diagnostic: ClientPrincipalParseDiagnostic
} {
  const diagnostic: ClientPrincipalParseDiagnostic = {
    hasHeader: Boolean(encodedPrincipal),
    headerLength: encodedPrincipal?.length ?? 0,
    identityProvider: null,
    hasUserId: false,
    hasUserDetails: false,
    claimsIsArray: false,
    claimCount: 0,
    parseFailure: encodedPrincipal ? null : 'missing-header',
  }
  if (!encodedPrincipal) {
    return { principal: null, diagnostic }
  }
  try {
    const raw = JSON.parse(
      Buffer.from(encodedPrincipal, 'base64').toString('utf8'),
    ) as unknown
    if (!isRecord(raw)) {
      return {
        principal: null,
        diagnostic: { ...diagnostic, parseFailure: 'malformed-encoding' },
      }
    }
    diagnostic.identityProvider =
      typeof raw.identityProvider === 'string' ? raw.identityProvider : null
    diagnostic.hasUserId = typeof raw.userId === 'string'
    diagnostic.hasUserDetails = typeof raw.userDetails === 'string'
    if (raw.claims === undefined) {
      diagnostic.claimsIsArray = true
    } else if (Array.isArray(raw.claims)) {
      diagnostic.claimsIsArray = true
      diagnostic.claimCount = raw.claims.length
    } else {
      return {
        principal: null,
        diagnostic: { ...diagnostic, parseFailure: 'claims-not-array' },
      }
    }
    if (
      typeof raw.identityProvider !== 'string' ||
      typeof raw.userId !== 'string' ||
      typeof raw.userDetails !== 'string'
    ) {
      return {
        principal: null,
        diagnostic: { ...diagnostic, parseFailure: 'missing-identity-fields' },
      }
    }
    const claims = Array.isArray(raw.claims)
      ? raw.claims
          .filter(
            (claim): claim is { typ: string; val: string } =>
              isRecord(claim) &&
              typeof claim.typ === 'string' &&
              typeof claim.val === 'string',
          )
          .map(({ typ, val }) => ({ typ, val }))
      : []
    diagnostic.claimCount = claims.length
    return {
      principal: {
        identityProvider: raw.identityProvider,
        userId: raw.userId,
        userDetails: raw.userDetails,
        claims,
      },
      diagnostic,
    }
  } catch {
    return {
      principal: null,
      diagnostic: { ...diagnostic, parseFailure: 'malformed-encoding' },
    }
  }
}

export function parseStaticWebAppsPrincipal(
  encodedPrincipal: string | null,
): VerifiedStaticWebAppsPrincipal | null {
  return inspectStaticWebAppsPrincipal(encodedPrincipal).principal
}

export function projectApiErrorResponse(reason: unknown): ProjectApiResponse {
  if (reason instanceof UnauthenticatedProjectRequestError) {
    return safeError(401, 'authentication')
  }
  if (reason instanceof MicrosoftGraphUnauthorizedError) {
    return safeError(502, 'graph-authentication')
  }
  if (reason instanceof MicrosoftGraphForbiddenError) {
    return safeError(502, 'graph-permission')
  }
  if (
    reason instanceof GraphTokenAcquisitionError ||
    reason instanceof SharePointProjectDriveResolutionError
  ) {
    return safeError(503, 'graph-unavailable')
  }
  if (
    reason instanceof SharePointProjectStorageConflictError ||
    (reason instanceof MicrosoftGraphDataError &&
      [409, 412].includes(reason.status))
  ) {
    return safeError(409, 'conflict')
  }
  if (
    reason instanceof SharePointProjectStorageNotFoundError ||
    (reason instanceof MicrosoftGraphDataError && reason.status === 404)
  ) {
    return safeError(404, 'not-found')
  }
  if (reason instanceof SharePointProjectOrphanStorageError) {
    return safeError(500, 'orphan-storage')
  }
  if (reason instanceof ProjectPersistenceError) {
    const status = [
      'malformed-data',
      'unsupported-schema',
      'framework-incompatible',
    ].includes(reason.code)
      ? 400
      : 500
    return safeError(status, reason.code)
  }
  return safeError(500, 'server-error')
}

function projectRecordResponse(
  stored: SharePointStoredProject,
  status: number,
): ProjectApiResponse {
  const record = storedProjectRecord(stored)
  return {
    status,
    body: record,
    headers: {
      ETag: record.etag,
      'Content-Type': 'application/json',
    },
  }
}

function storedProjectRecord(stored: SharePointStoredProject): ProjectRecord {
  const project = parsePersistedProjectDocument(
    JSON.parse(stored.designFile.content) as unknown,
  )
  const fields = stored.metadata.fields
  const modifiedAt =
    stored.designFile.modifiedAt ??
    stored.metadata.modifiedAt ??
    new Date().toISOString()
  return {
    project,
    etag: encodeConcurrencyToken(stored.concurrency),
    createdAt: stored.metadata.createdAt ?? modifiedAt,
    modifiedAt,
    createdBy: {
      objectId: fields.CreatedByObjectId,
      name: fields.CreatedByName,
      email: fields.CreatedByEmail,
    },
    modifiedBy: {
      objectId: fields.ModifiedByObjectId,
      name: fields.ModifiedByName,
      email: fields.ModifiedByEmail,
    },
  }
}

function encodeConcurrencyToken(
  token: SharePointProjectConcurrencyToken,
): string {
  const encoded = Buffer.from(
    JSON.stringify({
      version: 1,
      metadataEtag: token.metadataEtag,
      designFileEtag: token.designFileEtag,
    }),
  ).toString('base64url')
  return `"gpf.${encoded}"`
}

function decodeConcurrencyToken(
  rawToken: string | null,
): SharePointProjectConcurrencyToken {
  if (!rawToken?.startsWith('"gpf.') || !rawToken.endsWith('"')) {
    throw new SharePointProjectStorageConflictError()
  }
  try {
    const raw = JSON.parse(
      Buffer.from(rawToken.slice(5, -1), 'base64url').toString('utf8'),
    ) as unknown
    if (
      !isRecord(raw) ||
      raw.version !== 1 ||
      typeof raw.metadataEtag !== 'string' ||
      typeof raw.designFileEtag !== 'string'
    ) {
      throw new Error()
    }
    return {
      metadataEtag: raw.metadataEtag,
      designFileEtag: raw.designFileEtag,
    }
  } catch {
    throw new SharePointProjectStorageConflictError()
  }
}

function nativeTimestamp(
  fields: Record<string, unknown>,
  displayName: 'Modified',
): string {
  const internalName =
    SHAREPOINT_PROJECT_RESOURCE_SCHEMA.listFields[displayName]
  const value = fields[internalName]
  if (typeof value !== 'string') {
    throw new MicrosoftGraphDataError(502)
  }
  return value
}

function projectStatus(value: string): ProjectSummary['status'] {
  if (
    !['Draft', 'Submitted', 'Changes Requested', 'Approved'].includes(value)
  ) {
    throw new MicrosoftGraphDataError(502)
  }
  return value as ProjectSummary['status']
}

function safeError(status: number, code: string): ProjectApiResponse {
  return {
    status,
    body: { code, message: 'The project request could not be completed.' },
    headers: { 'Content-Type': 'application/json' },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export type { ProjectRepositoryOperation }
