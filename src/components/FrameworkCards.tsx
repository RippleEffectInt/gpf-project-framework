import { Link } from 'react-router-dom'
import type {
  FinalOutcomeSummary,
  PathwaySummary,
} from '../types/framework'

export function FinalOutcomeCard({
  summary,
  selectionStatus,
}: {
  summary: FinalOutcomeSummary
  selectionStatus: 'not-selected' | 'incomplete' | 'complete'
}) {
  const {
    outcome,
    impactAreas,
    primaryIndicator,
    primaryPathwayCount,
    relatedPathwayCount,
  } = summary
  return (
    <article
      className={`framework-card ${
        selectionStatus !== 'not-selected' ? 'selected-card' : ''
      }`}
    >
      <div className="card-topline">
        <div className="metadata-chips" aria-label="Impact areas">
          {impactAreas.map((impact) => (
            <span className="impact-chip" key={impact.id}>
              {impact.theme}
            </span>
          ))}
        </div>
        {selectionStatus === 'complete' && (
          <span className="selected-badge">
            ✓ Outcome and Primary pathway selected
          </span>
        )}
        {selectionStatus === 'incomplete' && (
          <span className="incomplete-badge">Primary pathway required</span>
        )}
      </div>
      <div>
        <p className="card-kicker">
          {outcome.shortLabel ?? 'Final outcome'}
        </p>
        <h2>{outcome.statement}</h2>
      </div>
      <div
        className={`indicator-preview ${primaryIndicator ? '' : 'data-error'}`}
        role={primaryIndicator ? undefined : 'alert'}
      >
        <span>
          {primaryIndicator
            ? 'Mandatory primary indicator'
            : 'Framework data error'}
        </span>
        <p>
          {primaryIndicator?.text ??
            'No active mandatory Primary indicator is available.'}
        </p>
      </div>
      <p className="pathway-count">
        {primaryPathwayCount} primary · {relatedPathwayCount} related pathway
        {relatedPathwayCount === 1 ? '' : 's'}
      </p>
      <div className="card-actions single-action">
        <Link
          className="button primary"
          to={`/design/outcomes/${outcome.id}`}
        >
          {selectionStatus === 'complete'
            ? 'Review outcome choices'
            : 'View details and choose pathways'}
        </Link>
      </div>
    </article>
  )
}

export function PathwayCard({
  summary,
  pathwayInProject,
  linkedToOutcome,
  actionDisabled = false,
  actionLabelOverride,
  recentlyAdded = false,
  primaryFinalOutcomeLabel,
  onAddOrLink,
}: {
  summary: PathwaySummary
  pathwayInProject: boolean
  linkedToOutcome: boolean
  actionDisabled?: boolean
  actionLabelOverride?: string
  recentlyAdded?: boolean
  primaryFinalOutcomeLabel?: string
  onAddOrLink: () => void
}) {
  const {
    pathway,
    finalOutcomeId,
    relationshipType,
    rationale,
    intermediateOutcomes,
  } = summary
  const isRelated = relationshipType === 'related'
  const actionLabel =
    actionLabelOverride ??
    (linkedToOutcome
      ? 'Linked to this outcome'
      : pathwayInProject
        ? 'Already in project — link to this outcome'
        : 'Add pathway to basket')

  return (
    <article
      id={`pathway-card-${pathway.id}`}
      tabIndex={recentlyAdded ? -1 : undefined}
      className={`framework-card pathway-card ${
        linkedToOutcome ? 'selected-card' : ''
      } ${recentlyAdded ? 'recently-added-card' : ''}`}
    >
      {(isRelated || linkedToOutcome) && (
        <div className="card-topline">
          {isRelated && (
            <span className="relationship-badge">Related pathway</span>
          )}
          {linkedToOutcome && (
            <span className="selected-badge">✓ In project</span>
          )}
        </div>
      )}
      <div>
        <p className="card-kicker">
          {intermediateOutcomes.length} intermediate outcome
          {intermediateOutcomes.length === 1 ? '' : 's'}
        </p>
        <h2>{pathway.name}</h2>
        {isRelated && primaryFinalOutcomeLabel && (
          <p className="related-primary-outcome">
            Primary Final Outcome: <strong>{primaryFinalOutcomeLabel}</strong>
          </p>
        )}
        {isRelated && (
          <p className="section-help">
            Can also reinforce this Final Outcome.
          </p>
        )}
        {!isRelated && (
          <p>
            {pathway.description ??
              'Follow the pathway’s ordered outcome chain to inspect how change is expected to happen.'}
          </p>
        )}
      </div>
      <div className="rationale-preview">
        <h3>Why this pathway?</h3>
        <p>
          {rationale ??
            (isRelated
              ? 'This pathway can reinforce the current Final Outcome while primarily contributing to another outcome.'
              : 'This approved pathway provides an ordered route towards the selected final outcome.')}
        </p>
      </div>
      <div className="card-actions">
        <Link
          className="button secondary"
          to={`/design/outcomes/${finalOutcomeId}/pathways/${pathway.id}`}
          state={{ fromOutcomeId: finalOutcomeId }}
        >
          View pathway
        </Link>
        <button
          className="button primary"
          type="button"
          disabled={linkedToOutcome || actionDisabled}
          onClick={onAddOrLink}
        >
          {actionLabel}
        </button>
      </div>
    </article>
  )
}
