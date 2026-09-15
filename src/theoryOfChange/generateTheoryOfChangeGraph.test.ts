import { describe, expect, it } from 'vitest'
import {
  getPathwayIntermediateOutcomeSeeds,
} from '../services/frameworkService'
import {
  initialProjectDesignState,
  projectDesignReducer,
} from '../state/projectDesign'
import type { FrameworkData } from '../types/framework'
import type {
  CustomInnovationOutcome,
  PathwayRelationshipType,
  ProjectDesignState,
} from '../types/project'
import {
  generateTheoryOfChangeGraph,
  tocNodeId,
} from './generateTheoryOfChangeGraph'
import { layoutTheoryOfChangeGraph } from './layoutTheoryOfChangeGraph'

function frameworkFixture(): FrameworkData {
  return {
    schemaVersion: '1',
    frameworkVersion: 'test',
    status: 'active',
    publishedAt: '2026-01-01',
    thematicAreas: [
      { id: 'THEME', label: 'Theme', sortOrder: 1, active: true },
    ],
    impacts: [
      {
        id: 'IMP_1',
        theme: 'Income',
        statement: 'People achieve secure and resilient incomes.',
        active: true,
      },
    ],
    finalOutcomes: [
      {
        id: 'FO_1',
        thematicAreaId: 'THEME',
        shortLabel: 'Profitable markets',
        statement: 'Producers benefit from profitable markets.',
        primaryIndicatorIds: ['IND_FO_1'],
        additionalIndicatorIds: [],
        active: true,
      },
      {
        id: 'FO_2',
        thematicAreaId: 'THEME',
        shortLabel: 'Inclusive enterprises',
        statement: 'Enterprises provide inclusive opportunities.',
        primaryIndicatorIds: ['IND_FO_2'],
        additionalIndicatorIds: [],
        active: true,
      },
    ],
    finalOutcomeImpactLinks: [
      {
        id: 'FOI_1',
        finalOutcomeId: 'FO_1',
        impactId: 'IMP_1',
        relationshipRole: 'Primary',
      },
      {
        id: 'FOI_2',
        finalOutcomeId: 'FO_2',
        impactId: 'IMP_1',
        relationshipRole: 'Primary',
      },
    ],
    pathways: [
      {
        id: 'PW_1',
        thematicAreaId: 'THEME',
        name: 'Market access',
        description: 'Connect producers to profitable buyers.',
        primaryFinalOutcomeId: 'FO_1',
        intermediateOutcomeIds: ['IO_1', 'IO_2'],
        active: true,
      },
      {
        id: 'PW_2',
        thematicAreaId: 'THEME',
        name: 'Enterprise capacity',
        description: 'Strengthen enterprise capabilities.',
        primaryFinalOutcomeId: 'FO_1',
        intermediateOutcomeIds: ['IO_3'],
        active: true,
      },
    ],
    finalOutcomePathwayLinks: [
      {
        id: 'FOP_1',
        finalOutcomeId: 'FO_1',
        pathwayId: 'PW_1',
        pathwayRelationshipType: 'primary',
        relationshipType: 'Core',
        outcomeRole: 'Primary final outcome for this pathway',
        rationale: null,
        designCaution: null,
        appSelectable: true,
      },
      {
        id: 'FOP_2',
        finalOutcomeId: 'FO_2',
        pathwayId: 'PW_1',
        pathwayRelationshipType: 'related',
        relationshipType: 'Complementary',
        outcomeRole: 'Additional final outcome',
        rationale: null,
        designCaution: null,
        appSelectable: true,
      },
      {
        id: 'FOP_3',
        finalOutcomeId: 'FO_1',
        pathwayId: 'PW_2',
        pathwayRelationshipType: 'primary',
        relationshipType: 'Core',
        outcomeRole: 'Primary final outcome for this pathway',
        rationale: null,
        designCaution: null,
        appSelectable: true,
      },
    ],
    intermediateOutcomes: [
      {
        id: 'IO_2',
        pathwayId: 'PW_1',
        stepNumber: 2,
        statement: 'Producers negotiate with buyers.',
        primaryIndicatorIds: ['IND_IO_2'],
        additionalIndicatorIds: [],
        suggestedActivityIds: ['ACT_2'],
        active: true,
      },
      {
        id: 'IO_1',
        pathwayId: 'PW_1',
        stepNumber: 1,
        statement: 'Producers understand markets.',
        primaryIndicatorIds: ['IND_IO_1'],
        additionalIndicatorIds: ['IND_IO_ADD'],
        suggestedActivityIds: ['ACT_1'],
        active: true,
      },
      {
        id: 'IO_3',
        pathwayId: 'PW_2',
        stepNumber: 1,
        statement: 'Producers understand markets.',
        primaryIndicatorIds: ['IND_IO_3'],
        additionalIndicatorIds: [],
        suggestedActivityIds: [],
        active: true,
      },
    ],
    indicators: [
      {
        id: 'IND_FO_1',
        parentType: 'FinalOutcome',
        parentId: 'FO_1',
        text: 'Market outcome indicator',
        role: 'Primary',
        mandatory: true,
        active: true,
      },
      {
        id: 'IND_FO_2',
        parentType: 'FinalOutcome',
        parentId: 'FO_2',
        text: 'Enterprise outcome indicator',
        role: 'Primary',
        mandatory: true,
        active: true,
      },
      ...['1', '2', '3'].map((suffix) => ({
        id: `IND_IO_${suffix}`,
        parentType: 'IntermediateOutcome' as const,
        parentId: `IO_${suffix}`,
        text: `Intermediate indicator ${suffix}`,
        role: 'Primary' as const,
        mandatory: true,
        active: true,
      })),
      {
        id: 'IND_IO_ADD',
        parentType: 'IntermediateOutcome',
        parentId: 'IO_1',
        text: 'Additional market indicator',
        role: 'Additional',
        mandatory: false,
        active: true,
      },
    ],
    suggestedActivities: [
      {
        id: 'ACT_1',
        intermediateOutcomeId: 'IO_1',
        text: 'Research markets',
        sortOrder: 1,
        active: true,
      },
      {
        id: 'ACT_2',
        intermediateOutcomeId: 'IO_2',
        text: 'Meet buyers',
        sortOrder: 1,
        active: true,
      },
    ],
    inputCategories: [],
  }
}

function addPathway(
  state: ProjectDesignState,
  framework: FrameworkData,
  finalOutcomeId: string,
  pathwayId: string,
  relationshipType: PathwayRelationshipType,
): ProjectDesignState {
  const pathway = framework.pathways.find((item) => item.id === pathwayId)
  if (!pathway) throw new Error('Expected pathway fixture.')
  return projectDesignReducer(state, {
    type: 'addPathway',
    finalOutcomeId,
    pathwayId,
    relationshipType,
    frameworkPrimaryFinalOutcomeId: pathway.primaryFinalOutcomeId,
    intermediateOutcomes: getPathwayIntermediateOutcomeSeeds(
      framework,
      pathwayId,
    ),
  })
}

function standardState(framework: FrameworkData): ProjectDesignState {
  return addPathway(
    initialProjectDesignState,
    framework,
    'FO_1',
    'PW_1',
    'primary',
  )
}

function sharedState(framework: FrameworkData): ProjectDesignState {
  return addPathway(
    standardState(framework),
    framework,
    'FO_2',
    'PW_1',
    'related',
  )
}

function customInnovation(): CustomInnovationOutcome {
  return {
    id: 'CUSTOM_FO',
    isCustom: true,
    shortLabel: 'Local seed systems',
    statement: 'Farmers access reliable local seed systems.',
    rationale: 'The framework requires a locally specific branch.',
    impactAreaIds: ['IMP_1'],
    primaryIndicator: {
      id: 'CUSTOM_FO_IND',
      wording: 'Farmers using local seed systems',
      measurementNotes: 'Annual survey',
    },
    pathway: {
      id: 'CUSTOM_PW',
      isCustom: true,
      name: 'Strengthen seed systems',
      description: 'Build reliable local seed supply.',
      rationale: 'Local availability is constrained.',
      intermediateOutcomes: [
        {
          id: 'CUSTOM_IO_2',
          isCustom: true,
          stepNumber: 2,
          statement: 'Seed enterprises supply farmers.',
          primaryIndicator: {
            id: 'CUSTOM_IO_IND_2',
            wording: 'Enterprises supplying seed',
            measurementNotes: '',
          },
          additionalIndicators: [],
          activities: [
            {
              id: 'CUSTOM_ACT_2',
              wording: 'Coach seed enterprises',
              projectDetails: '',
            },
          ],
          inputs: [],
        },
        {
          id: 'CUSTOM_IO_1',
          isCustom: true,
          stepNumber: 1,
          statement: 'Seed enterprises improve production.',
          primaryIndicator: {
            id: 'CUSTOM_IO_IND_1',
            wording: 'Enterprises meeting quality standards',
            measurementNotes: '',
          },
          additionalIndicators: [],
          activities: [
            {
              id: 'CUSTOM_ACT_1',
              wording: 'Train seed producers',
              projectDetails: '',
            },
          ],
          inputs: [
            {
              id: 'CUSTOM_INPUT',
              inputCategoryId: 'training',
              details: 'Technical facilitators',
            },
          ],
        },
      ],
    },
  }
}

describe('Theory of Change graph generation', () => {
  const framework = frameworkFixture()

  it('generates one impact, Final Outcome, pathway and its Intermediate Outcomes', () => {
    const graph = generateTheoryOfChangeGraph({
      project: standardState(framework),
      framework,
    })
    expect(graph.frameworkVersion).toBe('test')
    expect(graph.frameworkSchemaVersion).toBe('1')
    expect(graph.summary).toEqual({
      impactCount: 1,
      finalOutcomeCount: 1,
      pathwayCount: 1,
      intermediateOutcomeCount: 2,
    })
  })

  it('uses explicit step numbers for the causal Intermediate Outcome order', () => {
    const graph = generateTheoryOfChangeGraph({
      project: standardState(framework),
      framework,
    })
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        source: tocNodeId('intermediateOutcome', 'IO_1', 'PW_1'),
        target: tocNodeId('intermediateOutcome', 'IO_2', 'PW_1'),
        relationshipType: 'intermediateOutcomeChain',
      }),
    )
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        source: tocNodeId('intermediateOutcome', 'IO_2', 'PW_1'),
        target: tocNodeId('pathway', 'PW_1'),
      }),
    )
  })

  it('de-duplicates identical impacts by identity', () => {
    const duplicatedFramework: FrameworkData = {
      ...framework,
      finalOutcomeImpactLinks: [
        ...framework.finalOutcomeImpactLinks,
        {
          ...framework.finalOutcomeImpactLinks[0]!,
          id: 'FOI_DUPLICATE',
        },
      ],
    }
    const graph = generateTheoryOfChangeGraph({
      project: standardState(duplicatedFramework),
      framework: duplicatedFramework,
    })
    expect(graph.nodes.filter((node) => node.type === 'impact')).toHaveLength(1)
  })

  it('de-duplicates repeated Final Outcome IDs', () => {
    const state = standardState(framework)
    const graph = generateTheoryOfChangeGraph({
      project: {
        ...state,
        selectedFinalOutcomeIds: ['FO_1', 'FO_1'],
      },
      framework,
    })
    expect(
      graph.nodes.filter((node) => node.type === 'finalOutcome'),
    ).toHaveLength(1)
  })

  it('de-duplicates repeated Project Pathway instances', () => {
    const state = standardState(framework)
    const pathway = state.projectPathways[0]!
    const graph = generateTheoryOfChangeGraph({
      project: {
        ...state,
        projectPathways: [pathway, pathway],
      },
      framework,
    })
    expect(graph.nodes.filter((node) => node.type === 'pathway')).toHaveLength(1)
  })

  it('renders a Primary-and-Related pathway as one pathway node', () => {
    const graph = generateTheoryOfChangeGraph({
      project: sharedState(framework),
      framework,
    })
    expect(graph.nodes.filter((node) => node.type === 'pathway')).toHaveLength(1)
  })

  it('classifies Primary pathway edges', () => {
    const graph = generateTheoryOfChangeGraph({
      project: standardState(framework),
      framework,
    })
    expect(
      graph.edges.filter((edge) => edge.relationshipType === 'primaryPathway'),
    ).toHaveLength(1)
  })

  it('classifies Related pathway edges', () => {
    const graph = generateTheoryOfChangeGraph({
      project: sharedState(framework),
      framework,
    })
    expect(
      graph.edges.filter((edge) => edge.relationshipType === 'relatedPathway'),
    ).toHaveLength(1)
  })

  it('renders an automatically included Primary Final Outcome as a real node', () => {
    const relatedOnly = addPathway(
      initialProjectDesignState,
      framework,
      'FO_2',
      'PW_1',
      'related',
    )
    const graph = generateTheoryOfChangeGraph({
      project: relatedOnly,
      framework,
    })
    expect(relatedOnly.finalOutcomeSelectionSources.FO_1).toBe(
      'related-pathway',
    )
    expect(
      graph.nodes.some(
        (node) => node.id === tocNodeId('finalOutcome', 'FO_1'),
      ),
    ).toBe(true)
  })

  it('links one Related pathway to both its Primary and Related outcomes', () => {
    const graph = generateTheoryOfChangeGraph({
      project: sharedState(framework),
      framework,
    })
    const pathwayEdges = graph.edges.filter((edge) =>
      ['primaryPathway', 'relatedPathway'].includes(edge.relationshipType),
    )
    expect(pathwayEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: tocNodeId('finalOutcome', 'FO_1'),
          relationshipType: 'primaryPathway',
        }),
        expect.objectContaining({
          target: tocNodeId('finalOutcome', 'FO_2'),
          relationshipType: 'relatedPathway',
        }),
      ]),
    )
  })

  it('does not duplicate a shared pathway configuration or chain', () => {
    const graph = generateTheoryOfChangeGraph({
      project: sharedState(framework),
      framework,
    })
    expect(
      graph.nodes.filter((node) => node.type === 'intermediateOutcome'),
    ).toHaveLength(2)
  })

  it('generates a Custom Innovation Final Outcome', () => {
    const graph = generateTheoryOfChangeGraph({
      project: {
        ...initialProjectDesignState,
        customInnovation: customInnovation(),
      },
      framework,
    })
    expect(
      graph.nodes.find(
        (node) => node.id === tocNodeId('finalOutcome', 'CUSTOM_FO'),
      ),
    ).toEqual(expect.objectContaining({ custom: true }))
  })

  it('generates one Custom Innovation pathway', () => {
    const graph = generateTheoryOfChangeGraph({
      project: {
        ...initialProjectDesignState,
        customInnovation: customInnovation(),
      },
      framework,
    })
    expect(
      graph.nodes.find((node) => node.id === tocNodeId('pathway', 'CUSTOM_PW')),
    ).toEqual(expect.objectContaining({ custom: true }))
  })

  it('orders Custom Intermediate Outcomes by step number', () => {
    const graph = generateTheoryOfChangeGraph({
      project: {
        ...initialProjectDesignState,
        customInnovation: customInnovation(),
      },
      framework,
    })
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        source: tocNodeId(
          'intermediateOutcome',
          'CUSTOM_IO_1',
          'CUSTOM_PW',
        ),
        target: tocNodeId(
          'intermediateOutcome',
          'CUSTOM_IO_2',
          'CUSTOM_PW',
        ),
      }),
    )
  })

  it('connects a Custom Final Outcome to its organisational Impact', () => {
    const graph = generateTheoryOfChangeGraph({
      project: {
        ...initialProjectDesignState,
        customInnovation: customInnovation(),
      },
      framework,
    })
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        source: tocNodeId('finalOutcome', 'CUSTOM_FO'),
        target: tocNodeId('impact', 'IMP_1'),
        relationshipType: 'impactContribution',
      }),
    )
  })

  it('uses one Impact node when two Final Outcomes share it', () => {
    const graph = generateTheoryOfChangeGraph({
      project: sharedState(framework),
      framework,
    })
    expect(graph.nodes.filter((node) => node.type === 'impact')).toHaveLength(1)
    expect(
      graph.edges.filter(
        (edge) => edge.relationshipType === 'impactContribution',
      ),
    ).toHaveLength(2)
  })

  it('renders two distinct pathways feeding one Final Outcome', () => {
    const state = addPathway(
      standardState(framework),
      framework,
      'FO_1',
      'PW_2',
      'primary',
    )
    const graph = generateTheoryOfChangeGraph({ project: state, framework })
    expect(graph.nodes.filter((node) => node.type === 'pathway')).toHaveLength(2)
  })

  it('uses one pathway node for links to two Final Outcomes', () => {
    const graph = generateTheoryOfChangeGraph({
      project: sharedState(framework),
      framework,
    })
    const pathwayNodeId = tocNodeId('pathway', 'PW_1')
    expect(graph.nodes.filter((node) => node.id === pathwayNodeId)).toHaveLength(
      1,
    )
    expect(graph.edges.filter((edge) => edge.source === pathwayNodeId)).toHaveLength(
      2,
    )
  })

  it('keeps matching Intermediate Outcome wording in different pathways separate', () => {
    const state = addPathway(
      standardState(framework),
      framework,
      'FO_1',
      'PW_2',
      'primary',
    )
    const graph = generateTheoryOfChangeGraph({ project: state, framework })
    const matching = graph.nodes.filter(
      (node) =>
        node.type === 'intermediateOutcome' &&
        node.data.statement === 'Producers understand markets.',
    )
    expect(matching).toHaveLength(2)
    expect(new Set(matching.map((node) => node.id)).size).toBe(2)
  })

  it('produces stable node IDs and deterministic layout for identical state', () => {
    const project = sharedState(framework)
    const first = generateTheoryOfChangeGraph({ project, framework })
    const second = generateTheoryOfChangeGraph({ project, framework })
    expect(second).toEqual(first)
    expect(layoutTheoryOfChangeGraph(second)).toEqual(
      layoutTheoryOfChangeGraph(first),
    )
  })
})
