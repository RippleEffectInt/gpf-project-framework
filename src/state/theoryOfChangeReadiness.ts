import type { FrameworkData } from '../types/framework'
import type { ProjectDesignState } from '../types/project'
import { getCustomInnovationValidation } from './customInnovation'
import {
  getIncompleteFinalOutcomeIds,
  hasAtLeastOneFinalOutcome,
  isPathwayTechnicallyValid,
} from './journeySelectors'

export interface TheoryOfChangeReadiness {
  ready: boolean
  issues: string[]
}

export function getTheoryOfChangeReadiness(
  framework: FrameworkData,
  state: ProjectDesignState,
): TheoryOfChangeReadiness {
  const issues: string[] = []
  if (!hasAtLeastOneFinalOutcome(state)) {
    issues.push('Select at least one Final Outcome.')
  }

  state.selectedFinalOutcomeIds.forEach((finalOutcomeId) => {
    const outcome = framework.finalOutcomes.find(
      (candidate) => candidate.id === finalOutcomeId && candidate.active,
    )
    if (!outcome) {
      issues.push('A selected Final Outcome is unavailable in the framework.')
    }
  })

  getIncompleteFinalOutcomeIds(state).forEach((finalOutcomeId) => {
    const outcome = framework.finalOutcomes.find(
      (candidate) => candidate.id === finalOutcomeId,
    )
    issues.push(
      `Select a Primary pathway for ${
        outcome?.shortLabel ?? outcome?.statement ?? 'each Final Outcome'
      }.`,
    )
  })

  state.projectPathways.forEach((projectPathway) => {
    const pathway = framework.pathways.find(
      (candidate) =>
        candidate.id === projectPathway.pathwayId && candidate.active,
    )
    const steps = projectPathway.intermediateOutcomeConfigurations.flatMap(
      (configuration) => {
        const outcome = framework.intermediateOutcomes.find(
          (candidate) =>
            candidate.id === configuration.frameworkIntermediateOutcomeId &&
            candidate.pathwayId === projectPathway.pathwayId &&
            candidate.active,
        )
        return outcome ? [outcome.stepNumber] : []
      },
    )
    const validStepOrder =
      steps.length ===
        projectPathway.intermediateOutcomeConfigurations.length &&
      new Set(steps).size === steps.length &&
      steps.every((step) => step > 0)
    if (
      !pathway ||
      !isPathwayTechnicallyValid(projectPathway) ||
      !validStepOrder
    ) {
      issues.push(
        `${
          pathway?.name ?? 'A selected pathway'
        } needs a valid Intermediate Outcome chain.`,
      )
    }
  })

  state.outcomePathwayLinks.forEach((link) => {
    if (
      !state.projectPathways.some(
        (pathway) => pathway.pathwayId === link.pathwayId,
      )
    ) {
      issues.push('A selected pathway relationship has no pathway configuration.')
    }
  })

  const customValidation = getCustomInnovationValidation(
    state.customInnovation,
  )
  customValidation.issues.forEach((issue) => {
    issues.push(`Custom innovation: ${issue}`)
  })

  return {
    ready: issues.length === 0,
    issues: [...new Set(issues)],
  }
}
