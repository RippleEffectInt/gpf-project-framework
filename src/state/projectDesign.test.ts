import { describe, expect, it } from 'vitest'
import type {
  PathwayRelationshipType,
  ProjectDesignState,
} from '../types/project'
import {
  getMissingActivityCompletionMessages,
  getPathwayConfigurationStatus,
  getSelectedPrimaryPathwayCount,
  hasRequiredPrimaryPathways,
  initialProjectDesignState,
  intermediateOutcomeHasRequiredActivity,
  projectDesignReducer,
  type ProjectDesignAction,
} from './projectDesign'

const intermediateOutcomes = [
  {
    frameworkIntermediateOutcomeId: 'IO_1',
    primaryIndicatorId: 'IND_PRIMARY_1',
  },
  {
    frameworkIntermediateOutcomeId: 'IO_2',
    primaryIndicatorId: 'IND_PRIMARY_2',
  },
]

function addPathway(
  state: ProjectDesignState,
  finalOutcomeId = 'FO_A',
  relationshipType: PathwayRelationshipType = 'primary',
  frameworkPrimaryFinalOutcomeId =
    relationshipType === 'primary' ? finalOutcomeId : 'FO_A',
): ProjectDesignState {
  return projectDesignReducer(state, {
    type: 'addPathway',
    finalOutcomeId,
    pathwayId: 'PW_X',
    relationshipType,
    frameworkPrimaryFinalOutcomeId,
    intermediateOutcomes,
  })
}

function configuration(state: ProjectDesignState) {
  const result =
    state.projectPathways[0]?.intermediateOutcomeConfigurations[0]
  if (!result) throw new Error('Expected pathway configuration in test.')
  return result
}

describe('project design selection and pathway configuration', () => {
  it('selects a final outcome only once', () => {
    const selected = projectDesignReducer(initialProjectDesignState, {
      type: 'selectFinalOutcome',
      finalOutcomeId: 'FO_A',
    })
    const selectedAgain = projectDesignReducer(selected, {
      type: 'selectFinalOutcome',
      finalOutcomeId: 'FO_A',
    })

    expect(selectedAgain.selectedFinalOutcomeIds).toEqual(['FO_A'])
    expect(selectedAgain.finalOutcomeSelectionSources).toEqual({
      FO_A: 'direct',
    })
  })

  it('adds one pathway with its complete seeded configuration and link', () => {
    const result = addPathway(initialProjectDesignState)

    expect(result.projectPathways).toHaveLength(1)
    expect(result.projectPathways[0]?.intermediateOutcomeConfigurations).toHaveLength(2)
    expect(result.outcomePathwayLinks).toEqual([
      {
        finalOutcomeId: 'FO_A',
        pathwayId: 'PW_X',
        relationshipType: 'primary',
      },
    ])
  })

  it('does not duplicate an existing pathway or outcome link when added again', () => {
    const firstAddition = addPathway(initialProjectDesignState)
    const repeatedAddition = addPathway(firstAddition)

    expect(repeatedAddition.projectPathways).toHaveLength(1)
    expect(repeatedAddition.outcomePathwayLinks).toHaveLength(1)
    expect(repeatedAddition.projectPathways[0]).toBe(
      firstAddition.projectPathways[0],
    )
  })

  it('has no action that removes an individual standard intermediate outcome', () => {
    const state = addPathway(initialProjectDesignState)
    const unsupportedAction = {
      type: 'removeIntermediateOutcome',
      pathwayId: 'PW_X',
      intermediateOutcomeId: 'IO_1',
    } as unknown as ProjectDesignAction

    expect(projectDesignReducer(state, unsupportedAction)).toBe(state)
    expect(state.projectPathways[0]?.intermediateOutcomeConfigurations).toHaveLength(2)
  })

  it('automatically includes the mandatory Primary indicator and cannot deselect it', () => {
    const state = addPathway(initialProjectDesignState)
    const attemptedDeselection = projectDesignReducer(state, {
      type: 'setAdditionalIndicator',
      pathwayId: 'PW_X',
      intermediateOutcomeId: 'IO_1',
      frameworkIndicatorId: 'IND_PRIMARY_1',
      selected: false,
    })

    expect(configuration(attemptedDeselection).primaryIndicator).toEqual({
      frameworkIndicatorId: 'IND_PRIMARY_1',
      role: 'primary',
      mandatory: true,
    })
  })

  it('selects and deselects an optional additional indicator', () => {
    const state = addPathway(initialProjectDesignState)
    const selected = projectDesignReducer(state, {
      type: 'setAdditionalIndicator',
      pathwayId: 'PW_X',
      intermediateOutcomeId: 'IO_1',
      frameworkIndicatorId: 'IND_ADDITIONAL',
      selected: true,
    })
    const deselected = projectDesignReducer(selected, {
      type: 'setAdditionalIndicator',
      pathwayId: 'PW_X',
      intermediateOutcomeId: 'IO_1',
      frameworkIndicatorId: 'IND_ADDITIONAL',
      selected: false,
    })

    expect(configuration(selected).additionalIndicators).toHaveLength(1)
    expect(configuration(deselected).additionalIndicators).toEqual([])
  })

  it('adds, edits and deletes a project-specific indicator', () => {
    const state = addPathway(initialProjectDesignState)
    const added = projectDesignReducer(state, {
      type: 'addProjectSpecificIndicator',
      pathwayId: 'PW_X',
      intermediateOutcomeId: 'IO_1',
      indicator: { id: 'custom-ind', wording: 'Initial', measurementNotes: '' },
    })
    const edited = projectDesignReducer(added, {
      type: 'updateProjectSpecificIndicator',
      pathwayId: 'PW_X',
      intermediateOutcomeId: 'IO_1',
      indicator: {
        id: 'custom-ind',
        wording: 'Updated',
        measurementNotes: 'Definition',
      },
    })
    const deleted = projectDesignReducer(edited, {
      type: 'deleteProjectSpecificIndicator',
      pathwayId: 'PW_X',
      intermediateOutcomeId: 'IO_1',
      indicatorId: 'custom-ind',
    })

    expect(configuration(edited).projectSpecificIndicators[0]?.wording).toBe(
      'Updated',
    )
    expect(configuration(deleted).projectSpecificIndicators).toEqual([])
  })

  it('selects and deselects a standard suggested activity', () => {
    const state = addPathway(initialProjectDesignState)
    const selected = projectDesignReducer(state, {
      type: 'setStandardActivity',
      pathwayId: 'PW_X',
      intermediateOutcomeId: 'IO_1',
      frameworkActivityId: 'ACT_1',
      selected: true,
    })
    const deselected = projectDesignReducer(selected, {
      type: 'setStandardActivity',
      pathwayId: 'PW_X',
      intermediateOutcomeId: 'IO_1',
      frameworkActivityId: 'ACT_1',
      selected: false,
    })

    expect(configuration(selected).standardActivities).toEqual([
      { frameworkActivityId: 'ACT_1', projectNotes: '' },
    ])
    expect(configuration(deselected).standardActivities).toEqual([])
  })

  it('stores only the framework activity ID and editable project notes', () => {
    const selected = projectDesignReducer(addPathway(initialProjectDesignState), {
      type: 'setStandardActivity',
      pathwayId: 'PW_X',
      intermediateOutcomeId: 'IO_1',
      frameworkActivityId: 'ACT_1',
      selected: true,
    })
    const withNotes = projectDesignReducer(selected, {
      type: 'updateStandardActivityNotes',
      pathwayId: 'PW_X',
      intermediateOutcomeId: 'IO_1',
      frameworkActivityId: 'ACT_1',
      projectNotes: 'Use two facilitators',
    })

    expect(configuration(withNotes).standardActivities[0]).toEqual({
      frameworkActivityId: 'ACT_1',
      projectNotes: 'Use two facilitators',
    })
    expect(configuration(withNotes).standardActivities[0]).not.toHaveProperty(
      'wording',
    )
  })

  it('adds, edits and deletes a project-specific activity', () => {
    const state = addPathway(initialProjectDesignState)
    const added = projectDesignReducer(state, {
      type: 'addProjectSpecificActivity',
      pathwayId: 'PW_X',
      intermediateOutcomeId: 'IO_1',
      activity: { id: 'custom-act', wording: 'Initial', projectDetails: '' },
    })
    const edited = projectDesignReducer(added, {
      type: 'updateProjectSpecificActivity',
      pathwayId: 'PW_X',
      intermediateOutcomeId: 'IO_1',
      activity: {
        id: 'custom-act',
        wording: 'Updated',
        projectDetails: 'Local details',
      },
    })
    const deleted = projectDesignReducer(edited, {
      type: 'deleteProjectSpecificActivity',
      pathwayId: 'PW_X',
      intermediateOutcomeId: 'IO_1',
      activityId: 'custom-act',
    })

    expect(configuration(edited).projectSpecificActivities[0]?.wording).toBe(
      'Updated',
    )
    expect(configuration(deleted).projectSpecificActivities).toEqual([])
  })

  it('adds, edits and deletes inputs', () => {
    const state = addPathway(initialProjectDesignState)
    const added = projectDesignReducer(state, {
      type: 'addInput',
      pathwayId: 'PW_X',
      intermediateOutcomeId: 'IO_1',
      input: {
        id: 'input-1',
        inputCategoryId: 'training-facilitation',
        details: 'Initial',
      },
    })
    const edited = projectDesignReducer(added, {
      type: 'updateInput',
      pathwayId: 'PW_X',
      intermediateOutcomeId: 'IO_1',
      input: {
        id: 'input-1',
        inputCategoryId: 'training-facilitation',
        details: 'Updated',
      },
    })
    const deleted = projectDesignReducer(edited, {
      type: 'deleteInput',
      pathwayId: 'PW_X',
      intermediateOutcomeId: 'IO_1',
      inputId: 'input-1',
    })

    expect(configuration(edited).inputs[0]?.details).toBe('Updated')
    expect(configuration(deleted).inputs).toEqual([])
  })

  it('keeps one pathway configuration when linked to a second outcome', () => {
    const firstLink = addPathway(initialProjectDesignState)
    const secondLink = addPathway(firstLink, 'FO_B', 'related')

    expect(secondLink.projectPathways).toHaveLength(1)
    expect(secondLink.projectPathways[0]).toBe(firstLink.projectPathways[0])
    expect(secondLink.outcomePathwayLinks).toHaveLength(2)
  })

  it('does not duplicate community extension when linked to multiple outcomes', () => {
    const firstLink = projectDesignReducer(initialProjectDesignState, {
      type: 'addPathway',
      finalOutcomeId: 'FO_001',
      pathwayId: 'PW_028',
      relationshipType: 'related',
      frameworkPrimaryFinalOutcomeId: 'FO_024',
      intermediateOutcomes,
    })
    const secondLink = projectDesignReducer(firstLink, {
      type: 'addPathway',
      finalOutcomeId: 'FO_024',
      pathwayId: 'PW_028',
      relationshipType: 'primary',
      frameworkPrimaryFinalOutcomeId: 'FO_024',
      intermediateOutcomes,
    })

    expect(secondLink.projectPathways).toHaveLength(1)
    expect(secondLink.outcomePathwayLinks).toEqual([
      {
        finalOutcomeId: 'FO_001',
        pathwayId: 'PW_028',
        relationshipType: 'related',
      },
      {
        finalOutcomeId: 'FO_024',
        pathwayId: 'PW_028',
        relationshipType: 'primary',
      },
    ])
  })

  it('adds a Related pathway Primary Final Outcome once with auto provenance', () => {
    const result = addPathway(
      initialProjectDesignState,
      'FO_A',
      'related',
      'FO_B',
    )
    const repeated = addPathway(result, 'FO_A', 'related', 'FO_B')

    expect(repeated.selectedFinalOutcomeIds).toEqual(['FO_A', 'FO_B'])
    expect(repeated.finalOutcomeSelectionSources).toEqual({
      FO_A: 'direct',
      FO_B: 'related-pathway',
    })
    expect(repeated.projectPathways).toHaveLength(1)
    expect(repeated.outcomePathwayLinks).toEqual([
      {
        finalOutcomeId: 'FO_A',
        pathwayId: 'PW_X',
        relationshipType: 'related',
      },
      {
        finalOutcomeId: 'FO_B',
        pathwayId: 'PW_X',
        relationshipType: 'primary',
      },
    ])
    expect(getSelectedPrimaryPathwayCount(repeated, 'FO_B')).toBe(1)
  })

  it('does not downgrade an existing direct Final Outcome when linking a Related pathway', () => {
    const directPrimary = projectDesignReducer(initialProjectDesignState, {
      type: 'selectFinalOutcome',
      finalOutcomeId: 'FO_B',
    })
    const result = addPathway(directPrimary, 'FO_A', 'related', 'FO_B')

    expect(result.selectedFinalOutcomeIds).toEqual(['FO_B', 'FO_A'])
    expect(result.finalOutcomeSelectionSources.FO_B).toBe('direct')
    expect(
      result.selectedFinalOutcomeIds.filter((id) => id === 'FO_B'),
    ).toHaveLength(1)
  })

  it('removes a purely auto-added orphan when its Related link is removed', () => {
    const state = addPathway(
      initialProjectDesignState,
      'FO_A',
      'related',
      'FO_B',
    )
    const result = projectDesignReducer(state, {
      type: 'removeOutcomePathwayLink',
      finalOutcomeId: 'FO_A',
      pathwayId: 'PW_X',
    })

    expect(result.selectedFinalOutcomeIds).toEqual(['FO_A'])
    expect(result.finalOutcomeSelectionSources).toEqual({ FO_A: 'direct' })
    expect(result.outcomePathwayLinks).toEqual([])
    expect(result.projectPathways).toEqual([])
  })

  it('keeps a directly retained Final Outcome after its original Related link is removed', () => {
    const autoAdded = addPathway(
      initialProjectDesignState,
      'FO_A',
      'related',
      'FO_B',
    )
    const directlyRetained = projectDesignReducer(autoAdded, {
      type: 'addPathway',
      finalOutcomeId: 'FO_B',
      pathwayId: 'PW_Y',
      relationshipType: 'primary',
      frameworkPrimaryFinalOutcomeId: 'FO_B',
      intermediateOutcomes,
    })
    const result = projectDesignReducer(directlyRetained, {
      type: 'removeOutcomePathwayLink',
      finalOutcomeId: 'FO_A',
      pathwayId: 'PW_X',
    })

    expect(result.selectedFinalOutcomeIds).toEqual(['FO_A', 'FO_B'])
    expect(result.finalOutcomeSelectionSources.FO_B).toBe('direct')
    expect(result.projectPathways.map((item) => item.pathwayId)).toEqual([
      'PW_X',
      'PW_Y',
    ])
    expect(result.outcomePathwayLinks).toEqual([
      {
        finalOutcomeId: 'FO_B',
        pathwayId: 'PW_X',
        relationshipType: 'primary',
      },
      {
        finalOutcomeId: 'FO_B',
        pathwayId: 'PW_Y',
        relationshipType: 'primary',
      },
    ])
  })

  it('keeps one auto-added Final Outcome for two Related pathways with the same Primary outcome', () => {
    const first = addPathway(
      initialProjectDesignState,
      'FO_A',
      'related',
      'FO_B',
    )
    const second = projectDesignReducer(first, {
      type: 'addPathway',
      finalOutcomeId: 'FO_A',
      pathwayId: 'PW_Y',
      relationshipType: 'related',
      frameworkPrimaryFinalOutcomeId: 'FO_B',
      intermediateOutcomes,
    })

    expect(second.selectedFinalOutcomeIds).toEqual(['FO_A', 'FO_B'])
    expect(second.projectPathways).toHaveLength(2)
    expect(
      second.outcomePathwayLinks.filter(
        (link) =>
          link.finalOutcomeId === 'FO_B' &&
          link.relationshipType === 'primary',
      ),
    ).toHaveLength(2)
  })

  it('retains shared configuration when one outcome-pathway link is removed', () => {
    const shared = addPathway(
      addPathway(initialProjectDesignState),
      'FO_B',
      'related',
    )
    const configured = projectDesignReducer(shared, {
      type: 'addInput',
      pathwayId: 'PW_X',
      intermediateOutcomeId: 'IO_1',
      input: {
        id: 'input-1',
        inputCategoryId: 'other',
        details: 'Shared configuration',
      },
    })
    const result = projectDesignReducer(configured, {
      type: 'removeOutcomePathwayLink',
      finalOutcomeId: 'FO_B',
      pathwayId: 'PW_X',
    })

    expect(result.projectPathways).toHaveLength(1)
    expect(configuration(result).inputs[0]?.details).toBe(
      'Shared configuration',
    )
  })

  it('deletes pathway configuration when the final link is removed', () => {
    const state = addPathway(initialProjectDesignState)
    const result = projectDesignReducer(state, {
      type: 'removeOutcomePathwayLink',
      finalOutcomeId: 'FO_A',
      pathwayId: 'PW_X',
    })

    expect(result.projectPathways).toEqual([])
    expect(result.outcomePathwayLinks).toEqual([])
  })

  it('requires a Primary relationship and does not accept Related alone', () => {
    const relatedOnly = addPathway(
      initialProjectDesignState,
      'FO_A',
      'related',
    )
    const withPrimary = addPathway(
      {
        ...relatedOnly,
        projectPathways: [],
        outcomePathwayLinks: [],
      },
      'FO_A',
      'primary',
    )

    expect(hasRequiredPrimaryPathways(relatedOnly)).toBe(false)
    expect(hasRequiredPrimaryPathways(withPrimary)).toBe(true)
  })

  it('stores relationship type on each link rather than the pathway instance', () => {
    const state = addPathway(
      addPathway(initialProjectDesignState, 'FO_A', 'primary'),
      'FO_B',
      'related',
    )

    expect(state.outcomePathwayLinks.map((link) => link.relationshipType)).toEqual([
      'primary',
      'related',
    ])
    expect(state.projectPathways[0]).not.toHaveProperty('relationshipType')
  })

  it('reports not started, in progress and configured from activity and confirmation rules', () => {
    const notStarted = addPathway(initialProjectDesignState)
    const inProgress = projectDesignReducer(notStarted, {
      type: 'setAdditionalIndicator',
      pathwayId: 'PW_X',
      intermediateOutcomeId: 'IO_1',
      frameworkIndicatorId: 'IND_ADDITIONAL',
      selected: true,
    })
    const reviewedWithoutActivities = projectDesignReducer(inProgress, {
      type: 'setIntermediateOutcomeReviewed',
      pathwayId: 'PW_X',
      intermediateOutcomeId: 'IO_1',
      reviewed: true,
    })

    expect(getPathwayConfigurationStatus(notStarted.projectPathways[0]!)).toBe(
      'not-started',
    )
    expect(getPathwayConfigurationStatus(inProgress.projectPathways[0]!)).toBe(
      'in-progress',
    )
    expect(
      getPathwayConfigurationStatus(reviewedWithoutActivities.projectPathways[0]!),
    ).toBe('in-progress')
    expect(
      reviewedWithoutActivities.projectPathways[0]?.intermediateOutcomeConfigurations[0]
        ?.reviewed,
    ).toBe(false)
  })

  it('treats a standard Intermediate Outcome with zero activities as incomplete', () => {
    const state = addPathway(initialProjectDesignState)
    const first =
      state.projectPathways[0]?.intermediateOutcomeConfigurations[0]
    if (!first) throw new Error('Expected an Intermediate Outcome configuration.')
    expect(intermediateOutcomeHasRequiredActivity(first)).toBe(false)
    expect(getMissingActivityCompletionMessages(state.projectPathways[0]!)).toEqual([
      'Add an activity for Intermediate Outcome 1 before completing this pathway.',
      'Add an activity for Intermediate Outcome 2 before completing this pathway.',
    ])
  })

  it('accepts one suggested activity or one project-specific activity', () => {
    const notStarted = addPathway(initialProjectDesignState)
    const withSuggested = projectDesignReducer(notStarted, {
      type: 'setStandardActivity',
      pathwayId: 'PW_X',
      intermediateOutcomeId: 'IO_1',
      frameworkActivityId: 'ACT_1',
      selected: true,
    })
    const withProjectSpecific = projectDesignReducer(notStarted, {
      type: 'addProjectSpecificActivity',
      pathwayId: 'PW_X',
      intermediateOutcomeId: 'IO_1',
      activity: {
        id: 'act-custom',
        wording: 'Hold farmer field days',
        projectDetails: '',
      },
    })
    expect(
      intermediateOutcomeHasRequiredActivity(
        withSuggested.projectPathways[0]!.intermediateOutcomeConfigurations[0]!,
      ),
    ).toBe(true)
    expect(
      intermediateOutcomeHasRequiredActivity(
        withProjectSpecific.projectPathways[0]!.intermediateOutcomeConfigurations[0]!,
      ),
    ).toBe(true)
  })

  it('does not treat inputs or additional indicators as satisfying the activity requirement', () => {
    let state = addPathway(initialProjectDesignState)
    state = projectDesignReducer(state, {
      type: 'setAdditionalIndicator',
      pathwayId: 'PW_X',
      intermediateOutcomeId: 'IO_1',
      frameworkIndicatorId: 'IND_ADDITIONAL',
      selected: true,
    })
    state = projectDesignReducer(state, {
      type: 'addInput',
      pathwayId: 'PW_X',
      intermediateOutcomeId: 'IO_1',
      input: {
        id: 'inp-1',
        inputCategoryId: 'training-facilitation',
        details: 'Facilitator time',
      },
    })
    const first =
      state.projectPathways[0]?.intermediateOutcomeConfigurations[0]
    if (!first) throw new Error('Expected an Intermediate Outcome configuration.')
    expect(intermediateOutcomeHasRequiredActivity(first)).toBe(false)
    expect(getPathwayConfigurationStatus(state.projectPathways[0]!)).toBe(
      'in-progress',
    )
  })

  it('does not mark a pathway configured until every Intermediate Outcome has an activity', () => {
    const notStarted = addPathway(initialProjectDesignState)
    const blocked = projectDesignReducer(notStarted, {
      type: 'markPathwayConfigured',
      pathwayId: 'PW_X',
    })
    expect(
      blocked.projectPathways[0]?.intermediateOutcomeConfigurations.every(
        (item) => item.reviewed,
      ),
    ).toBe(false)
    expect(getPathwayConfigurationStatus(blocked.projectPathways[0]!)).toBe(
      'not-started',
    )

    let withActivities = notStarted
    notStarted.projectPathways[0]?.intermediateOutcomeConfigurations.forEach(
      (configuration, index) => {
        withActivities = projectDesignReducer(withActivities, {
          type: 'addProjectSpecificActivity',
          pathwayId: 'PW_X',
          intermediateOutcomeId: configuration.frameworkIntermediateOutcomeId,
          activity: {
            id: `act-${index}`,
            wording: 'Required activity',
            projectDetails: '',
          },
        })
      },
    )
    const configured = projectDesignReducer(withActivities, {
      type: 'markPathwayConfigured',
      pathwayId: 'PW_X',
    })
    expect(
      configured.projectPathways[0]?.intermediateOutcomeConfigurations.every(
        (item) => item.reviewed,
      ),
    ).toBe(true)
    expect(getPathwayConfigurationStatus(configured.projectPathways[0]!)).toBe(
      'configured',
    )
  })
})
