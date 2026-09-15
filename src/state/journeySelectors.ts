import { getFinalOutcome, getPathway } from '../services/frameworkService'
import type { FrameworkData } from '../types/framework'
import type {
  ConfigurationStatus,
  PathwayRelationshipType,
  ProjectDesignState,
  ProjectPathway,
} from '../types/project'
import { isCustomInnovationStructurallyComplete } from './customInnovation'
import {
  getPathwayConfigurationStatus,
  hasRequiredPrimaryPathways,
} from './projectDesign'

export interface PathwayOverviewItem {
  pathway: ProjectPathway
  name: string
  linkedOutcomes: Array<{
    finalOutcomeId: string
    statement: string
    relationshipType: PathwayRelationshipType
  }>
  status: ConfigurationStatus
}

export function hasAtLeastOneFinalOutcome(
  state: ProjectDesignState,
): boolean {
  return (
    state.selectedFinalOutcomeIds.length > 0 ||
    state.customInnovation !== null
  )
}

export function getSelectedFinalOutcomeCount(
  state: ProjectDesignState,
): number {
  return (
    state.selectedFinalOutcomeIds.length + (state.customInnovation ? 1 : 0)
  )
}

export function canContinueToConfigure(
  state: ProjectDesignState,
): boolean {
  if (!hasRequiredPrimaryPathways(state)) return false
  if (state.selectedFinalOutcomeIds.length > 0) return true
  return (
    state.customInnovation !== null &&
    isCustomInnovationStructurallyComplete(state.customInnovation)
  )
}

export function getIncompleteFinalOutcomeIds(
  state: ProjectDesignState,
): string[] {
  return state.selectedFinalOutcomeIds.filter(
    (outcomeId) =>
      !state.outcomePathwayLinks.some(
        (link) =>
          link.finalOutcomeId === outcomeId &&
          link.relationshipType === 'primary',
      ),
  )
}

export function getPathwayOverviewItems(
  data: FrameworkData,
  state: ProjectDesignState,
): PathwayOverviewItem[] {
  return state.projectPathways
    .map((projectPathway) => {
      const frameworkPathway = getPathway(data, projectPathway.pathwayId)
      const linkedOutcomes = state.outcomePathwayLinks
        .filter((link) => link.pathwayId === projectPathway.pathwayId)
        .flatMap((link) => {
          const outcome = getFinalOutcome(data, link.finalOutcomeId)
          return outcome
            ? [
                {
                  finalOutcomeId: outcome.id,
                  statement: outcome.shortLabel ?? outcome.statement,
                  relationshipType: link.relationshipType,
                },
              ]
            : []
        })
      return {
        pathway: projectPathway,
        name: frameworkPathway?.name ?? projectPathway.pathwayId,
        linkedOutcomes,
        status: getPathwayConfigurationStatus(projectPathway),
      }
    })
    .sort((left, right) => {
      const order: Record<ConfigurationStatus, number> = {
        'in-progress': 0,
        'not-started': 1,
        configured: 2,
      }
      return order[left.status] - order[right.status]
    })
}

export function isPathwayTechnicallyValid(
  pathway: ProjectPathway,
): boolean {
  return (
    pathway.intermediateOutcomeConfigurations.length > 0 &&
    pathway.intermediateOutcomeConfigurations.every(
      (configuration) =>
        configuration.primaryIndicator?.mandatory === true &&
        configuration.primaryIndicator.role === 'primary',
    )
  )
}

export function areStandardPathwaysConfirmed(
  state: ProjectDesignState,
): boolean {
  return state.projectPathways.every(
    (pathway) =>
      isPathwayTechnicallyValid(pathway) &&
      getPathwayConfigurationStatus(pathway) === 'configured',
  )
}

export function canContinueToReview(state: ProjectDesignState): boolean {
  return (
    canContinueToConfigure(state) &&
    areStandardPathwaysConfirmed(state) &&
    isCustomInnovationStructurallyComplete(state.customInnovation)
  )
}
