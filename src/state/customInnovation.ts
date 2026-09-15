import type {
  CustomInnovationOutcome,
  CustomIntermediateOutcome,
  CustomPathway,
  CustomPrimaryIndicator,
  ProjectDesignState,
  ProjectInput,
  ProjectSpecificActivity,
  ProjectSpecificIndicator,
} from '../types/project'

export function createCustomPrimaryIndicator(
  id: string,
): CustomPrimaryIndicator {
  return { id, wording: '', measurementNotes: '' }
}

export function createCustomIntermediateOutcome(
  id: string,
  primaryIndicatorId: string,
  stepNumber: number,
): CustomIntermediateOutcome {
  return {
    id,
    isCustom: true,
    stepNumber,
    statement: '',
    primaryIndicator: createCustomPrimaryIndicator(primaryIndicatorId),
    additionalIndicators: [],
    activities: [],
    inputs: [],
  }
}

export function createCustomInnovation(ids: {
  outcomeId: string
  pathwayId: string
  intermediateOutcomeId: string
  outcomePrimaryIndicatorId: string
  intermediatePrimaryIndicatorId: string
}): CustomInnovationOutcome {
  return {
    id: ids.outcomeId,
    isCustom: true,
    shortLabel: '',
    statement: '',
    rationale: '',
    impactAreaIds: [],
    primaryIndicator: createCustomPrimaryIndicator(ids.outcomePrimaryIndicatorId),
    pathway: {
      id: ids.pathwayId,
      isCustom: true,
      name: '',
      description: '',
      rationale: '',
      intermediateOutcomes: [
        createCustomIntermediateOutcome(
          ids.intermediateOutcomeId,
          ids.intermediatePrimaryIndicatorId,
          1,
        ),
      ],
    },
  }
}

function hasText(value: string | undefined): boolean {
  return Boolean(value?.trim())
}

export function isCustomInnovationStructurallyComplete(
  custom: CustomInnovationOutcome | null,
): boolean {
  if (!custom) return true
  return getCustomInnovationValidationIssues(custom).length === 0
}

export function getCustomInnovationValidationIssues(
  custom: CustomInnovationOutcome,
): string[] {
  const issues: string[] = []
  if (!hasText(custom.shortLabel)) issues.push('Custom outcome short label is required.')
  if (!hasText(custom.statement)) {
    issues.push('Custom outcome statement is required.')
  }
  if (!hasText(custom.rationale)) issues.push('Custom outcome rationale is required.')
  if (custom.impactAreaIds.length === 0) {
    issues.push('Select at least one Impact Area')
  }
  if (!hasText(custom.primaryIndicator.wording)) {
    issues.push('Custom outcome Primary indicator is required.')
  }
  if (!hasText(custom.pathway.name)) issues.push('Custom pathway name is required.')
  if (!hasText(custom.pathway.description)) {
    issues.push('Custom pathway description is required.')
  }
  if (!hasText(custom.pathway.rationale)) {
    issues.push('Explain why this custom pathway is needed.')
  }
  if (custom.pathway.intermediateOutcomes.length === 0) {
    issues.push('Add at least one Intermediate Outcome')
  }
  custom.pathway.intermediateOutcomes.forEach((outcome, index) => {
    if (!hasText(outcome.statement)) {
      issues.push(`Add a statement for Intermediate Outcome ${index + 1}`)
    }
    if (!hasText(outcome.primaryIndicator.wording)) {
      issues.push(
        `Add a Primary indicator for Intermediate Outcome ${index + 1}`,
      )
    }
    if (outcome.activities.length === 0) {
      issues.push(`Add an activity for Intermediate Outcome ${index + 1}`)
    }
  })
  return issues
}

function withRenumberedSteps(pathway: CustomPathway): CustomPathway {
  return {
    ...pathway,
    intermediateOutcomes: pathway.intermediateOutcomes.map((outcome, index) => ({
      ...outcome,
      stepNumber: index + 1,
    })),
  }
}

export function createBlankCustomInnovation(): CustomInnovationOutcome {
  return createCustomInnovation({
    outcomeId: `custom-fo-${crypto.randomUUID()}`,
    pathwayId: `custom-pw-${crypto.randomUUID()}`,
    intermediateOutcomeId: `custom-io-${crypto.randomUUID()}`,
    outcomePrimaryIndicatorId: `custom-fo-ind-${crypto.randomUUID()}`,
    intermediatePrimaryIndicatorId: `custom-io-ind-${crypto.randomUUID()}`,
  })
}

export function createBlankCustomIntermediateOutcome(
  stepNumber: number,
): CustomIntermediateOutcome {
  return createCustomIntermediateOutcome(
    `custom-io-${crypto.randomUUID()}`,
    `custom-io-ind-${crypto.randomUUID()}`,
    stepNumber,
  )
}

export interface CustomInnovationValidation {
  complete: boolean
  issues: string[]
}

export function getCustomInnovationValidation(
  custom: CustomInnovationOutcome | null,
): CustomInnovationValidation {
  if (!custom) return { complete: true, issues: [] }
  const issues = getCustomInnovationValidationIssues(custom)
  return { complete: issues.length === 0, issues }
}

export function getCustomOutcomeCompletionIssues(
  custom: CustomInnovationOutcome | null,
): string[] {
  return getCustomInnovationValidation(custom).issues
}

function updateCustom(
  state: ProjectDesignState,
  update: (custom: CustomInnovationOutcome) => CustomInnovationOutcome,
): ProjectDesignState {
  if (!state.customInnovation) return state
  const next = update(state.customInnovation)
  if (next === state.customInnovation) return state
  return { ...state, customInnovation: next }
}

function updateCustomIo(
  state: ProjectDesignState,
  intermediateOutcomeId: string,
  update: (outcome: CustomIntermediateOutcome) => CustomIntermediateOutcome,
): ProjectDesignState {
  return updateCustom(state, (custom) => ({
    ...custom,
    pathway: {
      ...custom.pathway,
      intermediateOutcomes: custom.pathway.intermediateOutcomes.map((outcome) =>
        outcome.id === intermediateOutcomeId ? update(outcome) : outcome,
      ),
    },
  }))
}

export type CustomInnovationAction =
  | { type: 'addCustomInnovation'; customInnovation: CustomInnovationOutcome }
  | {
      type: 'updateCustomInnovationFields'
      payload: Partial<
        Pick<CustomInnovationOutcome, 'shortLabel' | 'statement' | 'rationale'>
      >
    }
  | { type: 'setCustomImpactAreaIds'; impactAreaIds: string[] }
  | {
      type: 'setCustomOutcomePrimaryIndicator'
      indicator: CustomPrimaryIndicator
    }
  | {
      type: 'updateCustomPathway'
      payload: Partial<Pick<CustomPathway, 'name' | 'description' | 'rationale'>>
    }
  | {
      type: 'addCustomIntermediateOutcome'
      intermediateOutcome: CustomIntermediateOutcome
    }
  | {
      type: 'updateCustomIntermediateOutcome'
      intermediateOutcomeId: string
      payload: Partial<Pick<CustomIntermediateOutcome, 'statement'>>
    }
  | {
      type: 'setCustomIoPrimaryIndicator'
      intermediateOutcomeId: string
      indicator: CustomPrimaryIndicator
    }
  | { type: 'deleteCustomIntermediateOutcome'; intermediateOutcomeId: string }
  | {
      type: 'moveCustomIntermediateOutcome'
      intermediateOutcomeId: string
      direction: 'up' | 'down'
    }
  | {
      type: 'addCustomIoAdditionalIndicator'
      intermediateOutcomeId: string
      indicator: ProjectSpecificIndicator
    }
  | {
      type: 'updateCustomIoAdditionalIndicator'
      intermediateOutcomeId: string
      indicator: ProjectSpecificIndicator
    }
  | {
      type: 'deleteCustomIoAdditionalIndicator'
      intermediateOutcomeId: string
      indicatorId: string
    }
  | {
      type: 'addCustomIoActivity'
      intermediateOutcomeId: string
      activity: ProjectSpecificActivity
    }
  | {
      type: 'updateCustomIoActivity'
      intermediateOutcomeId: string
      activity: ProjectSpecificActivity
    }
  | {
      type: 'deleteCustomIoActivity'
      intermediateOutcomeId: string
      activityId: string
    }
  | {
      type: 'addCustomIoInput'
      intermediateOutcomeId: string
      input: ProjectInput
    }
  | {
      type: 'updateCustomIoInput'
      intermediateOutcomeId: string
      input: ProjectInput
    }
  | { type: 'deleteCustomIoInput'; intermediateOutcomeId: string; inputId: string }
  | { type: 'removeCustomInnovation' }

export function applyCustomInnovationAction(
  state: ProjectDesignState,
  action: CustomInnovationAction,
): ProjectDesignState {
  switch (action.type) {
    case 'addCustomInnovation':
      if (state.customInnovation) return state
      return { ...state, customInnovation: action.customInnovation }

    case 'updateCustomInnovationFields':
      return updateCustom(state, (custom) => ({ ...custom, ...action.payload }))

    case 'setCustomImpactAreaIds':
      return updateCustom(state, (custom) => ({
        ...custom,
        impactAreaIds: [...new Set(action.impactAreaIds)],
      }))

    case 'setCustomOutcomePrimaryIndicator':
      return updateCustom(state, (custom) => ({
        ...custom,
        primaryIndicator: action.indicator,
      }))

    case 'updateCustomPathway':
      return updateCustom(state, (custom) => ({
        ...custom,
        pathway: { ...custom.pathway, ...action.payload },
      }))

    case 'addCustomIntermediateOutcome':
      return updateCustom(state, (custom) => ({
        ...custom,
        pathway: withRenumberedSteps({
          ...custom.pathway,
          intermediateOutcomes: [
            ...custom.pathway.intermediateOutcomes,
            action.intermediateOutcome,
          ],
        }),
      }))

    case 'updateCustomIntermediateOutcome':
      return updateCustomIo(
        state,
        action.intermediateOutcomeId,
        (outcome) => ({ ...outcome, ...action.payload }),
      )

    case 'setCustomIoPrimaryIndicator':
      return updateCustomIo(state, action.intermediateOutcomeId, (outcome) => ({
        ...outcome,
        primaryIndicator: action.indicator,
      }))

    case 'deleteCustomIntermediateOutcome':
      return updateCustom(state, (custom) => {
        if (custom.pathway.intermediateOutcomes.length <= 1) return custom
        return {
          ...custom,
          pathway: withRenumberedSteps({
            ...custom.pathway,
            intermediateOutcomes: custom.pathway.intermediateOutcomes.filter(
              (outcome) => outcome.id !== action.intermediateOutcomeId,
            ),
          }),
        }
      })

    case 'moveCustomIntermediateOutcome':
      return updateCustom(state, (custom) => {
        const currentIndex = custom.pathway.intermediateOutcomes.findIndex(
          (outcome) => outcome.id === action.intermediateOutcomeId,
        )
        if (currentIndex < 0) return custom
        const targetIndex =
          action.direction === 'up' ? currentIndex - 1 : currentIndex + 1
        if (
          targetIndex < 0 ||
          targetIndex >= custom.pathway.intermediateOutcomes.length
        ) {
          return custom
        }
        const reordered = [...custom.pathway.intermediateOutcomes]
        const current = reordered[currentIndex]
        const target = reordered[targetIndex]
        if (!current || !target) return custom
        reordered[currentIndex] = target
        reordered[targetIndex] = current
        return {
          ...custom,
          pathway: withRenumberedSteps({
            ...custom.pathway,
            intermediateOutcomes: reordered,
          }),
        }
      })

    case 'addCustomIoAdditionalIndicator':
      return updateCustomIo(state, action.intermediateOutcomeId, (outcome) => ({
        ...outcome,
        additionalIndicators: [...outcome.additionalIndicators, action.indicator],
      }))

    case 'updateCustomIoAdditionalIndicator':
      return updateCustomIo(state, action.intermediateOutcomeId, (outcome) => ({
        ...outcome,
        additionalIndicators: outcome.additionalIndicators.map((indicator) =>
          indicator.id === action.indicator.id ? action.indicator : indicator,
        ),
      }))

    case 'deleteCustomIoAdditionalIndicator':
      return updateCustomIo(state, action.intermediateOutcomeId, (outcome) => ({
        ...outcome,
        additionalIndicators: outcome.additionalIndicators.filter(
          (indicator) => indicator.id !== action.indicatorId,
        ),
      }))

    case 'addCustomIoActivity':
      return updateCustomIo(state, action.intermediateOutcomeId, (outcome) => ({
        ...outcome,
        activities: [...outcome.activities, action.activity],
      }))

    case 'updateCustomIoActivity':
      return updateCustomIo(state, action.intermediateOutcomeId, (outcome) => ({
        ...outcome,
        activities: outcome.activities.map((activity) =>
          activity.id === action.activity.id ? action.activity : activity,
        ),
      }))

    case 'deleteCustomIoActivity':
      return updateCustomIo(state, action.intermediateOutcomeId, (outcome) => ({
        ...outcome,
        activities: outcome.activities.filter(
          (activity) => activity.id !== action.activityId,
        ),
      }))

    case 'addCustomIoInput':
      return updateCustomIo(state, action.intermediateOutcomeId, (outcome) => ({
        ...outcome,
        inputs: [...outcome.inputs, action.input],
      }))

    case 'updateCustomIoInput':
      return updateCustomIo(state, action.intermediateOutcomeId, (outcome) => ({
        ...outcome,
        inputs: outcome.inputs.map((input) =>
          input.id === action.input.id ? action.input : input,
        ),
      }))

    case 'deleteCustomIoInput':
      return updateCustomIo(state, action.intermediateOutcomeId, (outcome) => ({
        ...outcome,
        inputs: outcome.inputs.filter((input) => input.id !== action.inputId),
      }))

    case 'removeCustomInnovation':
      return { ...state, customInnovation: null }
  }
}
