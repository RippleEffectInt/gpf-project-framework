import type { ProjectDesignState } from '../types/project'
import type { ProjectDesignAction } from './projectDesign'

export const MAX_FINAL_OUTCOMES = 5

export function finalOutcomeCount(state: ProjectDesignState): number {
  return new Set(state.selectedFinalOutcomeIds).size + (state.customInnovation ? 1 : 0)
}

// Check the whole addition, including the Primary outcome of a Related pathway.
// Existing over-limit designs can still load, save, remove and edit selections.
export function outcomeLimitMessage(
  state: ProjectDesignState,
  action: ProjectDesignAction,
): string | null {
  const ids = new Set(state.selectedFinalOutcomeIds)
  let custom = Boolean(state.customInnovation)
  if (action.type === 'selectFinalOutcome') ids.add(action.finalOutcomeId)
  if (action.type === 'addPathway') {
    ids.add(action.finalOutcomeId)
    if (action.relationshipType === 'related') ids.add(action.frameworkPrimaryFinalOutcomeId)
  }
  if (action.type === 'addCustomInnovation') custom = true
  const nextCount = ids.size + (custom ? 1 : 0)
  if (nextCount <= MAX_FINAL_OUTCOMES || nextCount <= finalOutcomeCount(state)) return null
  return `A project can have at most ${MAX_FINAL_OUTCOMES} Final Outcomes, including custom innovation and Primary outcomes added by Related pathways. This choice would bring the total to ${nextCount}. Remove an outcome before adding this choice.`
}
