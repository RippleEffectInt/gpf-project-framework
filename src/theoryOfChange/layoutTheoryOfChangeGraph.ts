import type { PositionedTocGraph, TocGraphModel, TocNode } from './types'

export const TOC_LANE_COLUMNS = {
  pathway: { x: 30, width: 150 },
  intermediateOutcome: { x: 215, width: 300 },
  finalOutcome: { x: 610, width: 330 },
  impact: { x: 1010, width: 280 },
} as const

const CANVAS_WIDTH = 1320
const LANE_TOP = 24
const LANE_PADDING = 22
const LANE_GAP = 18
const IO_GAP = 12

export interface TocPathwayLane {
  id: string
  pathwayNodeId: string
  y: number
  height: number
  custom: boolean
  alternate: boolean
}

export interface TocLaneLayout extends PositionedTocGraph {
  lanes: TocPathwayLane[]
  canvas: {
    width: number
    height: number
  }
}

function nodeDimensions(node: TocNode): { width: number; height: number } {
  const readableText =
    node.type === 'impact'
      ? node.data.statement
      : node.type === 'finalOutcome'
        ? node.data.statement
        : node.type === 'intermediateOutcome'
          ? node.data.statement
          : node.title
  const estimatedLines = Math.ceil(readableText.length / 48)
  switch (node.type) {
    case 'impact':
      return {
        width: TOC_LANE_COLUMNS.impact.width,
        height: Math.min(156, 88 + estimatedLines * 12),
      }
    case 'finalOutcome':
      return {
        width: TOC_LANE_COLUMNS.finalOutcome.width,
        height: Math.min(202, 108 + estimatedLines * 14),
      }
    case 'pathway':
      return { width: TOC_LANE_COLUMNS.pathway.width, height: 72 }
    case 'intermediateOutcome':
      return {
        width: TOC_LANE_COLUMNS.intermediateOutcome.width,
        height: Math.min(98, 70 + Math.max(0, estimatedLines - 2) * 8),
      }
  }
}

function average(values: number[]): number {
  if (values.length === 0) return LANE_TOP + 90
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function placeSharedColumn(
  nodes: TocNode[],
  desiredCenter: (node: TocNode) => number,
  x: number,
  positions: Map<string, { x: number; y: number }>,
) {
  let previousBottom = LANE_TOP
  ;[...nodes]
    .sort((left, right) => {
      const centerDifference = desiredCenter(left) - desiredCenter(right)
      return centerDifference || left.id.localeCompare(right.id)
    })
    .forEach((node) => {
      const dimensions = nodeDimensions(node)
      const desiredY = desiredCenter(node) - dimensions.height / 2
      const y = Math.max(LANE_TOP, desiredY, previousBottom + 24)
      positions.set(node.id, { x, y })
      previousBottom = y + dimensions.height
    })
}

export function layoutTheoryOfChangeGraph(graph: TocGraphModel): TocLaneLayout {
  const positions = new Map<string, { x: number; y: number }>()
  const pathwayNodes = graph.nodes.filter((node) => node.type === 'pathway')
  const intermediateOutcomeNodes = graph.nodes.filter(
    (node) => node.type === 'intermediateOutcome',
  )
  const lanes: TocPathwayLane[] = []
  let nextLaneY = LANE_TOP

  pathwayNodes.forEach((pathway, index) => {
    const pathwayIntermediateOutcomes = intermediateOutcomeNodes
      .filter(
        (node) =>
          node.type === 'intermediateOutcome' &&
          node.data.pathwayId ===
            (pathway.type === 'pathway'
              ? pathway.id.replace(/^toc:pathway:/, '')
              : ''),
      )
      .sort((left, right) => {
        if (
          left.type !== 'intermediateOutcome' ||
          right.type !== 'intermediateOutcome'
        ) {
          return 0
        }
        return left.data.stepNumber - right.data.stepNumber
      })
    const intermediateHeight =
      pathwayIntermediateOutcomes.reduce(
        (sum, node) => sum + nodeDimensions(node).height,
        0,
      ) +
      Math.max(0, pathwayIntermediateOutcomes.length - 1) * IO_GAP
    const laneHeight = Math.max(190, intermediateHeight + LANE_PADDING * 2)
    const lane: TocPathwayLane = {
      id: `toc-lane:${pathway.id}`,
      pathwayNodeId: pathway.id,
      y: nextLaneY,
      height: laneHeight,
      custom: pathway.custom,
      alternate: index % 2 === 1,
    }
    lanes.push(lane)
    positions.set(pathway.id, {
      x: TOC_LANE_COLUMNS.pathway.x,
      y: lane.y + lane.height / 2 - nodeDimensions(pathway).height / 2,
    })

    let nextIntermediateY = lane.y + LANE_PADDING
    pathwayIntermediateOutcomes.forEach((node) => {
      const dimensions = nodeDimensions(node)
      positions.set(node.id, {
        x: TOC_LANE_COLUMNS.intermediateOutcome.x,
        y: nextIntermediateY,
      })
      nextIntermediateY += dimensions.height + IO_GAP
    })
    nextLaneY += laneHeight + LANE_GAP
  })

  const laneCenters = new Map(
    lanes.map((lane) => [lane.pathwayNodeId, lane.y + lane.height / 2]),
  )
  const finalOutcomeNodes = graph.nodes.filter(
    (node) => node.type === 'finalOutcome',
  )
  placeSharedColumn(
    finalOutcomeNodes,
    (node) =>
      average(
        graph.edges
          .filter(
            (edge) =>
              edge.target === node.id &&
              (edge.relationshipType === 'primaryPathway' ||
                edge.relationshipType === 'relatedPathway'),
          )
          .flatMap((edge) => {
            const center = laneCenters.get(edge.source)
            return center === undefined ? [] : [center]
          }),
      ),
    TOC_LANE_COLUMNS.finalOutcome.x,
    positions,
  )

  const impactNodes = graph.nodes.filter((node) => node.type === 'impact')
  placeSharedColumn(
    impactNodes,
    (node) =>
      average(
        graph.edges
          .filter(
            (edge) =>
              edge.target === node.id &&
              edge.relationshipType === 'impactContribution',
          )
          .flatMap((edge) => {
            const source = graph.nodes.find(
              (candidate) => candidate.id === edge.source,
            )
            const position = positions.get(edge.source)
            return source && position
              ? [position.y + nodeDimensions(source).height / 2]
              : []
          }),
      ),
    TOC_LANE_COLUMNS.impact.x,
    positions,
  )

  const positionedNodes = graph.nodes
    .flatMap((node) => {
      const dimensions = nodeDimensions(node)
      const position = positions.get(node.id)
      return position
        ? [
            {
              node,
              width: dimensions.width,
              height: dimensions.height,
              position,
            },
          ]
        : []
    })
    .sort(
      (left, right) =>
        left.position.x - right.position.x ||
        left.position.y - right.position.y ||
        left.node.id.localeCompare(right.node.id),
    )
  const contentBottom = positionedNodes.reduce(
    (bottom, item) => Math.max(bottom, item.position.y + item.height),
    LANE_TOP,
  )

  return {
    nodes: positionedNodes,
    edges: graph.edges,
    lanes,
    canvas: {
      width: CANVAS_WIDTH,
      height: Math.max(nextLaneY - LANE_GAP + LANE_TOP, contentBottom + 36),
    },
  }
}
