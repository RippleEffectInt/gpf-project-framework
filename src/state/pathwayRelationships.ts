import {
  getFinalOutcome,
  getPathway,
  getPrimaryFinalOutcomeForPathway,
} from '../services/frameworkService'
import type { FinalOutcome, FrameworkData } from '../types/framework'
import type {
  ConfigurationStatus,
  PathwayRelationshipType,
  ProjectDesignState,
} from '../types/project'
import { getPathwayConfigurationStatus } from './projectDesign'

export interface ProjectPathwayRelationship {
  finalOutcomeId: string
  label: string
  relationshipType: PathwayRelationshipType
}

export interface RelatedPathwayGroup {
  primaryFinalOutcome: FinalOutcome | undefined
  primaryFinalOutcomeLabel: string
  pathways: Array<{
    pathwayId: string
    name: string
    supports: Array<{ finalOutcomeId: string; label: string }>
  }>
}

export interface BasketPathwayItem {
  pathwayId: string
  name: string
  status: ConfigurationStatus
  relationshipType: PathwayRelationshipType
  primaryFinalOutcomeLabel?: string
  usedElsewhere: boolean
}

export interface BasketSelectedOutcome {
  outcomeId: string
  label: string
  primaryCount: number
  primaryPathways: BasketPathwayItem[]
  relatedPathways: BasketPathwayItem[]
}

function outcomeLabel(outcome: FinalOutcome | undefined, fallbackId: string): string {
  return outcome?.shortLabel ?? outcome?.statement ?? fallbackId
}

export function getProjectRelationshipsForPathway(
  data: FrameworkData,
  state: ProjectDesignState,
  pathwayId: string,
): ProjectPathwayRelationship[] {
  return state.outcomePathwayLinks
    .filter((link) => link.pathwayId === pathwayId)
    .map((link) => ({
      finalOutcomeId: link.finalOutcomeId,
      label: outcomeLabel(
        getFinalOutcome(data, link.finalOutcomeId),
        link.finalOutcomeId,
      ),
      relationshipType: link.relationshipType,
    }))
    .sort(
      (left, right) =>
        (left.relationshipType === 'primary' ? 0 : 1) -
        (right.relationshipType === 'primary' ? 0 : 1),
    )
}

export function getSelectedRelatedOutcomesForPathway(
  data: FrameworkData,
  state: ProjectDesignState,
  pathwayId: string,
): ProjectPathwayRelationship[] {
  return getProjectRelationshipsForPathway(data, state, pathwayId).filter(
    (relationship) => relationship.relationshipType === 'related',
  )
}

export function getSelectedPrimaryOutcomesForPathway(
  data: FrameworkData,
  state: ProjectDesignState,
  pathwayId: string,
): ProjectPathwayRelationship[] {
  return getProjectRelationshipsForPathway(data, state, pathwayId).filter(
    (relationship) => relationship.relationshipType === 'primary',
  )
}

export function isPathwayPrimaryForAnySelectedOutcome(
  state: ProjectDesignState,
  pathwayId: string,
): boolean {
  return state.outcomePathwayLinks.some(
    (link) =>
      link.pathwayId === pathwayId &&
      link.relationshipType === 'primary' &&
      state.selectedFinalOutcomeIds.includes(link.finalOutcomeId),
  )
}

function toBasketPathwayItem(
  data: FrameworkData,
  state: ProjectDesignState,
  outcomeId: string,
  pathwayId: string,
  relationshipType: PathwayRelationshipType,
): BasketPathwayItem {
  const projectPathway = state.projectPathways.find(
    (candidate) => candidate.pathwayId === pathwayId,
  )
  const primaryFinalOutcome = getPrimaryFinalOutcomeForPathway(data, pathwayId)
  return {
    pathwayId,
    name: getPathway(data, pathwayId)?.name ?? pathwayId,
    status: projectPathway
      ? getPathwayConfigurationStatus(projectPathway)
      : 'not-started',
    relationshipType,
    primaryFinalOutcomeLabel:
      relationshipType === 'related'
        ? outcomeLabel(primaryFinalOutcome, 'Unknown Final Outcome')
        : undefined,
    usedElsewhere: state.outcomePathwayLinks.some(
      (link) =>
        link.pathwayId === pathwayId && link.finalOutcomeId !== outcomeId,
    ),
  }
}

export function getBasketSelectedOutcomes(
  data: FrameworkData,
  state: ProjectDesignState,
): BasketSelectedOutcome[] {
  return state.selectedFinalOutcomeIds.map((outcomeId) => {
    const outcome = getFinalOutcome(data, outcomeId)
    const links = state.outcomePathwayLinks.filter(
      (link) => link.finalOutcomeId === outcomeId,
    )
    const primaryLinks = links.filter(
      (link) => link.relationshipType === 'primary',
    )
    const relatedLinks = links.filter(
      (link) => link.relationshipType === 'related',
    )
    return {
      outcomeId,
      label: outcomeLabel(outcome, outcomeId),
      primaryCount: primaryLinks.length,
      primaryPathways: primaryLinks.map((link) =>
        toBasketPathwayItem(data, state, outcomeId, link.pathwayId, 'primary'),
      ),
      relatedPathways: relatedLinks.map((link) =>
        toBasketPathwayItem(data, state, outcomeId, link.pathwayId, 'related'),
      ),
    }
  })
}

export function getRelatedPathwaysGroupedByPrimaryOutcome(
  data: FrameworkData,
  state: ProjectDesignState,
): RelatedPathwayGroup[] {
  const relatedPathwayIds = [
    ...new Set(
      state.outcomePathwayLinks
        .filter((link) => link.relationshipType === 'related')
        .map((link) => link.pathwayId),
    ),
  ].filter(
    (pathwayId) => !isPathwayPrimaryForAnySelectedOutcome(state, pathwayId),
  )

  const groups = new Map<string, RelatedPathwayGroup>()
  relatedPathwayIds.forEach((pathwayId) => {
    const primaryFinalOutcome = getPrimaryFinalOutcomeForPathway(
      data,
      pathwayId,
    )
    const groupKey = primaryFinalOutcome?.id ?? `unknown-${pathwayId}`
    const existing = groups.get(groupKey) ?? {
      primaryFinalOutcome,
      primaryFinalOutcomeLabel: outcomeLabel(
        primaryFinalOutcome,
        'Unknown Final Outcome',
      ),
      pathways: [],
    }
    existing.pathways.push({
      pathwayId,
      name: getPathway(data, pathwayId)?.name ?? pathwayId,
      supports: getSelectedRelatedOutcomesForPathway(data, state, pathwayId),
    })
    groups.set(groupKey, existing)
  })
  return [...groups.values()]
}
