import type {
  ActivityOutputPlanning,
  OutputUnitSelection,
  ProjectSpecificActivity,
  StandardActivitySelection,
} from '../types/project'

export const OUTPUT_UNIT_OPTIONS = [
  { value: 'no-unit', label: 'No unit' },
  { value: 'linkages', label: 'linkages' },
  { value: 'people', label: 'people' },
  { value: 'schemes', label: 'schemes' },
  { value: 'platforms', label: 'platforms' },
  { value: 'events', label: 'events' },
  { value: 'organisations', label: 'organisations' },
  { value: 'facilities', label: 'facilities' },
  { value: 'businesses', label: 'businesses' },
  { value: 'processes', label: 'processes' },
  { value: 'service-providers', label: 'service providers' },
  { value: 'local-infrastructure', label: 'local infrastructure' },
  { value: 'standards', label: 'standards' },
  { value: 'providers', label: 'providers' },
  { value: 'self-help-groups', label: 'Self Help Groups' },
  { value: 'enterprises', label: 'enterprises' },
  { value: 'communities', label: 'communities' },
  { value: 'demonstration-plots', label: 'demonstration plots' },
  { value: 'households', label: 'households' },
  { value: 'committees', label: 'committees' },
  { value: 'ripple-effect', label: 'Ripple Effect' },
  { value: 'pfts', label: 'PFTs' },
  { value: 'community-workshops', label: 'Community workshops' },
  { value: 'farmer-field-schools', label: 'Farmer Field Schools' },
  { value: 'other', label: 'Other' },
] as const satisfies ReadonlyArray<{
  value: Exclude<OutputUnitSelection, null>
  label: string
}>

const OUTPUT_UNIT_LABELS = Object.fromEntries(
  OUTPUT_UNIT_OPTIONS.map((option) => [option.value, option.label]),
) as Record<Exclude<OutputUnitSelection, null>, string>

export const emptyActivityOutputPlanning: ActivityOutputPlanning = {
  plannedQuantity: null,
  outputUnitSelection: null,
  customOutputUnit: null,
  useProjectSelfHelpGroupTotal: false,
  outputTextOverride: null,
}

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

export function parseOptionalPositiveInteger(
  value: string,
): number | null | 'invalid' {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (!/^\d+$/.test(trimmed)) return 'invalid'
  const parsed = Number(trimmed)
  return isPositiveInteger(parsed) ? parsed : 'invalid'
}

export function isOutputUnitSelection(
  value: unknown,
): value is OutputUnitSelection {
  return (
    value === null ||
    OUTPUT_UNIT_OPTIONS.some((option) => option.value === value)
  )
}

export function normalizeActivityOutput(
  planning: Partial<ActivityOutputPlanning> | undefined,
): ActivityOutputPlanning {
  return {
    plannedQuantity: planning?.plannedQuantity ?? null,
    outputUnitSelection: isOutputUnitSelection(
      planning?.outputUnitSelection,
    )
      ? planning.outputUnitSelection
      : null,
    customOutputUnit: planning?.customOutputUnit ?? null,
    useProjectSelfHelpGroupTotal:
      planning?.useProjectSelfHelpGroupTotal === true,
    outputTextOverride: planning?.outputTextOverride ?? null,
  }
}

export function getSelectedOutputUnit(
  planning: Pick<
    ActivityOutputPlanning,
    'outputUnitSelection' | 'customOutputUnit'
  >,
): string | null {
  if (
    planning.outputUnitSelection === null ||
    planning.outputUnitSelection === 'no-unit'
  ) {
    return null
  }
  if (planning.outputUnitSelection === 'other') {
    return planning.customOutputUnit?.trim() || null
  }
  return OUTPUT_UNIT_LABELS[planning.outputUnitSelection]
}

export function isGeneratedOutputPhraseAllowed(
  outputPhrase: string | null | undefined,
): boolean {
  return Boolean(
    outputPhrase?.trim() &&
      !/\b(adopt(?:ion|ing|ed)?|successfully|behaviou?r change|outcome achievement|impacts?)\b/i.test(
        outputPhrase,
      ),
  )
}

export function generateOutputText(
  outputPhrase: string | null | undefined,
  planning: Pick<
    ActivityOutputPlanning,
    'plannedQuantity' | 'outputUnitSelection' | 'customOutputUnit'
  >,
): string | null {
  const phrase = outputPhrase?.trim()
  if (
    !isPositiveInteger(planning.plannedQuantity) ||
    planning.outputUnitSelection === null ||
    !phrase ||
    !isGeneratedOutputPhraseAllowed(phrase)
  ) {
    return null
  }
  const unit = getSelectedOutputUnit(planning)
  if (
    planning.outputUnitSelection !== 'no-unit' &&
    !unit
  ) {
    return null
  }
  return [
    String(planning.plannedQuantity),
    unit,
    phrase,
  ]
    .filter(Boolean)
    .join(' ')
}

export function displayedOutputText(
  planning: Partial<ActivityOutputPlanning>,
  outputPhrase?: string | null,
): string | null {
  const normalized = normalizeActivityOutput(planning)
  const override = normalized.outputTextOverride?.trim()
  if (override) return override
  return generateOutputText(outputPhrase, normalized)
}

export function createActivityOutputPlanning(): ActivityOutputPlanning {
  return { ...emptyActivityOutputPlanning }
}

export function withUpdatedOutputQuantity(
  planning: ActivityOutputPlanning,
  plannedQuantity: number | null,
): ActivityOutputPlanning {
  return {
    ...planning,
    plannedQuantity,
    useProjectSelfHelpGroupTotal: false,
  }
}

export function withUpdatedOutputUnit(
  planning: ActivityOutputPlanning,
  outputUnitSelection: OutputUnitSelection,
): ActivityOutputPlanning {
  return {
    ...planning,
    outputUnitSelection,
    customOutputUnit:
      outputUnitSelection === 'other' ? planning.customOutputUnit : null,
    useProjectSelfHelpGroupTotal:
      outputUnitSelection === 'self-help-groups'
        ? planning.useProjectSelfHelpGroupTotal
        : false,
  }
}

export function withProjectSelfHelpGroupTotal(
  planning: ActivityOutputPlanning,
  useProjectSelfHelpGroupTotal: boolean,
  plannedSelfHelpGroupCount: number | null,
): ActivityOutputPlanning {
  if (!useProjectSelfHelpGroupTotal) {
    return { ...planning, useProjectSelfHelpGroupTotal: false }
  }
  return {
    ...planning,
    useProjectSelfHelpGroupTotal: true,
    plannedQuantity: isPositiveInteger(plannedSelfHelpGroupCount)
      ? plannedSelfHelpGroupCount
      : null,
  }
}

export function recountSelfHelpGroupOutputs<
  T extends StandardActivitySelection | ProjectSpecificActivity,
>(
  activities: T[],
  plannedSelfHelpGroupCount: number | null,
): T[] {
  return activities.map((activity) => {
    if (!activity.useProjectSelfHelpGroupTotal) return activity
    return {
      ...activity,
      plannedQuantity: isPositiveInteger(plannedSelfHelpGroupCount)
        ? plannedSelfHelpGroupCount
        : null,
    }
  })
}

export function createStandardActivitySelection(
  frameworkActivityId: string,
  output: ActivityOutputPlanning = emptyActivityOutputPlanning,
  projectNotes = '',
): StandardActivitySelection {
  return {
    frameworkActivityId,
    projectNotes,
    ...output,
  }
}

export function createCustomActivityOutputPlanning(
  plannedQuantity: number | null = null,
  outputUnitSelection: OutputUnitSelection = null,
): ActivityOutputPlanning {
  return {
    plannedQuantity,
    outputUnitSelection,
    customOutputUnit: null,
    useProjectSelfHelpGroupTotal: false,
    outputTextOverride: null,
  }
}

export function isOutputConfigured(
  planning: Partial<ActivityOutputPlanning>,
  outputPhrase?: string | null,
): boolean {
  const normalized = normalizeActivityOutput(planning)
  if (normalized.outputTextOverride?.trim()) return true
  return generateOutputText(outputPhrase, normalized) !== null
}

export function activityOutputSummary(
  standardActivities: StandardActivitySelection[],
  projectSpecificActivities: ProjectSpecificActivity[],
  outputPhraseByActivityId: ReadonlyMap<string, string | null>,
): { configured: number; needingAttention: number } {
  const configuredStandard = standardActivities.filter((activity) =>
    isOutputConfigured(
      activity,
      outputPhraseByActivityId.get(activity.frameworkActivityId),
    ),
  ).length
  const configuredCustom = projectSpecificActivities.filter((activity) =>
    isOutputConfigured(activity, null),
  ).length
  const configured = configuredStandard + configuredCustom
  return {
    configured,
    needingAttention:
      standardActivities.length +
      projectSpecificActivities.length -
      configured,
  }
}

export function formatActivityOutputSummary(summary: {
  configured: number
  needingAttention: number
}): string | null {
  if (summary.configured === 0 && summary.needingAttention === 0) return null
  const configuredLabel =
    summary.configured === 1
      ? '1 output configured'
      : `${summary.configured} outputs configured`
  if (summary.needingAttention === 0) return configuredLabel
  const attentionLabel =
    summary.needingAttention === 1
      ? '1 needs attention'
      : `${summary.needingAttention} need attention`
  return `${configuredLabel} · ${attentionLabel}`
}
