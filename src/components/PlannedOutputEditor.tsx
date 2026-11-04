import { useState } from 'react'
import {
  OUTPUT_UNIT_OPTIONS,
  displayedOutputText,
  isGeneratedOutputPhraseAllowed,
  parseOptionalPositiveInteger,
  withProjectSelfHelpGroupTotal,
  withUpdatedOutputQuantity,
  withUpdatedOutputUnit,
} from '../state/activityOutputs'
import type { SuggestedActivity } from '../types/framework'
import type {
  ActivityOutputPlanning,
  OutputUnitSelection,
} from '../types/project'

export function PlannedOutputEditor({
  planning,
  activity,
  plannedSelfHelpGroupCount,
  defaultWordingEditorOpen,
  onChange,
}: {
  planning: ActivityOutputPlanning
  activity?: Pick<SuggestedActivity, 'outputPhrase' | 'text'>
  plannedSelfHelpGroupCount: number | null
  defaultWordingEditorOpen?: boolean
  onChange: (planning: ActivityOutputPlanning) => void
}) {
  const outputPhrase = activity?.outputPhrase ?? null
  const hasUsableOutputPhrase =
    isGeneratedOutputPhraseAllowed(outputPhrase)
  const [editingWording, setEditingWording] = useState(
    defaultWordingEditorOpen ?? !hasUsableOutputPhrase,
  )
  const useSelfHelpGroupTotalAvailable =
    planning.outputUnitSelection === 'self-help-groups' &&
    plannedSelfHelpGroupCount !== null
  const showManualQuantity =
    !useSelfHelpGroupTotalAvailable ||
    !planning.useProjectSelfHelpGroupTotal
  const outputText = displayedOutputText(planning, outputPhrase)
  const generatedOutput = displayedOutputText(
    { ...planning, outputTextOverride: null },
    outputPhrase,
  )

  return (
    <div className="planned-output">
      <h4>Planned output</h4>
      <p>Describe the measurable result of this activity. Check the quantity, what you are counting and the final wording before moving on.</p>
      <div className="planned-output-fields">
        {showManualQuantity && (
          <label>
            <span>Planned quantity</span>
            <small>Enter a positive whole number for this activity, or leave blank while drafting.</small>
            <input
              inputMode="numeric"
              value={
                planning.plannedQuantity === null
                  ? ''
                  : String(planning.plannedQuantity)
              }
              aria-label="Planned quantity"
              onChange={(event) => {
                const parsed = parseOptionalPositiveInteger(
                  event.target.value,
                )
                if (parsed === 'invalid') return
                onChange(withUpdatedOutputQuantity(planning, parsed))
              }}
            />
          </label>
        )}
        <label>
          <span>Unit</span>
          <small>Choose what the quantity counts, for example groups, households or events.</small>
          <select
            aria-label="Output unit"
            value={planning.outputUnitSelection ?? ''}
            onChange={(event) =>
              onChange(
                withUpdatedOutputUnit(
                  planning,
                  (event.target.value || null) as OutputUnitSelection,
                ),
              )
            }
          >
            <option value="">Select a unit</option>
            {OUTPUT_UNIT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {planning.outputUnitSelection === 'other' && (
          <label className="full-width">
            <span>Other unit</span>
            <small>Name what you are counting, for example demonstration plots.</small>
            <input
              aria-label="Other output unit"
              value={planning.customOutputUnit ?? ''}
              onChange={(event) =>
                onChange({
                  ...planning,
                  customOutputUnit: event.target.value || null,
                })
              }
            />
          </label>
        )}
      </div>

      {useSelfHelpGroupTotalAvailable && (
        <label className="checkbox-option planned-output-groups">
          <input
            type="checkbox"
            checked={planning.useProjectSelfHelpGroupTotal}
            onChange={(event) =>
              onChange(
                withProjectSelfHelpGroupTotal(
                  planning,
                  event.target.checked,
                  plannedSelfHelpGroupCount,
                ),
              )
            }
          />
          <span>
            Use all {plannedSelfHelpGroupCount} Self Help Groups
          </span>
        </label>
      )}

      {useSelfHelpGroupTotalAvailable && <p className="field-guidance">When checked, the quantity follows the group total in Project details. Uncheck it to enter a different quantity for this activity.</p>}

      <p className="planned-output-text">
        {outputText
          ? `Planned output: ${outputText}`
          : hasUsableOutputPhrase
            ? 'Choose a quantity and unit to generate a planned output.'
            : 'This activity has no usable framework output phrase. Add or confirm the planned output wording if needed.'}
      </p>

      {!editingWording && (
        <button
          className="text-button"
          type="button"
          onClick={() => setEditingWording(true)}
        >
          Edit wording
        </button>
      )}
      {editingWording && (
        <div className="planned-output-wording">
          <label className="planned-output-override">
            <span>Output wording</span>
            <textarea
              rows={2}
              aria-label="Output wording"
              value={planning.outputTextOverride ?? generatedOutput ?? ''}
              onChange={(event) =>
                onChange({
                  ...planning,
                  outputTextOverride: event.target.value || null,
                })
              }
            />
            <small>
              Write the complete output, including its quantity and unit. Custom wording stays as written when quantities change, so update it yourself. Reset to generated wording removes this override; it does not change the framework activity.
            </small>
          </label>
          <div className="inline-actions">
            <button
              className="text-button"
              type="button"
              onClick={() =>
                onChange({ ...planning, outputTextOverride: null })
              }
            >
              Reset to generated wording
            </button>
            {hasUsableOutputPhrase && (
              <button
                className="text-button"
                type="button"
                onClick={() => setEditingWording(false)}
              >
                Hide wording
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
