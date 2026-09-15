import type { FrameworkData } from '../types/framework'
import { inputCategories } from '../data/inputCategories'
import type {
  CustomInnovationOutcome,
  ProjectDesignState,
  ProjectStatus,
} from '../types/project'
import { ProjectPersistenceError } from './errors'
import {
  PROJECT_PERSISTENCE_SCHEMA_VERSION,
  type PersistedCustomInnovationV1,
  type PersistedIntermediateOutcomeConfigurationV1,
  type PersistedProjectDesignV1,
  type PersistedProjectInputV1,
  type PersistedProjectPathwayV1,
  type PersistedProjectSpecificActivityV1,
  type PersistedProjectSpecificIndicatorV1,
  type PersistedStandardActivitySelectionV1,
  type PersistedStandardIndicatorSelectionV1,
} from './types'

const PROJECT_STATUSES: readonly ProjectStatus[] = [
  'Draft',
  'Submitted',
  'Changes Requested',
  'Approved',
]

interface SerializeProjectInput {
  id: string
  projectCode?: string
  status: ProjectStatus
  design: ProjectDesignState
  framework: FrameworkData
}

export interface LoadedPersistedProject {
  document: PersistedProjectDesignV1
  design: ProjectDesignState
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || isString(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString)
}

function isProjectStatus(value: unknown): value is ProjectStatus {
  return isString(value) && PROJECT_STATUSES.includes(value as ProjectStatus)
}

function isStandardIndicator(
  value: unknown,
): value is PersistedStandardIndicatorSelectionV1 {
  return (
    isRecord(value) &&
    isString(value.frameworkIndicatorId) &&
    (value.role === 'primary' || value.role === 'additional') &&
    typeof value.mandatory === 'boolean'
  )
}

function isProjectSpecificIndicator(
  value: unknown,
): value is PersistedProjectSpecificIndicatorV1 {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.wording) &&
    isString(value.measurementNotes)
  )
}

function isStandardActivity(
  value: unknown,
): value is PersistedStandardActivitySelectionV1 {
  return (
    isRecord(value) &&
    isString(value.frameworkActivityId) &&
    isString(value.projectNotes)
  )
}

function isProjectSpecificActivity(
  value: unknown,
): value is PersistedProjectSpecificActivityV1 {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.wording) &&
    isString(value.projectDetails)
  )
}

function isProjectInput(value: unknown): value is PersistedProjectInputV1 {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.inputCategoryId) &&
    isString(value.details)
  )
}

function isIntermediateOutcomeConfiguration(
  value: unknown,
): value is PersistedIntermediateOutcomeConfigurationV1 {
  return (
    isRecord(value) &&
    isString(value.frameworkIntermediateOutcomeId) &&
    (value.primaryIndicator === null ||
      isStandardIndicator(value.primaryIndicator)) &&
    Array.isArray(value.additionalIndicators) &&
    value.additionalIndicators.every(isStandardIndicator) &&
    Array.isArray(value.projectSpecificIndicators) &&
    value.projectSpecificIndicators.every(isProjectSpecificIndicator) &&
    Array.isArray(value.standardActivities) &&
    value.standardActivities.every(isStandardActivity) &&
    Array.isArray(value.projectSpecificActivities) &&
    value.projectSpecificActivities.every(isProjectSpecificActivity) &&
    Array.isArray(value.inputs) &&
    value.inputs.every(isProjectInput) &&
    typeof value.reviewed === 'boolean'
  )
}

function isProjectPathway(value: unknown): value is PersistedProjectPathwayV1 {
  return (
    isRecord(value) &&
    isString(value.pathwayId) &&
    Array.isArray(value.intermediateOutcomeConfigurations) &&
    value.intermediateOutcomeConfigurations.every(
      isIntermediateOutcomeConfiguration,
    )
  )
}

function isCustomPrimaryIndicator(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.wording) &&
    isString(value.measurementNotes)
  )
}

function isCustomInnovation(
  value: unknown,
): value is PersistedCustomInnovationV1 {
  if (
    !isRecord(value) ||
    value.isCustom !== true ||
    !isString(value.id) ||
    !isString(value.shortLabel) ||
    !isString(value.statement) ||
    !isString(value.rationale) ||
    !isStringArray(value.impactAreaIds) ||
    !isCustomPrimaryIndicator(value.primaryIndicator) ||
    !isRecord(value.pathway)
  ) {
    return false
  }
  const pathway = value.pathway
  return (
    pathway.isCustom === true &&
    isString(pathway.id) &&
    isString(pathway.name) &&
    isString(pathway.description) &&
    isString(pathway.rationale) &&
    Array.isArray(pathway.intermediateOutcomes) &&
    pathway.intermediateOutcomes.every(
      (outcome) =>
        isRecord(outcome) &&
        outcome.isCustom === true &&
        isString(outcome.id) &&
        typeof outcome.stepNumber === 'number' &&
        Number.isInteger(outcome.stepNumber) &&
        isString(outcome.statement) &&
        isCustomPrimaryIndicator(outcome.primaryIndicator) &&
        Array.isArray(outcome.additionalIndicators) &&
        outcome.additionalIndicators.every(isProjectSpecificIndicator) &&
        Array.isArray(outcome.activities) &&
        outcome.activities.every(isProjectSpecificActivity) &&
        Array.isArray(outcome.inputs) &&
        outcome.inputs.every(isProjectInput),
    )
  )
}

function isSelectionSources(
  value: unknown,
): value is Record<string, 'direct' | 'related-pathway'> {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (source) => source === 'direct' || source === 'related-pathway',
    )
  )
}

export function isPersistedProjectDesignV1(
  value: unknown,
): value is PersistedProjectDesignV1 {
  if (
    !isRecord(value) ||
    value.schemaVersion !== PROJECT_PERSISTENCE_SCHEMA_VERSION ||
    !isString(value.frameworkVersion) ||
    !isString(value.frameworkSchemaVersion) ||
    !isRecord(value.project) ||
    !isRecord(value.design)
  ) {
    return false
  }
  const project = value.project
  const design = value.design
  return (
    isString(project.id) &&
    isString(project.name) &&
    isOptionalString(project.country) &&
    isOptionalString(project.projectCode) &&
    isProjectStatus(project.status) &&
    isRecord(design.metadata) &&
    isString(design.metadata.donor) &&
    isString(design.metadata.fundingReference) &&
    isString(design.metadata.projectManager) &&
    isString(design.metadata.plannedStartDate) &&
    isString(design.metadata.plannedEndDate) &&
    isString(design.metadata.description) &&
    isStringArray(design.selectedFinalOutcomeIds) &&
    isSelectionSources(design.finalOutcomeSelectionSources) &&
    Array.isArray(design.projectPathways) &&
    design.projectPathways.every(isProjectPathway) &&
    Array.isArray(design.outcomePathwayLinks) &&
    design.outcomePathwayLinks.every(
      (link) =>
        isRecord(link) &&
        isString(link.finalOutcomeId) &&
        isString(link.pathwayId) &&
        (link.relationshipType === 'primary' ||
          link.relationshipType === 'related'),
    ) &&
    (design.customInnovation === null ||
      isCustomInnovation(design.customInnovation))
  )
}

export function parsePersistedProjectDocument(
  raw: unknown,
): PersistedProjectDesignV1 {
  if (!isRecord(raw) || typeof raw.schemaVersion !== 'number') {
    throw new ProjectPersistenceError('malformed-data')
  }
  if (raw.schemaVersion !== PROJECT_PERSISTENCE_SCHEMA_VERSION) {
    throw new ProjectPersistenceError('unsupported-schema')
  }
  if (!isPersistedProjectDesignV1(raw)) {
    throw new ProjectPersistenceError('malformed-data')
  }
  return raw
}

function serializeIndicator(
  indicator: PersistedStandardIndicatorSelectionV1,
): PersistedStandardIndicatorSelectionV1 {
  return {
    frameworkIndicatorId: indicator.frameworkIndicatorId,
    role: indicator.role,
    mandatory: indicator.mandatory,
  }
}

function serializeProjectIndicator(
  indicator: PersistedProjectSpecificIndicatorV1,
): PersistedProjectSpecificIndicatorV1 {
  return {
    id: indicator.id,
    wording: indicator.wording,
    measurementNotes: indicator.measurementNotes,
  }
}

function serializeProjectActivity(
  activity: PersistedProjectSpecificActivityV1,
): PersistedProjectSpecificActivityV1 {
  return {
    id: activity.id,
    wording: activity.wording,
    projectDetails: activity.projectDetails,
  }
}

function serializeInput(
  input: PersistedProjectInputV1,
): PersistedProjectInputV1 {
  return {
    id: input.id,
    inputCategoryId: input.inputCategoryId,
    details: input.details,
  }
}

function serializeCustomInnovation(
  custom: CustomInnovationOutcome,
): PersistedCustomInnovationV1 {
  return {
    id: custom.id,
    isCustom: true,
    shortLabel: custom.shortLabel,
    statement: custom.statement,
    rationale: custom.rationale,
    impactAreaIds: [...custom.impactAreaIds],
    primaryIndicator: {
      id: custom.primaryIndicator.id,
      wording: custom.primaryIndicator.wording,
      measurementNotes: custom.primaryIndicator.measurementNotes,
    },
    pathway: {
      id: custom.pathway.id,
      isCustom: true,
      name: custom.pathway.name,
      description: custom.pathway.description,
      rationale: custom.pathway.rationale,
      intermediateOutcomes: custom.pathway.intermediateOutcomes.map(
        (outcome) => ({
          id: outcome.id,
          isCustom: true,
          stepNumber: outcome.stepNumber,
          statement: outcome.statement,
          primaryIndicator: {
            id: outcome.primaryIndicator.id,
            wording: outcome.primaryIndicator.wording,
            measurementNotes: outcome.primaryIndicator.measurementNotes,
          },
          additionalIndicators: outcome.additionalIndicators.map(
            serializeProjectIndicator,
          ),
          activities: outcome.activities.map(serializeProjectActivity),
          inputs: outcome.inputs.map(serializeInput),
        }),
      ),
    },
  }
}

export function serializeProject({
  id,
  projectCode,
  status,
  design,
  framework,
}: SerializeProjectInput): PersistedProjectDesignV1 {
  return {
    schemaVersion: PROJECT_PERSISTENCE_SCHEMA_VERSION,
    frameworkVersion: framework.frameworkVersion,
    frameworkSchemaVersion: framework.schemaVersion,
    project: {
      id,
      name: design.metadata.title,
      ...(design.metadata.country ? { country: design.metadata.country } : {}),
      ...(projectCode ? { projectCode } : {}),
      status,
    },
    design: {
      metadata: {
        donor: design.metadata.donor,
        fundingReference: design.metadata.fundingReference,
        projectManager: design.metadata.projectManager,
        plannedStartDate: design.metadata.plannedStartDate,
        plannedEndDate: design.metadata.plannedEndDate,
        description: design.metadata.description,
      },
      selectedFinalOutcomeIds: [...design.selectedFinalOutcomeIds],
      finalOutcomeSelectionSources: {
        ...design.finalOutcomeSelectionSources,
      },
      projectPathways: design.projectPathways.map((pathway) => ({
        pathwayId: pathway.pathwayId,
        intermediateOutcomeConfigurations:
          pathway.intermediateOutcomeConfigurations.map((configuration) => ({
            frameworkIntermediateOutcomeId:
              configuration.frameworkIntermediateOutcomeId,
            primaryIndicator: configuration.primaryIndicator
              ? serializeIndicator(configuration.primaryIndicator)
              : null,
            additionalIndicators:
              configuration.additionalIndicators.map(serializeIndicator),
            projectSpecificIndicators:
              configuration.projectSpecificIndicators.map(
                serializeProjectIndicator,
              ),
            standardActivities: configuration.standardActivities.map(
              (activity) => ({
                frameworkActivityId: activity.frameworkActivityId,
                projectNotes: activity.projectNotes,
              }),
            ),
            projectSpecificActivities:
              configuration.projectSpecificActivities.map(
                serializeProjectActivity,
              ),
            inputs: configuration.inputs.map(serializeInput),
            reviewed: configuration.reviewed,
          })),
      })),
      outcomePathwayLinks: design.outcomePathwayLinks.map((link) => ({
        finalOutcomeId: link.finalOutcomeId,
        pathwayId: link.pathwayId,
        relationshipType: link.relationshipType,
      })),
      customInnovation: design.customInnovation
        ? serializeCustomInnovation(design.customInnovation)
        : null,
    },
  }
}

function assertFrameworkReferences(
  document: PersistedProjectDesignV1,
  framework: FrameworkData,
) {
  const finalOutcomeIds = new Set(
    framework.finalOutcomes
      .filter((outcome) => outcome.active)
      .map((outcome) => outcome.id),
  )
  const pathwayIds = new Set(
    framework.pathways
      .filter((pathway) => pathway.active)
      .map((pathway) => pathway.id),
  )
  const intermediateOutcomes = new Map(
    framework.intermediateOutcomes
      .filter((outcome) => outcome.active)
      .map((outcome) => [outcome.id, outcome]),
  )
  const indicatorIds = new Set(
    framework.indicators
      .filter((indicator) => indicator.active)
      .map((indicator) => indicator.id),
  )
  const activityIds = new Set(
    framework.suggestedActivities
      .filter((activity) => activity.active)
      .map((activity) => activity.id),
  )
  const inputCategoryIds = new Set([
    ...framework.inputCategories.map((category) => category.id),
    ...inputCategories.map((category) => category.id),
  ])
  const selectedIds = new Set(document.design.selectedFinalOutcomeIds)
  const invalid =
    [...selectedIds].some((id) => !finalOutcomeIds.has(id)) ||
    Object.keys(document.design.finalOutcomeSelectionSources).some(
      (id) => !selectedIds.has(id),
    ) ||
    document.design.projectPathways.some(
      (pathway) =>
        !pathwayIds.has(pathway.pathwayId) ||
        pathway.intermediateOutcomeConfigurations.some((configuration) => {
          const outcome = intermediateOutcomes.get(
            configuration.frameworkIntermediateOutcomeId,
          )
          const indicators = [
            ...(configuration.primaryIndicator
              ? [configuration.primaryIndicator]
              : []),
            ...configuration.additionalIndicators,
          ]
          return (
            !outcome ||
            outcome.pathwayId !== pathway.pathwayId ||
            indicators.some(
              (indicator) => !indicatorIds.has(indicator.frameworkIndicatorId),
            ) ||
            configuration.standardActivities.some(
              (activity) => !activityIds.has(activity.frameworkActivityId),
            ) ||
            configuration.inputs.some(
              (input) => !inputCategoryIds.has(input.inputCategoryId),
            )
          )
        }),
    ) ||
    document.design.outcomePathwayLinks.some(
      (link) =>
        !selectedIds.has(link.finalOutcomeId) ||
        !pathwayIds.has(link.pathwayId),
    ) ||
    Boolean(
      document.design.customInnovation?.impactAreaIds.some(
        (id) =>
          !framework.impacts.some(
            (impact) => impact.active && impact.id === id,
          ),
      ),
    )

  if (invalid) throw new ProjectPersistenceError('malformed-data')
}

export function loadPersistedProject(
  raw: unknown,
  framework: FrameworkData,
): LoadedPersistedProject {
  const document = parsePersistedProjectDocument(raw)
  if (
    document.frameworkVersion !== framework.frameworkVersion ||
    document.frameworkSchemaVersion !== framework.schemaVersion
  ) {
    throw new ProjectPersistenceError('framework-incompatible')
  }
  assertFrameworkReferences(document, framework)

  return {
    document,
    design: {
      metadata: {
        title: document.project.name,
        country: document.project.country ?? '',
        donor: document.design.metadata.donor,
        fundingReference: document.design.metadata.fundingReference,
        projectManager: document.design.metadata.projectManager,
        plannedStartDate: document.design.metadata.plannedStartDate,
        plannedEndDate: document.design.metadata.plannedEndDate,
        description: document.design.metadata.description,
      },
      selectedFinalOutcomeIds: [...document.design.selectedFinalOutcomeIds],
      finalOutcomeSelectionSources: {
        ...document.design.finalOutcomeSelectionSources,
      },
      projectPathways: document.design.projectPathways.map((pathway) => ({
        pathwayId: pathway.pathwayId,
        intermediateOutcomeConfigurations:
          pathway.intermediateOutcomeConfigurations.map((configuration) => ({
            projectPathwayId: pathway.pathwayId,
            frameworkIntermediateOutcomeId:
              configuration.frameworkIntermediateOutcomeId,
            primaryIndicator: configuration.primaryIndicator
              ? { ...configuration.primaryIndicator }
              : null,
            additionalIndicators: configuration.additionalIndicators.map(
              (indicator) => ({ ...indicator }),
            ),
            projectSpecificIndicators:
              configuration.projectSpecificIndicators.map((indicator) => ({
                ...indicator,
              })),
            standardActivities: configuration.standardActivities.map(
              (activity) => ({ ...activity }),
            ),
            projectSpecificActivities:
              configuration.projectSpecificActivities.map((activity) => ({
                ...activity,
              })),
            inputs: configuration.inputs.map((input) => ({ ...input })),
            reviewed: configuration.reviewed,
          })),
      })),
      outcomePathwayLinks: document.design.outcomePathwayLinks.map((link) => ({
        ...link,
      })),
      customInnovation: document.design.customInnovation
        ? ({
            ...document.design.customInnovation,
            impactAreaIds: [...document.design.customInnovation.impactAreaIds],
            primaryIndicator: {
              ...document.design.customInnovation.primaryIndicator,
            },
            pathway: {
              ...document.design.customInnovation.pathway,
              intermediateOutcomes:
                document.design.customInnovation.pathway.intermediateOutcomes.map(
                  (outcome) => ({
                    ...outcome,
                    primaryIndicator: { ...outcome.primaryIndicator },
                    additionalIndicators: outcome.additionalIndicators.map(
                      (indicator) => ({ ...indicator }),
                    ),
                    activities: outcome.activities.map((activity) => ({
                      ...activity,
                    })),
                    inputs: outcome.inputs.map((input) => ({ ...input })),
                  }),
                ),
            },
          } satisfies CustomInnovationOutcome)
        : null,
      lastSavedAt: null,
    },
  }
}
