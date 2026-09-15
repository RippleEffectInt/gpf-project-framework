import type { HumanProjectAuditFields } from './projectAuditPolicy'

export const SHAREPOINT_PROJECT_SITE_URL =
  'https://sendacow.sharepoint.com/sites/Projects'

export const SHAREPOINT_PROJECT_SERVER_ENV_KEYS = {
  siteUrl: 'SHAREPOINT_SITE_URL',
  siteId: 'SHAREPOINT_SITE_ID',
  projectDesignsListId: 'SHAREPOINT_PROJECT_DESIGNS_LIST_ID',
  projectDesignFilesLibraryListId:
    'SHAREPOINT_PROJECT_DESIGN_FILES_LIBRARY_LIST_ID',
} as const

export const SHAREPOINT_PROJECT_RESOURCE_SCHEMA = {
  listDisplayName: 'GPF - Project Designs',
  libraryDisplayName: 'GPF - Project Design Files',
  listFields: {
    Title: 'Title',
    ProjectId: 'field_1',
    ProjectCode: 'field_2',
    Country: 'field_3',
    ProjectStatus: 'field_4',
    FrameworkVersion: 'field_5',
    FrameworkSchemaVersion: 'field_6',
    ProjectSchemaVersion: 'ProjectSchemaVersion',
    ProjectDesignFileId: 'field_8',
    CreatedByName: 'field_9',
    CreatedByEmail: 'field_10',
    CreatedByObjectId: 'field_11',
    ModifiedByName: 'field_12',
    ModifiedByEmail: 'field_13',
    ModifiedByObjectId: 'field_14',
    Author: 'Author',
    Created: 'Created',
    Modified: 'Modified',
    Editor: 'Editor',
  },
  libraryFields: {
    ProjectId: 'ProjectId',
    FrameworkVersion: 'FrameworkVersion',
    FrameworkSchemaVersion: 'FrameworkSchemaVersion',
    ProjectSchemaVersion: 'ProjectSchemaVersion',
    Author: 'Author',
    Created: 'Created',
    Modified: 'Modified',
    Editor: 'Editor',
  },
} as const

export interface SharePointProjectServerConfig {
  siteUrl: string
  siteId: string
  projectDesignsListId: string
  projectDesignFilesLibraryListId: string
}

export function readSharePointProjectServerConfig(
  environment: Record<string, string | undefined>,
): SharePointProjectServerConfig {
  const siteUrl =
    environment.SHAREPOINT_SITE_URL?.trim() || SHAREPOINT_PROJECT_SITE_URL
  const siteId = environment.SHAREPOINT_SITE_ID?.trim()
  const projectDesignsListId =
    environment.SHAREPOINT_PROJECT_DESIGNS_LIST_ID?.trim()
  const projectDesignFilesLibraryListId =
    environment.SHAREPOINT_PROJECT_DESIGN_FILES_LIBRARY_LIST_ID?.trim()
  if (!siteId || !projectDesignsListId || !projectDesignFilesLibraryListId) {
    throw new Error(
      'SharePoint site ID, Project Designs list ID and Project Design Files library list ID are required.',
    )
  }
  return {
    siteUrl,
    siteId,
    projectDesignsListId,
    projectDesignFilesLibraryListId,
  }
}

export interface ProjectDesignListFields extends HumanProjectAuditFields {
  Title: string
  ProjectId: string
  ProjectCode?: string
  Country?: string
  ProjectStatus: string
  FrameworkVersion: string
  FrameworkSchemaVersion: string
  ProjectSchemaVersion: number
  ProjectDesignFileId: string
}

export interface ProjectDesignLibraryFields {
  ProjectId: string
  FrameworkVersion: string
  FrameworkSchemaVersion: string
  ProjectSchemaVersion: number
}

export type SharePointGraphFields = Record<string, unknown>

export function serializeProjectDesignListFields(
  fields: ProjectDesignListFields,
): SharePointGraphFields {
  const names = SHAREPOINT_PROJECT_RESOURCE_SCHEMA.listFields
  return compactFields({
    [names.Title]: fields.Title,
    [names.ProjectId]: fields.ProjectId,
    [names.ProjectCode]: fields.ProjectCode,
    [names.Country]: fields.Country,
    [names.ProjectStatus]: fields.ProjectStatus,
    [names.FrameworkVersion]: fields.FrameworkVersion,
    [names.FrameworkSchemaVersion]: fields.FrameworkSchemaVersion,
    [names.ProjectSchemaVersion]: fields.ProjectSchemaVersion,
    [names.ProjectDesignFileId]: fields.ProjectDesignFileId,
    [names.CreatedByName]: fields.CreatedByName,
    [names.CreatedByEmail]: fields.CreatedByEmail,
    [names.CreatedByObjectId]: fields.CreatedByObjectId,
    [names.ModifiedByName]: fields.ModifiedByName,
    [names.ModifiedByEmail]: fields.ModifiedByEmail,
    [names.ModifiedByObjectId]: fields.ModifiedByObjectId,
  })
}

export function deserializeProjectDesignListFields(
  raw: SharePointGraphFields,
): ProjectDesignListFields {
  const names = SHAREPOINT_PROJECT_RESOURCE_SCHEMA.listFields
  return {
    Title: requiredString(raw, names.Title),
    ProjectId: requiredString(raw, names.ProjectId),
    ProjectCode: optionalString(raw, names.ProjectCode),
    Country: optionalString(raw, names.Country),
    ProjectStatus: requiredString(raw, names.ProjectStatus),
    FrameworkVersion: requiredString(raw, names.FrameworkVersion),
    FrameworkSchemaVersion: requiredString(raw, names.FrameworkSchemaVersion),
    ProjectSchemaVersion: requiredNumber(raw, names.ProjectSchemaVersion),
    ProjectDesignFileId: requiredString(raw, names.ProjectDesignFileId),
    CreatedByName: requiredString(raw, names.CreatedByName),
    CreatedByEmail: requiredString(raw, names.CreatedByEmail),
    CreatedByObjectId: requiredString(raw, names.CreatedByObjectId),
    ModifiedByName: requiredString(raw, names.ModifiedByName),
    ModifiedByEmail: requiredString(raw, names.ModifiedByEmail),
    ModifiedByObjectId: requiredString(raw, names.ModifiedByObjectId),
  }
}

export function serializeProjectDesignLibraryFields(
  fields: ProjectDesignLibraryFields,
): SharePointGraphFields {
  const names = SHAREPOINT_PROJECT_RESOURCE_SCHEMA.libraryFields
  return {
    [names.ProjectId]: fields.ProjectId,
    [names.FrameworkVersion]: fields.FrameworkVersion,
    [names.FrameworkSchemaVersion]: fields.FrameworkSchemaVersion,
    [names.ProjectSchemaVersion]: fields.ProjectSchemaVersion,
  }
}

export function deserializeProjectDesignLibraryFields(
  raw: SharePointGraphFields,
): ProjectDesignLibraryFields {
  const names = SHAREPOINT_PROJECT_RESOURCE_SCHEMA.libraryFields
  return {
    ProjectId: requiredString(raw, names.ProjectId),
    FrameworkVersion: requiredString(raw, names.FrameworkVersion),
    FrameworkSchemaVersion: requiredString(raw, names.FrameworkSchemaVersion),
    ProjectSchemaVersion: requiredNumber(raw, names.ProjectSchemaVersion),
  }
}

function compactFields(fields: SharePointGraphFields): SharePointGraphFields {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  )
}

function requiredString(
  fields: SharePointGraphFields,
  internalName: string,
): string {
  const value = fields[internalName]
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`SharePoint field ${internalName} must be a string.`)
  }
  return value
}

function optionalString(
  fields: SharePointGraphFields,
  internalName: string,
): string | undefined {
  const value = fields[internalName]
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') {
    throw new Error(`SharePoint field ${internalName} must be a string.`)
  }
  return value
}

function requiredNumber(
  fields: SharePointGraphFields,
  internalName: string,
): number {
  const value = fields[internalName]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`SharePoint field ${internalName} must be a number.`)
  }
  return value
}
