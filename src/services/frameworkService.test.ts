import { describe, expect, it } from 'vitest'
import frameworkJson from '../data/framework-v1.0-normalized.json'
import type { FrameworkData } from '../types/framework'
import {
  COMMUNITY_EXTENSION_PATHWAY_ID,
  getActiveFinalOutcomes,
  getFinalOutcomesForImpactArea,
  getImpactAreas,
  getImpactAreasForFinalOutcome,
  getIntermediateOutcomesForPathway,
  getPathway,
  getPathwayIntermediateOutcomeSeeds,
  getPathwayRelationshipType,
  getPrimaryFinalOutcomeForPathway,
  getPrimaryIndicatorForIntermediateOutcome,
  getPrimaryPathwaysForFinalOutcome,
  getRelatedPathwaysForFinalOutcome,
  getSuggestedActivitiesForIntermediateOutcome,
} from './frameworkService'

const framework = frameworkJson as FrameworkData

describe('framework relationship and configuration queries', () => {
  it('loads the full ordered Intermediate Outcome chain for a standard pathway', () => {
    const pathway = getPathway(framework, 'PW_001')
    const outcomes = getIntermediateOutcomesForPathway(framework, 'PW_001')

    expect(pathway).toBeDefined()
    expect(outcomes.map((outcome) => outcome.id)).toEqual(
      pathway?.intermediateOutcomeIds,
    )
    expect(outcomes.map((outcome) => outcome.stepNumber)).toEqual([1, 2, 3, 4])
  })

  it('creates one mandatory Primary indicator seed for every active Intermediate Outcome', () => {
    const seeds = framework.pathways.flatMap((pathway) =>
      getPathwayIntermediateOutcomeSeeds(framework, pathway.id),
    )

    expect(seeds).toHaveLength(
      framework.intermediateOutcomes.filter((outcome) => outcome.active).length,
    )
    expect(seeds.every((seed) => seed.primaryIndicatorId !== null)).toBe(true)
    expect(
      framework.intermediateOutcomes
        .filter((outcome) => outcome.active)
        .every(
          (outcome) =>
            getPrimaryIndicatorForIntermediateOutcome(framework, outcome.id)
              ?.mandatory === true,
        ),
    ).toBe(true)
  })

  it('returns suggested activities as individual framework records', () => {
    const outcome = framework.intermediateOutcomes.find(
      (candidate) => candidate.suggestedActivityIds.length > 1,
    )
    if (!outcome) throw new Error('Expected activity test data.')

    const activities = getSuggestedActivitiesForIntermediateOutcome(
      framework,
      outcome.id,
    )
    expect(activities.map((activity) => activity.id)).toEqual(
      outcome.suggestedActivityIds,
    )
  })

  it('returns Primary and Related pathways in separate sets', () => {
    const primary = getPrimaryPathwaysForFinalOutcome(framework, 'FO_001')
    const related = getRelatedPathwaysForFinalOutcome(framework, 'FO_001')

    expect(primary.map(({ pathway }) => pathway.id)).toContain('PW_001')
    expect(primary.every((summary) => summary.relationshipType === 'primary')).toBe(
      true,
    )
    expect(related.every((summary) => summary.relationshipType === 'related')).toBe(
      true,
    )
    expect(
      primary.some((primarySummary) =>
        related.some(
          (relatedSummary) =>
            relatedSummary.pathway.id === primarySummary.pathway.id,
        ),
      ),
    ).toBe(false)
  })

  it('uses the explicit link relationship instead of legacy relationship labels', () => {
    const relationships = framework.finalOutcomePathwayLinks.filter(
      (link) => link.appSelectable,
    )

    relationships.forEach((link) => {
      expect(
        getPathwayRelationshipType(
          framework,
          link.finalOutcomeId,
          link.pathwayId,
        ),
      ).toBe(link.pathwayRelationshipType)
    })

    const explicitlyReclassified = relationships.find(
      (link) =>
        link.relationshipType === 'Core' &&
        link.pathwayRelationshipType === 'related',
    )
    expect(explicitlyReclassified).toBeDefined()
  })

  it('exposes community extension as Related where it is not already Primary', () => {
    const related = getRelatedPathwaysForFinalOutcome(framework, 'FO_001')
    expect(
      related.filter(
        ({ pathway }) => pathway.id === COMMUNITY_EXTENSION_PATHWAY_ID,
      ),
    ).toHaveLength(1)
    expect(
      getPathwayRelationshipType(
        framework,
        'FO_001',
        COMMUNITY_EXTENSION_PATHWAY_ID,
      ),
    ).toBe('related')
  })

  it('identifies a pathway Primary Final Outcome from framework data, not a Related discovery outcome', () => {
    expect(
      getPrimaryFinalOutcomeForPathway(
        framework,
        COMMUNITY_EXTENSION_PATHWAY_ID,
      )?.id,
    ).toBe('FO_024')
    expect(
      getPathwayRelationshipType(
        framework,
        'FO_001',
        COMMUNITY_EXTENSION_PATHWAY_ID,
      ),
    ).toBe('related')
  })

  it('retains the existing Primary community extension relationship', () => {
    expect(
      getPathwayRelationshipType(
        framework,
        'FO_024',
        COMMUNITY_EXTENSION_PATHWAY_ID,
      ),
    ).toBe('primary')
    expect(
      getPrimaryPathwaysForFinalOutcome(framework, 'FO_024').filter(
        ({ pathway }) => pathway.id === COMMUNITY_EXTENSION_PATHWAY_ID,
      ),
    ).toHaveLength(1)
  })

  it('returns every active Final Outcome for the All impact areas option', () => {
    expect(getActiveFinalOutcomes(framework, '', '')).toHaveLength(
      framework.finalOutcomes.filter((outcome) => outcome.active).length,
    )
  })

  it('filters Final Outcomes through explicit Impact relationships', () => {
    const income = getImpactAreas(framework).find(
      (impact) => impact.theme === 'Income',
    )
    if (!income) throw new Error('Expected Income impact area.')
    const expectedIds = new Set(
      framework.finalOutcomeImpactLinks
        .filter((link) => link.impactId === income.id)
        .map((link) => link.finalOutcomeId),
    )
    const actual = getFinalOutcomesForImpactArea(framework, income.id)

    expect(new Set(actual.map((outcome) => outcome.id))).toEqual(expectedIds)
  })

  it('returns a multi-impact Final Outcome under each linked Impact Area', () => {
    const impactAreas = getImpactAreasForFinalOutcome(framework, 'FO_001')
    expect(impactAreas.map((impact) => impact.theme)).toEqual([
      'Income',
      'Food',
    ])

    impactAreas.forEach((impact) => {
      expect(
        getFinalOutcomesForImpactArea(framework, impact.id).map(
          (outcome) => outcome.id,
        ),
      ).toContain('FO_001')
    })
  })
})
