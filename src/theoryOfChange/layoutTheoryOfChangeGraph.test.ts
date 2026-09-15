import { describe, expect, it } from 'vitest'
import {
  layoutTheoryOfChangeGraph,
  TOC_LANE_COLUMNS,
} from './layoutTheoryOfChangeGraph'
import type { TocEdge, TocGraphModel, TocNode } from './types'

function pathway(id: string, custom = false): TocNode {
  return {
    id: `toc:pathway:${id}`,
    type: 'pathway',
    title: `Pathway ${id}`,
    custom,
    data: {
      description: `Description for ${id}`,
      configurationStatus: custom ? 'custom' : 'configured',
      relationships: [],
    },
  }
}

function intermediateOutcome(
  pathwayId: string,
  stepNumber: number,
  statement = `Intermediate Outcome ${pathwayId}.${stepNumber}`,
): TocNode {
  return {
    id: `toc:intermediateOutcome:${pathwayId}:IO_${stepNumber}`,
    type: 'intermediateOutcome',
    title: `Step ${stepNumber}`,
    custom: pathwayId.startsWith('CUSTOM'),
    data: {
      pathwayId,
      stepNumber,
      statement,
      primaryIndicator: null,
      additionalIndicators: [],
      activities: [],
      inputs: [],
    },
  }
}

function finalOutcome(id: string): TocNode {
  return {
    id: `toc:finalOutcome:${id}`,
    type: 'finalOutcome',
    title: `Final Outcome ${id}`,
    custom: false,
    data: {
      statement: `Final Outcome statement ${id}`,
      impactLabels: ['Impact IMP_1'],
      primaryIndicator: null,
    },
  }
}

function impact(id = 'IMP_1'): TocNode {
  return {
    id: `toc:impact:${id}`,
    type: 'impact',
    title: `Impact ${id}`,
    custom: false,
    data: {
      theme: `Impact ${id}`,
      statement: `Impact statement ${id}`,
    },
  }
}

function edge(
  id: string,
  source: string,
  target: string,
  relationshipType: TocEdge['relationshipType'],
): TocEdge {
  return { id, source, target, relationshipType }
}

function graph(nodes: TocNode[], edges: TocEdge[]): TocGraphModel {
  return {
    frameworkVersion: 'test',
    frameworkSchemaVersion: 'test',
    nodes,
    edges,
    summary: {
      pathwayCount: nodes.filter((node) => node.type === 'pathway').length,
      intermediateOutcomeCount: nodes.filter(
        (node) => node.type === 'intermediateOutcome',
      ).length,
      finalOutcomeCount: nodes.filter((node) => node.type === 'finalOutcome')
        .length,
      impactCount: nodes.filter((node) => node.type === 'impact').length,
    },
  }
}

function positionOf(
  layout: ReturnType<typeof layoutTheoryOfChangeGraph>,
  id: string,
) {
  const item = layout.nodes.find((candidate) => candidate.node.id === id)
  if (!item) throw new Error(`Expected positioned node ${id}.`)
  return item
}

describe('pathway-oriented Theory of Change layout', () => {
  it('uses four left-to-right columns and one band for a single pathway', () => {
    const pw = pathway('PW_1')
    const io = intermediateOutcome('PW_1', 1)
    const outcome = finalOutcome('FO_1')
    const organisationalImpact = impact()
    const layout = layoutTheoryOfChangeGraph(
      graph(
        [organisationalImpact, outcome, pw, io],
        [
          edge('io-path', io.id, pw.id, 'intermediateOutcomeChain'),
          edge('path-outcome', pw.id, outcome.id, 'primaryPathway'),
          edge(
            'outcome-impact',
            outcome.id,
            organisationalImpact.id,
            'impactContribution',
          ),
        ],
      ),
    )

    expect(layout.lanes).toHaveLength(1)
    expect(positionOf(layout, pw.id).position.x).toBe(
      TOC_LANE_COLUMNS.pathway.x,
    )
    expect(positionOf(layout, io.id).position.x).toBe(
      TOC_LANE_COLUMNS.intermediateOutcome.x,
    )
    expect(positionOf(layout, outcome.id).position.x).toBe(
      TOC_LANE_COLUMNS.finalOutcome.x,
    )
    expect(positionOf(layout, organisationalImpact.id).position.x).toBe(
      TOC_LANE_COLUMNS.impact.x,
    )
  })

  it('orders Intermediate Outcomes vertically by explicit step number', () => {
    const pw = pathway('PW_1')
    const first = intermediateOutcome('PW_1', 1)
    const second = intermediateOutcome('PW_1', 2)
    const third = intermediateOutcome('PW_1', 3)
    const layout = layoutTheoryOfChangeGraph(
      graph([pw, third, first, second], []),
    )

    expect(positionOf(layout, first.id).position.y).toBeLessThan(
      positionOf(layout, second.id).position.y,
    )
    expect(positionOf(layout, second.id).position.y).toBeLessThan(
      positionOf(layout, third.id).position.y,
    )
  })

  it('creates ordered, alternating lanes for four or more pathways and aligns multiple Final Outcomes', () => {
    const pathways = ['PW_1', 'PW_2', 'PW_3', 'PW_4'].map((id) => pathway(id))
    const outcomes = ['FO_1', 'FO_2'].map((id) => finalOutcome(id))
    const edges = pathways.map((node, index) => {
      const outcome = outcomes[index % outcomes.length]
      if (!outcome) throw new Error('Expected a Final Outcome fixture.')
      return edge(
        `relationship-${index}`,
        node.id,
        outcome.id,
        'primaryPathway',
      )
    })
    const layout = layoutTheoryOfChangeGraph(
      graph([...pathways, ...outcomes], edges),
    )

    expect(layout.lanes).toHaveLength(4)
    expect(layout.lanes.map((lane) => lane.alternate)).toEqual([
      false,
      true,
      false,
      true,
    ])
    expect(layout.lanes.map((lane) => lane.y)).toEqual(
      [...layout.lanes]
        .map((lane) => lane.y)
        .sort((left, right) => left - right),
    )
    expect(
      outcomes.map((node) => positionOf(layout, node.id).position.x),
    ).toEqual([
      TOC_LANE_COLUMNS.finalOutcome.x,
      TOC_LANE_COLUMNS.finalOutcome.x,
    ])
  })

  it('positions one shared Final Outcome between its pathway lanes and keeps one shared Impact', () => {
    const firstPathway = pathway('PW_1')
    const secondPathway = pathway('PW_2')
    const sharedOutcome = finalOutcome('FO_SHARED')
    const sharedImpact = impact('IMP_SHARED')
    const layout = layoutTheoryOfChangeGraph(
      graph(
        [firstPathway, secondPathway, sharedOutcome, sharedImpact],
        [
          edge(
            'first-primary',
            firstPathway.id,
            sharedOutcome.id,
            'primaryPathway',
          ),
          edge(
            'second-related',
            secondPathway.id,
            sharedOutcome.id,
            'relatedPathway',
          ),
          edge(
            'shared-impact',
            sharedOutcome.id,
            sharedImpact.id,
            'impactContribution',
          ),
        ],
      ),
    )
    const firstLane = layout.lanes[0]
    const secondLane = layout.lanes[1]
    if (!firstLane || !secondLane) {
      throw new Error('Expected two pathway lanes.')
    }
    const firstCenter = firstLane.y + firstLane.height / 2
    const secondCenter = secondLane.y + secondLane.height / 2
    const positionedOutcome = positionOf(layout, sharedOutcome.id)
    const outcomeCenter =
      positionedOutcome.position.y + positionedOutcome.height / 2

    expect(outcomeCenter).toBeGreaterThan(firstCenter)
    expect(outcomeCenter).toBeLessThan(secondCenter)
    expect(
      layout.nodes.filter((item) => item.node.type === 'finalOutcome'),
    ).toHaveLength(1)
    expect(
      layout.nodes.filter((item) => item.node.type === 'impact'),
    ).toHaveLength(1)
    expect(layout.edges).toContainEqual(
      expect.objectContaining({ relationshipType: 'relatedPathway' }),
    )
  })

  it('marks Custom Innovation as a custom lane without changing graph nodes', () => {
    const customPathway = pathway('CUSTOM_PW', true)
    const model = graph(
      [customPathway, intermediateOutcome('CUSTOM_PW', 1)],
      [],
    )
    const layout = layoutTheoryOfChangeGraph(model)

    expect(layout.lanes).toEqual([
      expect.objectContaining({
        pathwayNodeId: customPathway.id,
        custom: true,
      }),
    ])
    expect(layout.nodes.map((item) => item.node)).toEqual(model.nodes)
  })

  it('bounds long Intermediate Outcome cards and keeps them inside their lane', () => {
    const pw = pathway('PW_LONG')
    const longText =
      'A deliberately long Intermediate Outcome statement '.repeat(20)
    const outcomes = [1, 2, 3].map((step) =>
      intermediateOutcome('PW_LONG', step, longText),
    )
    const layout = layoutTheoryOfChangeGraph(graph([pw, ...outcomes], []))
    const lane = layout.lanes[0]
    if (!lane) throw new Error('Expected a pathway lane.')

    outcomes.forEach((node) => {
      const item = positionOf(layout, node.id)
      expect(item.height).toBeLessThanOrEqual(98)
      expect(item.position.y + item.height).toBeLessThanOrEqual(
        lane.y + lane.height,
      )
    })
  })
})
