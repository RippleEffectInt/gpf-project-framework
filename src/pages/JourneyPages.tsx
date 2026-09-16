import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DesignProgress } from '../components/DesignProgress'
import { getFinalOutcome } from '../services/frameworkService'
import { getCustomInnovationValidation } from '../state/customInnovation'
import { useFramework, useProjectDesign } from '../state/AppState'
import {
  canContinueToConfigure,
  canContinueToReview,
  getPathwayOverviewItems,
} from '../state/journeySelectors'
import { getReviewEntryBlockers } from '../state/projectReadiness'
import {
  getSelectedActivityCount,
  hasConfiguredActivityQuantityOrUnit,
} from '../state/projectDesign'

export function ConfigurePathwaysOverviewPage() {
  const navigate = useNavigate()
  const { data } = useFramework()
  const { state, dispatch, saveProject, saveStatus } = useProjectDesign()
  const [bulkOutputFeedback, setBulkOutputFeedback] = useState<string | null>(
    null,
  )

  if (!data) {
    return (
      <div className="state-panel" role="status">
        <h1>Loading selected pathways</h1>
      </div>
    )
  }

  if (!canContinueToConfigure(state)) {
    return (
      <div className="page-container">
        <DesignProgress current="configure" />
        <div className="state-panel">
          <h1>Finish choosing Primary pathways first</h1>
          <p>
            Every selected Final Outcome needs at least one Primary pathway
            before configuration can begin.
          </p>
          <Link className="button primary" to="/design/outcomes">
            Return to outcome choices
          </Link>
        </div>
      </div>
    )
  }

  const items = getPathwayOverviewItems(data, state)
  const custom = state.customInnovation
  const customValidation = getCustomInnovationValidation(state.customInnovation)
  const customNeedsAttention = Boolean(custom) && !customValidation.complete
  const attentionCount =
    items.filter((item) => item.status !== 'configured').length +
    (customNeedsAttention ? 1 : 0)
  const nextItem = items.find((item) => item.status !== 'configured')
  const reviewAvailable = canContinueToReview(state)
  const reviewBlockers = getReviewEntryBlockers(data, state)
  const selectedActivityCount = getSelectedActivityCount(state)
  const plannedSelfHelpGroupCount =
    state.metadata.plannedSelfHelpGroupCount
  const showBulkSelfHelpGroupAction =
    plannedSelfHelpGroupCount != null &&
    plannedSelfHelpGroupCount > 0 &&
    selectedActivityCount > 0

  const applySelfHelpGroupTotal = () => {
    if (!showBulkSelfHelpGroupAction) return
    if (
      hasConfiguredActivityQuantityOrUnit(state) &&
      !window.confirm(
        'Some activity outputs have already been configured. Applying this will replace their quantity and unit with the project Self Help Group total. Custom output wording will be kept. Continue?',
      )
    ) {
      return
    }
    dispatch({ type: 'setAllActivityOutputsToProjectSelfHelpGroups' })
    setBulkOutputFeedback(
      `Activity outputs set to ${plannedSelfHelpGroupCount} Self Help Groups. Review individual activities and change any exceptions.`,
    )
  }

  const continueToReview = async () => {
    const saved = await saveProject()
    if (saved) navigate('/design/review')
  }

  return (
    <div className="page-container configure-overview-page">
      <DesignProgress current="configure" />
      <div className="page-heading">
        <span className="eyebrow">Stage 2 · Configure pathways</span>
        <h1>Configure pathways</h1>
        <p>Which pathway do you need to configure next?</p>
        <Link className="button secondary choose-return-link" to="/design/outcomes">
          Add or change outcomes and pathways
        </Link>
      </div>

      <section
        className="selected-outcomes-overview"
        aria-labelledby="selected-outcomes-heading"
      >
        <h2 id="selected-outcomes-heading">Selected Final Outcomes</h2>
        <ul>
          {state.selectedFinalOutcomeIds.map((outcomeId) => {
            const outcome = getFinalOutcome(data, outcomeId)
            return (
              <li key={outcomeId}>
                {outcome?.shortLabel ?? outcome?.statement ?? outcomeId}
              </li>
            )
          })}
          {custom && (
            <li>
              {custom.shortLabel || 'Untitled custom outcome'}
              <span className="relationship-badge">Custom innovation</span>
            </li>
          )}
        </ul>
      </section>

      {showBulkSelfHelpGroupAction && (
        <section
          className="bulk-shg-output-panel"
          aria-labelledby="bulk-shg-output-heading"
        >
          <div>
            <h2 id="bulk-shg-output-heading">
              Set all activity outputs to {plannedSelfHelpGroupCount} Self Help
              Groups
            </h2>
            <p>
              Use the project Self Help Group total as the starting point for
              all selected activities. You can change individual activities
              afterwards.
            </p>
          </div>
          <button
            className="button secondary"
            type="button"
            onClick={applySelfHelpGroupTotal}
          >
            Set all activity outputs to {plannedSelfHelpGroupCount} Self Help
            Groups
          </button>
          {bulkOutputFeedback && (
            <p className="bulk-shg-output-feedback" role="status">
              {bulkOutputFeedback}
            </p>
          )}
        </section>
      )}

      {custom && (
        <article
          className={`configuration-overview-card ${
            customNeedsAttention ? 'needs-attention' : ''
          }`}
        >
          <div className="overview-card-main">
            <span className="relationship-badge">Custom innovation</span>
            <h2>{custom.shortLabel || 'Custom innovation outcome'}</h2>
          </div>
          <div className="overview-card-action">
            <span
              className={`config-status ${
                customNeedsAttention ? 'status-in-progress' : 'status-configured'
              }`}
            >
              {customNeedsAttention ? 'Needs completion' : '✓ Complete'}
            </span>
            <Link className="button secondary" to="/design/custom-innovation">
              Edit custom innovation outcome
            </Link>
          </div>
        </article>
      )}

      {attentionCount > 0 && (
        <p className="attention-summary" role="status">
          {attentionCount} item{attentionCount === 1 ? '' : 's'} still need
          {attentionCount === 1 ? 's' : ''} configuration.
        </p>
      )}
      {attentionCount === 0 && (
        <p className="attention-summary all-complete" role="status">
          ✓ All pathways configured
        </p>
      )}

      <div className="configuration-overview-list">
        {items.map((item, index) => {
          const isNext = index === 0 && item.status !== 'configured'
          const configured = item.status === 'configured'
          const primaryLinks = item.linkedOutcomes.filter(
            (linkedOutcome) => linkedOutcome.relationshipType === 'primary',
          )
          const relatedLinks = item.linkedOutcomes.filter(
            (linkedOutcome) => linkedOutcome.relationshipType === 'related',
          )
          return (
            <article
              className={`configuration-overview-card ${
                isNext ? 'next-pathway-card' : ''
              } ${
                item.status !== 'configured' && !isNext ? 'needs-attention' : ''
              }`}
              key={item.pathway.pathwayId}
            >
              <div className="overview-card-main">
                {isNext && (
                  <span className="eyebrow">Configure this pathway next</span>
                )}
                <h2>{item.name}</h2>
                <div className="overview-contributes">
                  <strong>Contributes to</strong>
                  <ul>
                    {[...primaryLinks, ...relatedLinks].map(
                      (linkedOutcome) => (
                        <li key={linkedOutcome.finalOutcomeId}>
                          <span>{linkedOutcome.statement}</span>
                          <span className="overview-relationship">
                            {linkedOutcome.relationshipType === 'primary'
                              ? 'Primary'
                              : 'Related'}
                          </span>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              </div>
              <div className="overview-card-action">
                <span
                  className={`config-status ${
                    configured ? 'status-configured' : 'status-in-progress'
                  }`}
                >
                  {configured ? '✓ Configured' : 'Needs configuration'}
                </span>
                <Link
                  className={`button ${configured ? 'secondary' : 'primary'}`}
                  to={`/design/pathways/${item.pathway.pathwayId}/configure`}
                >
                  {configured ? 'Edit configuration' : 'Configure pathway'}
                </Link>
              </div>
            </article>
          )
        })}
      </div>

      {reviewAvailable ? (
        <section className="next-stage-panel ready-next-stage">
          <div>
            <h2>Ready to review</h2>
            <p>Review the outcomes, pathways and project details together.</p>
          </div>
          <button
            className="button primary large"
            type="button"
            onClick={() => void continueToReview()}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saving'
              ? 'Saving…'
              : 'Save & continue to review'}
          </button>
        </section>
      ) : (
        <section className="next-stage-panel incomplete-next-stage">
          <div>
            <h2>Finish required configuration first</h2>
            {reviewBlockers.length > 0 && (
              <ul className="review-blocker-list">
                {reviewBlockers.map((blocker) => (
                  <li key={blocker.id}>{blocker.label}</li>
                ))}
              </ul>
            )}
          </div>
          {nextItem ? (
            <Link
              className="button primary"
              to={`/design/pathways/${nextItem.pathway.pathwayId}/configure`}
            >
              Configure next pathway
            </Link>
          ) : customNeedsAttention ? (
            <Link className="button primary" to="/design/custom-innovation">
              Complete custom outcome
            </Link>
          ) : (
            <button className="button primary large" type="button" disabled>
              Save & continue to review
            </button>
          )}
        </section>
      )}
    </div>
  )
}

export { ReviewProjectPage } from './ReviewProjectPage'
