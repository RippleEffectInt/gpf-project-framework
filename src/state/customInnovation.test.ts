import { describe, expect, it } from 'vitest'
import frameworkJson from '../data/framework-v1.0-normalized.json'
import type { FrameworkData } from '../types/framework'
import type {
  CustomInnovationOutcome,
  ProjectDesignState,
} from '../types/project'
import {
  createBlankCustomIntermediateOutcome,
  createCustomInnovation,
  getCustomInnovationValidation,
} from './customInnovation'
import {
  initialProjectDesignState,
  projectDesignReducer,
} from './projectDesign'

const framework = frameworkJson as unknown as FrameworkData
const incomeImpactId = framework.impacts.find(
  (impact) => impact.theme === 'Income',
)?.id

if (!incomeImpactId) {
  throw new Error('Expected the Income Impact Area in framework data.')
}

const incomeImpactAreaId = incomeImpactId

function blankCustom(): CustomInnovationOutcome {
  return createCustomInnovation({
    outcomeId: 'custom-fo-1',
    pathwayId: 'custom-pw-1',
    intermediateOutcomeId: 'custom-io-1',
    outcomePrimaryIndicatorId: 'custom-fo-ind-1',
    intermediatePrimaryIndicatorId: 'custom-io-ind-1',
  })
}

function completeCustom(): CustomInnovationOutcome {
  const custom = blankCustom()
  const firstIo = custom.pathway.intermediateOutcomes[0]
  if (!firstIo) throw new Error('Expected a custom Intermediate Outcome.')
  return {
    ...custom,
    shortLabel: 'Local seed markets',
    statement: 'Smallholder farmers access reliable local seed markets.',
    rationale:
      'Standard outcomes do not adequately represent this market-system change.',
    impactAreaIds: [incomeImpactAreaId],
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

function withCustom(
  custom: CustomInnovationOutcome,
  base: ProjectDesignState = initialProjectDesignState,
): ProjectDesignState {
  return projectDesignReducer(base, {
    type: 'addCustomInnovation',
    customInnovation: custom,
  })
}

describe('custom innovation outcome', () => {
  it('adds one Custom Innovation Final Outcome', () => {
    const result = withCustom(blankCustom())
    expect(result.customInnovation?.isCustom).toBe(true)
    expect(result.customInnovation?.id).toBe('custom-fo-1')
    expect(result.customInnovation?.pathway.isCustom).toBe(true)
    expect(result.customInnovation?.pathway.id).toBe('custom-pw-1')
  })

  it('does not add a second Custom Innovation Final Outcome', () => {
    const first = withCustom(blankCustom())
    const second = projectDesignReducer(first, {
      type: 'addCustomInnovation',
      customInnovation: {
        ...blankCustom(),
        id: 'custom-fo-2',
      },
    })
    expect(second.customInnovation?.id).toBe('custom-fo-1')
    expect(second.customInnovation).toBe(first.customInnovation)
  })

  it('requires a short label, statement, rationale, Impact Area and Primary indicator', () => {
    const issues = getCustomInnovationValidation(blankCustom()).issues
    expect(issues).toEqual(
      expect.arrayContaining([
        'Custom outcome short label is required.',
        'Custom outcome statement is required.',
        'Custom outcome rationale is required.',
        'Select at least one Impact Area',
        'Custom outcome Primary indicator is required.',
      ]),
    )
  })

  it('requires custom pathway name, description, why this pathway and an Intermediate Outcome', () => {
    const issues = getCustomInnovationValidation(blankCustom()).issues
    expect(issues).toEqual(
      expect.arrayContaining([
        'Custom pathway name is required.',
        'Custom pathway description is required.',
        'Explain why this custom pathway is needed.',
      ]),
    )
    expect(blankCustom().pathway.intermediateOutcomes).toHaveLength(1)
    expect(issues).toEqual(
      expect.arrayContaining([
        'Add a statement for Intermediate Outcome 1',
        'Add a Primary indicator for Intermediate Outcome 1',
        'Add an activity for Intermediate Outcome 1',
      ]),
    )
  })

  it('adds, edits and reorders custom Intermediate Outcomes without losing attached records', () => {
    let state = withCustom(completeCustom())
    state = projectDesignReducer(state, {
      type: 'addCustomIntermediateOutcome',
      intermediateOutcome: createBlankCustomIntermediateOutcome(2),
    })
    const firstId = state.customInnovation?.pathway.intermediateOutcomes[0]?.id
    const secondId = state.customInnovation?.pathway.intermediateOutcomes[1]?.id
    if (!firstId || !secondId) {
      throw new Error('Expected two custom Intermediate Outcomes.')
    }

    state = projectDesignReducer(state, {
      type: 'updateCustomIntermediateOutcome',
      intermediateOutcomeId: secondId,
      payload: { statement: 'Producers form a seed cooperative.' },
    })
    state = projectDesignReducer(state, {
      type: 'addCustomIoActivity',
      intermediateOutcomeId: firstId,
      activity: {
        id: 'kept-activity',
        wording: 'Facilitate producer meetings',
        projectDetails: 'Monthly',
      },
    })
    state = projectDesignReducer(state, {
      type: 'addCustomIoInput',
      intermediateOutcomeId: firstId,
      input: {
        id: 'kept-input',
        inputCategoryId: 'training-facilitation',
        details: 'Facilitator time',
      },
    })
    state = projectDesignReducer(state, {
      type: 'addCustomIoAdditionalIndicator',
      intermediateOutcomeId: firstId,
      indicator: {
        id: 'kept-indicator',
        wording: 'Number of meetings held',
        measurementNotes: '',
      },
    })
    const reordered = projectDesignReducer(state, {
      type: 'moveCustomIntermediateOutcome',
      intermediateOutcomeId: firstId,
      direction: 'down',
    })
    const outcomes = reordered.customInnovation?.pathway.intermediateOutcomes
    expect(outcomes?.map((outcome) => outcome.id)).toEqual([secondId, firstId])
    expect(outcomes?.map((outcome) => outcome.stepNumber)).toEqual([1, 2])
    expect(outcomes?.[1]?.id).toBe(firstId)
    expect(outcomes?.[1]?.activities.map((activity) => activity.id)).toEqual(
      expect.arrayContaining(['custom-act-1', 'kept-activity']),
    )
    expect(outcomes?.[1]?.inputs[0]?.id).toBe('kept-input')
    expect(outcomes?.[1]?.additionalIndicators[0]?.id).toBe('kept-indicator')
    expect(outcomes?.[1]?.statement).toBe(
      'Local seed producers increase quality supply.',
    )
  })

  it('deletes an Intermediate Outcome and its attached records, but not the last remaining one', () => {
    let state = withCustom(completeCustom())
    state = projectDesignReducer(state, {
      type: 'addCustomIntermediateOutcome',
      intermediateOutcome: {
        ...createBlankCustomIntermediateOutcome(2),
        id: 'custom-io-2',
        statement: 'Second step',
        primaryIndicator: {
          id: 'custom-io-ind-2',
          wording: 'Second indicator',
          measurementNotes: '',
        },
      },
    })
    const firstId = 'custom-io-1'
    state = projectDesignReducer(state, {
      type: 'addCustomIoActivity',
      intermediateOutcomeId: firstId,
      activity: {
        id: 'orphan-activity',
        wording: 'Should be removed',
        projectDetails: '',
      },
    })
    const afterDelete = projectDesignReducer(state, {
      type: 'deleteCustomIntermediateOutcome',
      intermediateOutcomeId: firstId,
    })
    expect(afterDelete.customInnovation?.pathway.intermediateOutcomes).toHaveLength(
      1,
    )
    expect(
      afterDelete.customInnovation?.pathway.intermediateOutcomes[0]?.id,
    ).toBe('custom-io-2')
    expect(
      JSON.stringify(afterDelete.customInnovation),
    ).not.toContain('orphan-activity')

    const lastRemaining = afterDelete.customInnovation?.pathway.intermediateOutcomes[0]
    if (!lastRemaining) throw new Error('Expected one remaining Intermediate Outcome.')
    const attemptedLastDelete = projectDesignReducer(afterDelete, {
      type: 'deleteCustomIntermediateOutcome',
      intermediateOutcomeId: lastRemaining.id,
    })
    expect(
      attemptedLastDelete.customInnovation?.pathway.intermediateOutcomes,
    ).toHaveLength(1)
    expect(
      attemptedLastDelete.customInnovation?.pathway.intermediateOutcomes[0]?.id,
    ).toBe(lastRemaining.id)
  })

  it('removes the full custom chain without affecting standard selections', () => {
    const withStandard = projectDesignReducer(initialProjectDesignState, {
      type: 'addPathway',
      finalOutcomeId: 'FO_A',
      pathwayId: 'PW_X',
      relationshipType: 'primary',
      frameworkPrimaryFinalOutcomeId: 'FO_A',
      intermediateOutcomes: [
        {
          frameworkIntermediateOutcomeId: 'IO_1',
          primaryIndicatorId: 'IND_PRIMARY_1',
        },
      ],
    })
    const withBoth = withCustom(completeCustom(), withStandard)
    const removed = projectDesignReducer(withBoth, {
      type: 'removeCustomInnovation',
    })
    expect(removed.customInnovation).toBeNull()
    expect(removed.selectedFinalOutcomeIds).toEqual(['FO_A'])
    expect(removed.projectPathways).toHaveLength(1)
    expect(removed.outcomePathwayLinks).toHaveLength(1)
  })

  it('does not modify framework reference data when custom content is created', () => {
    const outcomeCount = framework.finalOutcomes.length
    const pathwayCount = framework.pathways.length
    const indicatorCount = framework.indicators.length
    withCustom(completeCustom())
    expect(framework.finalOutcomes).toHaveLength(outcomeCount)
    expect(framework.pathways).toHaveLength(pathwayCount)
    expect(framework.indicators).toHaveLength(indicatorCount)
    expect(
      framework.finalOutcomes.some((outcome) => outcome.id === 'custom-fo-1'),
    ).toBe(false)
    expect(framework.pathways.some((pathway) => pathway.id === 'custom-pw-1')).toBe(
      false,
    )
  })

  it('treats 2–5 Intermediate Outcomes as guidance rather than a maximum', () => {
    const custom = completeCustom()
    const extraOutcomes = [2, 3, 4, 5, 6].map((step) => ({
      ...createBlankCustomIntermediateOutcome(step),
      statement: `Change ${step}`,
      primaryIndicator: {
        id: `custom-io-ind-${step}`,
        wording: `Indicator ${step}`,
        measurementNotes: '',
      },
      activities: [
        {
          id: `custom-act-${step}`,
          wording: `Activity ${step}`,
          projectDetails: '',
        },
      ],
    }))
    const withSix = {
      ...custom,
      pathway: {
        ...custom.pathway,
        intermediateOutcomes: [
          ...custom.pathway.intermediateOutcomes,
          ...extraOutcomes,
        ],
      },
    }
    const validation = getCustomInnovationValidation(withSix)
    expect(withSix.pathway.intermediateOutcomes).toHaveLength(6)
    expect(validation.complete).toBe(true)
    expect(validation.issues.join(' ')).not.toMatch(/maximum|at most 5|no more than 5/i)
  })

  it('lists a missing Intermediate Outcome as a specific completion issue', () => {
    const custom = completeCustom()
    const withoutIos = {
      ...custom,
      pathway: { ...custom.pathway, intermediateOutcomes: [] },
    }
    expect(getCustomInnovationValidation(withoutIos).issues).toContain(
      'Add at least one Intermediate Outcome',
    )
  })

  it('requires at least one activity on every Custom Intermediate Outcome', () => {
    const custom = completeCustom()
    const firstIo = custom.pathway.intermediateOutcomes[0]
    if (!firstIo) throw new Error('Expected a custom Intermediate Outcome.')
    const withoutActivity = {
      ...custom,
      pathway: {
        ...custom.pathway,
        intermediateOutcomes: [{ ...firstIo, activities: [] }],
      },
    }
    const validation = getCustomInnovationValidation(withoutActivity)
    expect(validation.complete).toBe(false)
    expect(validation.issues).toContain(
      'Add an activity for Intermediate Outcome 1',
    )
  })
})
