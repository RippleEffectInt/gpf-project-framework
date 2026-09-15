import { describe, expect, it } from 'vitest'
import frameworkJson from '../data/framework-v1.0-normalized.json'
import {
  getImpactAreasForFinalOutcome,
  getPathwayIntermediateOutcomeSeeds,
  getPrimaryFinalOutcomeForPathway,
  getPrimaryPathwaysForFinalOutcome,
  getRelatedPathwaysForFinalOutcome,
} from '../services/frameworkService'
import type { FrameworkData } from '../types/framework'
import type {
  CustomInnovationOutcome,
  ProjectDesignState,
} from '../types/project'
import { createCustomInnovation } from './customInnovation'
import { canContinueToReview } from './journeySelectors'
import {
  initialProjectDesignState,
  projectDesignReducer,
} from './projectDesign'
import {
  canProceedToReview,
  getImpactsRepresentedByProject,
  getProjectReadiness,
  getUniqueSelectedPathways,
} from './projectReadiness'

const framework = frameworkJson as unknown as FrameworkData
const incomeImpact = framework.impacts.find((impact) => impact.theme === 'Income')
const inclusionImpact = framework.impacts.find(
  (impact) => impact.theme === 'Inclusion',
)
const firstOutcome = framework.finalOutcomes.find(
  (outcome) =>
    getPrimaryPathwaysForFinalOutcome(framework, outcome.id).length > 0,
)
if (!firstOutcome || !incomeImpact || !inclusionImpact) {
  throw new Error('Expected framework outcomes and Impact Areas.')
}
const selectedOutcome = firstOutcome
const selectedIncomeImpact = incomeImpact
const selectedInclusionImpact = inclusionImpact
const primaryPathway = getPrimaryPathwaysForFinalOutcome(
  framework,
  selectedOutcome.id,
)[0]
if (!primaryPathway) throw new Error('Expected a Primary pathway.')
const selectedPrimaryPathway = primaryPathway

const completeMetadata = {
  title: 'Seed systems project',
  country: 'Kenya',
  donor: 'FCDO',
  fundingReference: 'REF-001',
  projectManager: 'Amina Hassan',
  plannedStartDate: '2026-01',
  plannedEndDate: '2026-12',
  description: 'A project to strengthen local seed markets.',
}

function completeCustom(): CustomInnovationOutcome {
  const custom = createCustomInnovation({
    outcomeId: 'custom-fo-1',
    pathwayId: 'custom-pw-1',
    intermediateOutcomeId: 'custom-io-1',
    outcomePrimaryIndicatorId: 'custom-fo-ind-1',
    intermediatePrimaryIndicatorId: 'custom-io-ind-1',
  })
  const firstIo = custom.pathway.intermediateOutcomes[0]
  if (!firstIo) throw new Error('Expected a custom Intermediate Outcome.')
  return {
    ...custom,
    shortLabel: 'Local seed markets',
    statement: 'Smallholder farmers access reliable local seed markets.',
    rationale:
      'Standard outcomes do not adequately represent this market-system change.',
    impactAreaIds: [
      selectedIncomeImpact.id,
      selectedInclusionImpact.id,
      selectedIncomeImpact.id,
    ],
    primaryIndicator: {
      ...custom.primaryIndicator,
      wording: 'Number of farmers using local seed markets',
    },
    pathway: {
      ...custom.pathway,
      name: 'Local seed market development',
      description: 'Strengthen local seed production and trade.',
      rationale: 'Market access is the mechanism for the custom outcome.',
      intermediateOutcomes: [
        {
          ...firstIo,
          statement: 'Local seed producers increase quality supply.',
          primaryIndicator: {
            ...firstIo.primaryIndicator,
            wording: 'Volume of quality seed produced locally',
          },
          activities: [
            {
              id: 'custom-act-1',
              wording: 'Train local seed producers',
              projectDetails: '',
            },
          ],
        },
      ],
    },
  }
}

function addPrimaryPathway(
  state: ProjectDesignState,
  finalOutcomeId = selectedOutcome.id,
  relationshipType: 'primary' | 'related' = 'primary',
  pathwayId = selectedPrimaryPathway.pathway.id,
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

function addRequiredActivities(state: ProjectDesignState): ProjectDesignState {
  return state.projectPathways.reduce(
    (current, pathway) =>
      pathway.intermediateOutcomeConfigurations.reduce(
        (inner, configuration, index) =>
          projectDesignReducer(inner, {
            type: 'addProjectSpecificActivity',
            pathwayId: pathway.pathwayId,
            intermediateOutcomeId: configuration.frameworkIntermediateOutcomeId,
            activity: {
              id: `test-act-${pathway.pathwayId}-${index}`,
              wording: 'Required test activity',
              projectDetails: '',
            },
          }),
        current,
      ),
    state,
  )
}

function confirmPathways(state: ProjectDesignState): ProjectDesignState {
  const withActivities = addRequiredActivities(state)
  return withActivities.projectPathways.reduce(
    (current, pathway) =>
      projectDesignReducer(current, {
        type: 'markPathwayConfigured',
        pathwayId: pathway.pathwayId,
      }),
    withActivities,
  )
}

function withMetadata(state: ProjectDesignState): ProjectDesignState {
  return projectDesignReducer(state, {
    type: 'updateMetadata',
    payload: completeMetadata,
  })
}

describe('project design readiness and review model', () => {
  it('blocks readiness when required project details are missing', () => {
    const state = confirmPathways(addPrimaryPathway(initialProjectDesignState))
    const readiness = getProjectReadiness(framework, state)
    expect(readiness.ready).toBe(false)
    expect(readiness.checks.some((check) => check.id === 'project-details' && !check.passed)).toBe(
      true,
    )
  })

  it('blocks readiness when no Final Outcomes are selected', () => {
    const state = withMetadata(initialProjectDesignState)
    const readiness = getProjectReadiness(framework, state)
    expect(readiness.ready).toBe(false)
    expect(
      readiness.checks.some((check) => check.id === 'final-outcomes' && !check.passed),
    ).toBe(true)
  })

  it('keeps a Related-only standard Final Outcome incomplete', () => {
    const state = withMetadata(
      addPrimaryPathway(
        initialProjectDesignState,
        selectedOutcome.id,
        'related',
      ),
    )
    const readiness = getProjectReadiness(framework, state)
    expect(readiness.ready).toBe(false)
    expect(
      readiness.checks.some(
        (check) =>
          !check.passed &&
          check.label.includes('Primary pathway required'),
      ),
    ).toBe(true)
    expect(canContinueToReview(state)).toBe(false)
  })

  it('passes the pathway requirement when a Primary pathway is selected', () => {
    const state = withMetadata(addPrimaryPathway(initialProjectDesignState))
    const readiness = getProjectReadiness(framework, state)
    expect(
      readiness.checks.some(
        (check) =>
          check.id === 'primary-pathways' && check.passed,
      ),
    ).toBe(true)
  })

  it('blocks readiness and review when a standard pathway is unconfirmed', () => {
    const state = withMetadata(addPrimaryPathway(initialProjectDesignState))
    const readiness = getProjectReadiness(framework, state)
    expect(
      readiness.checks.some((check) =>
        check.id.startsWith('pathway-unconfirmed'),
      ),
    ).toBe(true)
    expect(canProceedToReview(state)).toBe(false)
  })

  it('passes configuration readiness after the pathway is confirmed', () => {
    const state = confirmPathways(
      withMetadata(addPrimaryPathway(initialProjectDesignState)),
    )
    const readiness = getProjectReadiness(framework, state)
    expect(
      readiness.checks.some(
        (check) => check.id === 'pathways-configured' && check.passed,
      ),
    ).toBe(true)
    expect(canProceedToReview(state)).toBe(true)
  })

  it('does not treat inputs or additional indicators as enough for pathway readiness', () => {
    const state = confirmPathways(
      withMetadata(addPrimaryPathway(initialProjectDesignState)),
    )
    const pathway = state.projectPathways[0]
    const intermediateOutcome =
      pathway?.intermediateOutcomeConfigurations[0]
    if (!pathway || !intermediateOutcome) {
      throw new Error('Expected a configured Intermediate Outcome.')
    }
    expect(intermediateOutcome.projectSpecificActivities.length).toBeGreaterThan(0)
    expect(intermediateOutcome.additionalIndicators).toEqual([])
    expect(intermediateOutcome.inputs).toEqual([])
    expect(getProjectReadiness(framework, state).ready).toBe(true)
  })

  it('blocks readiness when a pathway Intermediate Outcome has no activity', () => {
    const withPathway = withMetadata(addPrimaryPathway(initialProjectDesignState))
    const markedWithoutActivities = projectDesignReducer(withPathway, {
      type: 'markPathwayConfigured',
      pathwayId: selectedPrimaryPathway.pathway.id,
    })
    expect(canProceedToReview(markedWithoutActivities)).toBe(false)
    expect(getProjectReadiness(framework, markedWithoutActivities).ready).toBe(
      false,
    )
  })

  it('does not block readiness when no Custom Innovation Outcome is present', () => {
    const state = confirmPathways(
      withMetadata(addPrimaryPathway(initialProjectDesignState)),
    )
    const customCheck = getProjectReadiness(framework, state).checks.find(
      (check) => check.id === 'custom-innovation-unused',
    )
    expect(customCheck?.passed).toBe(true)
    expect(getProjectReadiness(framework, state).ready).toBe(true)
  })

  it('blocks readiness when an incomplete Custom Innovation Outcome is present', () => {
    const state = projectDesignReducer(
      confirmPathways(withMetadata(addPrimaryPathway(initialProjectDesignState))),
      {
        type: 'addCustomInnovation',
        customInnovation: createCustomInnovation({
          outcomeId: 'custom-fo-1',
          pathwayId: 'custom-pw-1',
          intermediateOutcomeId: 'custom-io-1',
          outcomePrimaryIndicatorId: 'custom-fo-ind-1',
          intermediatePrimaryIndicatorId: 'custom-io-ind-1',
        }),
      },
    )
    const readiness = getProjectReadiness(framework, state)
    expect(readiness.ready).toBe(false)
    expect(canProceedToReview(state)).toBe(false)
    expect(
      readiness.checks.some(
        (check) => !check.passed && check.id.startsWith('custom-innovation'),
      ),
    ).toBe(true)
  })

  it('passes custom validation when the Custom Innovation Outcome is complete', () => {
    const state = projectDesignReducer(
      confirmPathways(withMetadata(addPrimaryPathway(initialProjectDesignState))),
      {
        type: 'addCustomInnovation',
        customInnovation: completeCustom(),
      },
    )
    const readiness = getProjectReadiness(framework, state)
    expect(
      readiness.checks.some(
        (check) => check.id === 'custom-innovation-complete' && check.passed,
      ),
    ).toBe(true)
    expect(readiness.ready).toBe(true)
    expect(canProceedToReview(state)).toBe(true)
  })

  it('lists a shared pathway once with all linked Final Outcomes and relationship types', () => {
    const secondOutcome = framework.finalOutcomes.find(
      (outcome) =>
        outcome.id !== selectedOutcome.id &&
        getPrimaryPathwaysForFinalOutcome(framework, outcome.id).some(
          (summary) => summary.pathway.id !== selectedPrimaryPathway.pathway.id,
        ),
    )
    if (!secondOutcome) throw new Error('Expected a second Final Outcome.')
    const secondPrimary = getPrimaryPathwaysForFinalOutcome(
      framework,
      secondOutcome.id,
    ).find((summary) => summary.pathway.id !== selectedPrimaryPathway.pathway.id)
    if (!secondPrimary) throw new Error('Expected a distinct Primary pathway.')

    let state = addPrimaryPathway(initialProjectDesignState)
    state = addPrimaryPathway(
      state,
      secondOutcome.id,
      'related',
      selectedPrimaryPathway.pathway.id,
    )
    state = addPrimaryPathway(
      state,
      secondOutcome.id,
      'primary',
      secondPrimary.pathway.id,
    )
    const unique = getUniqueSelectedPathways(framework, state)
    const shared = unique.filter(
      (item) => item.pathway.pathwayId === selectedPrimaryPathway.pathway.id,
    )
    expect(shared).toHaveLength(1)
    expect(shared[0]?.linkedOutcomes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          finalOutcomeId: selectedOutcome.id,
          relationshipType: 'primary',
        }),
        expect.objectContaining({
          finalOutcomeId: secondOutcome.id,
          relationshipType: 'related',
        }),
      ]),
    )
    expect(unique.map((item) => item.pathway.pathwayId)).toEqual(
      expect.arrayContaining([
        selectedPrimaryPathway.pathway.id,
        secondPrimary.pathway.id,
      ]),
    )
    expect(unique.length).toBe(2)
  })

  it('de-duplicates repeated Impact Areas and does not list unselected pathways', () => {
    const state = projectDesignReducer(
      addPrimaryPathway(initialProjectDesignState),
      {
        type: 'addCustomInnovation',
        customInnovation: completeCustom(),
      },
    )
    const impacts = getImpactsRepresentedByProject(framework, state)
    const incomeMatches = impacts.filter(
      (impact) => impact.id === selectedIncomeImpact.id,
    )
    expect(incomeMatches).toHaveLength(1)
    expect(
      impacts.some((impact) => impact.id === selectedInclusionImpact.id),
    ).toBe(true)
    const unique = getUniqueSelectedPathways(framework, state)
    expect(unique.every((item) => item.pathway.pathwayId !== 'custom-pw-1')).toBe(
      true,
    )
    expect(
      unique.every((item) =>
        state.projectPathways.some(
          (pathway) => pathway.pathwayId === item.pathway.pathwayId,
        ),
      ),
    ).toBe(true)
    expect(unique.length).toBe(state.projectPathways.length)
  })

  it('includes Impact Areas from a Related pathway auto-added Primary Final Outcome', () => {
    const originatingOutcome = framework.finalOutcomes.find(
      (candidate) =>
        getPrimaryPathwaysForFinalOutcome(framework, candidate.id).length > 0 &&
        getRelatedPathwaysForFinalOutcome(framework, candidate.id).length > 0,
    )
    if (!originatingOutcome) {
      throw new Error('Expected an outcome with Related pathways.')
    }
    const originatingPrimary = getPrimaryPathwaysForFinalOutcome(
      framework,
      originatingOutcome.id,
    )[0]
    const related = getRelatedPathwaysForFinalOutcome(
      framework,
      originatingOutcome.id,
    )[0]
    if (!originatingPrimary || !related) {
      throw new Error('Expected Primary and Related pathway test data.')
    }
    const autoAddedOutcome = getPrimaryFinalOutcomeForPathway(
      framework,
      related.pathway.id,
    )
    if (!autoAddedOutcome) {
      throw new Error('Expected the Related pathway Primary Final Outcome.')
    }
    let state = addPrimaryPathway(
      initialProjectDesignState,
      originatingOutcome.id,
      'primary',
      originatingPrimary.pathway.id,
    )
    state = addPrimaryPathway(
      state,
      originatingOutcome.id,
      'related',
      related.pathway.id,
    )

    const representedIds = getImpactsRepresentedByProject(
      framework,
      state,
    ).map((impact) => impact.id)
    const autoAddedImpactIds = getImpactAreasForFinalOutcome(
      framework,
      autoAddedOutcome.id,
    ).map((impact) => impact.id)

    expect(state.selectedFinalOutcomeIds).toContain(autoAddedOutcome.id)
    expect(representedIds).toEqual(
      expect.arrayContaining(autoAddedImpactIds),
    )
  })
})
