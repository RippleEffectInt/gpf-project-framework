import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { createBlankCustomInnovation } from '../state/customInnovation'
import {
  getActiveFinalOutcomes,
  getFinalOutcome,
  getFinalOutcomeSummary,
  getImpactAreas,
  getIndicators,
  getPathwayIntermediateOutcomeSeeds,
  getPathwayForOutcome,
  getPrimaryFinalOutcomeForPathway,
  getPrimaryPathwaysForFinalOutcome,
  getRelatedPathwaysForFinalOutcome,
} from '../services/frameworkService'
import { FinalOutcomeCard, PathwayCard } from '../components/FrameworkCards'
import { DesignProgress } from '../components/DesignProgress'
import { useFramework, useProjectDesign } from '../state/AppState'
import { getSelectedPrimaryPathwayCount } from '../state/projectDesign'
import {
  getProjectRelationshipsForPathway,
} from '../state/pathwayRelationships'
import type { PathwaySummary } from '../types/framework'

function ReferenceDataState() {
  const { loading, error, retry } = useFramework()
  if (loading) {
    return (
      <div className="state-panel" role="status">
        <span className="spinner" aria-hidden="true" />
        <h1>Loading the framework</h1>
        <p>Preparing approved outcomes, pathways and indicators…</p>
      </div>
    )
  }
  return (
    <div className="state-panel" role="alert">
      <h1>Framework unavailable</h1>
      <p>{error ?? 'The framework reference data could not be loaded.'}</p>
      <button className="button primary" type="button" onClick={retry}>
        Try again
      </button>
    </div>
  )
}

function MissingRecord({ recordName }: { recordName: string }) {
  return (
    <div className="state-panel">
      <h1>{recordName} not found</h1>
      <p>The selected item is unavailable in the current framework version.</p>
      <Link className="button secondary" to="/design/outcomes">
        Browse final outcomes
      </Link>
    </div>
  )
}

export function FindFinalOutcomesPage() {
  const { data } = useFramework()
  const { state, dispatch } = useProjectDesign()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [impactAreaId, setImpactAreaId] = useState('')

  const outcomes = useMemo(
    () =>
      data
        ? getActiveFinalOutcomes(data, query, impactAreaId).map((outcome) =>
            getFinalOutcomeSummary(data, outcome),
          )
        : [],
    [data, query, impactAreaId],
  )

  if (!data) return <ReferenceDataState />

  const impactAreas = getImpactAreas(data)
  return (
    <div className="page-container">
      <DesignProgress current="choose" />
      <div className="page-heading">
        <span className="eyebrow">Stage 1 · Choose outcomes and pathways</span>
        <h1>What change is this project trying to achieve?</h1>
        <p>
          Open an outcome to review its indicator and choose at least one
          Primary pathway.
        </p>
      </div>

      <section className="filter-bar sticky-filters" aria-label="Outcome filters">
        <label className="search-field">
          <span>Search final outcomes</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search outcome statements"
          />
        </label>
        <label>
          <span>Impact Area</span>
          <select
            value={impactAreaId}
            onChange={(event) => setImpactAreaId(event.target.value)}
          >
            <option value="">All impact areas</option>
            {impactAreas.map((impact) => (
              <option key={impact.id} value={impact.id}>
                {impact.theme}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="custom-innovation-entry">
        <h2>Can't find a suitable standard outcome?</h2>
        <p>
          If your project genuinely requires an outcome that is not represented
          in the standard framework, you can create one custom innovation
          outcome.
        </p>
        {state.customInnovation ? (
          <div className="custom-already-added" role="status">
            <strong>Custom innovation outcome already added</strong>
            <p>
              {state.customInnovation.shortLabel ||
                'Untitled custom innovation outcome'}
            </p>
            <Link className="button secondary" to="/design/custom-innovation">
              Edit custom innovation outcome
            </Link>
          </div>
        ) : (
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              dispatch({
                type: 'addCustomInnovation',
                customInnovation: createBlankCustomInnovation(),
              })
              navigate('/design/custom-innovation')
            }}
          >
            Add custom innovation outcome
          </button>
        )}
      </section>

      <div className="results-summary" aria-live="polite">
        {outcomes.length} final outcome{outcomes.length === 1 ? '' : 's'}
      </div>
      {outcomes.length === 0 ? (
        <div className="empty-state">
          <h2>No final outcomes found</h2>
          <p>Try a broader search or choose a different impact area.</p>
        </div>
      ) : (
        <div className="framework-grid">
          {outcomes.map((summary) => (
            <FinalOutcomeCard
              key={summary.outcome.id}
              summary={summary}
              selectionStatus={
                !state.selectedFinalOutcomeIds.includes(summary.outcome.id)
                  ? 'not-selected'
                  : getSelectedPrimaryPathwayCount(
                        state,
                        summary.outcome.id,
                      ) > 0
                    ? 'complete'
                    : 'incomplete'
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function FinalOutcomeDetailPage() {
  const { outcomeId = '' } = useParams()
  const { data } = useFramework()
  const {
    state,
    dispatch,
    pathwayNavigationFeedback,
    clearPathwayNavigationFeedback,
  } = useProjectDesign()
  const feedbackRef = useRef<HTMLDivElement>(null)
  const feedback =
    pathwayNavigationFeedback?.finalOutcomeId === outcomeId
      ? pathwayNavigationFeedback
      : null

  useEffect(() => {
    if (!feedback) return
    const selectedCard = document.getElementById(
      `pathway-card-${feedback.pathwayId}`,
    )
    selectedCard?.scrollIntoView({ block: 'center', behavior: 'auto' })
    selectedCard?.focus()
    if (!selectedCard) feedbackRef.current?.focus()
    const clearTimer = window.setTimeout(
      clearPathwayNavigationFeedback,
      6000,
    )
    return () => window.clearTimeout(clearTimer)
  }, [clearPathwayNavigationFeedback, feedback])

  if (!data) return <ReferenceDataState />

  const outcome = getFinalOutcome(data, outcomeId)
  if (!outcome) return <MissingRecord recordName="Final outcome" />

  const summary = getFinalOutcomeSummary(data, outcome)
  const additionalIndicators = getIndicators(
    data,
    outcome.additionalIndicatorIds,
  )
  const selected = state.selectedFinalOutcomeIds.includes(outcome.id)
  const primaryPathways = getPrimaryPathwaysForFinalOutcome(data, outcomeId)
  const relatedPathways = getRelatedPathwaysForFinalOutcome(data, outcomeId)
  const selectedPrimaryCount = getSelectedPrimaryPathwayCount(state, outcomeId)
  const outcomeComplete = selected && selectedPrimaryCount > 0

  const addOrLinkPathway = (pathwaySummary: PathwaySummary) => {
    const frameworkPrimaryOutcome = getPrimaryFinalOutcomeForPathway(
      data,
      pathwaySummary.pathway.id,
    )
    dispatch({
      type: 'addPathway',
      finalOutcomeId: outcomeId,
      pathwayId: pathwaySummary.pathway.id,
      relationshipType: pathwaySummary.relationshipType,
      frameworkPrimaryFinalOutcomeId:
        frameworkPrimaryOutcome?.id ?? outcomeId,
      intermediateOutcomes: getPathwayIntermediateOutcomeSeeds(
        data,
        pathwaySummary.pathway.id,
      ),
    })
  }

  const renderPathwayCard = (
    pathwaySummary: PathwaySummary,
    related = false,
  ) => {
    const pathwayInProject = state.projectPathways.some(
      ({ pathwayId }) => pathwayId === pathwaySummary.pathway.id,
    )
    const linkedToOutcome = state.outcomePathwayLinks.some(
      (link) =>
        link.pathwayId === pathwaySummary.pathway.id &&
        link.finalOutcomeId === outcomeId,
    )
    const relatedBlocked = related && selectedPrimaryCount === 0
    const primaryOutcome = getPrimaryFinalOutcomeForPathway(
      data,
      pathwaySummary.pathway.id,
    )
    return (
      <PathwayCard
        key={pathwaySummary.pathway.id}
        summary={pathwaySummary}
        pathwayInProject={pathwayInProject}
        linkedToOutcome={linkedToOutcome}
        actionDisabled={relatedBlocked}
        recentlyAdded={feedback?.pathwayId === pathwaySummary.pathway.id}
        primaryFinalOutcomeLabel={
          primaryOutcome?.shortLabel ?? primaryOutcome?.statement
        }
        actionLabelOverride={
          relatedBlocked ? 'Choose a Primary pathway first' : undefined
        }
        onAddOrLink={() => addOrLinkPathway(pathwaySummary)}
      />
    )
  }

  return (
    <div className="page-container detail-page">
      <DesignProgress current="choose" />
      <Link className="back-link" to="/design/outcomes">
        ← Back to all outcomes
      </Link>
      {feedback && (
        <div
          className="navigation-success"
          role="status"
          aria-live="polite"
          aria-label={feedback.message}
          tabIndex={-1}
          ref={feedbackRef}
        >
          <span aria-hidden="true">✓</span>
          {feedback.message}
        </div>
      )}
      <div className="detail-hero">
        <div className="card-topline">
          <div className="metadata-chips" aria-label="Impact areas">
            {summary.impactAreas.map((impact) => (
              <span className="impact-chip light-chip" key={impact.id}>
                {impact.theme}
              </span>
            ))}
          </div>
          {selected && <span className="selected-badge">✓ In project</span>}
        </div>
        <span className="eyebrow">
          {outcome.shortLabel ?? 'Final outcome'}
        </span>
        <h1>{outcome.statement}</h1>
      </div>
      <div className="detail-columns">
        <section className="detail-section">
          <span className="eyebrow">Required measure</span>
          <h2>Mandatory primary indicator</h2>
          {summary.primaryIndicator ? (
            <p className="indicator-large">{summary.primaryIndicator.text}</p>
          ) : (
            <div className="data-error" role="alert">
              This Final Outcome has no active mandatory Primary indicator.
            </div>
          )}
        </section>
        <section className="detail-section">
          <span className="eyebrow">Informational preview</span>
          <h2>Optional additional indicators</h2>
          {additionalIndicators.length > 0 ? (
            <ul className="clean-list">
              {additionalIndicators.map((indicator) => (
                <li key={indicator.id}>{indicator.text}</li>
              ))}
            </ul>
          ) : (
            <p>No additional indicators are listed for this outcome.</p>
          )}
        </section>
      </div>

      <section className="combined-pathway-selection">
        <div
          className={`requirement-status ${
            outcomeComplete ? 'requirement-met' : ''
          }`}
          role="status"
        >
          <strong>
            {outcomeComplete
              ? '✓ Outcome and Primary pathway selected'
              : 'Primary pathway required'}
          </strong>
          <span>
            {outcomeComplete
              ? 'You can add Related pathways or continue when all outcomes are complete.'
              : 'Choose at least one Primary pathway below to select this Final Outcome.'}
          </span>
        </div>

        {primaryPathways.length === 0 ? (
          <div className="data-error" role="alert">
            <strong>Framework data error</strong>
            <p>This outcome has no Primary pathway in the current framework.</p>
          </div>
        ) : (
          <section className="pathway-group" aria-labelledby="primary-pathways">
            <div className="group-heading">
              <span className="eyebrow">Required choice</span>
              <h2 id="primary-pathways">Primary pathways</h2>
              <p>
                Ripple Effect&apos;s standard routes for achieving this
                outcome. Choose at least one.
              </p>
            </div>
            <div className="framework-grid">
              {primaryPathways.map((pathwaySummary) =>
                renderPathwayCard(pathwaySummary),
              )}
            </div>
          </section>
        )}

        <section
          className="pathway-group related-group"
          aria-labelledby="related-pathways"
        >
          <div className="group-heading">
            <span className="eyebrow">Optional support</span>
            <h2 id="related-pathways">Related pathways</h2>
            <p>
              These pathways can strengthen your Primary pathway. They are
              optional.
            </p>
          </div>
          {relatedPathways.length === 0 ? (
            <p className="neutral-note">No Related pathways are available.</p>
          ) : (
            <div className="framework-grid">
              {relatedPathways.map((pathwaySummary) =>
                renderPathwayCard(pathwaySummary, true),
              )}
            </div>
          )}
        </section>
      </section>

    </div>
  )
}

export function ChoosePathwaysPage() {
  const { outcomeId = '' } = useParams()
  return <Navigate replace to={`/design/outcomes/${outcomeId}`} />
}

export function PathwayDetailPage() {
  const { outcomeId = '', pathwayId = '' } = useParams()
  const navigate = useNavigate()
  const { data } = useFramework()
  const { state, dispatch, announcePathwayNavigation } = useProjectDesign()
  if (!data) return <ReferenceDataState />

  const outcome = getFinalOutcome(data, outcomeId)
  const summary = getPathwayForOutcome(data, outcomeId, pathwayId)
  if (!outcome || !summary) return <MissingRecord recordName="Pathway" />

  const isRelated = summary.relationshipType === 'related'
  const currentOutcomeLabel = outcome.shortLabel ?? outcome.statement
  const pathwayPrimaryOutcome = getPrimaryFinalOutcomeForPathway(data, pathwayId)
  const pathwayPrimaryLabel =
    pathwayPrimaryOutcome?.shortLabel ??
    pathwayPrimaryOutcome?.statement ??
    'its own Final Outcome'
  const projectRelationships = getProjectRelationshipsForPathway(
    data,
    state,
    pathwayId,
  )
  const otherRelationships = projectRelationships.filter(
    (relationship) => relationship.finalOutcomeId !== outcomeId,
  )
  const pathwayInProject = state.projectPathways.some(
    (item) => item.pathwayId === pathwayId,
  )
  const linkedToOutcome = state.outcomePathwayLinks.some(
    (link) =>
      link.pathwayId === pathwayId && link.finalOutcomeId === outcomeId,
  )
  const actionLabel = pathwayInProject
    ? 'Link pathway to this outcome'
    : 'Add pathway to basket'

  const addOrLinkPathway = () => {
    if (linkedToOutcome) return
    const addsPrimaryFinalOutcome = Boolean(
      isRelated &&
        pathwayPrimaryOutcome &&
        !state.selectedFinalOutcomeIds.includes(pathwayPrimaryOutcome.id),
    )
    dispatch({
      type: 'addPathway',
      finalOutcomeId: outcomeId,
      pathwayId,
      relationshipType: summary.relationshipType,
      frameworkPrimaryFinalOutcomeId:
        pathwayPrimaryOutcome?.id ?? outcomeId,
      intermediateOutcomes: getPathwayIntermediateOutcomeSeeds(
        data,
        pathwayId,
      ),
    })
    announcePathwayNavigation({
      finalOutcomeId: outcomeId,
      pathwayId,
      message: addsPrimaryFinalOutcome
        ? 'Pathway added. Its Primary Final Outcome has also been added to your project.'
        : pathwayInProject
          ? 'Pathway linked to this outcome'
          : 'Pathway added to project',
    })
    navigate(`/design/outcomes/${outcomeId}`, { replace: true })
  }

  const addAction = linkedToOutcome ? (
    <p className="already-in-project-status" role="status">
      Already in project
    </p>
  ) : (
    <button
      className="button primary"
      type="button"
      onClick={addOrLinkPathway}
    >
      {actionLabel}
    </button>
  )

  return (
    <div className="page-container detail-page">
      <DesignProgress current="choose" />
      <Link
        className="back-link"
        to={`/design/outcomes/${outcomeId}`}
      >
        ← Back to outcome and pathways
      </Link>
      <div className="pathway-detail-header">
        <h1>{summary.pathway.name}</h1>
        <p className="lead">
          {summary.pathway.description ??
            'This pathway sets out the ordered intermediate outcomes through which the project can contribute to the selected final outcome.'}
        </p>
        <section
          className="pathway-relationship-box"
          aria-label="Pathway relationship"
        >
          {isRelated ? (
            <>
              <div>
                <h2>Related pathway for</h2>
                <p>{currentOutcomeLabel}</p>
              </div>
              <div>
                <h2>Primary Final Outcome</h2>
                <p>{pathwayPrimaryLabel}</p>
              </div>
              <p>
                This pathway primarily contributes to the Final Outcome above
                and can also reinforce the outcome you are currently designing.
              </p>
            </>
          ) : (
            <div>
              <h2>Primary pathway for</h2>
              <p>{currentOutcomeLabel}</p>
            </div>
          )}
          {otherRelationships.length > 0 && (
            <p>
              Also used elsewhere in this project:{' '}
              {otherRelationships
                .map(
                  (relationship) =>
                    `${relationship.label} (${relationship.relationshipType === 'primary' ? 'Primary' : 'Related'})`,
                )
                .join(', ')}
            </p>
          )}
        </section>
        <div className="why-panel">
          <h2>Why this pathway?</h2>
          <p>
            {summary.rationale ??
              'This approved pathway provides an ordered route towards the selected final outcome.'}
          </p>
        </div>
        {addAction}
      </div>

      <section className="chain-section">
        <div className="section-heading-row">
          <div>
            <span className="eyebrow">Read-only framework content</span>
            <h2>Intermediate-outcome chain</h2>
          </div>
          <span>{summary.intermediateOutcomes.length} steps</span>
        </div>
        <ol className="outcome-chain">
          {summary.intermediateOutcomes.map((intermediateOutcome) => {
            const primaryIndicator = getIndicators(
              data,
              intermediateOutcome.primaryIndicatorIds,
            )[0]
            return (
              <li key={intermediateOutcome.id}>
                <div className="chain-number">
                  {intermediateOutcome.stepNumber}
                </div>
                <div className="chain-content">
                  <h3>{intermediateOutcome.statement}</h3>
                  <div className="indicator-preview">
                    <span>Mandatory primary indicator</span>
                    <p>
                      {primaryIndicator?.text ??
                        'No primary indicator is available.'}
                    </p>
                  </div>
                  <p className="activity-count">
                    {intermediateOutcome.suggestedActivityIds.length} suggested{' '}
                    {intermediateOutcome.suggestedActivityIds.length === 1
                      ? 'activity'
                      : 'activities'}{' '}
                    available
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </section>
      <section className="pathway-detail-bottom-action">
        <div>
          <span className="eyebrow">Add this pathway?</span>
          <h2>{summary.pathway.name}</h2>
          <p>
            Return to the Final Outcome after adding it, then continue choosing
            pathways.
          </p>
        </div>
        {linkedToOutcome ? (
          <p className="already-in-project-status" role="status">
            Already in project
          </p>
        ) : (
          <button
            className="button primary large"
            type="button"
            onClick={addOrLinkPathway}
          >
            {actionLabel}
          </button>
        )}
      </section>
    </div>
  )
}
