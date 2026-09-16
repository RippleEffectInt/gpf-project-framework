import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DesignProgress } from '../components/DesignProgress'
import { OptionalQuestion } from '../components/OptionalQuestion'
import {
  ADDED_SESSION_MESSAGE,
  SAVED_SESSION_MESSAGE,
  SessionSaveFeedback,
} from '../components/SessionSaveFeedback'
import { inputCategories } from '../data/inputCategories'
import {
  getAdditionalIndicatorsForIntermediateOutcome,
  getFinalOutcome,
  getIntermediateOutcomesForPathway,
  getPathway,
  getPrimaryIndicatorForIntermediateOutcome,
  getSuggestedActivitiesForIntermediateOutcome,
} from '../services/frameworkService'
import { useFramework, useProjectDesign } from '../state/AppState'
import {
  getMissingActivityCompletionMessages,
  getPathwayConfigurationStatus,
  intermediateOutcomeHasRequiredActivity,
  projectDesignReducer,
} from '../state/projectDesign'
import { PlannedOutputEditor } from '../components/PlannedOutputEditor'
import {
  activityOutputSummary,
  createActivityOutputPlanning,
  createCustomActivityOutputPlanning,
  formatActivityOutputSummary,
  normalizeActivityOutput,
} from '../state/activityOutputs'
import type { FrameworkData, IntermediateOutcome, SuggestedActivity } from '../types/framework'
import type {
  ConfigurationStatus,
  ProjectInput,
  ProjectIntermediateOutcomeConfiguration,
  ProjectSpecificActivity,
  ProjectSpecificIndicator,
} from '../types/project'

const statusLabels: Record<ConfigurationStatus, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  configured: 'Configured',
}

function createLocalId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

function OptionalActivityNotes({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const [saved, setSaved] = useState(false)
  return (
    <label className="activity-notes">
      <span>Project-specific details or notes — optional</span>
      <textarea
        aria-label="Project-specific details or notes — optional"
        placeholder="Add any project-specific details about this activity if useful. Leave blank if the standard activity description is sufficient."
        rows={2}
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setSaved(true)
        }}
      />
      {saved && (
        <SessionSaveFeedback message={SAVED_SESSION_MESSAGE} />
      )}
    </label>
  )
}

function ProjectSpecificIndicatorsEditor({
  pathwayId,
  intermediateOutcomeId,
  indicators,
}: {
  pathwayId: string
  intermediateOutcomeId: string
  indicators: ProjectSpecificIndicator[]
}) {
  const { dispatch } = useProjectDesign()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [wording, setWording] = useState('')
  const [measurementNotes, setMeasurementNotes] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)

  const reset = () => {
    setEditingId(null)
    setWording('')
    setMeasurementNotes('')
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!wording.trim()) return
    if (editingId) {
      reset()
      return
    }
    const indicator = {
      id: createLocalId('indicator'),
      wording: wording.trim(),
      measurementNotes: measurementNotes.trim(),
    }
    dispatch({
      type: 'addProjectSpecificIndicator',
      pathwayId,
      intermediateOutcomeId,
      indicator,
    })
    setFeedback(ADDED_SESSION_MESSAGE)
    reset()
  }

  return (
    <div className="custom-config-section">
      <h4>Project-specific indicators</h4>
      <p className="section-help">
        Add a project-specific indicator only where the standard framework
        indicators do not capture an important measure for this project.
      </p>
      {indicators.length === 0 ? (
        <p className="neutral-note">No project-specific indicators added.</p>
      ) : (
        <ul className="configured-item-list">
          {indicators.map((indicator) => (
            <li key={indicator.id}>
              <div>
                <strong>Project-specific indicator</strong>
                <p>{indicator.wording}</p>
                {indicator.measurementNotes && (
                  <small>{indicator.measurementNotes}</small>
                )}
              </div>
              <div className="inline-actions">
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    setEditingId(indicator.id)
                    setWording(indicator.wording)
                    setMeasurementNotes(indicator.measurementNotes)
                  }}
                >
                  Edit
                </button>
                <button
                  className="text-button danger"
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: 'deleteProjectSpecificIndicator',
                      pathwayId,
                      intermediateOutcomeId,
                      indicatorId: indicator.id,
                    })
                  }
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form className="compact-form" onSubmit={submit}>
        <label>
          <span>Indicator wording *</span>
          <input
            value={wording}
            onChange={(event) => {
              const value = event.target.value
              setWording(value)
              if (editingId) {
                dispatch({
                  type: 'updateProjectSpecificIndicator',
                  pathwayId,
                  intermediateOutcomeId,
                  indicator: {
                    id: editingId,
                    wording: value,
                    measurementNotes,
                  },
                })
              }
            }}
            required
          />
        </label>
        <label>
          <span>Measurement / definition notes</span>
          <textarea
            rows={2}
            value={measurementNotes}
            onChange={(event) => {
              const value = event.target.value
              setMeasurementNotes(value)
              if (editingId) {
                dispatch({
                  type: 'updateProjectSpecificIndicator',
                  pathwayId,
                  intermediateOutcomeId,
                  indicator: {
                    id: editingId,
                    wording,
                    measurementNotes: value,
                  },
                })
              }
            }}
          />
        </label>
        <div className="inline-actions">
          <button className="button secondary" type="submit">
            {editingId ? 'Done editing' : 'Add another indicator'}
          </button>
          <SessionSaveFeedback
            message={editingId ? SAVED_SESSION_MESSAGE : feedback}
          />
          {editingId && (
            <button className="text-button" type="button" onClick={reset}>
              Close editor
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

function ProjectSpecificActivitiesEditor({
  pathwayId,
  intermediateOutcomeId,
  activities,
}: {
  pathwayId: string
  intermediateOutcomeId: string
  activities: ProjectSpecificActivity[]
}) {
  const { dispatch, state } = useProjectDesign()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [wording, setWording] = useState('')
  const [projectDetails, setProjectDetails] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)

  const reset = () => {
    setEditingId(null)
    setWording('')
    setProjectDetails('')
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!wording.trim()) return
    if (editingId) {
      reset()
      return
    }
    const activity = {
      id: createLocalId('activity'),
      wording: wording.trim(),
      projectDetails: projectDetails.trim(),
      ...createCustomActivityOutputPlanning(),
    }
    dispatch({
      type: 'addProjectSpecificActivity',
      pathwayId,
      intermediateOutcomeId,
      activity,
    })
    setFeedback(ADDED_SESSION_MESSAGE)
    setEditingId(activity.id)
    setWording(activity.wording)
    setProjectDetails(activity.projectDetails)
  }

  return (
    <div className="custom-config-section">
      <h4>Project-specific activities</h4>
      <p className="section-help">
        Below you can add a project-specific activity if the standard suggested
        activities do not fully describe what this project will do.
      </p>
      {activities.length === 0 ? (
        <p className="neutral-note">No project-specific activities added.</p>
      ) : (
        <ul className="configured-item-list">
          {activities.map((activity) => (
            <li key={activity.id}>
              <div>
                <strong>Project-specific activity</strong>
                <p>{activity.wording}</p>
                {activity.projectDetails && (
                  <small>{activity.projectDetails}</small>
                )}
                <PlannedOutputEditor
                  planning={normalizeActivityOutput(activity)}
                  plannedSelfHelpGroupCount={
                    state.metadata.plannedSelfHelpGroupCount
                  }
                  onChange={(output) =>
                    dispatch({
                      type: 'updateProjectSpecificActivity',
                      pathwayId,
                      intermediateOutcomeId,
                      activity: {
                        ...activity,
                        ...output,
                      },
                    })
                  }
                />
              </div>
              <div className="inline-actions">
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    setEditingId(activity.id)
                    setWording(activity.wording)
                    setProjectDetails(activity.projectDetails)
                  }}
                >
                  Edit
                </button>
                <button
                  className="text-button danger"
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: 'deleteProjectSpecificActivity',
                      pathwayId,
                      intermediateOutcomeId,
                      activityId: activity.id,
                    })
                  }
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form className="compact-form" onSubmit={submit}>
        <label>
          <span>Activity wording *</span>
          <input
            value={wording}
            onChange={(event) => {
              const value = event.target.value
              setWording(value)
              if (editingId) {
                const current = activities.find((item) => item.id === editingId)
                dispatch({
                  type: 'updateProjectSpecificActivity',
                  pathwayId,
                  intermediateOutcomeId,
                  activity: {
                    ...current,
                    id: editingId,
                    wording: value,
                    projectDetails,
                  },
                })
              }
            }}
            required
          />
        </label>
        <label>
          <span>Project-specific details</span>
          <textarea
            rows={2}
            value={projectDetails}
            onChange={(event) => {
              const value = event.target.value
              setProjectDetails(value)
              if (editingId) {
                const current = activities.find((item) => item.id === editingId)
                dispatch({
                  type: 'updateProjectSpecificActivity',
                  pathwayId,
                  intermediateOutcomeId,
                  activity: {
                    ...current,
                    id: editingId,
                    wording,
                    projectDetails: value,
                  },
                })
              }
            }}
          />
        </label>
        <div className="inline-actions">
          <button className="button secondary" type="submit">
            {editingId ? 'Done editing' : 'Add another activity'}
          </button>
          <SessionSaveFeedback
            message={editingId ? SAVED_SESSION_MESSAGE : feedback}
          />
          {editingId && (
            <button className="text-button" type="button" onClick={reset}>
              Close editor
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

function InputsEditor({
  pathwayId,
  intermediateOutcomeId,
  inputs,
}: {
  pathwayId: string
  intermediateOutcomeId: string
  inputs: ProjectInput[]
}) {
  const { dispatch } = useProjectDesign()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [inputCategoryId, setInputCategoryId] = useState('')
  const [details, setDetails] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)

  const reset = () => {
    setEditingId(null)
    setInputCategoryId('')
    setDetails('')
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!inputCategoryId || !details.trim()) return
    if (editingId) {
      reset()
      return
    }
    const input = {
      id: createLocalId('input'),
      inputCategoryId,
      details: details.trim(),
    }
    dispatch({
      type: 'addInput',
      pathwayId,
      intermediateOutcomeId,
      input,
    })
    setFeedback(ADDED_SESSION_MESSAGE)
    reset()
  }

  return (
    <div className="custom-config-section">
      <h4>Inputs</h4>
      <p className="section-help">
        Record any input needed for this Intermediate Outcome using the
        categories below. Budget and costing are not included.
      </p>
      {inputs.length === 0 ? (
        <p className="neutral-note">No inputs added.</p>
      ) : (
        <ul className="configured-item-list">
          {inputs.map((input) => (
            <li key={input.id}>
              <div>
                <strong>
                  {inputCategories.find(
                    (category) => category.id === input.inputCategoryId,
                  )?.label ?? 'Unknown category'}
                </strong>
                <p>{input.details}</p>
              </div>
              <div className="inline-actions">
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    setEditingId(input.id)
                    setInputCategoryId(input.inputCategoryId)
                    setDetails(input.details)
                  }}
                >
                  Edit
                </button>
                <button
                  className="text-button danger"
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: 'deleteInput',
                      pathwayId,
                      intermediateOutcomeId,
                      inputId: input.id,
                    })
                  }
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form className="compact-form input-form" onSubmit={submit}>
        <label>
          <span>Input category *</span>
          <select
            value={inputCategoryId}
            onChange={(event) => {
              const value = event.target.value
              setInputCategoryId(value)
              if (editingId) {
                dispatch({
                  type: 'updateInput',
                  pathwayId,
                  intermediateOutcomeId,
                  input: { id: editingId, inputCategoryId: value, details },
                })
              }
            }}
            required
          >
            <option value="">Select a category</option>
            {inputCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Input details *</span>
          <textarea
            rows={2}
            value={details}
            onChange={(event) => {
              const value = event.target.value
              setDetails(value)
              if (editingId) {
                dispatch({
                  type: 'updateInput',
                  pathwayId,
                  intermediateOutcomeId,
                  input: { id: editingId, inputCategoryId, details: value },
                })
              }
            }}
            required
          />
        </label>
        <div className="inline-actions">
          <button className="button secondary" type="submit">
            {editingId ? 'Done editing' : 'Add another input'}
          </button>
          <SessionSaveFeedback
            message={editingId ? SAVED_SESSION_MESSAGE : feedback}
          />
          {editingId && (
            <button className="text-button" type="button" onClick={reset}>
              Close editor
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

function IncludeAllActivitiesCheckbox({
  className,
  pathwayId,
  intermediateOutcomeId,
  suggestedActivities,
  configuration,
}: {
  className?: string
  pathwayId: string
  intermediateOutcomeId: string
  suggestedActivities: SuggestedActivity[]
  configuration: ProjectIntermediateOutcomeConfiguration
}) {
  const { dispatch } = useProjectDesign()
  const selectedCount = suggestedActivities.filter((activity) =>
    configuration.standardActivities.some(
      (selection) => selection.frameworkActivityId === activity.id,
    ),
  ).length
  const allSelected =
    suggestedActivities.length > 0 &&
    selectedCount === suggestedActivities.length

  return (
    <label
      className={`checkbox-option include-all-activities ${className ?? ''}`.trim()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={allSelected}
        ref={(element) => {
          if (!element) return
          element.indeterminate =
            selectedCount > 0 && selectedCount < suggestedActivities.length
        }}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) =>
          dispatch({
            type: 'setSuggestedActivities',
            pathwayId,
            intermediateOutcomeId,
            frameworkActivityIds: suggestedActivities.map(
              (activity) => activity.id,
            ),
            selected: event.target.checked,
            outputsByActivityId: Object.fromEntries(
              suggestedActivities.map((activity) => [
                activity.id,
                createActivityOutputPlanning(),
              ]),
            ),
          })
        }
      />
      <span>Include all activities</span>
    </label>
  )
}

function IntermediateOutcomeConfigurationCard({
  data,
  pathwayId,
  outcome,
  configuration,
}: {
  data: FrameworkData
  pathwayId: string
  outcome: IntermediateOutcome
  configuration: ProjectIntermediateOutcomeConfiguration
}) {
  const { dispatch, state, saveProject, saveStatus } = useProjectDesign()
  const plannedSelfHelpGroupCount =
    state.metadata.plannedSelfHelpGroupCount
  const primaryIndicator = getPrimaryIndicatorForIntermediateOutcome(
    data,
    outcome.id,
  )
  const additionalIndicators = getAdditionalIndicatorsForIntermediateOutcome(
    data,
    outcome.id,
  )
  const suggestedActivities = getSuggestedActivitiesForIntermediateOutcome(
    data,
    outcome.id,
  )
  const activityCount =
    configuration.standardActivities.length +
    configuration.projectSpecificActivities.length
  const outputSummary = formatActivityOutputSummary(
    activityOutputSummary(
      configuration.standardActivities,
      configuration.projectSpecificActivities,
      new Map(
        suggestedActivities.map((activity) => [
          activity.id,
          activity.outputPhrase ?? null,
        ]),
      ),
    ),
  )
  const hasStarted =
    configuration.reviewed ||
    configuration.additionalIndicators.length > 0 ||
    configuration.projectSpecificIndicators.length > 0 ||
    activityCount > 0 ||
    configuration.inputs.length > 0
  const stepStatus = !configuration.primaryIndicator
    ? 'Data error'
    : configuration.reviewed
      ? 'Configured'
      : hasStarted
        ? 'In progress'
        : 'Not started'
  const [open, setOpen] = useState(false)
  const [savingStep, setSavingStep] = useState(false)

  const saveCompletedStep = async () => {
    const action = {
      type: 'setIntermediateOutcomeReviewed' as const,
      pathwayId,
      intermediateOutcomeId: outcome.id,
      reviewed: true,
    }
    const nextState = projectDesignReducer(state, action)
    dispatch(action)
    setSavingStep(true)
    try {
      await saveProject(nextState)
    } finally {
      setSavingStep(false)
    }
  }

  return (
    <li className="configuration-chain-item">
      <div className="chain-number">{outcome.stepNumber}</div>
      <details
        className="io-configuration-card"
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary>
          <div className="io-summary-main">
            <span className="eyebrow">Step {outcome.stepNumber}</span>
            <h2>{outcome.statement}</h2>
            <div className="io-summary-counts">
              <span
                className={
                  configuration.primaryIndicator
                    ? 'primary-included'
                    : 'primary-missing'
                }
              >
                {configuration.primaryIndicator
                  ? `✓ Primary indicator: ${
                      primaryIndicator?.text ?? 'Included'
                    }`
                  : 'Primary indicator missing'}
              </span>
              <span>
                {configuration.additionalIndicators.length} optional indicators
              </span>
              <span
                className={
                  activityCount === 0 ? 'activity-required-summary' : undefined
                }
              >
                {activityCount === 0
                  ? 'Activity required'
                  : `${activityCount} activities`}
              </span>
              <span>
                {configuration.inputs.length === 0
                  ? 'No inputs added'
                  : `${configuration.inputs.length} inputs`}
              </span>
              {outputSummary && <span>{outputSummary}</span>}
            </div>
            {suggestedActivities.length > 0 && !open && (
              <IncludeAllActivitiesCheckbox
                className="io-summary-include-all"
                pathwayId={pathwayId}
                intermediateOutcomeId={outcome.id}
                suggestedActivities={suggestedActivities}
                configuration={configuration}
              />
            )}
          </div>
          <div className="io-summary-status">
            <span
              className={`config-status status-${stepStatus
                .toLowerCase()
                .replace(' ', '-')}`}
            >
              {stepStatus}
            </span>
            <span className="summary-action">
              {configuration.reviewed ? 'Edit' : 'Configure'}
            </span>
          </div>
        </summary>

        <div className="io-config-body">
          <section className="configuration-section">
            <h3>Indicators</h3>
            {primaryIndicator && configuration.primaryIndicator ? (
              <div className="mandatory-selection">
                <span className="lock-label">Primary indicator · Required</span>
                <p>{primaryIndicator.text}</p>
                <small>Included automatically and cannot be changed.</small>
              </div>
            ) : (
              <div className="data-error" role="alert">
                <strong>Framework data error</strong>
                <p>
                  This intermediate outcome has no active mandatory Primary
                  indicator. Configuration cannot be completed.
                </p>
              </div>
            )}

            <OptionalQuestion
              question="Do you wish to select any additional indicators for this Intermediate Outcome?"
              defaultOpen={configuration.additionalIndicators.length > 0}
            >
              {additionalIndicators.length === 0 ? (
                <p className="neutral-note">
                  There are no additional framework indicators for this
                  Intermediate Outcome.
                </p>
              ) : (
                additionalIndicators.map((indicator) => (
                  <label className="checkbox-option" key={indicator.id}>
                    <input
                      type="checkbox"
                      checked={configuration.additionalIndicators.some(
                        (selection) =>
                          selection.frameworkIndicatorId === indicator.id,
                      )}
                      onChange={(event) =>
                        dispatch({
                          type: 'setAdditionalIndicator',
                          pathwayId,
                          intermediateOutcomeId: outcome.id,
                          frameworkIndicatorId: indicator.id,
                          selected: event.target.checked,
                        })
                      }
                    />
                    <span>{indicator.text}</span>
                  </label>
                ))
              )}
            </OptionalQuestion>
            <OptionalQuestion
              question="Do you wish to add any project-specific indicators for this Intermediate Outcome?"
              help="Use this only if the standard indicators do not capture something important for this particular project."
              defaultOpen={configuration.projectSpecificIndicators.length > 0}
            >
              <ProjectSpecificIndicatorsEditor
                pathwayId={pathwayId}
                intermediateOutcomeId={outcome.id}
                indicators={configuration.projectSpecificIndicators}
              />
            </OptionalQuestion>
          </section>

          <section className="configuration-section">
            <h3>Activities</h3>
            {activityCount === 0 && (
              <div className="activity-required" role="status">
                <strong>Activity required</strong>
                <p>
                  Select at least one suggested activity or add a
                  project-specific activity for this Intermediate Outcome.
                </p>
              </div>
            )}
            <p className="section-help">
              Select at least one suggested activity or add a project-specific
              activity. Activity notes and details remain optional.
            </p>
            {suggestedActivities.length === 0 ? (
              <p className="neutral-note">No suggested framework activities.</p>
            ) : (
              <div className="activity-options">
                {open && (
                  <IncludeAllActivitiesCheckbox
                    pathwayId={pathwayId}
                    intermediateOutcomeId={outcome.id}
                    suggestedActivities={suggestedActivities}
                    configuration={configuration}
                  />
                )}
                {suggestedActivities.map((activity) => {
                  const selection = configuration.standardActivities.find(
                    (candidate) =>
                      candidate.frameworkActivityId === activity.id,
                  )
                  return (
                    <div className="activity-option" key={activity.id}>
                      <label className="checkbox-option">
                        <input
                          type="checkbox"
                          checked={Boolean(selection)}
                          onChange={(event) =>
                            dispatch({
                              type: 'setStandardActivity',
                              pathwayId,
                              intermediateOutcomeId: outcome.id,
                              frameworkActivityId: activity.id,
                              selected: event.target.checked,
                              output: createActivityOutputPlanning(),
                            })
                          }
                        />
                        <span>{activity.text}</span>
                      </label>
                      {selection && (
                        <>
                          <OptionalActivityNotes
                            value={selection.projectNotes}
                            onChange={(projectNotes) =>
                              dispatch({
                                type: 'updateStandardActivityNotes',
                                pathwayId,
                                intermediateOutcomeId: outcome.id,
                                frameworkActivityId: activity.id,
                                projectNotes,
                              })
                            }
                          />
                          <PlannedOutputEditor
                            planning={normalizeActivityOutput(selection)}
                            activity={activity}
                            plannedSelfHelpGroupCount={
                              plannedSelfHelpGroupCount
                            }
                            onChange={(output) =>
                              dispatch({
                                type: 'updateStandardActivityOutput',
                                pathwayId,
                                intermediateOutcomeId: outcome.id,
                                frameworkActivityId: activity.id,
                                output,
                              })
                            }
                          />
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            <ProjectSpecificActivitiesEditor
              pathwayId={pathwayId}
              intermediateOutcomeId={outcome.id}
              activities={configuration.projectSpecificActivities}
            />
          </section>

          <section className="configuration-section">
            <OptionalQuestion
              question="Do you wish to record any inputs required for this Intermediate Outcome?"
              defaultOpen={configuration.inputs.length > 0}
            >
              <InputsEditor
                pathwayId={pathwayId}
                intermediateOutcomeId={outcome.id}
                inputs={configuration.inputs}
              />
            </OptionalQuestion>
          </section>

          <div className="review-control">
            <div>
              <strong>Step review</strong>
              <p>
                Every Intermediate Outcome needs at least one activity.
                Additional indicators, activity notes and inputs remain
                optional.
              </p>
            </div>
            <button
              className={`button ${
                configuration.reviewed ? 'secondary' : 'primary'
              }`}
              type="button"
              disabled={
                saveStatus === 'saving' ||
                !configuration.primaryIndicator ||
                !intermediateOutcomeHasRequiredActivity(configuration)
              }
              onClick={() => void saveCompletedStep()}
            >
              {savingStep
                ? 'Saving…'
                : configuration.reviewed
                  ? '✓ Step configured'
                  : 'Done with this step'}
            </button>
          </div>
        </div>
      </details>
    </li>
  )
}

export function PathwayConfigurationPage() {
  const { pathwayId = '' } = useParams()
  const navigate = useNavigate()
  const { data, loading, error, retry } = useFramework()
  const { state, dispatch, saveProject, saveStatus } = useProjectDesign()
  const [savingAndReturning, setSavingAndReturning] = useState(false)

  if (!data) {
    return (
      <div className="state-panel" role={error ? 'alert' : 'status'}>
        <h1>{loading ? 'Loading the framework' : 'Framework unavailable'}</h1>
        <p>{error ?? 'Preparing pathway configuration…'}</p>
        {error && (
          <button className="button primary" type="button" onClick={retry}>
            Try again
          </button>
        )}
      </div>
    )
  }

  const pathway = getPathway(data, pathwayId)
  const projectPathway = state.projectPathways.find(
    (candidate) => candidate.pathwayId === pathwayId,
  )
  if (!pathway || !projectPathway) {
    return (
      <div className="state-panel">
        <h1>Selected pathway not found</h1>
        <p>Add the pathway to this project before configuring it.</p>
        <Link className="button secondary" to="/design/outcomes">
          Browse final outcomes
        </Link>
      </div>
    )
  }

  const intermediateOutcomes = getIntermediateOutcomesForPathway(
    data,
    pathwayId,
  )
  const linkedOutcomes = state.outcomePathwayLinks
    .filter((link) => link.pathwayId === pathwayId)
    .map((link) => getFinalOutcome(data, link.finalOutcomeId))
    .filter((outcome) => outcome !== undefined)
  const status = getPathwayConfigurationStatus(projectPathway)
  const missingActivityMessages =
    getMissingActivityCompletionMessages(projectPathway)

  return (
    <div className="page-container configuration-page">
      <DesignProgress current="configure" />
      <Link className="back-link" to="/design/configure">
        ← Back to Configure Pathways
      </Link>
      <div className="configuration-hero">
        <div>
          <span className="eyebrow">Stage 2 · Configure pathway</span>
          <h1>{pathway.name}</h1>
          <p>
            {pathway.description ??
              'Add any project-specific details for this pathway. If it contributes to several outcomes, you still complete it only once.'}
          </p>
        </div>
        <div className={`pathway-status status-${status}`}>
          <span>Configuration status</span>
          <strong>{statusLabels[status]}</strong>
        </div>
      </div>

      <div className="autosave-status" role="status" aria-live="polite">
        <span aria-hidden="true">!</span>
        <div>
          <strong>Save the project to persist changes</strong>
          <small>
            Your latest choices and notes remain available while you work.
          </small>
        </div>
      </div>

      <section className="contributes-panel" aria-labelledby="contributes-to">
        <h2 id="contributes-to">Contributes to</h2>
        <div className="outcome-chip-list">
          {linkedOutcomes.map((outcome) => (
            <span key={outcome.id}>
              {outcome.shortLabel ?? outcome.statement}
            </span>
          ))}
        </div>
      </section>

      <section className="configuration-chain-section">
        <div className="section-heading-row">
          <div>
            <span className="eyebrow">Standard read-only change chain</span>
            <h2>Intermediate outcomes</h2>
            <p>
              Expand each step to add at least one activity. Additional
              indicators, activity notes and inputs remain optional. The Primary
              indicator is included automatically.
            </p>
          </div>
          <span>{intermediateOutcomes.length} steps</span>
        </div>
        <ol className="configuration-chain">
          {intermediateOutcomes.map((outcome) => {
            const configuration =
              projectPathway.intermediateOutcomeConfigurations.find(
                (candidate) =>
                  candidate.frameworkIntermediateOutcomeId === outcome.id,
              )
            return configuration ? (
              <IntermediateOutcomeConfigurationCard
                key={outcome.id}
                data={data}
                pathwayId={pathwayId}
                outcome={outcome}
                configuration={configuration}
              />
            ) : (
              <li className="data-error" key={outcome.id}>
                Missing project configuration for {outcome.statement}
              </li>
            )
          })}
        </ol>
      </section>

      <section
        className={`done-pathway-panel ${
          missingActivityMessages.length > 0 ? 'needs-attention' : ''
        }`}
      >
        <div>
          <span className="eyebrow">Finished this pathway?</span>
          <h2>Confirm you are done</h2>
          <p>
            Every Intermediate Outcome needs at least one activity. Additional
            indicators, activity notes and inputs remain optional. Save and
            return to the pathway list when finished.
          </p>
          {missingActivityMessages.length > 0 && (
            <ul className="missing-activity-list">
              {missingActivityMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </div>
        <button
          className="button primary large"
          type="button"
          disabled={
            saveStatus === 'saving' ||
            missingActivityMessages.length > 0
          }
          onClick={() => {
            if (missingActivityMessages.length > 0) {
              return
            }
            const action = {
              type: 'markPathwayConfigured' as const,
              pathwayId,
            }
            const nextState = projectDesignReducer(state, action)
            dispatch(action)
            setSavingAndReturning(true)
            void saveProject(nextState)
              .then((saved) => {
                if (saved) {
                  navigate('/design/configure', { replace: true })
                }
              })
              .finally(() => setSavingAndReturning(false))
          }}
        >
          {savingAndReturning
            ? 'Saving…'
            : 'Save & return to pathways'}
        </button>
      </section>
    </div>
  )
}
