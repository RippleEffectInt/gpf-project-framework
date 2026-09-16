import { useState, type FormEvent } from 'react'
import { inputCategories } from '../data/inputCategories'
import { useProjectDesign } from '../state/AppState'
import {
  ADDED_SESSION_MESSAGE,
  SAVED_SESSION_MESSAGE,
  SessionSaveFeedback,
} from './SessionSaveFeedback'
import { PlannedOutputEditor } from './PlannedOutputEditor'
import {
  createCustomActivityOutputPlanning,
  normalizeActivityOutput,
} from '../state/activityOutputs'
import type {
  ProjectInput,
  ProjectSpecificActivity,
  ProjectSpecificIndicator,
} from '../types/project'

function createLocalId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

export function CustomAdditionalIndicatorsEditor({
  intermediateOutcomeId,
  indicators,
}: {
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
    dispatch({
      type: 'addCustomIoAdditionalIndicator',
      intermediateOutcomeId,
      indicator: {
        id: createLocalId('custom-ind'),
        wording: wording.trim(),
        measurementNotes: measurementNotes.trim(),
      },
    })
    setFeedback(ADDED_SESSION_MESSAGE)
    reset()
  }

  return (
    <div className="custom-config-section">
      <h4>Additional indicators — optional</h4>
      <p className="section-help">
        Add any additional indicators that will help measure this Intermediate
        Outcome.
      </p>
      {indicators.length === 0 ? (
        <p className="neutral-note">No additional indicators selected.</p>
      ) : (
        <ul className="configured-item-list">
          {indicators.map((indicator) => (
            <li key={indicator.id}>
              <div>
                <strong>Additional indicator</strong>
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
                      type: 'deleteCustomIoAdditionalIndicator',
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
                  type: 'updateCustomIoAdditionalIndicator',
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
                  type: 'updateCustomIoAdditionalIndicator',
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

export function CustomActivitiesEditor({
  intermediateOutcomeId,
  activities,
}: {
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
    dispatch({
      type: 'addCustomIoActivity',
      intermediateOutcomeId,
      activity: {
        id: createLocalId('custom-act'),
        wording: wording.trim(),
        projectDetails: projectDetails.trim(),
        ...createCustomActivityOutputPlanning(),
      },
    })
    setFeedback(ADDED_SESSION_MESSAGE)
    reset()
  }

  return (
    <div className="custom-config-section">
      <h4>Project-specific activities</h4>
      <p className="section-help">
        Custom Intermediate Outcomes have no standard suggested activities.
        Add at least one project-specific activity for this Intermediate
        Outcome.
      </p>
      {activities.length === 0 ? (
        <div className="activity-required" role="status">
          <strong>Activity required</strong>
          <p>
            Add at least one project-specific activity for this Intermediate
            Outcome.
          </p>
        </div>
      ) : (
        <ul className="configured-item-list">
          {activities.map((activity) => (
            <li key={activity.id}>
              <div>
                <strong>Project-specific activity</strong>
                <p>{activity.wording}</p>
                {activity.projectDetails && <small>{activity.projectDetails}</small>}
                <PlannedOutputEditor
                  planning={normalizeActivityOutput(activity)}
                  plannedSelfHelpGroupCount={
                    state.metadata.plannedSelfHelpGroupCount
                  }
                  onChange={(output) =>
                    dispatch({
                      type: 'updateCustomIoActivity',
                      intermediateOutcomeId,
                      activity: { ...activity, ...output },
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
                      type: 'deleteCustomIoActivity',
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
                  type: 'updateCustomIoActivity',
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
                  type: 'updateCustomIoActivity',
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

export function CustomInputsEditor({
  intermediateOutcomeId,
  inputs,
}: {
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
    dispatch({
      type: 'addCustomIoInput',
      intermediateOutcomeId,
      input: {
        id: createLocalId('custom-input'),
        inputCategoryId,
        details: details.trim(),
      },
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
                      type: 'deleteCustomIoInput',
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
                  type: 'updateCustomIoInput',
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
                  type: 'updateCustomIoInput',
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
