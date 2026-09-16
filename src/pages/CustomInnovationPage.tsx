import { Link, useNavigate } from 'react-router-dom'
import { DesignProgress } from '../components/DesignProgress'
import {
  CustomActivitiesEditor,
  CustomAdditionalIndicatorsEditor,
  CustomInputsEditor,
} from '../components/CustomRecordEditors'
import { getImpactAreas } from '../services/frameworkService'
import { useFramework, useProjectDesign } from '../state/AppState'
import {
  createBlankCustomInnovation,
  createBlankCustomIntermediateOutcome,
  getCustomInnovationValidation,
} from '../state/customInnovation'
import { canContinueToConfigure } from '../state/journeySelectors'
import type { CustomIntermediateOutcome } from '../types/project'

const GOVERNANCE_MESSAGE =
  'This outcome is outside the standard organisational framework and will require review by all Thematic Coordinators and final approval by the Head of M&E.'

export function CustomInnovationPage() {
  const navigate = useNavigate()
  const { data } = useFramework()
  const { state, dispatch, saveProject, saveStatus } = useProjectDesign()
  const custom = state.customInnovation

  if (!data) {
    return (
      <div className="state-panel" role="status">
        <h1>Loading custom innovation</h1>
      </div>
    )
  }

  if (!custom) {
    return (
      <div className="page-container">
        <DesignProgress current="choose" />
        <Link className="back-link" to="/design/outcomes">
          ← Back to all outcomes
        </Link>
        <div className="page-heading">
          <span className="eyebrow">Custom innovation outcome</span>
          <h1>Add a custom innovation outcome</h1>
          <p>
            Use this only when a genuinely required result is not represented
            adequately by the standard organisational framework.
          </p>
        </div>
        <div className="governance-banner" role="note">
          <strong>Custom innovation outcome</strong>
          <p>{GOVERNANCE_MESSAGE}</p>
        </div>
        <button
          className="button primary"
          type="button"
          onClick={() =>
            dispatch({
              type: 'addCustomInnovation',
              customInnovation: createBlankCustomInnovation(),
            })
          }
        >
          Add custom innovation outcome
        </button>
      </div>
    )
  }

  const impactAreas = getImpactAreas(data)
  const validation = getCustomInnovationValidation(custom)
  const canConfigure = validation.complete && canContinueToConfigure(state)
  const canDeleteIo = custom.pathway.intermediateOutcomes.length > 1

  const toggleImpactArea = (impactId: string, selected: boolean) => {
    const next = selected
      ? [...new Set([...custom.impactAreaIds, impactId])]
      : custom.impactAreaIds.filter((id) => id !== impactId)
    dispatch({ type: 'setCustomImpactAreaIds', impactAreaIds: next })
  }

  const removeCustomOutcome = () => {
    if (
      window.confirm(
        'Discard this custom innovation draft and its custom pathway, indicators, activities and inputs? Standard framework selections will be kept.',
      )
    ) {
      dispatch({ type: 'removeCustomInnovation' })
      navigate('/design/outcomes')
    }
  }

  const saveAndContinue = async (destination: string) => {
    const saved = await saveProject()
    if (saved) navigate(destination)
  }

  return (
    <div className="page-container custom-innovation-page">
      <DesignProgress current="choose" />
      <Link className="back-link" to="/design/outcomes">
        ← Back to all outcomes
      </Link>
      <div className="page-heading">
        <span className="eyebrow">Custom innovation outcome</span>
        <h1>Custom innovation outcome</h1>
        <p>
          This content is project-specific and is not part of the standard
          organisational framework.
        </p>
      </div>
      <div className="governance-banner" role="note">
        <strong>Outside the standard framework</strong>
        <p>{GOVERNANCE_MESSAGE}</p>
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

      <section className="detail-section custom-fields">
        <span className="eyebrow">Required outcome details</span>
        <h2>Custom Final Outcome</h2>
        <label>
          <span>Short label *</span>
          <input
            value={custom.shortLabel}
            onChange={(event) =>
              dispatch({
                type: 'updateCustomInnovationFields',
                payload: { shortLabel: event.target.value },
              })
            }
            required
          />
        </label>
        <label>
          <span>Final Outcome statement *</span>
          <textarea
            rows={3}
            value={custom.statement}
            onChange={(event) =>
              dispatch({
                type: 'updateCustomInnovationFields',
                payload: { statement: event.target.value },
              })
            }
            required
          />
          <small>
            Describe an outcome-level change, not an activity or output.
          </small>
        </label>
        <label>
          <span>Rationale *</span>
          <textarea
            rows={3}
            value={custom.rationale}
            onChange={(event) =>
              dispatch({
                type: 'updateCustomInnovationFields',
                payload: { rationale: event.target.value },
              })
            }
            required
          />
          <small>
            Explain why the required change is not adequately represented by the
            standard framework outcomes.
          </small>
        </label>
        <fieldset className="impact-area-fieldset">
          <legend>Linked Impact Area(s) *</legend>
          <p className="section-help">
            Link this custom outcome to at least one existing organisational
            Impact Area. New organisational impacts cannot be created here.
          </p>
          {impactAreas.map((impact) => (
            <label className="checkbox-option" key={impact.id}>
              <input
                type="checkbox"
                checked={custom.impactAreaIds.includes(impact.id)}
                onChange={(event) =>
                  toggleImpactArea(impact.id, event.target.checked)
                }
              />
              <span>{impact.theme}</span>
            </label>
          ))}
        </fieldset>
        <label>
          <span>Primary indicator for custom outcome *</span>
          <input
            value={custom.primaryIndicator.wording}
            onChange={(event) =>
              dispatch({
                type: 'setCustomOutcomePrimaryIndicator',
                indicator: {
                  ...custom.primaryIndicator,
                  wording: event.target.value,
                },
              })
            }
            required
          />
        </label>
        <label>
          <span>Measurement / definition notes</span>
          <textarea
            rows={2}
            value={custom.primaryIndicator.measurementNotes}
            onChange={(event) =>
              dispatch({
                type: 'setCustomOutcomePrimaryIndicator',
                indicator: {
                  ...custom.primaryIndicator,
                  measurementNotes: event.target.value,
                },
              })
            }
          />
        </label>
      </section>

      <section className="detail-section custom-fields">
        <div className="guidance-panel" role="note">
          <h2>What is a pathway?</h2>
          <p>
            A pathway describes the sequence of changes expected to lead to your
            Final Outcome. It should explain how the project expects change to
            happen, rather than listing project activities.
          </p>
          <p>
            Intermediate Outcomes are the key changes that need to happen along
            that pathway. They should describe changes in behaviour, practices,
            capacity, systems or conditions — not activities delivered by the
            project.
          </p>
          <p>
            Most pathways should normally contain around{' '}
            <strong>2–5 Intermediate Outcomes</strong>. Use only the changes
            that are necessary to explain the causal journey. The app requires
            at least one, but adding more does not automatically make the
            pathway stronger.
          </p>
        </div>
        <span className="eyebrow">Custom pathway</span>
        <h2>Custom pathway</h2>
        <p className="section-help">
          This is a Custom pathway created for this project. It is not a
          standard framework pathway.
        </p>
        <label>
          <span>Pathway name *</span>
          <input
            value={custom.pathway.name}
            onChange={(event) =>
              dispatch({
                type: 'updateCustomPathway',
                payload: { name: event.target.value },
              })
            }
            required
          />
        </label>
        <label>
          <span>Pathway description *</span>
          <textarea
            rows={3}
            value={custom.pathway.description}
            onChange={(event) =>
              dispatch({
                type: 'updateCustomPathway',
                payload: { description: event.target.value },
              })
            }
            required
          />
          <small>
            Describe the main change pathway through which this project expects
            to achieve the custom outcome.
          </small>
        </label>
        <label>
          <span>Why this pathway? *</span>
          <textarea
            rows={3}
            value={custom.pathway.rationale}
            onChange={(event) =>
              dispatch({
                type: 'updateCustomPathway',
                payload: { rationale: event.target.value },
              })
            }
            required
          />
          <small>
            Explain the causal logic connecting the pathway to the custom Final
            Outcome.
          </small>
        </label>
      </section>

      <section className="chain-section">
        <div className="section-heading-row">
          <div>
            <span className="eyebrow">Ordered change chain</span>
            <h2>Intermediate Outcomes</h2>
            <p>
              Keep the chain concise and causal. At least one Intermediate
              Outcome is required. Around 2–5 Intermediate Outcomes is usually
              enough.
            </p>
          </div>
          <span>{custom.pathway.intermediateOutcomes.length} steps</span>
        </div>
        <ol className="custom-io-chain">
          {custom.pathway.intermediateOutcomes.map((outcome, index) => (
            <CustomIntermediateOutcomeEditor
              key={outcome.id}
              outcome={outcome}
              index={index}
              total={custom.pathway.intermediateOutcomes.length}
              canDelete={canDeleteIo}
            />
          ))}
        </ol>
        <button
          className="button secondary"
          type="button"
          onClick={() =>
            dispatch({
              type: 'addCustomIntermediateOutcome',
              intermediateOutcome: createBlankCustomIntermediateOutcome(
                custom.pathway.intermediateOutcomes.length + 1,
              ),
            })
          }
        >
          Add another Intermediate Outcome
        </button>
      </section>

      {!validation.complete && (
        <div className="requirement-status" role="status">
          <strong>Custom innovation still needs required details</strong>
          <ul>
            {validation.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="form-actions custom-innovation-actions">
        <button
          className="button secondary"
          type="button"
          onClick={removeCustomOutcome}
        >
          Cancel / discard custom outcome
        </button>
        {validation.complete ? (
          <>
            <button
              className="button primary"
              type="button"
              onClick={() => void saveAndContinue('/design/outcomes')}
              disabled={saveStatus === 'saving'}
            >
              {saveStatus === 'saving'
                ? 'Saving…'
                : 'Save custom outcome and continue choosing outcomes'}
            </button>
            {canConfigure ? (
              <button
                className="button secondary"
                type="button"
                onClick={() => void saveAndContinue('/design/configure')}
                disabled={saveStatus === 'saving'}
              >
                {saveStatus === 'saving'
                  ? 'Saving…'
                  : 'Save custom outcome and continue to configure pathways'}
              </button>
            ) : (
              <button className="button secondary" type="button" disabled>
                Save custom outcome and continue to configure pathways
              </button>
            )}
          </>
        ) : (
          <>
            <button className="button primary" type="button" disabled>
              Save custom outcome and continue choosing outcomes
            </button>
            <button className="button secondary" type="button" disabled>
              Save custom outcome and continue to configure pathways
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function CustomIntermediateOutcomeEditor({
  outcome,
  index,
  total,
  canDelete,
}: {
  outcome: CustomIntermediateOutcome
  index: number
  total: number
  canDelete: boolean
}) {
  const { dispatch } = useProjectDesign()

  return (
    <li className="custom-io-editor">
      <div className="chain-number">{outcome.stepNumber}</div>
      <div className="custom-io-editor-body">
        <div className="custom-io-editor-toolbar">
          <span className="eyebrow">Step {outcome.stepNumber}</span>
          <div className="inline-actions">
            <button
              className="text-button"
              type="button"
              disabled={index === 0}
              onClick={() =>
                dispatch({
                  type: 'moveCustomIntermediateOutcome',
                  intermediateOutcomeId: outcome.id,
                  direction: 'up',
                })
              }
            >
              Move up
            </button>
            <button
              className="text-button"
              type="button"
              disabled={index === total - 1}
              onClick={() =>
                dispatch({
                  type: 'moveCustomIntermediateOutcome',
                  intermediateOutcomeId: outcome.id,
                  direction: 'down',
                })
              }
            >
              Move down
            </button>
            <button
              className="text-button danger"
              type="button"
              disabled={!canDelete}
              onClick={() =>
                dispatch({
                  type: 'deleteCustomIntermediateOutcome',
                  intermediateOutcomeId: outcome.id,
                })
              }
            >
              Delete Intermediate Outcome
            </button>
          </div>
        </div>
        <label>
          <span>Intermediate Outcome statement *</span>
          <textarea
            rows={2}
            value={outcome.statement}
            onChange={(event) =>
              dispatch({
                type: 'updateCustomIntermediateOutcome',
                intermediateOutcomeId: outcome.id,
                payload: { statement: event.target.value },
              })
            }
            required
          />
        </label>
        <label>
          <span>Primary indicator *</span>
          <input
            value={outcome.primaryIndicator.wording}
            onChange={(event) =>
              dispatch({
                type: 'setCustomIoPrimaryIndicator',
                intermediateOutcomeId: outcome.id,
                indicator: {
                  ...outcome.primaryIndicator,
                  wording: event.target.value,
                },
              })
            }
            required
          />
        </label>
        <label>
          <span>Measurement / definition notes</span>
          <textarea
            rows={2}
            value={outcome.primaryIndicator.measurementNotes}
            onChange={(event) =>
              dispatch({
                type: 'setCustomIoPrimaryIndicator',
                intermediateOutcomeId: outcome.id,
                indicator: {
                  ...outcome.primaryIndicator,
                  measurementNotes: event.target.value,
                },
              })
            }
          />
        </label>
        <CustomAdditionalIndicatorsEditor
          intermediateOutcomeId={outcome.id}
          indicators={outcome.additionalIndicators}
        />
        <CustomActivitiesEditor
          intermediateOutcomeId={outcome.id}
          activities={outcome.activities}
        />
        <CustomInputsEditor
          intermediateOutcomeId={outcome.id}
          inputs={outcome.inputs}
        />
      </div>
    </li>
  )
}
