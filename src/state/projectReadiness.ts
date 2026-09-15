import {
  getFinalOutcome,
  getImpactAreas,
  getImpactAreasForFinalOutcome,
  getPathway,
  getPrimaryIndicatorForFinalOutcome,
  getPrimaryIndicatorForIntermediateOutcome,
} from '../services/frameworkService'
import type { FrameworkData, ImpactArea } from '../types/framework'
import type { ProjectDesignState } from '../types/project'
import {
  getCustomInnovationValidation,
} from './customInnovation'
import {
  canContinueToReview,
  getIncompleteFinalOutcomeIds,
  getPathwayOverviewItems,
  getSelectedFinalOutcomeCount,
  hasAtLeastOneFinalOutcome,
} from './journeySelectors'
import { isProjectMetadataComplete } from './projectMetadata'

export interface ReadinessAction {
  label: string
  to: string
}

export interface ReadinessCheck {
  id: string
  label: string
  passed: boolean
  action?: ReadinessAction
}

export interface ProjectReadiness {
  ready: boolean
  checks: ReadinessCheck[]
}

export function getUniqueSelectedPathways(
  data: FrameworkData,
  state: ProjectDesignState,
) {
  return getPathwayOverviewItems(data, state)
}

export function getImpactsRepresentedByProject(
  data: FrameworkData,
  state: ProjectDesignState,
): ImpactArea[] {
  const representedIds = new Set<string>()
  state.selectedFinalOutcomeIds.forEach((finalOutcomeId) => {
    getImpactAreasForFinalOutcome(data, finalOutcomeId).forEach((impact) => {
      representedIds.add(impact.id)
    })
  })
  const organisationalIds = new Set(
    getImpactAreas(data).map((impact) => impact.id),
  )
  state.customInnovation?.impactAreaIds.forEach((impactId) => {
    if (organisationalIds.has(impactId)) representedIds.add(impactId)
  })
  return getImpactAreas(data).filter((impact) => representedIds.has(impact.id))
}

export function getCustomInnovationValidationForProject(
  state: ProjectDesignState,
) {
  return getCustomInnovationValidation(state.customInnovation)
}

function outcomeLabel(
  data: FrameworkData,
  finalOutcomeId: string,
): string {
  const outcome = getFinalOutcome(data, finalOutcomeId)
  return outcome?.shortLabel ?? outcome?.statement ?? finalOutcomeId
}

function getMandatoryIndicatorChecks(
  data: FrameworkData,
  state: ProjectDesignState,
): ReadinessCheck[] {
  const checks: ReadinessCheck[] = []
  state.selectedFinalOutcomeIds.forEach((finalOutcomeId) => {
    if (!getPrimaryIndicatorForFinalOutcome(data, finalOutcomeId)) {
      checks.push({
        id: `missing-fo-indicator-${finalOutcomeId}`,
        label: `Framework data error: Primary indicator missing for ${outcomeLabel(data, finalOutcomeId)}`,
        passed: false,
        action: {
          label: 'Review Final Outcome',
          to: `/design/outcomes/${finalOutcomeId}`,
        },
      })
    }
  })
  state.projectPathways.forEach((pathway) => {
    const pathwayName =
      getPathway(data, pathway.pathwayId)?.name ?? pathway.pathwayId
    pathway.intermediateOutcomeConfigurations.forEach((configuration) => {
      const frameworkPrimary = getPrimaryIndicatorForIntermediateOutcome(
        data,
        configuration.frameworkIntermediateOutcomeId,
      )
      const hasMandatoryPrimary =
        configuration.primaryIndicator?.mandatory === true &&
        configuration.primaryIndicator.role === 'primary' &&
        Boolean(frameworkPrimary)
      if (!hasMandatoryPrimary) {
        checks.push({
          id: `missing-io-indicator-${configuration.frameworkIntermediateOutcomeId}`,
          label: `Framework data error: Primary indicator missing in ${pathwayName}`,
          passed: false,
          action: {
            label: 'Configure pathway',
            to: `/design/pathways/${pathway.pathwayId}/configure`,
          },
        })
      }
    })
  })
  return checks
}

function getCustomReadinessChecks(
  data: FrameworkData,
  state: ProjectDesignState,
): ReadinessCheck[] {
  if (!state.customInnovation) {
    return [
      {
        id: 'custom-innovation-unused',
        label: 'Custom innovation not used',
        passed: true,
      },
    ]
  }

  const organisationalIds = new Set(
    getImpactAreas(data).map((impact) => impact.id),
  )
  const linkedOrganisationalImpacts =
    state.customInnovation.impactAreaIds.filter((impactId) =>
      organisationalIds.has(impactId),
    )
  const validation = getCustomInnovationValidation(state.customInnovation)
  const issues = [...validation.issues]
  if (
    state.customInnovation.impactAreaIds.length > 0 &&
    linkedOrganisationalImpacts.length === 0
  ) {
    issues.push('Select at least one existing organisational Impact Area.')
  }

  if (issues.length === 0) {
    return [
      {
        id: 'custom-innovation-complete',
        label: 'Custom innovation requirements complete',
        passed: true,
      },
    ]
  }

  return issues.map((issue, index) => ({
    id: `custom-innovation-${index}`,
    label: issue,
    passed: false,
    action: {
      label: 'Complete custom outcome',
      to: '/design/custom-innovation',
    },
  }))
}

export function getProjectReadiness(
  data: FrameworkData,
  state: ProjectDesignState,
): ProjectReadiness {
  const outcomeCount = getSelectedFinalOutcomeCount(state)
  const uniquePathways = getUniqueSelectedPathways(data, state)
  const configuredCount = uniquePathways.filter(
    (item) => item.status === 'configured',
  ).length
  const incompleteOutcomeIds = getIncompleteFinalOutcomeIds(state)
  const unconfirmedPathways = uniquePathways.filter(
    (item) => item.status !== 'configured',
  )
  const indicatorIssues = getMandatoryIndicatorChecks(data, state)
  const checks: ReadinessCheck[] = [
    isProjectMetadataComplete(state.metadata)
      ? {
          id: 'project-details',
          label: 'Project details complete',
          passed: true,
        }
      : {
          id: 'project-details',
          label: 'Required project details are incomplete',
          passed: false,
          action: { label: 'Edit project details', to: '/design/details' },
        },
    hasAtLeastOneFinalOutcome(state)
      ? {
          id: 'final-outcomes',
          label: `${outcomeCount} Final Outcome${outcomeCount === 1 ? '' : 's'} selected`,
          passed: true,
        }
      : {
          id: 'final-outcomes',
          label: 'Select at least one Final Outcome',
          passed: false,
          action: { label: 'Choose Final Outcomes', to: '/design/outcomes' },
        },
  ]

  if (state.selectedFinalOutcomeIds.length > 0) {
    if (incompleteOutcomeIds.length === 0) {
      checks.push({
        id: 'primary-pathways',
        label: 'Primary pathway selected for every standard Final Outcome',
        passed: true,
      })
    } else {
      incompleteOutcomeIds.forEach((finalOutcomeId) => {
        checks.push({
          id: `primary-pathway-${finalOutcomeId}`,
          label: `Primary pathway required for ${outcomeLabel(data, finalOutcomeId)}`,
          passed: false,
          action: {
            label: 'Choose Primary pathway',
            to: `/design/outcomes/${finalOutcomeId}`,
          },
        })
      })
    }
  }

  if (uniquePathways.length > 0) {
    if (unconfirmedPathways.length === 0) {
      checks.push({
        id: 'pathways-configured',
        label: `${configuredCount} of ${uniquePathways.length} pathways configured`,
        passed: true,
      })
    } else {
      unconfirmedPathways.forEach((item) => {
        checks.push({
          id: `pathway-unconfirmed-${item.pathway.pathwayId}`,
          label: `${item.name} still needs confirmation`,
          passed: false,
          action: {
            label: 'Configure pathway',
            to: `/design/pathways/${item.pathway.pathwayId}/configure`,
          },
        })
      })
    }
  }

  if (state.selectedFinalOutcomeIds.length > 0 || uniquePathways.length > 0) {
    if (indicatorIssues.length === 0) {
      checks.push({
        id: 'mandatory-indicators',
        label: 'Mandatory framework indicators present',
        passed: true,
      })
    } else {
      checks.push(...indicatorIssues)
    }
  }

  checks.push(...getCustomReadinessChecks(data, state))

  return {
    ready: checks.every((check) => check.passed),
    checks,
  }
}

export function getProjectReadinessIssues(
  data: FrameworkData,
  state: ProjectDesignState,
): ReadinessCheck[] {
  return getProjectReadiness(data, state).checks.filter((check) => !check.passed)
}

export function getReviewEntryBlockers(
  data: FrameworkData,
  state: ProjectDesignState,
): ReadinessCheck[] {
  return getProjectReadinessIssues(data, state).filter(
    (check) =>
      check.id === 'final-outcomes' ||
      check.id.startsWith('primary-pathway') ||
      check.id.startsWith('pathway-unconfirmed') ||
      check.id.startsWith('custom-innovation-'),
  )
}

export function canProceedToReview(state: ProjectDesignState): boolean {
  return canContinueToReview(state)
}
