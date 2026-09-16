import { ProjectPersistenceError } from './errors'
import { parsePersistedProjectDocument } from './projectSerialization'
import type {
  ProjectAuditIdentity,
  ProjectRecord,
  ProjectSummary,
} from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseProjectAuditIdentity(
  value: unknown,
): ProjectAuditIdentity | undefined {
  if (value === undefined) return undefined
  if (
    !isRecord(value) ||
    typeof value.objectId !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.email !== 'string'
  ) {
    throw new ProjectPersistenceError('malformed-data')
  }
  return {
    objectId: value.objectId,
    name: value.name,
    email: value.email,
  }
}

export function parseProjectRecord(raw: unknown): ProjectRecord {
  if (
    !isRecord(raw) ||
    typeof raw.etag !== 'string' ||
    typeof raw.createdAt !== 'string' ||
    typeof raw.modifiedAt !== 'string'
  ) {
    throw new ProjectPersistenceError('malformed-data')
  }
  return {
    project: parsePersistedProjectDocument(raw.project),
    etag: raw.etag,
    createdAt: raw.createdAt,
    modifiedAt: raw.modifiedAt,
    createdBy: parseProjectAuditIdentity(raw.createdBy),
    modifiedBy: parseProjectAuditIdentity(raw.modifiedBy),
  }
}

export function toProjectSummary(record: ProjectRecord): ProjectSummary {
  return {
    id: record.project.project.id,
    name: record.project.project.name,
    projectCode: record.project.project.projectCode,
    country: record.project.project.country,
    status: record.project.project.status,
    frameworkVersion: record.project.frameworkVersion,
    schemaVersion: record.project.schemaVersion,
    modifiedAt: record.modifiedAt,
    potentialDonor: record.project.design.metadata.donor || undefined,
    createdBy: record.createdBy,
    modifiedBy: record.modifiedBy,
  }
}
