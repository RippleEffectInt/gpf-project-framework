import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { MonthYearFields } from '../components/MonthYearFields'
import { useFramework, useProjectDesign } from '../state/AppState'
import {
  getProjectMetadataErrors,
  type ProjectMetadataErrors,
} from '../state/projectMetadata'
import type { ProjectMetadata } from '../types/project'

type FieldErrors = ProjectMetadataErrors

function validate(metadata: ProjectMetadata): FieldErrors {
  return getProjectMetadataErrors(metadata)
}

export function ProjectDetailsPage() {
  const navigate = useNavigate()
  const { data, loading } = useFramework()
  const {
    state,
    dispatch,
    saveProject,
    saveStatus,
    saveError,
    metadataSyncRequired,
  } = useProjectDesign()
  const [errors, setErrors] = useState<FieldErrors>({})

  const updateField = (field: keyof ProjectMetadata, value: string) => {
    dispatch({ type: 'updateMetadata', payload: { [field]: value } })
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const saveDraft = () => void saveProject()

  const continueToOutcomes = (event: FormEvent) => {
    event.preventDefault()
    const validationErrors = validate(state.metadata)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length === 0) {
      navigate('/design/outcomes')
    }
  }

  return (
    <div className="page-container narrow-page">
      <div className="step-label">Project setup · Project details</div>
      <div className="page-heading">
        <span className="eyebrow">Start a project design</span>
        <h1>Tell us about the project</h1>
        <p>
          Add the core information used to identify and manage this design. You
          can refine it while the project remains a draft.
        </p>
      </div>

      <form className="details-form" onSubmit={continueToOutcomes} noValidate>
        <label className="full-width">
          <span>Project title *</span>
          <input
            value={state.metadata.title}
            onChange={(event) => updateField('title', event.target.value)}
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? 'title-error' : undefined}
          />
          {errors.title && (
            <small className="field-error" id="title-error">
              {errors.title}
            </small>
          )}
        </label>
        <label>
          <span>Country *</span>
          <input
            value={state.metadata.country}
            onChange={(event) => updateField('country', event.target.value)}
            aria-invalid={Boolean(errors.country)}
          />
          {errors.country && (
            <small className="field-error">{errors.country}</small>
          )}
        </label>
        <label>
          <span>Donor *</span>
          <input
            value={state.metadata.donor}
            onChange={(event) => updateField('donor', event.target.value)}
            aria-invalid={Boolean(errors.donor)}
          />
          {errors.donor && (
            <small className="field-error">{errors.donor}</small>
          )}
        </label>
        <label>
          <span>Funding opportunity / reference *</span>
          <input
            value={state.metadata.fundingReference}
            onChange={(event) =>
              updateField('fundingReference', event.target.value)
            }
            aria-invalid={Boolean(errors.fundingReference)}
          />
          {errors.fundingReference && (
            <small className="field-error">{errors.fundingReference}</small>
          )}
        </label>
        <label>
          <span>Project Manager *</span>
          <input
            value={state.metadata.projectManager}
            onChange={(event) =>
              updateField('projectManager', event.target.value)
            }
            aria-invalid={Boolean(errors.projectManager)}
          />
          {errors.projectManager && (
            <small className="field-error">{errors.projectManager}</small>
          )}
        </label>
        <MonthYearFields
          id="potential-start"
          label="Potential implementation start"
          value={state.metadata.plannedStartDate}
          onChange={(value) => updateField('plannedStartDate', value)}
          error={errors.plannedStartDate}
        />
        <MonthYearFields
          id="potential-end"
          label="Potential implementation end"
          value={state.metadata.plannedEndDate}
          onChange={(value) => updateField('plannedEndDate', value)}
          error={errors.plannedEndDate}
        />
        <label className="full-width">
          <span>Short project description *</span>
          <textarea
            rows={5}
            value={state.metadata.description}
            onChange={(event) => updateField('description', event.target.value)}
            aria-invalid={Boolean(errors.description)}
          />
          {errors.description && (
            <small className="field-error">{errors.description}</small>
          )}
        </label>
        <label className="full-width">
          <span>Planned number of Self Help Groups</span>
          <input
            inputMode="numeric"
            value={
              state.metadata.plannedSelfHelpGroupCount == null
                ? ''
                : String(state.metadata.plannedSelfHelpGroupCount)
            }
            onChange={(event) => {
              const raw = event.target.value.trim()
              if (!raw) {
                dispatch({
                  type: 'updateMetadata',
                  payload: { plannedSelfHelpGroupCount: null },
                })
                setErrors((current) => ({
                  ...current,
                  plannedSelfHelpGroupCount: undefined,
                }))
                return
              }
              if (!/^\d+$/.test(raw) || Number(raw) < 1) {
                setErrors((current) => ({
                  ...current,
                  plannedSelfHelpGroupCount:
                    'Enter a whole number greater than zero.',
                }))
                return
              }
              dispatch({
                type: 'updateMetadata',
                payload: { plannedSelfHelpGroupCount: Number(raw) },
              })
              setErrors((current) => ({
                ...current,
                plannedSelfHelpGroupCount: undefined,
              }))
            }}
            aria-invalid={Boolean(errors.plannedSelfHelpGroupCount)}
          />
          {errors.plannedSelfHelpGroupCount && (
            <small className="field-error">
              {errors.plannedSelfHelpGroupCount}
            </small>
          )}
          <small>
            Used to help calculate planned outputs where an activity applies
            to Self Help Groups.
          </small>
        </label>
        <label className="full-width">
          <span>Framework version</span>
          <input
            readOnly
            value={
              loading ? 'Loading…' : (data?.frameworkVersion ?? 'Unavailable')
            }
            className="read-only-field"
          />
          <small>
            Set automatically from the project framework dataset.
          </small>
        </label>

        <div className="form-actions full-width">
          <div aria-live="polite" className="save-message">
            {metadataSyncRequired && saveStatus === 'dirty'
              ? 'Unsaved changes. The previously saved design still needs project-list synchronisation.'
              : metadataSyncRequired
                ? 'Project design saved. Project-list information still needs synchronising.'
                : saveStatus === 'saving'
                  ? 'Saving project…'
                  : saveStatus === 'clean' && state.lastSavedAt
                    ? 'Project saved.'
                    : saveError?.message}
          </div>
          <button
            className="button secondary"
            type="button"
            onClick={saveDraft}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? 'Saving…' : 'Save Draft'}
          </button>
          <button className="button primary" type="submit">
            Continue
          </button>
        </div>
      </form>
    </div>
  )
}
