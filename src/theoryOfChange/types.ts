import type {
  ConfigurationStatus,
  PathwayRelationshipType,
  ProjectDesignState,
} from '../types/project'
import type { FrameworkData } from '../types/framework'

export type TocNodeType =
  | 'impact'
  | 'finalOutcome'
  | 'pathway'
  | 'intermediateOutcome'

export type TocRelationshipType =
  | 'impactContribution'
  | 'primaryPathway'
  | 'relatedPathway'
  | 'intermediateOutcomeChain'

export interface TocGenerationInput {
  project: ProjectDesignState
  framework: FrameworkData
  inputCategories?: readonly {
    id: string
    label: string
  }[]
}

export interface TocIndicatorDetail {
  label: string
  measurementNotes?: string
  custom: boolean
}

export interface TocActivityDetail {
  label: string
  projectNotes?: string
  custom: boolean
}

export interface TocInputDetail {
  category: string
  details: string
}

interface TocNodeBase {
  id: string
  type: TocNodeType
  title: string
  custom: boolean
}

export interface TocImpactNode extends TocNodeBase {
  type: 'impact'
  data: {
    theme: string
    statement: string
  }
}

export interface TocFinalOutcomeNode extends TocNodeBase {
  type: 'finalOutcome'
  data: {
    statement: string
    impactLabels: string[]
    primaryIndicator: TocIndicatorDetail | null
  }
}

export interface TocPathwayNode extends TocNodeBase {
  type: 'pathway'
  data: {
    description: string
    configurationStatus: ConfigurationStatus | 'custom'
    relationships: Array<{
      finalOutcomeId: string
      finalOutcomeLabel: string
      relationshipType: PathwayRelationshipType
    }>
  }
}

export interface TocIntermediateOutcomeNode extends TocNodeBase {
  type: 'intermediateOutcome'
  data: {
    pathwayId: string
    stepNumber: number
    statement: string
    primaryIndicator: TocIndicatorDetail | null
    additionalIndicators: TocIndicatorDetail[]
    activities: TocActivityDetail[]
    inputs: TocInputDetail[]
  }
}

export type TocNode =
  | TocImpactNode
  | TocFinalOutcomeNode
  | TocPathwayNode
  | TocIntermediateOutcomeNode

export interface TocEdge {
  id: string
  source: string
  target: string
  relationshipType: TocRelationshipType
}

export interface TocGraphSummary {
  impactCount: number
  finalOutcomeCount: number
  pathwayCount: number
  intermediateOutcomeCount: number
}

export interface TocGraphModel {
  frameworkVersion: string
  frameworkSchemaVersion: string
  nodes: TocNode[]
  edges: TocEdge[]
  summary: TocGraphSummary
}

export interface PositionedTocNode {
  node: TocNode
  position: {
    x: number
    y: number
  }
  width: number
  height: number
}

export interface PositionedTocGraph {
  nodes: PositionedTocNode[]
  edges: TocEdge[]
}

export interface TocImageExporter {
  exportPng(graph: TocGraphModel, projectTitle: string): Promise<Blob>
}
