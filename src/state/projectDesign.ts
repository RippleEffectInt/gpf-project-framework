import type {
  ActivityOutputPlanning,
  ConfigurationStatus,
  FinalOutcomeSelectionSource,
  PathwayIntermediateOutcomeSeed,
  ProjectDesignState,
  ProjectInput,
  ProjectIntermediateOutcomeConfiguration,
  ProjectMetadata,
  ProjectPathway,
  ProjectSpecificActivity,
  ProjectSpecificIndicator,
} from '../types/project'
import type { PathwayRelationshipType } from '../types/project'
import {
  applyCustomInnovationAction,
  type CustomInnovationAction,
} from './customInnovation'
import {
  createStandardActivitySelection,
  emptyActivityOutputPlanning,
  recountSelfHelpGroupOutputs,
} from './activityOutputs'

export const emptyProjectMetadata: ProjectMetadata = {
  title: '',
  country: '',
  donor: '',
  fundingReference: '',
  projectManager: '',
  plannedStartDate: '',
  plannedEndDate: '',
  description: '',
  plannedSelfHelpGroupCount: null,
}

export const initialProjectDesignState: ProjectDesignState = {
  metadata: emptyProjectMetadata,
  selectedFinalOutcomeIds: [],
  finalOutcomeSelectionSources: {},
  projectPathways: [],
  outcomePathwayLinks: [],
  customInnovation: null,
  lastSavedAt: null,
}

export type ProjectDesignAction =
  | { type: 'updateMetadata'; payload: Partial<ProjectMetadata> }
  | { type: 'setAllActivityOutputsToProjectSelfHelpGroups' }
  | { type: 'selectFinalOutcome'; finalOutcomeId: string }
  | {
      type: 'addPathway'
      finalOutcomeId: string
      pathwayId: string
      relationshipType: PathwayRelationshipType
      frameworkPrimaryFinalOutcomeId: string
      intermediateOutcomes: PathwayIntermediateOutcomeSeed[]
    }
  | {
      type: 'removeOutcomePathwayLink'
      finalOutcomeId: string
      pathwayId: string
    }
  | { type: 'removeFinalOutcome'; finalOutcomeId: string }
  | {
      type: 'setAdditionalIndicator'
      pathwayId: string
      intermediateOutcomeId: string
      frameworkIndicatorId: string
      selected: boolean
    }
  | {
      type: 'addProjectSpecificIndicator'
      pathwayId: string
      intermediateOutcomeId: string
      indicator: ProjectSpecificIndicator
    }
  | {
      type: 'updateProjectSpecificIndicator'
      pathwayId: string
      intermediateOutcomeId: string
      indicator: ProjectSpecificIndicator
    }
  | {
      type: 'deleteProjectSpecificIndicator'
      pathwayId: string
      intermediateOutcomeId: string
      indicatorId: string
    }
  | {
      type: 'setStandardActivity'
      pathwayId: string
      intermediateOutcomeId: string
      frameworkActivityId: string
      selected: boolean
      output?: ActivityOutputPlanning
    }
  | {
      type: 'setSuggestedActivities'
      pathwayId: string
      intermediateOutcomeId: string
      frameworkActivityIds: string[]
      selected: boolean
      outputsByActivityId?: Record<string, ActivityOutputPlanning>
    }
  | {
      type: 'updateStandardActivityNotes'
      pathwayId: string
      intermediateOutcomeId: string
      frameworkActivityId: string
      projectNotes: string
    }
  | {
      type: 'updateStandardActivityOutput'
      pathwayId: string
      intermediateOutcomeId: string
      frameworkActivityId: string
      output: ActivityOutputPlanning
    }
  | {
      type: 'addProjectSpecificActivity'
      pathwayId: string
      intermediateOutcomeId: string
      activity: ProjectSpecificActivity
    }
  | {
      type: 'updateProjectSpecificActivity'
      pathwayId: string
      intermediateOutcomeId: string
      activity: ProjectSpecificActivity
    }
  | {
      type: 'deleteProjectSpecificActivity'
      pathwayId: string
      intermediateOutcomeId: string
      activityId: string
    }
  | {
      type: 'addInput'
      pathwayId: string
      intermediateOutcomeId: string
      input: ProjectInput
    }
  | {
      type: 'updateInput'
      pathwayId: string
      intermediateOutcomeId: string
      input: ProjectInput
    }
  | {
      type: 'deleteInput'
      pathwayId: string
      intermediateOutcomeId: string
      inputId: string
    }
  | {
      type: 'setIntermediateOutcomeReviewed'
      pathwayId: string
      intermediateOutcomeId: string
      reviewed: boolean
    }
  | { type: 'markPathwayConfigured'; pathwayId: string }
  | { type: 'saveDraft'; savedAt: string }
  | { type: 'replaceState'; state: ProjectDesignState }
  | { type: 'reset' }
  | CustomInnovationAction

function createIntermediateOutcomeConfiguration(
  projectPathwayId: string,
  seed: PathwayIntermediateOutcomeSeed,
): ProjectIntermediateOutcomeConfiguration {
  return {
    projectPathwayId,
    frameworkIntermediateOutcomeId: seed.frameworkIntermediateOutcomeId,
    primaryIndicator: seed.primaryIndicatorId
      ? {
          frameworkIndicatorId: seed.primaryIndicatorId,
          role: 'primary',
          mandatory: true,
        }
      : null,
    additionalIndicators: [],
    projectSpecificIndicators: [],
    standardActivities: [],
    projectSpecificActivities: [],
    inputs: [],
    reviewed: false,
  }
}

export function getFinalOutcomeSelectionSource(
  state: ProjectDesignState,
  finalOutcomeId: string,
): FinalOutcomeSelectionSource {
  return state.finalOutcomeSelectionSources?.[finalOutcomeId] ?? 'direct'
}

function linkKey(link: { finalOutcomeId: string; pathwayId: string }): string {
  return `${link.finalOutcomeId}::${link.pathwayId}`
}

function removeLinksWithDependencyCleanup(
  state: ProjectDesignState,
  shouldRemove: (
    link: ProjectDesignState['outcomePathwayLinks'][number],
  ) => boolean,
  forcedOutcomeIds: string[] = [],
): ProjectDesignState {
  const originalLinks = state.outcomePathwayLinks
  let remainingLinks = originalLinks.filter((link) => !shouldRemove(link))
  let changed = true

  while (changed) {
    changed = false
    const remainingKeys = new Set(remainingLinks.map(linkKey))
    const removedLinks = originalLinks.filter(
      (link) => !remainingKeys.has(linkKey(link)),
    )

    const removedPrimaryPathwayIds = new Set(
      removedLinks
        .filter((link) => link.relationshipType === 'primary')
        .map((link) => link.pathwayId),
    )
    const withoutDependentRelatedLinks = remainingLinks.filter(
      (link) =>
        !(
          link.relationshipType === 'related' &&
          removedPrimaryPathwayIds.has(link.pathwayId)
        ),
    )
    if (withoutDependentRelatedLinks.length !== remainingLinks.length) {
      remainingLinks = withoutDependentRelatedLinks
      changed = true
      continue
    }

    const removedRelatedPathwayIds = new Set(
      removedLinks
        .filter((link) => link.relationshipType === 'related')
        .map((link) => link.pathwayId),
    )
    const withoutOrphanedAutoPrimaryLinks = remainingLinks.filter((link) => {
      if (
        link.relationshipType !== 'primary' ||
        !removedRelatedPathwayIds.has(link.pathwayId) ||
        getFinalOutcomeSelectionSource(state, link.finalOutcomeId) !==
          'related-pathway'
      ) {
        return true
      }
      return remainingLinks.some(
        (candidate) =>
          candidate.pathwayId === link.pathwayId &&
          candidate.relationshipType === 'related',
      )
    })
    if (withoutOrphanedAutoPrimaryLinks.length !== remainingLinks.length) {
      remainingLinks = withoutOrphanedAutoPrimaryLinks
      changed = true
    }
  }

  const forcedOutcomeSet = new Set(forcedOutcomeIds)
  const selectedFinalOutcomeIds = state.selectedFinalOutcomeIds.filter(
    (finalOutcomeId) =>
      !forcedOutcomeSet.has(finalOutcomeId) &&
      (getFinalOutcomeSelectionSource(state, finalOutcomeId) === 'direct' ||
        remainingLinks.some((link) => link.finalOutcomeId === finalOutcomeId)),
  )
  const selectedOutcomeSet = new Set(selectedFinalOutcomeIds)
  const finalOutcomeSelectionSources = Object.fromEntries(
    Object.entries(state.finalOutcomeSelectionSources ?? {}).filter(([id]) =>
      selectedOutcomeSet.has(id),
    ),
  )
  const remainingPathwayIds = new Set(
    remainingLinks.map((link) => link.pathwayId),
  )

  return {
    ...state,
    selectedFinalOutcomeIds,
    finalOutcomeSelectionSources,
    outcomePathwayLinks: remainingLinks,
    projectPathways: state.projectPathways.filter(({ pathwayId }) =>
      remainingPathwayIds.has(pathwayId),
    ),
  }
}

function updateIntermediateOutcomeConfiguration(
  state: ProjectDesignState,
  pathwayId: string,
  intermediateOutcomeId: string,
  update: (
    configuration: ProjectIntermediateOutcomeConfiguration,
  ) => ProjectIntermediateOutcomeConfiguration,
): ProjectDesignState {
  return {
    ...state,
    projectPathways: state.projectPathways.map((pathway) =>
      pathway.pathwayId !== pathwayId
        ? pathway
        : {
            ...pathway,
            intermediateOutcomeConfigurations:
              pathway.intermediateOutcomeConfigurations.map((configuration) =>
                configuration.frameworkIntermediateOutcomeId !==
                intermediateOutcomeId
                  ? configuration
                  : update(configuration),
              ),
          },
    ),
  }
}

function hasOptionalConfiguration(
  configuration: ProjectIntermediateOutcomeConfiguration,
): boolean {
  return (
    configuration.additionalIndicators.length > 0 ||
    configuration.projectSpecificIndicators.length > 0 ||
    configuration.standardActivities.length > 0 ||
    configuration.projectSpecificActivities.length > 0 ||
    configuration.inputs.length > 0
  )
}

export function intermediateOutcomeHasRequiredActivity(
  configuration: ProjectIntermediateOutcomeConfiguration,
): boolean {
  return (
    configuration.standardActivities.length > 0 ||
    configuration.projectSpecificActivities.length > 0
  )
}

export function pathwayHasRequiredActivities(pathway: ProjectPathway): boolean {
  return (
    pathway.intermediateOutcomeConfigurations.length > 0 &&
    pathway.intermediateOutcomeConfigurations.every(
      intermediateOutcomeHasRequiredActivity,
    )
  )
}

export function getMissingActivityCompletionMessages(
  pathway: ProjectPathway,
): string[] {
  return pathway.intermediateOutcomeConfigurations.flatMap(
    (configuration, index) =>
      intermediateOutcomeHasRequiredActivity(configuration)
        ? []
        : [
            `Add an activity for Intermediate Outcome ${index + 1} before completing this pathway.`,
          ],
  )
}

export function getPathwayConfigurationStatus(
  pathway: ProjectPathway,
): ConfigurationStatus {
  const configurations = pathway.intermediateOutcomeConfigurations
  const technicallyValid = configurations.every(
    (configuration) =>
      configuration.primaryIndicator?.mandatory === true &&
      configuration.primaryIndicator.role === 'primary',
  )
  if (
    configurations.length > 0 &&
    technicallyValid &&
    configurations.every((configuration) => configuration.reviewed) &&
    pathwayHasRequiredActivities(pathway)
  ) {
    return 'configured'
  }
  if (
    configurations.some(
      (configuration) =>
        configuration.reviewed ||
        hasOptionalConfiguration(configuration) ||
        intermediateOutcomeHasRequiredActivity(configuration),
    )
  ) {
    return 'in-progress'
  }
  return 'not-started'
}

export function getSelectedPrimaryPathwayCount(
  state: ProjectDesignState,
  finalOutcomeId: string,
): number {
  return state.outcomePathwayLinks.filter(
    (link) =>
      link.finalOutcomeId === finalOutcomeId &&
      link.relationshipType === 'primary',
  ).length
}

export function hasRequiredPrimaryPathways(state: ProjectDesignState): boolean {
  return state.selectedFinalOutcomeIds.every(
    (finalOutcomeId) =>
      getSelectedPrimaryPathwayCount(state, finalOutcomeId) > 0,
  )
}

function selectedActivities(state: ProjectDesignState) {
  return [
    ...state.projectPathways.flatMap((pathway) =>
      pathway.intermediateOutcomeConfigurations.flatMap(
        (configuration) => [
          ...configuration.standardActivities,
          ...configuration.projectSpecificActivities,
        ],
      ),
    ),
    ...(state.customInnovation?.pathway.intermediateOutcomes.flatMap(
      (outcome) => outcome.activities,
    ) ?? []),
  ]
}

export function getSelectedActivityCount(
  state: ProjectDesignState,
): number {
  return selectedActivities(state).length
}

export function hasConfiguredActivityQuantityOrUnit(
  state: ProjectDesignState,
): boolean {
  return selectedActivities(state).some(
    (activity) =>
      activity.plannedQuantity != null ||
      activity.outputUnitSelection != null ||
      Boolean(activity.customOutputUnit?.trim()) ||
      activity.useProjectSelfHelpGroupTotal === true,
  )
}

export function projectDesignReducer(
  state: ProjectDesignState,
  action: ProjectDesignAction,
): ProjectDesignState {
  switch (action.type) {
    case 'updateMetadata': {
      const metadata = { ...state.metadata, ...action.payload }
      const selfHelpGroupCountChanged =
        metadata.plannedSelfHelpGroupCount !==
        state.metadata.plannedSelfHelpGroupCount
      if (!selfHelpGroupCountChanged) {
        return { ...state, metadata }
      }
      return {
        ...state,
        metadata,
        projectPathways: state.projectPathways.map((pathway) => ({
          ...pathway,
          intermediateOutcomeConfigurations:
            pathway.intermediateOutcomeConfigurations.map((configuration) => ({
              ...configuration,
              standardActivities: recountSelfHelpGroupOutputs(
                configuration.standardActivities,
                metadata.plannedSelfHelpGroupCount,
              ),
              projectSpecificActivities: recountSelfHelpGroupOutputs(
                configuration.projectSpecificActivities,
                metadata.plannedSelfHelpGroupCount,
              ),
            })),
        })),
        customInnovation: state.customInnovation
          ? {
              ...state.customInnovation,
              pathway: {
                ...state.customInnovation.pathway,
                intermediateOutcomes:
                  state.customInnovation.pathway.intermediateOutcomes.map(
                    (outcome) => ({
                      ...outcome,
                      activities: recountSelfHelpGroupOutputs(
                        outcome.activities,
                        metadata.plannedSelfHelpGroupCount,
                      ),
                    }),
                  ),
              },
            }
          : null,
      }
    }

    case 'setAllActivityOutputsToProjectSelfHelpGroups': {
      const total = state.metadata.plannedSelfHelpGroupCount
      if (!Number.isInteger(total) || total === null || total < 1) {
        return state
      }
      const applyTotal = <
        T extends
          | ProjectSpecificActivity
          | { frameworkActivityId: string; projectNotes: string },
      >(
        activity: T,
      ): T => ({
        ...activity,
        plannedQuantity: total,
        outputUnitSelection: 'self-help-groups',
        customOutputUnit: null,
        useProjectSelfHelpGroupTotal: true,
      })
      return {
        ...state,
        projectPathways: state.projectPathways.map((pathway) => ({
          ...pathway,
          intermediateOutcomeConfigurations:
            pathway.intermediateOutcomeConfigurations.map(
              (configuration) => ({
                ...configuration,
                standardActivities:
                  configuration.standardActivities.map(applyTotal),
                projectSpecificActivities:
                  configuration.projectSpecificActivities.map(applyTotal),
              }),
            ),
        })),
        customInnovation: state.customInnovation
          ? {
              ...state.customInnovation,
              pathway: {
                ...state.customInnovation.pathway,
                intermediateOutcomes:
                  state.customInnovation.pathway.intermediateOutcomes.map(
                    (outcome) => ({
                      ...outcome,
                      activities: outcome.activities.map(applyTotal),
                    }),
                  ),
              },
            }
          : null,
      }
    }

    case 'selectFinalOutcome':
      return {
        ...state,
        selectedFinalOutcomeIds: state.selectedFinalOutcomeIds.includes(
          action.finalOutcomeId,
        )
          ? state.selectedFinalOutcomeIds
          : [...state.selectedFinalOutcomeIds, action.finalOutcomeId],
        finalOutcomeSelectionSources: {
          ...(state.finalOutcomeSelectionSources ?? {}),
          [action.finalOutcomeId]: 'direct',
        },
      }

    case 'addPathway': {
      const pathwayExists = state.projectPathways.some(
        ({ pathwayId }) => pathwayId === action.pathwayId,
      )
      const addsPrimaryOutcome =
        action.relationshipType === 'related' &&
        action.frameworkPrimaryFinalOutcomeId !== action.finalOutcomeId
      const selectedFinalOutcomeIds = [...state.selectedFinalOutcomeIds]
      const finalOutcomeSelectionSources = {
        ...(state.finalOutcomeSelectionSources ?? {}),
      }
      if (!selectedFinalOutcomeIds.includes(action.finalOutcomeId)) {
        selectedFinalOutcomeIds.push(action.finalOutcomeId)
        finalOutcomeSelectionSources[action.finalOutcomeId] = 'direct'
      } else if (!finalOutcomeSelectionSources[action.finalOutcomeId]) {
        finalOutcomeSelectionSources[action.finalOutcomeId] = 'direct'
      }
      if (action.relationshipType === 'primary') {
        finalOutcomeSelectionSources[action.finalOutcomeId] = 'direct'
      }
      if (
        addsPrimaryOutcome &&
        !selectedFinalOutcomeIds.includes(action.frameworkPrimaryFinalOutcomeId)
      ) {
        selectedFinalOutcomeIds.push(action.frameworkPrimaryFinalOutcomeId)
        finalOutcomeSelectionSources[action.frameworkPrimaryFinalOutcomeId] =
          'related-pathway'
      } else if (
        addsPrimaryOutcome &&
        !finalOutcomeSelectionSources[action.frameworkPrimaryFinalOutcomeId]
      ) {
        finalOutcomeSelectionSources[action.frameworkPrimaryFinalOutcomeId] =
          'direct'
      }
      const candidateLinks = [
        {
          finalOutcomeId: action.finalOutcomeId,
          pathwayId: action.pathwayId,
          relationshipType: action.relationshipType,
        },
        ...(addsPrimaryOutcome
          ? [
              {
                finalOutcomeId: action.frameworkPrimaryFinalOutcomeId,
                pathwayId: action.pathwayId,
                relationshipType: 'primary' as const,
              },
            ]
          : []),
      ]
      const outcomePathwayLinks = [...state.outcomePathwayLinks]
      candidateLinks.forEach((candidate) => {
        if (
          !outcomePathwayLinks.some(
            (link) =>
              link.pathwayId === candidate.pathwayId &&
              link.finalOutcomeId === candidate.finalOutcomeId,
          )
        ) {
          outcomePathwayLinks.push(candidate)
        }
      })
      return {
        ...state,
        selectedFinalOutcomeIds,
        finalOutcomeSelectionSources,
        projectPathways: pathwayExists
          ? state.projectPathways
          : [
              ...state.projectPathways,
              {
                pathwayId: action.pathwayId,
                intermediateOutcomeConfigurations:
                  action.intermediateOutcomes.map((seed) =>
                    createIntermediateOutcomeConfiguration(
                      action.pathwayId,
                      seed,
                    ),
                  ),
              },
            ],
        outcomePathwayLinks,
      }
    }

    case 'removeOutcomePathwayLink':
      return removeLinksWithDependencyCleanup(
        state,
        (link) =>
          link.finalOutcomeId === action.finalOutcomeId &&
          link.pathwayId === action.pathwayId,
      )

    case 'removeFinalOutcome':
      return removeLinksWithDependencyCleanup(
        state,
        (link) => link.finalOutcomeId === action.finalOutcomeId,
        [action.finalOutcomeId],
      )

    case 'setAdditionalIndicator':
      return updateIntermediateOutcomeConfiguration(
        state,
        action.pathwayId,
        action.intermediateOutcomeId,
        (configuration) => {
          const exists = configuration.additionalIndicators.some(
            (indicator) =>
              indicator.frameworkIndicatorId === action.frameworkIndicatorId,
          )
          return {
            ...configuration,
            additionalIndicators: action.selected
              ? exists
                ? configuration.additionalIndicators
                : [
                    ...configuration.additionalIndicators,
                    {
                      frameworkIndicatorId: action.frameworkIndicatorId,
                      role: 'additional',
                      mandatory: false,
                    },
                  ]
              : configuration.additionalIndicators.filter(
                  (indicator) =>
                    indicator.frameworkIndicatorId !==
                    action.frameworkIndicatorId,
                ),
          }
        },
      )

    case 'addProjectSpecificIndicator':
      return updateIntermediateOutcomeConfiguration(
        state,
        action.pathwayId,
        action.intermediateOutcomeId,
        (configuration) => ({
          ...configuration,
          projectSpecificIndicators: [
            ...configuration.projectSpecificIndicators,
            action.indicator,
          ],
        }),
      )

    case 'updateProjectSpecificIndicator':
      return updateIntermediateOutcomeConfiguration(
        state,
        action.pathwayId,
        action.intermediateOutcomeId,
        (configuration) => ({
          ...configuration,
          projectSpecificIndicators:
            configuration.projectSpecificIndicators.map((indicator) =>
              indicator.id === action.indicator.id
                ? action.indicator
                : indicator,
            ),
        }),
      )

    case 'deleteProjectSpecificIndicator':
      return updateIntermediateOutcomeConfiguration(
        state,
        action.pathwayId,
        action.intermediateOutcomeId,
        (configuration) => ({
          ...configuration,
          projectSpecificIndicators:
            configuration.projectSpecificIndicators.filter(
              (indicator) => indicator.id !== action.indicatorId,
            ),
        }),
      )

    case 'setStandardActivity':
      return updateIntermediateOutcomeConfiguration(
        state,
        action.pathwayId,
        action.intermediateOutcomeId,
        (configuration) => {
          const existing = configuration.standardActivities.find(
            (activity) =>
              activity.frameworkActivityId === action.frameworkActivityId,
          )
          const newSelection = createStandardActivitySelection(
            action.frameworkActivityId,
            action.output ?? emptyActivityOutputPlanning,
          )
          return {
            ...configuration,
            standardActivities: action.selected
              ? existing
                ? configuration.standardActivities
                : [...configuration.standardActivities, newSelection]
              : configuration.standardActivities.filter(
                  (activity) =>
                    activity.frameworkActivityId !== action.frameworkActivityId,
                ),
          }
        },
      )

    case 'setSuggestedActivities':
      return updateIntermediateOutcomeConfiguration(
        state,
        action.pathwayId,
        action.intermediateOutcomeId,
        (configuration) => {
          const suggestedIds = new Set(action.frameworkActivityIds)
          if (!action.selected) {
            return {
              ...configuration,
              standardActivities: configuration.standardActivities.filter(
                (activity) => !suggestedIds.has(activity.frameworkActivityId),
              ),
            }
          }
          const existingById = new Map(
            configuration.standardActivities.map((activity) => [
              activity.frameworkActivityId,
              activity,
            ]),
          )
          return {
            ...configuration,
            standardActivities: [
              ...configuration.standardActivities.filter(
                (activity) => !suggestedIds.has(activity.frameworkActivityId),
              ),
              ...action.frameworkActivityIds.map((frameworkActivityId) => {
                const existing = existingById.get(frameworkActivityId)
                if (existing) return existing
                return createStandardActivitySelection(
                  frameworkActivityId,
                  action.outputsByActivityId?.[frameworkActivityId] ??
                    emptyActivityOutputPlanning,
                )
              }),
            ],
          }
        },
      )

    case 'updateStandardActivityNotes':
      return updateIntermediateOutcomeConfiguration(
        state,
        action.pathwayId,
        action.intermediateOutcomeId,
        (configuration) => ({
          ...configuration,
          standardActivities: configuration.standardActivities.map(
            (activity) =>
              activity.frameworkActivityId === action.frameworkActivityId
                ? { ...activity, projectNotes: action.projectNotes }
                : activity,
          ),
        }),
      )

    case 'updateStandardActivityOutput':
      return updateIntermediateOutcomeConfiguration(
        state,
        action.pathwayId,
        action.intermediateOutcomeId,
        (configuration) => ({
          ...configuration,
          standardActivities: configuration.standardActivities.map(
            (activity) =>
              activity.frameworkActivityId === action.frameworkActivityId
                ? { ...activity, ...action.output }
                : activity,
          ),
        }),
      )

    case 'addProjectSpecificActivity':
      return updateIntermediateOutcomeConfiguration(
        state,
        action.pathwayId,
        action.intermediateOutcomeId,
        (configuration) => ({
          ...configuration,
          projectSpecificActivities: [
            ...configuration.projectSpecificActivities,
            { ...emptyActivityOutputPlanning, ...action.activity },
          ],
        }),
      )

    case 'updateProjectSpecificActivity':
      return updateIntermediateOutcomeConfiguration(
        state,
        action.pathwayId,
        action.intermediateOutcomeId,
        (configuration) => ({
          ...configuration,
          projectSpecificActivities:
            configuration.projectSpecificActivities.map((activity) =>
              activity.id === action.activity.id ? action.activity : activity,
            ),
        }),
      )

    case 'deleteProjectSpecificActivity':
      return updateIntermediateOutcomeConfiguration(
        state,
        action.pathwayId,
        action.intermediateOutcomeId,
        (configuration) => ({
          ...configuration,
          projectSpecificActivities:
            configuration.projectSpecificActivities.filter(
              (activity) => activity.id !== action.activityId,
            ),
        }),
      )

    case 'addInput':
      return updateIntermediateOutcomeConfiguration(
        state,
        action.pathwayId,
        action.intermediateOutcomeId,
        (configuration) => ({
          ...configuration,
          inputs: [...configuration.inputs, action.input],
        }),
      )

    case 'updateInput':
      return updateIntermediateOutcomeConfiguration(
        state,
        action.pathwayId,
        action.intermediateOutcomeId,
        (configuration) => ({
          ...configuration,
          inputs: configuration.inputs.map((input) =>
            input.id === action.input.id ? action.input : input,
          ),
        }),
      )

    case 'deleteInput':
      return updateIntermediateOutcomeConfiguration(
        state,
        action.pathwayId,
        action.intermediateOutcomeId,
        (configuration) => ({
          ...configuration,
          inputs: configuration.inputs.filter(
            (input) => input.id !== action.inputId,
          ),
        }),
      )

    case 'setIntermediateOutcomeReviewed':
      return updateIntermediateOutcomeConfiguration(
        state,
        action.pathwayId,
        action.intermediateOutcomeId,
        (configuration) => ({
          ...configuration,
          reviewed: action.reviewed
            ? intermediateOutcomeHasRequiredActivity(configuration)
            : false,
        }),
      )

    case 'markPathwayConfigured': {
      const target = state.projectPathways.find(
        (pathway) => pathway.pathwayId === action.pathwayId,
      )
      if (!target || !pathwayHasRequiredActivities(target)) {
        return state
      }
      return {
        ...state,
        projectPathways: state.projectPathways.map((pathway) =>
          pathway.pathwayId !== action.pathwayId
            ? pathway
            : {
                ...pathway,
                intermediateOutcomeConfigurations:
                  pathway.intermediateOutcomeConfigurations.map(
                    (configuration) => ({
                      ...configuration,
                      reviewed: configuration.primaryIndicator !== null,
                    }),
                  ),
              },
        ),
      }
    }

    case 'saveDraft':
      return { ...state, lastSavedAt: action.savedAt }

    case 'replaceState':
      return action.state

    case 'reset':
      return initialProjectDesignState

    case 'addCustomInnovation':
    case 'updateCustomInnovationFields':
    case 'setCustomImpactAreaIds':
    case 'setCustomOutcomePrimaryIndicator':
    case 'updateCustomPathway':
    case 'addCustomIntermediateOutcome':
    case 'updateCustomIntermediateOutcome':
    case 'setCustomIoPrimaryIndicator':
    case 'deleteCustomIntermediateOutcome':
    case 'moveCustomIntermediateOutcome':
    case 'addCustomIoAdditionalIndicator':
    case 'updateCustomIoAdditionalIndicator':
    case 'deleteCustomIoAdditionalIndicator':
    case 'addCustomIoActivity':
    case 'updateCustomIoActivity':
    case 'deleteCustomIoActivity':
    case 'addCustomIoInput':
    case 'updateCustomIoInput':
    case 'deleteCustomIoInput':
    case 'removeCustomInnovation':
      return applyCustomInnovationAction(state, action)

    default:
      return state
  }
}
