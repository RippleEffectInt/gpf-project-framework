import { describe, expect, it } from 'vitest'
import type { TocGraphModel } from '../theoryOfChange/types'
import {
  buildTheoryOfChangeSvg,
  planTheoryOfChangePdf,
} from './theoryOfChangeExport'

const graph: TocGraphModel = {
  frameworkVersion: 'TEST-FRAMEWORK',
  frameworkSchemaVersion: '1.0',
  nodes: [
    {
      id: 'toc:pathway:PW_1',
      type: 'pathway',
      title: 'Inclusive market pathway',
      custom: false,
      data: {
        description: '',
        configurationStatus: 'configured',
        relationships: [
          {
            finalOutcomeId: 'FO_1',
            finalOutcomeLabel: 'Profitable markets',
            relationshipType: 'primary',
          },
          {
            finalOutcomeId: 'FO_2',
            finalOutcomeLabel: 'Inclusive services',
            relationshipType: 'related',
          },
        ],
      },
    },
    {
      id: 'toc:intermediateOutcome:PW_1:IO_1',
      type: 'intermediateOutcome',
      title: 'Step 1',
      custom: false,
      data: {
        pathwayId: 'PW_1',
        stepNumber: 1,
        statement: 'Producer groups can identify market opportunities',
        primaryIndicator: null,
        additionalIndicators: [],
        activities: [],
        inputs: [],
      },
    },
    {
      id: 'toc:intermediateOutcome:PW_1:IO_2',
      type: 'intermediateOutcome',
      title: 'Step 2',
      custom: false,
      data: {
        pathwayId: 'PW_1',
        stepNumber: 2,
        statement: 'Producer groups establish buyer relationships',
        primaryIndicator: null,
        additionalIndicators: [],
        activities: [],
        inputs: [],
      },
    },
    {
      id: 'toc:finalOutcome:FO_1',
      type: 'finalOutcome',
      title: 'Profitable markets',
      custom: false,
      data: {
        statement: 'Smallholders benefit from profitable markets',
        impactLabels: ['Income'],
        primaryIndicator: null,
      },
    },
    {
      id: 'toc:finalOutcome:FO_2',
      type: 'finalOutcome',
      title: 'Inclusive services',
      custom: false,
      data: {
        statement: 'Smallholders access inclusive market services',
        impactLabels: ['Inclusion'],
        primaryIndicator: null,
      },
    },
    {
      id: 'toc:impact:IMP_1',
      type: 'impact',
      title: 'Income',
      custom: false,
      data: {
        theme: 'Income',
        statement: 'People are financially secure',
      },
    },
  ],
  edges: [
    {
      id: 'io-1-2',
      source: 'toc:intermediateOutcome:PW_1:IO_1',
      target: 'toc:intermediateOutcome:PW_1:IO_2',
      relationshipType: 'intermediateOutcomeChain',
    },
    {
      id: 'io-2-pathway',
      source: 'toc:intermediateOutcome:PW_1:IO_2',
      target: 'toc:pathway:PW_1',
      relationshipType: 'intermediateOutcomeChain',
    },
    {
      id: 'primary',
      source: 'toc:pathway:PW_1',
      target: 'toc:finalOutcome:FO_1',
      relationshipType: 'primaryPathway',
    },
    {
      id: 'related',
      source: 'toc:pathway:PW_1',
      target: 'toc:finalOutcome:FO_2',
      relationshipType: 'relatedPathway',
    },
    {
      id: 'impact',
      source: 'toc:finalOutcome:FO_1',
      target: 'toc:impact:IMP_1',
      relationshipType: 'impactContribution',
    },
  ],
  summary: {
    impactCount: 1,
    finalOutcomeCount: 2,
    pathwayCount: 1,
    intermediateOutcomeCount: 2,
  },
}

describe('complete Theory of Change export document', () => {
  it('renders the full graph model rather than viewport-only content', () => {
    const document = buildTheoryOfChangeSvg(graph, 'Market Project')

    expect(document.width).toBe(1320)
    expect(document.height).toBeGreaterThan(300)
    expect(document.nodeIds).toHaveLength(graph.nodes.length)
    graph.nodes.forEach((node) => {
      expect(document.svg).toContain(
        `data-toc-export-node="${node.id}"`,
      )
    })
    expect(document.svg).toContain('Market Project')
    expect(document.svg).toContain('PATHWAY')
    expect(document.svg).toContain('INTERMEDIATE OUTCOMES')
    expect(document.svg).toContain('FINAL OUTCOMES')
    expect(document.svg).toContain('IMPACTS')
    expect(document.svg).toContain('stroke-dasharray="8 6"')
    expect(document.svg).not.toContain('react-flow__controls')
  })

  it('plans landscape PDF pages that cover normal models without clipping', () => {
    const document = buildTheoryOfChangeSvg(graph, 'Market Project')
    const plan = planTheoryOfChangePdf(
      document.width,
      document.height,
    )
    const finalPage = plan.pages.at(-1)

    expect(plan.pageWidth).toBeGreaterThan(plan.pageHeight)
    expect(plan.pages).toHaveLength(1)
    expect(finalPage).toBeDefined()
    expect(
      (finalPage?.sourceY ?? 0) + (finalPage?.sourceHeight ?? 0),
    ).toBeCloseTo(document.height, 5)
    expect(finalPage?.renderHeight).toBeLessThanOrEqual(
      plan.pageHeight - plan.margin * 2,
    )
  })

  it('tiles large models across landscape pages without losing content', () => {
    const plan = planTheoryOfChangePdf(1320, 2600)
    const coveredHeight = plan.pages.reduce(
      (height, page) => height + page.sourceHeight,
      0,
    )

    expect(plan.pages.length).toBeGreaterThan(1)
    expect(coveredHeight).toBeCloseTo(2600, 5)
    expect(
      plan.pages.every(
        (page) =>
          page.renderHeight <=
          plan.pageHeight - plan.margin * 2,
      ),
    ).toBe(true)
  })
})
