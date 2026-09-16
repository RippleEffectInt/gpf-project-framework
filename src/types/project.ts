export interface ProjectMetadata {
  title: string
  country: string
  donor: string
  fundingReference: string
  projectManager: string
  plannedStartDate: string
  plannedEndDate: string
  description: string
  plannedSelfHelpGroupCount: number | null
}

export type PathwayRelationshipType = 'primary' | 'related'
export type FinalOutcomeSelectionSource = 'direct' | 'related-pathway'

export interface StandardIndicatorSelection {
  frameworkIndicatorId: string
  role: 'primary' | 'additional'
  mandatory: boolean
}

export interface ProjectSpecificIndicator {
  id: string
  wording: string
  measurementNotes: string
}

export type OutputUnitSelection =
  | null
  | 'no-unit'
  | 'linkages'
  | 'people'
  | 'schemes'
  | 'platforms'
  | 'events'
  | 'organisations'
  | 'facilities'
  | 'businesses'
  | 'processes'
  | 'service-providers'
  | 'local-infrastructure'
  | 'standards'
  | 'providers'
  | 'self-help-groups'
  | 'enterprises'
  | 'communities'
  | 'demonstration-plots'
  | 'households'
  | 'committees'
  | 'ripple-effect'
  | 'pfts'
  | 'community-workshops'
  | 'farmer-field-schools'
  | 'other'

export interface ActivityOutputPlanning {
  plannedQuantity: number | null
  outputUnitSelection: OutputUnitSelection
  customOutputUnit: string | null
  useProjectSelfHelpGroupTotal: boolean
  outputTextOverride: string | null
}

export interface StandardActivitySelection {
  frameworkActivityId: string
  projectNotes: string
  plannedQuantity?: number | null
  outputUnitSelection?: OutputUnitSelection
  customOutputUnit?: string | null
  useProjectSelfHelpGroupTotal?: boolean
  outputTextOverride?: string | null
}

export interface ProjectSpecificActivity {
  id: string
  wording: string
  projectDetails: string
  plannedQuantity?: number | null
  outputUnitSelection?: OutputUnitSelection
  customOutputUnit?: string | null
  useProjectSelfHelpGroupTotal?: boolean
  outputTextOverride?: string | null
}

export interface ProjectInput {
  id: string
  inputCategoryId: string
  details: string
}

export interface InputCategory {
  readonly id: string
  readonly label: string
}

export interface ProjectIntermediateOutcomeConfiguration {
  projectPathwayId: string
  frameworkIntermediateOutcomeId: string
  primaryIndicator: StandardIndicatorSelection | null
  additionalIndicators: StandardIndicatorSelection[]
  projectSpecificIndicators: ProjectSpecificIndicator[]
  standardActivities: StandardActivitySelection[]
  projectSpecificActivities: ProjectSpecificActivity[]
  inputs: ProjectInput[]
  reviewed: boolean
}

export interface PathwayIntermediateOutcomeSeed {
  frameworkIntermediateOutcomeId: string
  primaryIndicatorId: string | null
}

export interface ProjectPathway {
  pathwayId: string
  intermediateOutcomeConfigurations: ProjectIntermediateOutcomeConfiguration[]
}

export interface OutcomePathwayLink {
  finalOutcomeId: string
  pathwayId: string
  relationshipType: PathwayRelationshipType
}

export type ConfigurationStatus = 'not-started' | 'in-progress' | 'configured'

export interface CustomPrimaryIndicator {
  id: string
  wording: string
  measurementNotes: string
}

export interface CustomIntermediateOutcome {
  id: string
  isCustom: true
  stepNumber: number
  statement: string
  primaryIndicator: CustomPrimaryIndicator
  additionalIndicators: ProjectSpecificIndicator[]
  activities: ProjectSpecificActivity[]
  inputs: ProjectInput[]
}

export interface CustomPathway {
  id: string
  isCustom: true
  name: string
  description: string
  rationale: string
  intermediateOutcomes: CustomIntermediateOutcome[]
}

export interface CustomInnovationOutcome {
  id: string
  isCustom: true
  shortLabel: string
  statement: string
  rationale: string
  impactAreaIds: string[]
  primaryIndicator: CustomPrimaryIndicator
  pathway: CustomPathway
}

export interface ProjectDesignState {
  metadata: ProjectMetadata
  selectedFinalOutcomeIds: string[]
  finalOutcomeSelectionSources: Record<string, FinalOutcomeSelectionSource>
  projectPathways: ProjectPathway[]
  outcomePathwayLinks: OutcomePathwayLink[]
  customInnovation: CustomInnovationOutcome | null
  lastSavedAt: string | null
}

export type ProjectStatus =
  | 'Draft'
  | 'Submitted'
  | 'Changes Requested'
  | 'Approved'

export interface ProjectListItem {
  id: string
  name: string
  country: string
  projectManager: string
  status: ProjectStatus
  frameworkVersion: string
  lastUpdated: string
}
