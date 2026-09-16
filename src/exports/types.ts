import type { TocGraphModel } from '../theoryOfChange/types'

export type FrameworkSource =
  | 'Standard framework'
  | 'Custom innovation'

export interface ProjectExportMetadata {
  projectTitle: string
  projectCode: string
  country: string
  status: string
  plannedStart: string
  plannedEnd: string
  plannedSelfHelpGroupCount: number | null
  frameworkVersion: string
  frameworkSchemaVersion: string
  projectSchemaVersion: number
  modifiedAt: string
  exportDate: string
}

export interface ProjectExportSummary {
  selectedImpactAreas: string[]
  finalOutcomeCount: number
  uniquePathwayCount: number
  intermediateOutcomeCount: number
  selectedActivityCount: number
  configuredPlannedOutputCount: number
}

export interface ResultsFrameworkExportRow {
  impactArea: string
  finalOutcome: string
  pathway: string
  pathwayRelationship: 'Primary' | 'Related'
  intermediateOutcomeStep: number
  intermediateOutcome: string
  frameworkSource: FrameworkSource
}

export interface ActivityOutputExportRow {
  finalOutcome: string
  pathway: string
  intermediateOutcome: string
  activity: string
  activityType: 'Standard' | 'Custom'
  projectDetails: string
  plannedQuantity: number | null
  unit: string
  plannedOutput: string
}

export interface IndicatorExportRow {
  resultLevel: 'Final Outcome' | 'Intermediate Outcome'
  finalOutcome: string
  pathway: string
  intermediateOutcome: string
  indicator: string
  indicatorType: 'Primary' | 'Additional' | 'Project-specific'
  requirement: 'Mandatory' | 'Optional'
  frameworkSource: FrameworkSource
}

export interface InputExportRow {
  finalOutcome: string
  pathway: string
  intermediateOutcome: string
  inputCategory: string
  input: string
}

export interface DonorLogframeExportRow {
  resultsLevel: 'Impact' | 'Final Outcome' | 'Intermediate Outcome'
  resultStatement: string
  finalOutcome: string
  indicator: string
  pathwayContext: string
  keyActivities: string
  plannedOutputs: string
}

export interface ProjectExportModel {
  metadata: ProjectExportMetadata
  summary: ProjectExportSummary
  resultsFramework: ResultsFrameworkExportRow[]
  activitiesOutputs: ActivityOutputExportRow[]
  indicators: IndicatorExportRow[]
  inputs: InputExportRow[]
  donorLogframe: DonorLogframeExportRow[]
  theoryOfChange: TocGraphModel
}
