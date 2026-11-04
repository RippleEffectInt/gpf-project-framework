import type { FrameworkData } from '../types/framework'
import type { ProjectDesignState } from '../types/project'
import { getSuggestedActivitiesForIntermediateOutcome } from '../services/frameworkService'
import { createActivityOutputPlanning, isPositiveInteger } from './activityOutputs'
import type { ProjectDesignAction } from './projectDesign'

/** A deliberately explicit preset: never rerun on navigation or overwrite existing work. */
export function guidedPreparationActions(data: FrameworkData, state: ProjectDesignState): ProjectDesignAction[] {
  const actions: ProjectDesignAction[] = []
  const total = state.metadata.plannedSelfHelpGroupCount
  for (const pathway of state.projectPathways) {
    for (const configuration of pathway.intermediateOutcomeConfigurations) {
      if (configuration.reviewed || configuration.standardActivities.length || configuration.projectSpecificActivities.length) continue
      for (const activity of getSuggestedActivitiesForIntermediateOutcome(data, configuration.frameworkIntermediateOutcomeId)) {
        actions.push({
          type: 'setStandardActivity', pathwayId: pathway.pathwayId,
          intermediateOutcomeId: configuration.frameworkIntermediateOutcomeId,
          frameworkActivityId: activity.id, selected: true,
          output: isPositiveInteger(total) ? {
            ...createActivityOutputPlanning(), plannedQuantity: total,
            outputUnitSelection: 'self-help-groups', useProjectSelfHelpGroupTotal: true,
          } : createActivityOutputPlanning(),
        })
      }
    }
  }
  return actions
}

/** New designs only. Each step is considered once, even if users remove every activity later. */
export function guidedAutomaticActions(data: FrameworkData, state: ProjectDesignState): ProjectDesignAction[] {
  if (!state.guidedInitializedStepKeys) return []
  const marked = new Set(state.guidedInitializedStepKeys)
  const keys: string[] = []
  const projectPathways = state.projectPathways.map(pathway => ({ ...pathway,
    intermediateOutcomeConfigurations: pathway.intermediateOutcomeConfigurations.filter(io => {
      const key = `${pathway.pathwayId}/${io.frameworkIntermediateOutcomeId}`
      if (marked.has(key)) return false
      keys.push(key)
      return !io.additionalIndicators.length && !io.projectSpecificIndicators.length && !io.inputs.length
    }),
  }))
  if (!keys.length) return []
  return [...guidedPreparationActions(data, { ...state, projectPathways }), { type: 'markGuidedStepsInitialized', keys }]
}
