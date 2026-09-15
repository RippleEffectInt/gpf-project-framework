import { getPathwayConfigurationStatus } from '../state/projectDesign'
import type {
  ProjectIntermediateOutcomeConfiguration,
  ProjectPathway,
} from '../types/project'
import type {
  TocActivityDetail,
  TocEdge,
  TocFinalOutcomeNode,
  TocGenerationInput,
  TocGraphModel,
  TocImpactNode,
  TocIndicatorDetail,
  TocIntermediateOutcomeNode,
  TocNode,
  TocPathwayNode,
  TocRelationshipType,
} from './types'

export function tocNodeId(
  type: TocNode['type'],
  entityId: string,
  pathwayId?: string,
): string {
  return type === 'intermediateOutcome'
    ? `toc:${type}:${pathwayId ?? 'unknown'}:${entityId}`
    : `toc:${type}:${entityId}`
}

function tocEdgeId(
  relationshipType: TocRelationshipType,
  source: string,
  target: string,
): string {
  return `toc-edge:${relationshipType}:${source}->${target}`
}

function addEdge(
  edges: Map<string, TocEdge>,
  relationshipType: TocRelationshipType,
  source: string,
  target: string,
) {
  const edge: TocEdge = {
    id: tocEdgeId(relationshipType, source, target),
    source,
    target,
    relationshipType,
  }
  edges.set(edge.id, edge)
}

function standardIndicator(
  input: TocGenerationInput,
  indicatorId: string | undefined,
): TocIndicatorDetail | null {
  if (!indicatorId) return null
  const indicator = input.framework.indicators.find(
    (candidate) => candidate.id === indicatorId && candidate.active,
  )
  return indicator
    ? {
        label: indicator.text,
        custom: false,
      }
    : null
}

function standardActivities(
  input: TocGenerationInput,
  configuration: ProjectIntermediateOutcomeConfiguration,
): TocActivityDetail[] {
  const selected = new Map(
    configuration.standardActivities.map((activity) => [
      activity.frameworkActivityId,
      activity,
    ]),
  )
  const frameworkActivities = input.framework.suggestedActivities
    .filter((activity) => selected.has(activity.id) && activity.active)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((activity) => {
      const projectSelection = selected.get(activity.id)
      return {
        label: activity.text,
        projectNotes: projectSelection?.projectNotes || undefined,
        custom: false,
      }
    })
  return [
    ...frameworkActivities,
    ...configuration.projectSpecificActivities.map((activity) => ({
      label: activity.wording,
      projectNotes: activity.projectDetails || undefined,
      custom: true,
    })),
  ]
}

function buildStandardIntermediateOutcomes(
  input: TocGenerationInput,
  projectPathway: ProjectPathway,
  nodes: Map<string, TocNode>,
  edges: Map<string, TocEdge>,
  categoryLabels: Map<string, string>,
) {
  const pathwayNodeId = tocNodeId('pathway', projectPathway.pathwayId)
  const ordered = projectPathway.intermediateOutcomeConfigurations
    .flatMap((configuration) => {
      const intermediateOutcome = input.framework.intermediateOutcomes.find(
        (candidate) =>
          candidate.id === configuration.frameworkIntermediateOutcomeId &&
          candidate.pathwayId === projectPathway.pathwayId &&
          candidate.active,
      )
      return intermediateOutcome
        ? [{ configuration, intermediateOutcome }]
        : []
    })
    .sort(
      (left, right) =>
        left.intermediateOutcome.stepNumber -
        right.intermediateOutcome.stepNumber,
    )

  ordered.forEach(({ configuration, intermediateOutcome }, index) => {
    const nodeId = tocNodeId(
      'intermediateOutcome',
      intermediateOutcome.id,
      projectPathway.pathwayId,
    )
    const additionalIndicators: TocIndicatorDetail[] = [
      ...configuration.additionalIndicators.flatMap((selection) => {
        const detail = standardIndicator(
          input,
          selection.frameworkIndicatorId,
        )
        return detail ? [detail] : []
      }),
      ...configuration.projectSpecificIndicators.map((indicator) => ({
        label: indicator.wording,
        measurementNotes: indicator.measurementNotes || undefined,
        custom: true,
      })),
    ]
    const node: TocIntermediateOutcomeNode = {
      id: nodeId,
      type: 'intermediateOutcome',
      title: `Step ${intermediateOutcome.stepNumber}`,
      custom: false,
      data: {
        pathwayId: projectPathway.pathwayId,
        stepNumber: intermediateOutcome.stepNumber,
        statement: intermediateOutcome.statement,
        primaryIndicator: standardIndicator(
          input,
          configuration.primaryIndicator?.frameworkIndicatorId,
        ),
        additionalIndicators,
        activities: standardActivities(input, configuration),
        inputs: configuration.inputs.map((item) => ({
          category: categoryLabels.get(item.inputCategoryId) ?? 'Input',
          details: item.details,
        })),
      },
    }
    nodes.set(node.id, node)

    const next = ordered[index + 1]
    const target = next
      ? tocNodeId(
          'intermediateOutcome',
          next.intermediateOutcome.id,
          projectPathway.pathwayId,
        )
      : pathwayNodeId
    addEdge(edges, 'intermediateOutcomeChain', nodeId, target)
  })
}

function addImpactConnection(
  input: TocGenerationInput,
  impactId: string,
  finalOutcomeNodeId: string,
  nodes: Map<string, TocNode>,
  edges: Map<string, TocEdge>,
): string | null {
  const impact = input.framework.impacts.find(
    (candidate) => candidate.id === impactId && candidate.active,
  )
  if (!impact) return null
  const impactNodeId = tocNodeId('impact', impact.id)
  const impactNode: TocImpactNode = {
    id: impactNodeId,
    type: 'impact',
    title: impact.theme,
    custom: false,
    data: {
      theme: impact.theme,
      statement: impact.statement,
    },
  }
  nodes.set(impactNodeId, impactNode)
  addEdge(
    edges,
    'impactContribution',
    finalOutcomeNodeId,
    impactNodeId,
  )
  return impact.theme
}

export function generateTheoryOfChangeGraph(
  input: TocGenerationInput,
): TocGraphModel {
  const nodes = new Map<string, TocNode>()
  const edges = new Map<string, TocEdge>()
  const categoryLabels = new Map(
    input.inputCategories?.map((category) => [category.id, category.label]) ??
      [],
  )
  const selectedOutcomeIds = new Set(input.project.selectedFinalOutcomeIds)
  const outcomeLabels = new Map<string, string>()

  selectedOutcomeIds.forEach((finalOutcomeId) => {
    const outcome = input.framework.finalOutcomes.find(
      (candidate) => candidate.id === finalOutcomeId && candidate.active,
    )
    if (!outcome) return
    const nodeId = tocNodeId('finalOutcome', outcome.id)
    const impactLabels = input.framework.finalOutcomeImpactLinks
      .filter((link) => link.finalOutcomeId === outcome.id)
      .flatMap((link) => {
        const label = addImpactConnection(
          input,
          link.impactId,
          nodeId,
          nodes,
          edges,
        )
        return label ? [label] : []
      })
    const primaryIndicatorId = outcome.primaryIndicatorIds.find((id) =>
      input.framework.indicators.some(
        (indicator) =>
          indicator.id === id &&
          indicator.active &&
          indicator.role === 'Primary' &&
          indicator.mandatory,
      ),
    )
    const node: TocFinalOutcomeNode = {
      id: nodeId,
      type: 'finalOutcome',
      title: outcome.shortLabel ?? outcome.statement,
      custom: false,
      data: {
        statement: outcome.statement,
        impactLabels: [...new Set(impactLabels)],
        primaryIndicator: standardIndicator(input, primaryIndicatorId),
      },
    }
    nodes.set(node.id, node)
    outcomeLabels.set(outcome.id, node.title)
  })

  input.project.projectPathways.forEach((projectPathway) => {
    const pathway = input.framework.pathways.find(
      (candidate) =>
        candidate.id === projectPathway.pathwayId && candidate.active,
    )
    if (!pathway) return
    const relationships = input.project.outcomePathwayLinks
      .filter(
        (link) =>
          link.pathwayId === projectPathway.pathwayId &&
          selectedOutcomeIds.has(link.finalOutcomeId) &&
          outcomeLabels.has(link.finalOutcomeId),
      )
      .sort(
        (left, right) =>
          (left.relationshipType === 'primary' ? 0 : 1) -
          (right.relationshipType === 'primary' ? 0 : 1),
      )
      .map((link) => ({
        finalOutcomeId: link.finalOutcomeId,
        finalOutcomeLabel:
          outcomeLabels.get(link.finalOutcomeId) ?? link.finalOutcomeId,
        relationshipType: link.relationshipType,
      }))
    const pathwayNode: TocPathwayNode = {
      id: tocNodeId('pathway', pathway.id),
      type: 'pathway',
      title: pathway.name,
      custom: false,
      data: {
        description: pathway.description ?? '',
        configurationStatus: getPathwayConfigurationStatus(projectPathway),
        relationships,
      },
    }
    nodes.set(pathwayNode.id, pathwayNode)
    relationships.forEach((relationship) => {
      addEdge(
        edges,
        relationship.relationshipType === 'primary'
          ? 'primaryPathway'
          : 'relatedPathway',
        pathwayNode.id,
        tocNodeId('finalOutcome', relationship.finalOutcomeId),
      )
    })
    buildStandardIntermediateOutcomes(
      input,
      projectPathway,
      nodes,
      edges,
      categoryLabels,
    )
  })

  const custom = input.project.customInnovation
  if (custom) {
    const finalOutcomeNodeId = tocNodeId('finalOutcome', custom.id)
    const impactLabels = custom.impactAreaIds.flatMap((impactId) => {
      const label = addImpactConnection(
        input,
        impactId,
        finalOutcomeNodeId,
        nodes,
        edges,
      )
      return label ? [label] : []
    })
    const finalOutcomeNode: TocFinalOutcomeNode = {
      id: finalOutcomeNodeId,
      type: 'finalOutcome',
      title: custom.shortLabel || custom.statement,
      custom: true,
      data: {
        statement: custom.statement,
        impactLabels: [...new Set(impactLabels)],
        primaryIndicator: custom.primaryIndicator.wording
          ? {
              label: custom.primaryIndicator.wording,
              measurementNotes:
                custom.primaryIndicator.measurementNotes || undefined,
              custom: true,
            }
          : null,
      },
    }
    nodes.set(finalOutcomeNode.id, finalOutcomeNode)

    const pathwayNode: TocPathwayNode = {
      id: tocNodeId('pathway', custom.pathway.id),
      type: 'pathway',
      title: custom.pathway.name,
      custom: true,
      data: {
        description: custom.pathway.description,
        configurationStatus: 'custom',
        relationships: [
          {
            finalOutcomeId: custom.id,
            finalOutcomeLabel: finalOutcomeNode.title,
            relationshipType: 'primary',
          },
        ],
      },
    }
    nodes.set(pathwayNode.id, pathwayNode)
    addEdge(
      edges,
      'primaryPathway',
      pathwayNode.id,
      finalOutcomeNode.id,
    )

    const ordered = [...custom.pathway.intermediateOutcomes].sort(
      (left, right) => left.stepNumber - right.stepNumber,
    )
    ordered.forEach((outcome, index) => {
      const nodeId = tocNodeId(
        'intermediateOutcome',
        outcome.id,
        custom.pathway.id,
      )
      const node: TocIntermediateOutcomeNode = {
        id: nodeId,
        type: 'intermediateOutcome',
        title: `Step ${outcome.stepNumber}`,
        custom: true,
        data: {
          pathwayId: custom.pathway.id,
          stepNumber: outcome.stepNumber,
          statement: outcome.statement,
          primaryIndicator: outcome.primaryIndicator.wording
            ? {
                label: outcome.primaryIndicator.wording,
                measurementNotes:
                  outcome.primaryIndicator.measurementNotes || undefined,
                custom: true,
              }
            : null,
          additionalIndicators: outcome.additionalIndicators.map(
            (indicator) => ({
              label: indicator.wording,
              measurementNotes: indicator.measurementNotes || undefined,
              custom: true,
            }),
          ),
          activities: outcome.activities.map((activity) => ({
            label: activity.wording,
            projectNotes: activity.projectDetails || undefined,
            custom: true,
          })),
          inputs: outcome.inputs.map((item) => ({
            category: categoryLabels.get(item.inputCategoryId) ?? 'Input',
            details: item.details,
          })),
        },
      }
      nodes.set(node.id, node)
      const next = ordered[index + 1]
      const target = next
        ? tocNodeId(
            'intermediateOutcome',
            next.id,
            custom.pathway.id,
          )
        : pathwayNode.id
      addEdge(edges, 'intermediateOutcomeChain', node.id, target)
    })
  }

  const allNodes = [...nodes.values()]
  return {
    frameworkVersion: input.framework.frameworkVersion,
    frameworkSchemaVersion: input.framework.schemaVersion,
    nodes: allNodes,
    edges: [...edges.values()],
    summary: {
      impactCount: allNodes.filter((node) => node.type === 'impact').length,
      finalOutcomeCount: allNodes.filter(
        (node) => node.type === 'finalOutcome',
      ).length,
      pathwayCount: allNodes.filter((node) => node.type === 'pathway').length,
      intermediateOutcomeCount: allNodes.filter(
        (node) => node.type === 'intermediateOutcome',
      ).length,
    },
  }
}
