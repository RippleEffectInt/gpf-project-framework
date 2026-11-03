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
