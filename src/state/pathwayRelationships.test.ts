import { describe, expect, it } from 'vitest'
import frameworkJson from '../data/framework-v1.0-normalized.json'
import {
  COMMUNITY_EXTENSION_PATHWAY_ID,
  getPathwayIntermediateOutcomeSeeds,
  getPrimaryFinalOutcomeForPathway,
  getPrimaryPathwaysForFinalOutcome,
} from '../services/frameworkService'
import type { FrameworkData } from '../types/framework'
import type { PathwayRelationshipType, ProjectDesignState } from '../types/project'
import {
  getBasketSelectedOutcomes,
  getProjectRelationshipsForPathway,
  getRelatedPathwaysGroupedByPrimaryOutcome,
  getSelectedRelatedOutcomesForPathway,
} from './pathwayRelationships'
import {
  getFinalOutcomeSelectionSource,
  hasRequiredPrimaryPathways,
  initialProjectDesignState,
  projectDesignReducer,
} from './projectDesign'

const framework = frameworkJson as unknown as FrameworkData
const discoveryOutcome = framework.finalOutcomes.find(
  (outcome) => outcome.id === 'FO_001',
)
const communityPrimaryOutcome = getPrimaryFinalOutcomeForPathway(
  framework,
  COMMUNITY_EXTENSION_PATHWAY_ID,
)
const discoveryPrimaryPathway = getPrimaryPathwaysForFinalOutcome(
  framework,
  'FO_001',
)[0]

if (!discoveryOutcome || !communityPrimaryOutcome || !discoveryPrimaryPathway) {
  throw new Error('Expected community extension relationship test data.')
}

function addPathway(
  state: ProjectDesignState,
  finalOutcomeId: string,
  pathwayId: string,
  relationshipType: PathwayRelationshipType,
): ProjectDesignState {
  return projectDesignReducer(state, {
    type: 'addPathway',
    finalOutcomeId,
    pathwayId,
    relationshipType,
    frameworkPrimaryFinalOutcomeId:
      getPrimaryFinalOutcomeForPathway(framework, pathwayId)?.id ??
      finalOutcomeId,
    intermediateOutcomes: getPathwayIntermediateOutcomeSeeds(
      framework,
      pathwayId,
    ),
  })
}

describe('pathway relationship selectors', () => {
  it('adds a Related pathway’s own Primary Final Outcome and relationship', () => {
    const relatedOnly = addPathway(
      initialProjectDesignState,
      discoveryOutcome.id,
      COMMUNITY_EXTENSION_PATHWAY_ID,
      'related',
    )

    expect(relatedOnly.selectedFinalOutcomeIds).toEqual([
      discoveryOutcome.id,
      communityPrimaryOutcome.id,
    ])
    expect(
      getFinalOutcomeSelectionSource(
        relatedOnly,
        communityPrimaryOutcome.id,
      ),
    ).toBe('related-pathway')
    expect(relatedOnly.projectPathways).toHaveLength(1)
    expect(relatedOnly.outcomePathwayLinks).toEqual([
      {
        finalOutcomeId: discoveryOutcome.id,
        pathwayId: COMMUNITY_EXTENSION_PATHWAY_ID,
        relationshipType: 'related',
      },
      {
        finalOutcomeId: communityPrimaryOutcome.id,
        pathwayId: COMMUNITY_EXTENSION_PATHWAY_ID,
        relationshipType: 'primary',
      },
    ])
    expect(
      getSelectedRelatedOutcomesForPathway(
        framework,
        relatedOnly,
        COMMUNITY_EXTENSION_PATHWAY_ID,
      ).map((item) => item.finalOutcomeId),
    ).toEqual([discoveryOutcome.id])
  })

  it('shows the pathway under both Final Outcome cards', () => {
    let state = addPathway(
      initialProjectDesignState,
      discoveryOutcome.id,
      discoveryPrimaryPathway.pathway.id,
      'primary',
    )
    state = addPathway(
      state,
      discoveryOutcome.id,
      COMMUNITY_EXTENSION_PATHWAY_ID,
      'related',
    )

    const groups = getRelatedPathwaysGroupedByPrimaryOutcome(framework, state)
    expect(groups).toEqual([])

    const selected = getBasketSelectedOutcomes(framework, state)
    expect(selected.map((item) => item.outcomeId)).toEqual([
      discoveryOutcome.id,
      communityPrimaryOutcome.id,
    ])
    expect(
      selected[0]?.primaryPathways.map((item) => item.pathwayId),
    ).toEqual([discoveryPrimaryPathway.pathway.id])
    expect(
      selected[0]?.relatedPathways.map((item) => item.pathwayId),
    ).toEqual([COMMUNITY_EXTENSION_PATHWAY_ID])
    expect(selected[0]?.relatedPathways[0]?.primaryFinalOutcomeLabel).toBe(
      communityPrimaryOutcome.shortLabel ?? communityPrimaryOutcome.statement,
    )
    expect(selected[0]?.relatedPathways[0]?.relationshipType).toBe('related')
    expect(
      selected[1]?.primaryPathways.map((item) => item.pathwayId),
    ).toEqual([COMMUNITY_EXTENSION_PATHWAY_ID])
    expect(hasRequiredPrimaryPathways(state)).toBe(true)
  })

  it('keeps one Project Pathway when the same pathway is Primary and Related', () => {
    let state = addPathway(
      initialProjectDesignState,
      communityPrimaryOutcome.id,
      COMMUNITY_EXTENSION_PATHWAY_ID,
      'primary',
    )
    state = addPathway(
      state,
      discoveryOutcome.id,
      COMMUNITY_EXTENSION_PATHWAY_ID,
      'related',
    )

    expect(state.projectPathways).toHaveLength(1)
    expect(state.outcomePathwayLinks).toHaveLength(2)
    expect(
      getProjectRelationshipsForPathway(
        framework,
        state,
        COMMUNITY_EXTENSION_PATHWAY_ID,
      ),
    ).toEqual([
      expect.objectContaining({
        finalOutcomeId: communityPrimaryOutcome.id,
        relationshipType: 'primary',
      }),
      expect.objectContaining({
        finalOutcomeId: discoveryOutcome.id,
        relationshipType: 'related',
      }),
    ])
    expect(getRelatedPathwaysGroupedByPrimaryOutcome(framework, state)).toEqual(
      [],
    )

    const selected = getBasketSelectedOutcomes(framework, state)
    const primaryGroup = selected.find(
      (item) => item.outcomeId === communityPrimaryOutcome.id,
    )
    const relatedGroup = selected.find(
      (item) => item.outcomeId === discoveryOutcome.id,
    )
    expect(primaryGroup?.primaryPathways).toHaveLength(1)
    expect(primaryGroup?.primaryPathways[0]?.usedElsewhere).toBe(true)
    expect(relatedGroup?.relatedPathways).toHaveLength(1)
    expect(relatedGroup?.relatedPathways[0]?.pathwayId).toBe(
      COMMUNITY_EXTENSION_PATHWAY_ID,
    )
    expect(relatedGroup?.relatedPathways[0]?.usedElsewhere).toBe(true)
    expect(relatedGroup?.relatedPathways[0]?.primaryFinalOutcomeLabel).toBe(
      communityPrimaryOutcome.shortLabel ?? communityPrimaryOutcome.statement,
    )
  })
})
