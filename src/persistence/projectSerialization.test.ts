import { describe, expect, it } from 'vitest'
import frameworkJson from '../data/framework-v1.0-normalized.json'
import {
  getPathwayIntermediateOutcomeSeeds,
  getSuggestedActivitiesForIntermediateOutcome,
} from '../services/frameworkService'
import {
  initialProjectDesignState,
  projectDesignReducer,
} from '../state/projectDesign'
import { generateTheoryOfChangeGraph } from '../theoryOfChange/generateTheoryOfChangeGraph'
import type { FrameworkData } from '../types/framework'
import type {
  CustomInnovationOutcome,
  ProjectDesignState,
} from '../types/project'
import { loadPersistedProject, serializeProject } from './projectSerialization'

const framework = frameworkJson as FrameworkData

function relatedPathwayState(): ProjectDesignState {
  const relatedLink = framework.finalOutcomePathwayLinks.find(
    (link) => link.appSelectable && link.pathwayRelationshipType === 'related',
  )
  if (!relatedLink) throw new Error('Expected a Related pathway fixture.')
  const pathway = framework.pathways.find(
    (candidate) => candidate.id === relatedLink.pathwayId,
  )
  if (!pathway) throw new Error('Expected a pathway fixture.')
  let state = projectDesignReducer(initialProjectDesignState, {
    type: 'selectFinalOutcome',
    finalOutcomeId: relatedLink.finalOutcomeId,
  })
  state = projectDesignReducer(state, {
    type: 'addPathway',
    finalOutcomeId: relatedLink.finalOutcomeId,
    pathwayId: pathway.id,
    relationshipType: 'related',
    frameworkPrimaryFinalOutcomeId: pathway.primaryFinalOutcomeId,
    intermediateOutcomes: getPathwayIntermediateOutcomeSeeds(
      framework,
      pathway.id,
    ),
  })
  return {
    ...state,
    metadata: {
      title: 'Persisted project',
      country: 'Uganda',
      donor: 'Example donor',
      fundingReference: 'FUND-42',
      projectManager: 'Project manager',
      plannedStartDate: '2026-10',
      plannedEndDate: '2028-09',
      description: 'A project used to verify persistence.',
      plannedSelfHelpGroupCount: null,
    },
    lastSavedAt: '2026-09-14T20:00:00.000Z',
  }
}

function customInnovation(): CustomInnovationOutcome {
  const impact = framework.impacts.find((candidate) => candidate.active)
  if (!impact) throw new Error('Expected an Impact fixture.')
  return {
    id: 'CUSTOM_FO',
    isCustom: true,
    shortLabel: 'Custom outcome',
    statement: 'A complete custom Final Outcome.',
    rationale: 'The framework does not otherwise represent this change.',
    impactAreaIds: [impact.id],
    primaryIndicator: {
      id: 'CUSTOM_FO_IND',
      wording: 'Custom outcome indicator',
      measurementNotes: 'Measured annually.',
    },
    pathway: {
      id: 'CUSTOM_PW',
      isCustom: true,
      name: 'Custom pathway',
      description: 'A project-owned pathway.',
      rationale: 'Needed for this context.',
      intermediateOutcomes: [
        {
          id: 'CUSTOM_IO',
          isCustom: true,
          stepNumber: 1,
          statement: 'Partners can apply the new approach.',
          primaryIndicator: {
            id: 'CUSTOM_IO_IND',
            wording: 'Partners applying the approach',
            measurementNotes: 'Counted quarterly.',
          },
          additionalIndicators: [
            {
              id: 'CUSTOM_IO_ADD',
              wording: 'Quality score',
              measurementNotes: 'Reviewed annually.',
            },
          ],
          activities: [
            {
              id: 'CUSTOM_ACTIVITY',
              wording: 'Coach partners',
              projectDetails: 'Provide practical support.',
              plannedQuantity: null,
              outputUnitSelection: null,
              customOutputUnit: null,
              useProjectSelfHelpGroupTotal: false,
              outputTextOverride: null,
            },
          ],
          inputs: [
            {
              id: 'CUSTOM_INPUT',
              inputCategoryId: 'training-facilitation',
              details: 'Facilitator time',
            },
          ],
        },
      ],
    },
  }
}

describe('project persistence serialization', () => {
  it('serializes and deserializes meaningful project state equivalently', () => {
    const state = relatedPathwayState()
    const document = serializeProject({
      id: 'PROJECT_1',
      projectCode: 'P-001',
      status: 'Draft',
      design: state,
      framework,
    })
    const loaded = loadPersistedProject(document, framework)

    expect(loaded.design).toEqual({ ...state, lastSavedAt: null })
    expect(loaded.document.project).toEqual(
      expect.objectContaining({
        id: 'PROJECT_1',
        name: 'Persisted project',
        country: 'Uganda',
        projectCode: 'P-001',
      }),
    )
  })

  it('persists bulk-selected suggested activities as standard activity selections', () => {
    const state = relatedPathwayState()
    const pathway = state.projectPathways[0]
    const configuration = pathway?.intermediateOutcomeConfigurations.find(
      (candidate) =>
        getSuggestedActivitiesForIntermediateOutcome(
          framework,
          candidate.frameworkIntermediateOutcomeId,
        ).length > 1,
    )
    if (!pathway || !configuration) {
      throw new Error('Expected an Intermediate Outcome with suggested activities.')
    }
    const activityIds = getSuggestedActivitiesForIntermediateOutcome(
      framework,
      configuration.frameworkIntermediateOutcomeId,
    ).map((activity) => activity.id)
    const selected = projectDesignReducer(state, {
      type: 'setSuggestedActivities',
      pathwayId: pathway.pathwayId,
      intermediateOutcomeId: configuration.frameworkIntermediateOutcomeId,
      frameworkActivityIds: activityIds,
      selected: true,
    })
    const document = serializeProject({
      id: 'PROJECT_1',
      status: 'Draft',
      design: selected,
      framework,
    })
    const loaded = loadPersistedProject(document, framework)
    const persisted =
      document.design.projectPathways[0]?.intermediateOutcomeConfigurations.find(
        (candidate) =>
          candidate.frameworkIntermediateOutcomeId ===
          configuration.frameworkIntermediateOutcomeId,
      )?.standardActivities
    const loadedActivities =
      loaded.design.projectPathways[0]?.intermediateOutcomeConfigurations.find(
        (candidate) =>
          candidate.frameworkIntermediateOutcomeId ===
          configuration.frameworkIntermediateOutcomeId,
      )?.standardActivities

    expect(persisted).toEqual(
      activityIds.map((frameworkActivityId) => ({
        frameworkActivityId,
        projectNotes: '',
        plannedQuantity: null,
        outputUnitSelection: null,
        customOutputUnit: null,
        useProjectSelfHelpGroupTotal: false,
        outputTextOverride: null,
      })),
    )
    expect(loadedActivities).toEqual(persisted)
    expect(JSON.stringify(persisted)).not.toContain('selectedTab')
  })

  it('preserves two distinct custom activities and their output configurations', () => {
    let state = relatedPathwayState()
    state = projectDesignReducer(state, {
      type: 'updateMetadata',
      payload: { plannedSelfHelpGroupCount: 50 },
    })
    const pathway = state.projectPathways[0]
    const configuration =
      pathway?.intermediateOutcomeConfigurations[0]
    if (!pathway || !configuration) {
      throw new Error('Expected a pathway configuration.')
    }
    state = projectDesignReducer(state, {
      type: 'addProjectSpecificActivity',
      pathwayId: pathway.pathwayId,
      intermediateOutcomeId:
        configuration.frameworkIntermediateOutcomeId,
      activity: {
        id: 'CUSTOM_ACTIVITY_1',
        wording: 'Facilitate local planning',
        projectDetails: 'First activity notes',
        plannedQuantity: 5,
        outputUnitSelection: 'events',
        customOutputUnit: null,
        useProjectSelfHelpGroupTotal: false,
        outputTextOverride: 'Five planning sessions delivered',
      },
    })
    state = projectDesignReducer(state, {
      type: 'addProjectSpecificActivity',
      pathwayId: pathway.pathwayId,
      intermediateOutcomeId:
        configuration.frameworkIntermediateOutcomeId,
      activity: {
        id: 'CUSTOM_ACTIVITY_2',
        wording: 'Coach producer groups',
        projectDetails: 'Second activity notes',
        plannedQuantity: 50,
        outputUnitSelection: 'self-help-groups',
        customOutputUnit: null,
        useProjectSelfHelpGroupTotal: true,
        outputTextOverride: 'Fifty groups coached',
      },
    })
    const document = serializeProject({
      id: 'PROJECT_1',
      status: 'Draft',
      design: state,
      framework,
    })
    const loaded = loadPersistedProject(document, framework).design
    const loadedActivities =
      loaded.projectPathways[0]?.intermediateOutcomeConfigurations[0]
        ?.projectSpecificActivities

    expect(loadedActivities).toEqual([
      expect.objectContaining({
        id: 'CUSTOM_ACTIVITY_1',
        wording: 'Facilitate local planning',
        projectDetails: 'First activity notes',
        plannedQuantity: 5,
        outputUnitSelection: 'events',
        outputTextOverride: 'Five planning sessions delivered',
      }),
      expect.objectContaining({
        id: 'CUSTOM_ACTIVITY_2',
        wording: 'Coach producer groups',
        projectDetails: 'Second activity notes',
        plannedQuantity: 50,
        outputUnitSelection: 'self-help-groups',
        useProjectSelfHelpGroupTotal: true,
        outputTextOverride: 'Fifty groups coached',
      }),
    ])
  })

  it('excludes UI-only and derived presentation state', () => {
    const state = {
      ...relatedPathwayState(),
      selectedTab: 'details',
      graphViewport: { x: 10, y: 20, zoom: 0.8 },
    } as ProjectDesignState
    const document = serializeProject({
      id: 'PROJECT_1',
      status: 'Draft',
      design: state,
      framework,
    })
    const json = JSON.stringify(document)

    expect(json).not.toContain('selectedTab')
    expect(json).not.toContain('graphViewport')
    expect(json).not.toContain('lastSavedAt')
    expect(json).not.toContain('TocGraphModel')
  })

  it('preserves Custom Innovation content in full', () => {
    const state = {
      ...relatedPathwayState(),
      customInnovation: customInnovation(),
    }
    const document = serializeProject({
      id: 'PROJECT_1',
      status: 'Draft',
      design: state,
      framework,
    })

    expect(
      loadPersistedProject(document, framework).design.customInnovation,
    ).toEqual(state.customInnovation)
  })

  it('preserves Related pathways and reproduces auto-added Final Outcomes', () => {
    const state = relatedPathwayState()
    const document = serializeProject({
      id: 'PROJECT_1',
      status: 'Draft',
      design: state,
      framework,
    })
    const loaded = loadPersistedProject(document, framework).design

    expect(loaded.outcomePathwayLinks).toEqual(state.outcomePathwayLinks)
    expect(loaded.finalOutcomeSelectionSources).toEqual(
      state.finalOutcomeSelectionSources,
    )
    expect(generateTheoryOfChangeGraph({ project: loaded, framework })).toEqual(
      generateTheoryOfChangeGraph({ project: state, framework }),
    )
  })

  it('retains framework and persistence schema versions', () => {
    const document = serializeProject({
      id: 'PROJECT_1',
      status: 'Draft',
      design: relatedPathwayState(),
      framework,
    })

    expect(document.schemaVersion).toBe(1)
    expect(document.frameworkVersion).toBe(framework.frameworkVersion)
    expect(document.frameworkSchemaVersion).toBe(framework.schemaVersion)
  })

  it('rejects unsupported project schema versions safely', () => {
    const document = serializeProject({
      id: 'PROJECT_1',
      status: 'Draft',
      design: relatedPathwayState(),
      framework,
    })

    expect(() =>
      loadPersistedProject({ ...document, schemaVersion: 2 }, framework),
    ).toThrowError(
      expect.objectContaining({
        code: 'unsupported-schema',
      }),
    )
  })

  it('rejects malformed persisted data safely', () => {
    expect(() =>
      loadPersistedProject({ schemaVersion: 1, project: {} }, framework),
    ).toThrowError(
      expect.objectContaining({
        code: 'malformed-data',
      }),
    )
  })

  it('blocks incompatible framework versions rather than guessing', () => {
    const document = serializeProject({
      id: 'PROJECT_1',
      status: 'Draft',
      design: relatedPathwayState(),
      framework,
    })

    expect(() =>
      loadPersistedProject(
        { ...document, frameworkVersion: 'unavailable-version' },
        framework,
      ),
    ).toThrowError(
      expect.objectContaining({
        code: 'framework-incompatible',
      }),
    )
  })
})
