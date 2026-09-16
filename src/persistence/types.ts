import type { OutputUnitSelection, ProjectStatus } from '../types/project'

export const PROJECT_PERSISTENCE_SCHEMA_VERSION = 1 as const

export interface PersistedStandardIndicatorSelectionV1 {
  frameworkIndicatorId: string
  role: 'primary' | 'additional'
  mandatory: boolean
}

export interface PersistedProjectSpecificIndicatorV1 {
  id: string
  wording: string
  measurementNotes: string
}

export interface PersistedStandardActivitySelectionV1 {
  frameworkActivityId: string
  projectNotes: string
  plannedQuantity?: number | null
  outputUnitSelection?: OutputUnitSelection
  customOutputUnit?: string | null
  useProjectSelfHelpGroupTotal?: boolean
  outputTextOverride?: string | null
}

export interface PersistedProjectSpecificActivityV1 {
  id: string
  wording: string
  projectDetails: string
  plannedQuantity?: number | null
  outputUnitSelection?: OutputUnitSelection
  customOutputUnit?: string | null
  useProjectSelfHelpGroupTotal?: boolean
  outputTextOverride?: string | null
}

export interface PersistedProjectInputV1 {
  id: string
  inputCategoryId: string
  details: string
}

export interface PersistedIntermediateOutcomeConfigurationV1 {
  frameworkIntermediateOutcomeId: string
  primaryIndicator: PersistedStandardIndicatorSelectionV1 | null
  additionalIndicators: PersistedStandardIndicatorSelectionV1[]
  projectSpecificIndicators: PersistedProjectSpecificIndicatorV1[]
  standardActivities: PersistedStandardActivitySelectionV1[]
  projectSpecificActivities: PersistedProjectSpecificActivityV1[]
  inputs: PersistedProjectInputV1[]
  reviewed: boolean
}

export interface PersistedProjectPathwayV1 {
  pathwayId: string
  intermediateOutcomeConfigurations: PersistedIntermediateOutcomeConfigurationV1[]
}

export interface PersistedOutcomePathwayLinkV1 {
  finalOutcomeId: string
  pathwayId: string
  relationshipType: 'primary' | 'related'
}

export interface PersistedCustomPrimaryIndicatorV1 {
  id: string
  wording: string
  measurementNotes: string
}

export interface PersistedCustomIntermediateOutcomeV1 {
  id: string
  isCustom: true
  stepNumber: number
  statement: string
  primaryIndicator: PersistedCustomPrimaryIndicatorV1
  additionalIndicators: PersistedProjectSpecificIndicatorV1[]
  activities: PersistedProjectSpecificActivityV1[]
  inputs: PersistedProjectInputV1[]
}

export interface PersistedCustomPathwayV1 {
  id: string
  isCustom: true
  name: string
  description: string
  rationale: string
  intermediateOutcomes: PersistedCustomIntermediateOutcomeV1[]
}

export interface PersistedCustomInnovationV1 {
  id: string
  isCustom: true
  shortLabel: string
  statement: string
  rationale: string
  impactAreaIds: string[]
  primaryIndicator: PersistedCustomPrimaryIndicatorV1
  pathway: PersistedCustomPathwayV1
}

export interface PersistedProjectDesignV1 {
  schemaVersion: typeof PROJECT_PERSISTENCE_SCHEMA_VERSION
  frameworkVersion: string
  frameworkSchemaVersion: string
  project: {
    id: string
    name: string
    country?: string
    projectCode?: string
    status: ProjectStatus
  }
  design: {
    metadata: {
      donor: string
      fundingReference: string
      projectManager: string
      plannedStartDate: string
      plannedEndDate: string
      description: string
      plannedSelfHelpGroupCount?: number | null
    }
    selectedFinalOutcomeIds: string[]
    finalOutcomeSelectionSources: Record<string, 'direct' | 'related-pathway'>
    projectPathways: PersistedProjectPathwayV1[]
    outcomePathwayLinks: PersistedOutcomePathwayLinkV1[]
    customInnovation: PersistedCustomInnovationV1 | null
  }
}

export interface ProjectAuditIdentity {
  objectId: string
  name: string
  email: string
}

export interface ProjectRecord {
  project: PersistedProjectDesignV1
  /** Opaque repository token. SharePoint mode represents list and file ETags. */
  etag: string
  createdAt: string
  modifiedAt: string
  createdBy?: ProjectAuditIdentity
  modifiedBy?: ProjectAuditIdentity
}

export interface MetadataSyncRequiredResult {
  status: 'metadata-sync-required'
  record: ProjectRecord
  /** Opaque API token; its contents are never interpreted by browser code. */
  metadataSyncToken: string
}

export type ProjectSaveResult = ProjectRecord | MetadataSyncRequiredResult

export function isMetadataSyncRequiredResult(
  result: ProjectSaveResult,
): result is MetadataSyncRequiredResult {
  return 'status' in result && result.status === 'metadata-sync-required'
}

export interface ProjectSummary {
  id: string
  name: string
  projectCode?: string
  country?: string
  status: ProjectStatus
  frameworkVersion: string
  schemaVersion: number
  modifiedAt: string
  potentialDonor?: string
  createdBy?: ProjectAuditIdentity
  modifiedBy?: ProjectAuditIdentity
}

export interface ProjectRepository {
  createProject(project: PersistedProjectDesignV1): Promise<ProjectSaveResult>
  updateProject(
    project: PersistedProjectDesignV1,
    etag: string,
  ): Promise<ProjectSaveResult>
  retryMetadataSync?(
    projectId: string,
    metadataSyncToken: string,
  ): Promise<ProjectSaveResult>
  getProject(id: string): Promise<ProjectRecord | null>
  listProjects(): Promise<ProjectSummary[]>
}
