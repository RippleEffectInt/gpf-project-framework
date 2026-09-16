import { inputCategories } from '../data/inputCategories'
import { getFrameworkByVersion } from '../data/frameworkRegistry'
import { loadPersistedProject } from '../persistence/projectSerialization'
import type {
  PersistedProjectDesignV1,
  ProjectRecord,
} from '../persistence/types'
import {
  displayedOutputText,
  getSelectedOutputUnit,
  normalizeActivityOutput,
} from '../state/activityOutputs'
import { formatYearMonthDisplay } from '../state/projectDates'
import { getImpactsRepresentedByProject } from '../state/projectReadiness'
import { generateTheoryOfChangeGraph } from '../theoryOfChange/generateTheoryOfChangeGraph'
import type {
  FrameworkData,
  Indicator,
  IntermediateOutcome,
} from '../types/framework'
import type {
  ActivityOutputPlanning,
  ProjectDesignState,
  ProjectSpecificActivity,
  StandardActivitySelection,
} from '../types/project'
import type {
  ActivityOutputExportRow,
  DonorLogframeExportRow,
  IndicatorExportRow,
  InputExportRow,
  ProjectExportModel,
  ResultsFrameworkExportRow,
} from './types'

export class ProjectExportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProjectExportError'
  }
}

function joinUnique(
  values: Array<string | null | undefined>,
  separator = '\n',
): string {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean))]
    .join(separator)
}

function relationshipLabel(
  relationshipType: 'primary' | 'related',
): 'Primary' | 'Related' {
  return relationshipType === 'primary' ? 'Primary' : 'Related'
}

function inputCategoryLabel(
  inputCategoryId: string,
  framework?: FrameworkData,
): string {
  return (
    inputCategories.find((category) => category.id === inputCategoryId)
      ?.label ??
    framework?.inputCategories.find(
      (category) => category.id === inputCategoryId,
    )?.label ??
    'Unknown category'
  )
}

function finalOutcomeStatement(
  framework: FrameworkData,
  finalOutcomeId: string,
): string {
  const outcome = framework.finalOutcomes.find(
    (candidate) => candidate.id === finalOutcomeId,
  )
  if (!outcome) {
    throw new ProjectExportError(
      `Final Outcome ${finalOutcomeId} is unavailable in the saved framework version.`,
    )
  }
  return outcome.statement
}

function impactAreasForFinalOutcome(
  framework: FrameworkData,
  finalOutcomeId: string,
): string {
  const impactIds = framework.finalOutcomeImpactLinks
    .filter((link) => link.finalOutcomeId === finalOutcomeId)
    .map((link) => link.impactId)
  return joinUnique(
    impactIds.map(
      (impactId) =>
        framework.impacts.find((impact) => impact.id === impactId)?.theme,
    ),
    '; ',
  )
}

function indicatorText(
  framework: FrameworkData,
  indicatorId: string,
): string {
  const indicator = framework.indicators.find(
    (candidate) => candidate.id === indicatorId,
  )
  if (!indicator) {
    throw new ProjectExportError(
      `Indicator ${indicatorId} is unavailable in the saved framework version.`,
    )
  }
  return indicator.text
}

function effectivePlanning(
  activity:
    | StandardActivitySelection
    | ProjectSpecificActivity,
  state: ProjectDesignState,
): ActivityOutputPlanning {
  const planning = normalizeActivityOutput(activity)
  if (!planning.useProjectSelfHelpGroupTotal) return planning
  return {
    ...planning,
    plannedQuantity: state.metadata.plannedSelfHelpGroupCount,
  }
}

function exportUnit(planning: ActivityOutputPlanning): string {
  if (planning.outputUnitSelection === null) return ''
  if (planning.outputUnitSelection === 'no-unit') return 'No unit'
  return getSelectedOutputUnit(planning) ?? ''
}

function standardIndicatorRow(
  indicator: Indicator,
  context: {
    resultLevel: 'Final Outcome' | 'Intermediate Outcome'
    finalOutcome: string
    pathway?: string
    intermediateOutcome?: string
  },
): IndicatorExportRow {
  return {
    resultLevel: context.resultLevel,
    finalOutcome: context.finalOutcome,
    pathway: context.pathway ?? '',
    intermediateOutcome: context.intermediateOutcome ?? '',
    indicator: indicator.text,
    indicatorType:
      indicator.role === 'Primary' ? 'Primary' : 'Additional',
    requirement: indicator.mandatory ? 'Mandatory' : 'Optional',
    frameworkSource: 'Standard framework',
  }
}

interface StandardPathwayContext {
  pathwayId: string
  pathwayName: string
  finalOutcomeStatements: string[]
  intermediateOutcomes: Array<{
    outcome: IntermediateOutcome
    configuration: ProjectDesignState['projectPathways'][number]['intermediateOutcomeConfigurations'][number]
  }>
}

function buildStandardPathwayContexts(
  state: ProjectDesignState,
  framework: FrameworkData,
): StandardPathwayContext[] {
  return state.projectPathways.map((projectPathway) => {
    const pathway = framework.pathways.find(
      (candidate) => candidate.id === projectPathway.pathwayId,
    )
    if (!pathway) {
      throw new ProjectExportError(
        `Pathway ${projectPathway.pathwayId} is unavailable in the saved framework version.`,
      )
    }
    const links = state.outcomePathwayLinks.filter(
      (link) => link.pathwayId === pathway.id,
    )
    const finalOutcomeStatements = links.map((link) =>
      finalOutcomeStatement(framework, link.finalOutcomeId),
    )
    const intermediateOutcomes =
      projectPathway.intermediateOutcomeConfigurations
        .map((configuration) => {
          const outcome = framework.intermediateOutcomes.find(
            (candidate) =>
              candidate.id ===
                configuration.frameworkIntermediateOutcomeId &&
              candidate.pathwayId === pathway.id,
          )
          if (!outcome) {
            throw new ProjectExportError(
              `Intermediate Outcome ${configuration.frameworkIntermediateOutcomeId} is unavailable in the saved framework version.`,
            )
          }
          return { outcome, configuration }
        })
        .sort(
          (left, right) =>
            left.outcome.stepNumber - right.outcome.stepNumber,
        )
    return {
      pathwayId: pathway.id,
      pathwayName: pathway.name,
      finalOutcomeStatements,
      intermediateOutcomes,
    }
  })
}

function addStandardResultsRows(
  rows: ResultsFrameworkExportRow[],
  state: ProjectDesignState,
  framework: FrameworkData,
  pathways: StandardPathwayContext[],
) {
  pathways.forEach((pathway) => {
    const links = state.outcomePathwayLinks.filter(
      (link) => link.pathwayId === pathway.pathwayId,
    )
    links.forEach((link) => {
      const statement = finalOutcomeStatement(
        framework,
        link.finalOutcomeId,
      )
      pathway.intermediateOutcomes.forEach(({ outcome }) => {
        rows.push({
          impactArea: impactAreasForFinalOutcome(
            framework,
            link.finalOutcomeId,
          ),
          finalOutcome: statement,
          pathway: pathway.pathwayName,
          pathwayRelationship: relationshipLabel(
            link.relationshipType,
          ),
          intermediateOutcomeStep: outcome.stepNumber,
          intermediateOutcome: outcome.statement,
          frameworkSource: 'Standard framework',
        })
      })
    })
  })
}

function addStandardActivityRows(
  rows: ActivityOutputExportRow[],
  state: ProjectDesignState,
  framework: FrameworkData,
  pathways: StandardPathwayContext[],
) {
  pathways.forEach((pathway) => {
    const finalOutcomes = joinUnique(
      pathway.finalOutcomeStatements,
      '; ',
    )
    pathway.intermediateOutcomes.forEach(
      ({ outcome, configuration }) => {
        configuration.standardActivities.forEach((activity) => {
          const frameworkActivity =
            framework.suggestedActivities.find(
              (candidate) =>
                candidate.id === activity.frameworkActivityId,
            )
          if (!frameworkActivity) {
            throw new ProjectExportError(
              `Activity ${activity.frameworkActivityId} is unavailable in the saved framework version.`,
            )
          }
          const planning = effectivePlanning(activity, state)
          rows.push({
            finalOutcome: finalOutcomes,
            pathway: pathway.pathwayName,
            intermediateOutcome: outcome.statement,
            activity: frameworkActivity.text,
            activityType: 'Standard',
            projectDetails: activity.projectNotes,
            plannedQuantity: planning.plannedQuantity,
            unit: exportUnit(planning),
            plannedOutput:
              displayedOutputText(
                planning,
                frameworkActivity.outputPhrase,
              ) ?? '',
          })
        })
        configuration.projectSpecificActivities.forEach((activity) => {
          const planning = effectivePlanning(activity, state)
          rows.push({
            finalOutcome: finalOutcomes,
            pathway: pathway.pathwayName,
            intermediateOutcome: outcome.statement,
            activity: activity.wording,
            activityType: 'Custom',
            projectDetails: activity.projectDetails,
            plannedQuantity: planning.plannedQuantity,
            unit: exportUnit(planning),
            plannedOutput:
              displayedOutputText(planning, null) ?? '',
          })
        })
      },
    )
  })
}

function addStandardIndicatorRows(
  rows: IndicatorExportRow[],
  state: ProjectDesignState,
  framework: FrameworkData,
  pathways: StandardPathwayContext[],
) {
  state.selectedFinalOutcomeIds.forEach((finalOutcomeId) => {
    const outcome = framework.finalOutcomes.find(
      (candidate) => candidate.id === finalOutcomeId,
    )
    if (!outcome) return
    outcome.primaryIndicatorIds.forEach((indicatorId) => {
      const indicator = framework.indicators.find(
        (candidate) => candidate.id === indicatorId,
      )
      if (indicator) {
        rows.push(
          standardIndicatorRow(indicator, {
            resultLevel: 'Final Outcome',
            finalOutcome: outcome.statement,
          }),
        )
      }
    })
  })

  pathways.forEach((pathway) => {
    const finalOutcomes = joinUnique(
      pathway.finalOutcomeStatements,
      '; ',
    )
    pathway.intermediateOutcomes.forEach(
      ({ outcome, configuration }) => {
        if (configuration.primaryIndicator) {
          const indicator = framework.indicators.find(
            (candidate) =>
              candidate.id ===
              configuration.primaryIndicator?.frameworkIndicatorId,
          )
          if (indicator) {
            rows.push(
              standardIndicatorRow(indicator, {
                resultLevel: 'Intermediate Outcome',
                finalOutcome: finalOutcomes,
                pathway: pathway.pathwayName,
                intermediateOutcome: outcome.statement,
              }),
            )
          }
        }
        configuration.additionalIndicators.forEach((selection) => {
          const indicator = framework.indicators.find(
            (candidate) =>
              candidate.id === selection.frameworkIndicatorId,
          )
          if (indicator) {
            rows.push(
              standardIndicatorRow(indicator, {
                resultLevel: 'Intermediate Outcome',
                finalOutcome: finalOutcomes,
                pathway: pathway.pathwayName,
                intermediateOutcome: outcome.statement,
              }),
            )
          }
        })
        configuration.projectSpecificIndicators.forEach((indicator) => {
          rows.push({
            resultLevel: 'Intermediate Outcome',
            finalOutcome: finalOutcomes,
            pathway: pathway.pathwayName,
            intermediateOutcome: outcome.statement,
            indicator: indicator.wording,
            indicatorType: 'Project-specific',
            requirement: 'Optional',
            frameworkSource: 'Standard framework',
          })
        })
      },
    )
  })
}

function buildSavedInputRows(
  document: PersistedProjectDesignV1,
  pathways: StandardPathwayContext[],
  framework: FrameworkData,
): InputExportRow[] {
  const rows: InputExportRow[] = []
  document.design.projectPathways.forEach((persistedPathway) => {
    const pathway = pathways.find(
      (candidate) =>
        candidate.pathwayId === persistedPathway.pathwayId,
    )
    if (!pathway) {
      throw new ProjectExportError(
        `Pathway ${persistedPathway.pathwayId} is unavailable for input export.`,
      )
    }
    const finalOutcomes = joinUnique(
      pathway.finalOutcomeStatements,
      '; ',
    )
    persistedPathway.intermediateOutcomeConfigurations.forEach(
      (configuration) => {
        const outcome = framework.intermediateOutcomes.find(
          (candidate) =>
            candidate.id ===
              configuration.frameworkIntermediateOutcomeId &&
            candidate.pathwayId === persistedPathway.pathwayId,
        )
        if (!outcome) {
          throw new ProjectExportError(
            `Intermediate Outcome ${configuration.frameworkIntermediateOutcomeId} is unavailable for input export.`,
          )
        }
        configuration.inputs.forEach((input) => {
          rows.push({
            finalOutcome: finalOutcomes,
            pathway: pathway.pathwayName,
            intermediateOutcome: outcome.statement,
            inputCategory: inputCategoryLabel(
              input.inputCategoryId,
              framework,
            ),
            input: input.details,
          })
        })
      },
    )
  })

  const custom = document.design.customInnovation
  custom?.pathway.intermediateOutcomes.forEach((outcome) => {
    outcome.inputs.forEach((input) => {
      rows.push({
        finalOutcome: custom.statement,
        pathway: custom.pathway.name,
        intermediateOutcome: outcome.statement,
        inputCategory: inputCategoryLabel(
          input.inputCategoryId,
          framework,
        ),
        input: input.details,
      })
    })
  })
  return rows
}

function addCustomInnovationRows(
  model: Pick<
    ProjectExportModel,
    'resultsFramework' | 'activitiesOutputs' | 'indicators'
  >,
  state: ProjectDesignState,
  framework: FrameworkData,
) {
  const custom = state.customInnovation
  if (!custom) return
  const finalOutcome = custom.statement
  const pathway = custom.pathway.name
  const impactArea = joinUnique(
    custom.impactAreaIds.map(
      (impactId) =>
        framework.impacts.find((impact) => impact.id === impactId)
          ?.theme,
    ),
    '; ',
  )
  model.indicators.push({
    resultLevel: 'Final Outcome',
    finalOutcome,
    pathway,
    intermediateOutcome: '',
    indicator: custom.primaryIndicator.wording,
    indicatorType: 'Primary',
    requirement: 'Mandatory',
    frameworkSource: 'Custom innovation',
  })

  ;[...custom.pathway.intermediateOutcomes]
    .sort((left, right) => left.stepNumber - right.stepNumber)
    .forEach((outcome) => {
      model.resultsFramework.push({
        impactArea,
        finalOutcome,
        pathway,
        pathwayRelationship: 'Primary',
        intermediateOutcomeStep: outcome.stepNumber,
        intermediateOutcome: outcome.statement,
        frameworkSource: 'Custom innovation',
      })
      model.indicators.push({
        resultLevel: 'Intermediate Outcome',
        finalOutcome,
        pathway,
        intermediateOutcome: outcome.statement,
        indicator: outcome.primaryIndicator.wording,
        indicatorType: 'Primary',
        requirement: 'Mandatory',
        frameworkSource: 'Custom innovation',
      })
      outcome.additionalIndicators.forEach((indicator) => {
        model.indicators.push({
          resultLevel: 'Intermediate Outcome',
          finalOutcome,
          pathway,
          intermediateOutcome: outcome.statement,
          indicator: indicator.wording,
          indicatorType: 'Additional',
          requirement: 'Optional',
          frameworkSource: 'Custom innovation',
        })
      })
      outcome.activities.forEach((activity) => {
        const planning = effectivePlanning(activity, state)
        model.activitiesOutputs.push({
          finalOutcome,
          pathway,
          intermediateOutcome: outcome.statement,
          activity: activity.wording,
          activityType: 'Custom',
          projectDetails: activity.projectDetails,
          plannedQuantity: planning.plannedQuantity,
          unit: exportUnit(planning),
          plannedOutput: displayedOutputText(planning, null) ?? '',
        })
      })
    })
}

function standardDonorRows(
  state: ProjectDesignState,
  framework: FrameworkData,
  pathways: StandardPathwayContext[],
): DonorLogframeExportRow[] {
  const rows: DonorLogframeExportRow[] = []
  const representedImpacts = getImpactsRepresentedByProject(
    framework,
    state,
  )
  representedImpacts.forEach((impact) => {
    const linkedOutcomes = state.selectedFinalOutcomeIds
      .filter((finalOutcomeId) =>
        framework.finalOutcomeImpactLinks.some(
          (link) =>
            link.finalOutcomeId === finalOutcomeId &&
            link.impactId === impact.id,
        ),
      )
      .map((id) => finalOutcomeStatement(framework, id))
    if (state.customInnovation?.impactAreaIds.includes(impact.id)) {
      linkedOutcomes.push(state.customInnovation.statement)
    }
    rows.push({
      resultsLevel: 'Impact',
      resultStatement: impact.statement,
      finalOutcome: '',
      indicator: '',
      pathwayContext: joinUnique(linkedOutcomes, '; '),
      keyActivities: '',
      plannedOutputs: '',
    })
  })

  state.selectedFinalOutcomeIds.forEach((finalOutcomeId) => {
    const outcome = framework.finalOutcomes.find(
      (candidate) => candidate.id === finalOutcomeId,
    )
    if (!outcome) return
    const pathwaysForOutcome = pathways.flatMap((pathway) =>
      state.outcomePathwayLinks.some(
        (link) =>
          link.pathwayId === pathway.pathwayId &&
          link.finalOutcomeId === finalOutcomeId,
      )
        ? [
            `${pathway.pathwayName} (${
              relationshipLabel(
                state.outcomePathwayLinks.find(
                  (link) =>
                    link.pathwayId === pathway.pathwayId &&
                    link.finalOutcomeId === finalOutcomeId,
                )?.relationshipType ?? 'primary',
              )
            })`,
          ]
        : [],
    )
    rows.push({
      resultsLevel: 'Final Outcome',
      resultStatement: outcome.statement,
      finalOutcome: outcome.statement,
      indicator: joinUnique(
        outcome.primaryIndicatorIds.map((id) =>
          indicatorText(framework, id),
        ),
      ),
      pathwayContext: joinUnique(pathwaysForOutcome),
      keyActivities: '',
      plannedOutputs: '',
    })
  })

  pathways.forEach((pathway) => {
    const relationships = state.outcomePathwayLinks.filter(
      (link) => link.pathwayId === pathway.pathwayId,
    )
    pathway.intermediateOutcomes.forEach(
      ({ outcome, configuration }) => {
        const activityLabels = [
          ...configuration.standardActivities.map((selection) => {
            const activity = framework.suggestedActivities.find(
              (candidate) =>
                candidate.id === selection.frameworkActivityId,
            )
            return activity?.text
          }),
          ...configuration.projectSpecificActivities.map(
            (activity) => activity.wording,
          ),
        ]
        const plannedOutputs = [
          ...configuration.standardActivities.map((selection) => {
            const activity = framework.suggestedActivities.find(
              (candidate) =>
                candidate.id === selection.frameworkActivityId,
            )
            return activity
              ? displayedOutputText(
                  effectivePlanning(selection, state),
                  activity.outputPhrase,
                )
              : null
          }),
          ...configuration.projectSpecificActivities.map((activity) =>
            displayedOutputText(
              effectivePlanning(activity, state),
              null,
            ),
          ),
        ]
        relationships.forEach((relationship) => {
          rows.push({
            resultsLevel: 'Intermediate Outcome',
            resultStatement: outcome.statement,
            finalOutcome: finalOutcomeStatement(
              framework,
              relationship.finalOutcomeId,
            ),
            indicator: joinUnique([
              configuration.primaryIndicator
                ? indicatorText(
                    framework,
                    configuration.primaryIndicator.frameworkIndicatorId,
                  )
                : null,
              ...configuration.additionalIndicators.map((selection) =>
                indicatorText(
                  framework,
                  selection.frameworkIndicatorId,
                ),
              ),
              ...configuration.projectSpecificIndicators.map(
                (indicator) => indicator.wording,
              ),
            ]),
            pathwayContext: `${pathway.pathwayName} (${relationshipLabel(
              relationship.relationshipType,
            )})`,
            keyActivities: joinUnique(activityLabels),
            plannedOutputs: joinUnique(plannedOutputs),
          })
        })
      },
    )
  })
  return rows
}

function addCustomDonorRows(
  rows: DonorLogframeExportRow[],
  state: ProjectDesignState,
) {
  const custom = state.customInnovation
  if (!custom) return
  rows.push({
    resultsLevel: 'Final Outcome',
    resultStatement: custom.statement,
    finalOutcome: custom.statement,
    indicator: custom.primaryIndicator.wording,
    pathwayContext: `${custom.pathway.name} (Primary)\nCustom innovation`,
    keyActivities: '',
    plannedOutputs: '',
  })
  ;[...custom.pathway.intermediateOutcomes]
    .sort((left, right) => left.stepNumber - right.stepNumber)
    .forEach((outcome) => {
      rows.push({
        resultsLevel: 'Intermediate Outcome',
        resultStatement: outcome.statement,
        finalOutcome: custom.statement,
        indicator: joinUnique([
          outcome.primaryIndicator.wording,
          ...outcome.additionalIndicators.map(
            (indicator) => indicator.wording,
          ),
        ]),
        pathwayContext: `${custom.pathway.name}\nCustom innovation`,
        keyActivities: joinUnique(
          outcome.activities.map((activity) => activity.wording),
        ),
        plannedOutputs: joinUnique(
          outcome.activities.map((activity) =>
            displayedOutputText(
              effectivePlanning(activity, state),
              null,
            ),
          ),
        ),
      })
    })
}

export function buildProjectExportModel(
  record: ProjectRecord,
  framework: FrameworkData,
  exportDate = new Date(),
): ProjectExportModel {
  if (
    record.project.frameworkVersion !== framework.frameworkVersion ||
    record.project.frameworkSchemaVersion !== framework.schemaVersion
  ) {
    throw new ProjectExportError(
      'The exact saved framework version is unavailable for export.',
    )
  }
  const state = loadPersistedProject(record.project, framework).design
  const pathways = buildStandardPathwayContexts(state, framework)
  const resultsFramework: ResultsFrameworkExportRow[] = []
  const activitiesOutputs: ActivityOutputExportRow[] = []
  const indicators: IndicatorExportRow[] = []
  const inputs = buildSavedInputRows(record.project, pathways, framework)

  addStandardResultsRows(
    resultsFramework,
    state,
    framework,
    pathways,
  )
  addStandardActivityRows(
    activitiesOutputs,
    state,
    framework,
    pathways,
  )
  addStandardIndicatorRows(
    indicators,
    state,
    framework,
    pathways,
  )
  addCustomInnovationRows(
    { resultsFramework, activitiesOutputs, indicators },
    state,
    framework,
  )

  const donorLogframe = standardDonorRows(
    state,
    framework,
    pathways,
  )
  addCustomDonorRows(donorLogframe, state)
  const representedImpacts = getImpactsRepresentedByProject(
    framework,
    state,
  )
  const configuredPlannedOutputCount = activitiesOutputs.filter(
    (row) => row.plannedOutput,
  ).length

  return {
    metadata: {
      projectTitle: state.metadata.title,
      projectCode: record.project.project.projectCode ?? '',
      country: state.metadata.country,
      status: record.project.project.status,
      plannedStart: formatYearMonthDisplay(
        state.metadata.plannedStartDate,
      ),
      plannedEnd: formatYearMonthDisplay(
        state.metadata.plannedEndDate,
      ),
      plannedSelfHelpGroupCount:
        state.metadata.plannedSelfHelpGroupCount,
      frameworkVersion: record.project.frameworkVersion,
      frameworkSchemaVersion: record.project.frameworkSchemaVersion,
      projectSchemaVersion: record.project.schemaVersion,
      modifiedAt: record.modifiedAt,
      exportDate: exportDate.toISOString(),
    },
    summary: {
      selectedImpactAreas: representedImpacts.map(
        (impact) => impact.theme,
      ),
      finalOutcomeCount:
        state.selectedFinalOutcomeIds.length +
        (state.customInnovation ? 1 : 0),
      uniquePathwayCount:
        state.projectPathways.length + (state.customInnovation ? 1 : 0),
      intermediateOutcomeCount:
        state.projectPathways.reduce(
          (count, pathway) =>
            count +
            pathway.intermediateOutcomeConfigurations.length,
          0,
        ) +
        (state.customInnovation?.pathway.intermediateOutcomes.length ?? 0),
      selectedActivityCount: activitiesOutputs.length,
      configuredPlannedOutputCount,
    },
    resultsFramework,
    activitiesOutputs,
    indicators,
    inputs,
    donorLogframe,
    theoryOfChange: generateTheoryOfChangeGraph({
      project: state,
      framework,
      inputCategories,
    }),
  }
}

export function buildProjectExportModelFromRecord(
  record: ProjectRecord,
  exportDate = new Date(),
): ProjectExportModel {
  const framework = getFrameworkByVersion(record.project.frameworkVersion)
  if (
    !framework ||
    framework.schemaVersion !== record.project.frameworkSchemaVersion
  ) {
    throw new ProjectExportError(
      'The exact saved framework version is unavailable for export.',
    )
  }
  return buildProjectExportModel(record, framework, exportDate)
}
