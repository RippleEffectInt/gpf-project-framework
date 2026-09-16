import type {
  FinalOutcome,
  FinalOutcomeSummary,
  FrameworkData,
  ImpactArea,
  Indicator,
  IntermediateOutcome,
  Pathway,
  PathwaySummary,
  SuggestedActivity,
  ThematicArea,
} from '../types/framework'
import type {
  PathwayIntermediateOutcomeSeed,
  PathwayRelationshipType,
} from '../types/project'
import { CURRENT_FRAMEWORK } from '../data/frameworkRegistry'

export const COMMUNITY_EXTENSION_PATHWAY_ID = 'PW_028'

function isFrameworkData(value: unknown): value is FrameworkData {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<FrameworkData>
  return (
    typeof candidate.frameworkVersion === 'string' &&
    Array.isArray(candidate.finalOutcomes) &&
    Array.isArray(candidate.finalOutcomeImpactLinks) &&
    Array.isArray(candidate.pathways) &&
    Array.isArray(candidate.finalOutcomePathwayLinks) &&
    Array.isArray(candidate.intermediateOutcomes) &&
    Array.isArray(candidate.indicators) &&
    Array.isArray(candidate.suggestedActivities) &&
    candidate.suggestedActivities.every(
      (activity) =>
        typeof activity.id === 'string' &&
        typeof activity.text === 'string' &&
        typeof activity.intermediateOutcomeId === 'string' &&
        typeof activity.sortOrder === 'number' &&
        typeof activity.active === 'boolean' &&
        (activity.outputPhrase === undefined ||
          activity.outputPhrase === null ||
          typeof activity.outputPhrase === 'string'),
    )
  )
}

export async function loadFramework(): Promise<FrameworkData> {
  if (!isFrameworkData(CURRENT_FRAMEWORK)) {
    throw new Error('The current framework file does not match the expected schema.')
  }
  return CURRENT_FRAMEWORK
}

export function getActiveThematicAreas(data: FrameworkData): ThematicArea[] {
  return data.thematicAreas
    .filter((area) => area.active)
    .sort((left, right) => left.sortOrder - right.sortOrder)
}

export function getActiveFinalOutcomes(
  data: FrameworkData,
  query = '',
  impactAreaId = '',
): FinalOutcome[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const impactOutcomeIds = impactAreaId
    ? new Set(
        data.finalOutcomeImpactLinks
          .filter((link) => link.impactId === impactAreaId)
          .map((link) => link.finalOutcomeId),
      )
    : null
  return data.finalOutcomes.filter(
    (outcome) =>
      outcome.active &&
      (!impactOutcomeIds || impactOutcomeIds.has(outcome.id)) &&
      (!normalizedQuery ||
        outcome.statement.toLocaleLowerCase().includes(normalizedQuery) ||
        outcome.shortLabel?.toLocaleLowerCase().includes(normalizedQuery)),
  )
}

export function getImpactAreas(data: FrameworkData): ImpactArea[] {
  return data.impacts.filter((impact) => impact.active)
}

export function getImpactAreasForFinalOutcome(
  data: FrameworkData,
  finalOutcomeId: string,
): ImpactArea[] {
  const impactIds = new Set(
    data.finalOutcomeImpactLinks
      .filter((link) => link.finalOutcomeId === finalOutcomeId)
      .map((link) => link.impactId),
  )
  return getImpactAreas(data).filter((impact) => impactIds.has(impact.id))
}

export function getFinalOutcomesForImpactArea(
  data: FrameworkData,
  impactAreaId: string,
): FinalOutcome[] {
  return getActiveFinalOutcomes(data, '', impactAreaId)
}

export function getIndicator(
  data: FrameworkData,
  indicatorId: string | undefined,
): Indicator | undefined {
  return data.indicators.find(
    (indicator) => indicator.id === indicatorId && indicator.active,
  )
}

export function getIndicators(
  data: FrameworkData,
  indicatorIds: readonly string[],
): Indicator[] {
  const idSet = new Set(indicatorIds)
  return data.indicators.filter(
    (indicator) => idSet.has(indicator.id) && indicator.active,
  )
}

export function getPrimaryIndicatorForFinalOutcome(
  data: FrameworkData,
  finalOutcomeId: string,
): Indicator | undefined {
  const finalOutcome = getFinalOutcome(data, finalOutcomeId)
  if (!finalOutcome) return undefined
  const primaryIds = new Set(finalOutcome.primaryIndicatorIds)
  const candidates = data.indicators.filter(
    (indicator) =>
      primaryIds.has(indicator.id) &&
      indicator.parentId === finalOutcomeId &&
      indicator.parentType === 'FinalOutcome' &&
      indicator.role === 'Primary' &&
      indicator.mandatory &&
      indicator.active,
  )
  return candidates.length === 1 ? candidates[0] : undefined
}

export function getFinalOutcomeSummary(
  data: FrameworkData,
  outcome: FinalOutcome,
): FinalOutcomeSummary {
  const thematicArea = data.thematicAreas.find(
    (area) => area.id === outcome.thematicAreaId,
  )
  if (!thematicArea) {
    throw new Error(`Unknown thematic area for final outcome ${outcome.id}.`)
  }
  const pathways = getPathwaysForOutcome(data, outcome.id)
  const primaryPathwayCount = pathways.filter(
    (summary) => summary.relationshipType === 'primary',
  ).length
  const relatedPathwayCount = pathways.length - primaryPathwayCount
  return {
    outcome,
    thematicArea,
    impactAreas: getImpactAreasForFinalOutcome(data, outcome.id),
    primaryIndicator: getPrimaryIndicatorForFinalOutcome(data, outcome.id),
    pathwayCount: pathways.length,
    primaryPathwayCount,
    relatedPathwayCount,
  }
}

export function getFinalOutcome(
  data: FrameworkData,
  outcomeId: string,
): FinalOutcome | undefined {
  return data.finalOutcomes.find(
    (outcome) => outcome.id === outcomeId && outcome.active,
  )
}

function getUserFacingRationale(rationale: string | null): string | null {
  if (!rationale) return null
  const governanceTerms =
    /master framework|pilf|original framework|inferred|source row|normalization/i
  return governanceTerms.test(rationale) ? null : rationale
}

function getRelationshipType(
  link: FrameworkData['finalOutcomePathwayLinks'][number],
): PathwayRelationshipType {
  return link.pathwayRelationshipType
}

function createPathwaySummary(
  data: FrameworkData,
  finalOutcomeId: string,
  pathway: Pathway,
  link: PathwaySummary['link'],
  relationshipType: PathwayRelationshipType,
): PathwaySummary {
  return {
    pathway,
    finalOutcomeId,
    link,
    relationshipType,
    rationale: getUserFacingRationale(link?.rationale ?? null),
    intermediateOutcomes: getIntermediateOutcomesForPathway(data, pathway.id),
  }
}

export function getPathwaysForOutcome(
  data: FrameworkData,
  outcomeId: string,
): PathwaySummary[] {
  const summaries: PathwaySummary[] = []
  data.finalOutcomePathwayLinks
    .filter(
      (link) => link.finalOutcomeId === outcomeId && link.appSelectable,
    )
    .forEach((link) => {
      const pathway = data.pathways.find(
        (candidate) => candidate.id === link.pathwayId && candidate.active,
      )
      if (pathway) {
        summaries.push(
          createPathwaySummary(
            data,
            outcomeId,
            pathway,
            link,
            getRelationshipType(link),
          ),
        )
      }
    })

  const communityExtension = data.pathways.find(
    (pathway) =>
      pathway.id === COMMUNITY_EXTENSION_PATHWAY_ID && pathway.active,
  )
  if (
    communityExtension &&
    !summaries.some(
      ({ pathway }) => pathway.id === COMMUNITY_EXTENSION_PATHWAY_ID,
    )
  ) {
    summaries.push(
      createPathwaySummary(
        data,
        outcomeId,
        communityExtension,
        null,
        'related',
      ),
    )
  }
  return summaries
}

export function getPrimaryPathwaysForFinalOutcome(
  data: FrameworkData,
  finalOutcomeId: string,
): PathwaySummary[] {
  return getPathwaysForOutcome(data, finalOutcomeId).filter(
    (summary) => summary.relationshipType === 'primary',
  )
}

export function getRelatedPathwaysForFinalOutcome(
  data: FrameworkData,
  finalOutcomeId: string,
): PathwaySummary[] {
  return getPathwaysForOutcome(data, finalOutcomeId).filter(
    (summary) => summary.relationshipType === 'related',
  )
}

export function getPathwayRelationshipType(
  data: FrameworkData,
  finalOutcomeId: string,
  pathwayId: string,
): PathwayRelationshipType | undefined {
  return getPathwaysForOutcome(data, finalOutcomeId).find(
    ({ pathway }) => pathway.id === pathwayId,
  )?.relationshipType
}

export function getPathwayForOutcome(
  data: FrameworkData,
  outcomeId: string,
  pathwayId: string,
): PathwaySummary | undefined {
  return getPathwaysForOutcome(data, outcomeId).find(
    ({ pathway }) => pathway.id === pathwayId,
  )
}

export function getPathway(
  data: FrameworkData,
  pathwayId: string,
): Pathway | undefined {
  return data.pathways.find(
    (pathway) => pathway.id === pathwayId && pathway.active,
  )
}

export function getPrimaryFinalOutcomeForPathway(
  data: FrameworkData,
  pathwayId: string,
): FinalOutcome | undefined {
  const pathway = getPathway(data, pathwayId)
  if (!pathway) return undefined
  return getFinalOutcome(data, pathway.primaryFinalOutcomeId)
}

export function getIntermediateOutcomesForPathway(
  data: FrameworkData,
  pathwayId: string,
): IntermediateOutcome[] {
  return data.intermediateOutcomes
    .filter(
      (outcome) => outcome.pathwayId === pathwayId && outcome.active,
    )
    .sort((left, right) => left.stepNumber - right.stepNumber)
}

export const getIntermediateOutcomes = getIntermediateOutcomesForPathway

export function getPrimaryIndicatorForIntermediateOutcome(
  data: FrameworkData,
  intermediateOutcomeId: string,
): Indicator | undefined {
  const intermediateOutcome = data.intermediateOutcomes.find(
    (outcome) =>
      outcome.id === intermediateOutcomeId && outcome.active,
  )
  if (!intermediateOutcome) return undefined
  const primaryIds = new Set(intermediateOutcome.primaryIndicatorIds)
  const candidates = data.indicators.filter(
    (indicator) =>
      primaryIds.has(indicator.id) &&
      indicator.parentId === intermediateOutcomeId &&
      indicator.parentType === 'IntermediateOutcome' &&
      indicator.role === 'Primary' &&
      indicator.mandatory &&
      indicator.active,
  )
  return candidates.length === 1 ? candidates[0] : undefined
}

export function getAdditionalIndicatorsForIntermediateOutcome(
  data: FrameworkData,
  intermediateOutcomeId: string,
): Indicator[] {
  const intermediateOutcome = data.intermediateOutcomes.find(
    (outcome) =>
      outcome.id === intermediateOutcomeId && outcome.active,
  )
  if (!intermediateOutcome) return []
  const additionalIds = new Set(intermediateOutcome.additionalIndicatorIds)
  return data.indicators.filter(
    (indicator) =>
      additionalIds.has(indicator.id) &&
      indicator.parentId === intermediateOutcomeId &&
      indicator.parentType === 'IntermediateOutcome' &&
      indicator.role === 'Additional' &&
      indicator.active,
  )
}

export function getSuggestedActivitiesForIntermediateOutcome(
  data: FrameworkData,
  intermediateOutcomeId: string,
): SuggestedActivity[] {
  const intermediateOutcome = data.intermediateOutcomes.find(
    (outcome) =>
      outcome.id === intermediateOutcomeId && outcome.active,
  )
  if (!intermediateOutcome) return []
  const activityIds = new Set(intermediateOutcome.suggestedActivityIds)
  return data.suggestedActivities
    .filter(
      (activity) =>
        activityIds.has(activity.id) &&
        activity.intermediateOutcomeId === intermediateOutcomeId &&
        activity.active,
    )
    .sort((left, right) => left.sortOrder - right.sortOrder)
}

export function getPathwayIntermediateOutcomeSeeds(
  data: FrameworkData,
  pathwayId: string,
): PathwayIntermediateOutcomeSeed[] {
  return getIntermediateOutcomesForPathway(data, pathwayId).map((outcome) => ({
    frameworkIntermediateOutcomeId: outcome.id,
    primaryIndicatorId:
      getPrimaryIndicatorForIntermediateOutcome(data, outcome.id)?.id ?? null,
  }))
}
