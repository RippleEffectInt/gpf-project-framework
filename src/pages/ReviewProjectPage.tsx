import { Link } from 'react-router-dom'
import { DesignProgress } from '../components/DesignProgress'
import { ReadinessPanel } from '../components/ReadinessPanel'
import { inputCategories } from '../data/inputCategories'
import {
  getFinalOutcome,
  getImpactAreas,
  getImpactAreasForFinalOutcome,
  getIndicator,
  getIntermediateOutcomesForPathway,
  getPathway,
  getPrimaryFinalOutcomeForPathway,
  getPrimaryIndicatorForFinalOutcome,
  getSuggestedActivitiesForIntermediateOutcome,
} from '../services/frameworkService'
import { useFramework, useProjectDesign } from '../state/AppState'
import { canContinueToReview } from '../state/journeySelectors'
import { getProjectRelationshipsForPathway } from '../state/pathwayRelationships'
import { getPotentialImplementationPeriod } from '../state/projectDates'
import {
  getImpactsRepresentedByProject,
  getProjectReadiness,
  getUniqueSelectedPathways,
} from '../state/projectReadiness'
import { getTheoryOfChangeReadiness } from '../state/theoryOfChangeReadiness'
import type { FrameworkData } from '../types/framework'
import type {
  CustomInnovationOutcome,
  PathwayRelationshipType,
  ProjectDesignState,
  ProjectIntermediateOutcomeConfiguration,
} from '../types/project'

function relationshipLabel(type: PathwayRelationshipType): string {
  return type === 'primary' ? 'Primary' : 'Related'
}

function inputCategoryLabel(inputCategoryId: string): string {
  return (
    inputCategories.find((category) => category.id === inputCategoryId)
      ?.label ?? 'Unknown category'
  )
}

function selectedLinksForOutcome(
  state: ProjectDesignState,
  finalOutcomeId: string,
  relationshipType: PathwayRelationshipType,
) {
  return state.outcomePathwayLinks.filter(
    (link) =>
      link.finalOutcomeId === finalOutcomeId &&
      link.relationshipType === relationshipType,
  )
}

function IntermediateOutcomeReview({
  data,
  configuration,
}: {
  data: FrameworkData
  configuration: ProjectIntermediateOutcomeConfiguration
}) {
  const outcome = getIntermediateOutcomesForPathway(
    data,
    configuration.projectPathwayId,
  ).find(
    (candidate) =>
      candidate.id === configuration.frameworkIntermediateOutcomeId,
  )
  if (!outcome) return null

  const primaryIndicator = getIndicator(
    data,
    configuration.primaryIndicator?.frameworkIndicatorId,
  )
  const additionalIndicators = configuration.additionalIndicators
    .map((selection) => getIndicator(data, selection.frameworkIndicatorId))
    .filter((indicator) => indicator !== undefined)
  const suggestedActivities = getSuggestedActivitiesForIntermediateOutcome(
    data,
    outcome.id,
  )
  const selectedSuggested = configuration.standardActivities.map(
    (selection) => ({
      activity: suggestedActivities.find(
        (activity) => activity.id === selection.frameworkActivityId,
      ),
      notes: selection.projectNotes,
    }),
  )

  return (
    <details className="review-io-details">
      <summary>
        <span className="review-step-number">Step {outcome.stepNumber}</span>
        <strong>{outcome.statement}</strong>
      </summary>
      <div className="review-io-body">
        <p>
          <strong>Primary indicator:</strong>{' '}
          {primaryIndicator?.text ?? 'Primary indicator missing'}
        </p>
        <div>
          <strong>Additional indicators</strong>
          {additionalIndicators.length === 0 ? (
            <p className="neutral-note">No additional indicators selected.</p>
          ) : (
            <ul>
              {additionalIndicators.map((indicator) => (
                <li key={indicator.id}>{indicator.text}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <strong>Project-specific indicators</strong>
          {configuration.projectSpecificIndicators.length === 0 ? (
            <p className="neutral-note">
              No project-specific indicators added.
            </p>
          ) : (
            <ul>
              {configuration.projectSpecificIndicators.map((indicator) => (
                <li key={indicator.id}>
                  {indicator.wording}
                  {indicator.measurementNotes
                    ? ` — ${indicator.measurementNotes}`
                    : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <strong>Suggested activities</strong>
          {selectedSuggested.length === 0 ? (
            <p className="neutral-note">No activities selected.</p>
          ) : (
            <ul>
              {selectedSuggested.map((item, index) => (
                <li key={item.activity?.id ?? index}>
                  {item.activity?.text ?? 'Selected activity'}
                  {item.notes ? ` — ${item.notes}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <strong>Project-specific activities</strong>
          {configuration.projectSpecificActivities.length === 0 ? (
            <p className="neutral-note">
              No project-specific activities added.
            </p>
          ) : (
            <ul>
              {configuration.projectSpecificActivities.map((activity) => (
                <li key={activity.id}>
                  {activity.wording}
                  {activity.projectDetails
                    ? ` — ${activity.projectDetails}`
                    : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <strong>Inputs</strong>
          {configuration.inputs.length === 0 ? (
            <p className="neutral-note">No inputs added.</p>
          ) : (
            <ul>
              {configuration.inputs.map((input) => (
                <li key={input.id}>
                  {inputCategoryLabel(input.inputCategoryId)} — {input.details}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </details>
  )
}

function CustomInnovationReview({
  data,
  custom,
}: {
  data: FrameworkData
  custom: CustomInnovationOutcome
}) {
  const impactAreas = getImpactAreas(data).filter((impact) =>
    custom.impactAreaIds.includes(impact.id),
  )
  return (
    <section
      className="review-custom-section"
      aria-labelledby="custom-innovation-heading"
    >
      <div className="custom-innovation-banner">
        <span className="relationship-badge">Custom innovation</span>
        <h2 id="custom-innovation-heading">CUSTOM INNOVATION</h2>
        <p>
          This content is project-specific and is not part of the standard
          organisational framework.
        </p>
        <Link className="button secondary" to="/design/custom-innovation">
          Edit custom innovation outcome
        </Link>
      </div>
      <dl className="review-definition-list">
        <div>
          <dt>Short label</dt>
          <dd>{custom.shortLabel}</dd>
        </div>
        <div>
          <dt>Final Outcome statement</dt>
          <dd>{custom.statement}</dd>
        </div>
        <div>
          <dt>Rationale</dt>
          <dd>{custom.rationale}</dd>
        </div>
        <div>
          <dt>Linked organisational Impact Areas</dt>
          <dd>
            {impactAreas.length === 0
              ? 'None selected'
              : impactAreas.map((impact) => impact.theme).join(', ')}
          </dd>
        </div>
        <div>
          <dt>Primary indicator</dt>
          <dd>
            {custom.primaryIndicator.wording}
            {custom.primaryIndicator.measurementNotes
              ? ` — ${custom.primaryIndicator.measurementNotes}`
              : ''}
          </dd>
        </div>
        <div>
          <dt>Custom pathway</dt>
          <dd>{custom.pathway.name}</dd>
        </div>
        <div>
          <dt>Pathway description</dt>
          <dd>{custom.pathway.description}</dd>
        </div>
        <div>
          <dt>Why this pathway?</dt>
          <dd>{custom.pathway.rationale}</dd>
        </div>
      </dl>
      <h3>Intermediate Outcome chain</h3>
      <ol className="review-custom-io-list">
        {custom.pathway.intermediateOutcomes.map((outcome) => (
          <li key={outcome.id}>
            <details className="review-io-details">
              <summary>
                <span className="review-step-number">
                  Step {outcome.stepNumber}
                </span>
                <strong>{outcome.statement}</strong>
              </summary>
              <div className="review-io-body">
                <p>
                  <strong>Primary indicator:</strong>{' '}
                  {outcome.primaryIndicator.wording}
                  {outcome.primaryIndicator.measurementNotes
                    ? ` — ${outcome.primaryIndicator.measurementNotes}`
                    : ''}
                </p>
                <div>
                  <strong>Additional indicators</strong>
                  {outcome.additionalIndicators.length === 0 ? (
                    <p className="neutral-note">
                      No additional indicators selected.
                    </p>
                  ) : (
                    <ul>
                      {outcome.additionalIndicators.map((indicator) => (
                        <li key={indicator.id}>{indicator.wording}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <strong>Activities</strong>
                  {outcome.activities.length === 0 ? (
                    <p className="neutral-note">No activities selected.</p>
                  ) : (
                    <ul>
                      {outcome.activities.map((activity) => (
                        <li key={activity.id}>
                          {activity.wording}
                          {activity.projectDetails
                            ? ` — ${activity.projectDetails}`
                            : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <strong>Inputs</strong>
                  {outcome.inputs.length === 0 ? (
                    <p className="neutral-note">No inputs added.</p>
                  ) : (
                    <ul>
                      {outcome.inputs.map((input) => (
                        <li key={input.id}>
                          {inputCategoryLabel(input.inputCategoryId)} —{' '}
                          {input.details}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </details>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function ReviewProjectPage() {
  const { data } = useFramework()
  const { state } = useProjectDesign()

  if (!data) {
    return (
      <div className="state-panel" role="status">
        <h1>Loading project review</h1>
      </div>
    )
  }

  if (!canContinueToReview(state)) {
    return (
      <div className="page-container">
        <DesignProgress current="review" />
        <div className="state-panel">
          <h1>Finish configuring pathways first</h1>
          <p>
            Confirm each pathway configuration before reviewing the project.
          </p>
          <Link className="button primary" to="/design/configure">
            Return to pathway configuration
          </Link>
        </div>
      </div>
    )
  }

  const readiness = getProjectReadiness(data, state)
  const tocReadiness = getTheoryOfChangeReadiness(data, state)
  const impactAreas = getImpactsRepresentedByProject(data, state)
  const uniquePathways = getUniqueSelectedPathways(data, state)
  const { metadata } = state
  const implementationPeriod = getPotentialImplementationPeriod(metadata)

  return (
    <div className="page-container review-page">
      <DesignProgress current="review" />
      <div className="page-heading">
        <span className="eyebrow">Stage 3 · Review project</span>
        <h1>Review Project Design</h1>
        <p>
          Check the current design. Optional content may be empty. Submission
          and approval are not part of this phase.
        </p>
      </div>

      <ReadinessPanel readiness={readiness} />

      <section
        className="review-toc-action"
        aria-labelledby="review-toc-heading"
      >
        <div>
          <span className="eyebrow">Generated project logic</span>
          <h2 id="review-toc-heading">Theory of Change</h2>
          <p>
            View the causal chain generated from the current Final Outcomes,
            pathway relationships and Intermediate Outcomes.
          </p>
        </div>
        {tocReadiness.ready ? (
          <Link className="button primary large" to="/design/theory-of-change">
            View Theory of Change
          </Link>
        ) : (
          <button className="button primary large" type="button" disabled>
            View Theory of Change
          </button>
        )}
      </section>

      <section
        className="review-section"
        aria-labelledby="review-details-heading"
      >
        <div className="review-section-heading">
          <h2 id="review-details-heading">Project details</h2>
          <Link to="/design/details">Edit project details</Link>
        </div>
        <dl className="review-definition-list">
          <div>
            <dt>Project title</dt>
            <dd>{metadata.title}</dd>
          </div>
          <div>
            <dt>Country</dt>
            <dd>{metadata.country}</dd>
          </div>
          <div>
            <dt>Donor</dt>
            <dd>{metadata.donor}</dd>
          </div>
          <div>
            <dt>Funding opportunity/reference</dt>
            <dd>{metadata.fundingReference}</dd>
          </div>
          <div>
            <dt>Project Manager</dt>
            <dd>{metadata.projectManager}</dd>
          </div>
          <div>
            <dt>Potential implementation start</dt>
            <dd>{implementationPeriod.startLabel}</dd>
          </div>
          <div>
            <dt>Potential implementation end</dt>
            <dd>{implementationPeriod.endLabel}</dd>
          </div>
          <div>
            <dt>Short description</dt>
            <dd>{metadata.description}</dd>
          </div>
          <div>
            <dt>Framework version</dt>
            <dd>{data.frameworkVersion}</dd>
          </div>
        </dl>
      </section>

      <section
        className="review-section"
        aria-labelledby="review-impacts-heading"
      >
        <h2 id="review-impacts-heading">Impact Areas</h2>
        {impactAreas.length === 0 ? (
          <p className="neutral-note">
            No organisational Impact Areas represented yet.
          </p>
        ) : (
          <ul className="review-impact-list">
            {impactAreas.map((impact) => (
              <li key={impact.id}>{impact.theme}</li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="review-section"
        aria-labelledby="review-outcomes-heading"
      >
        <div className="review-section-heading">
          <h2 id="review-outcomes-heading">Standard Final Outcomes</h2>
          <Link to="/design/outcomes">Change Final Outcomes</Link>
        </div>
        {state.selectedFinalOutcomeIds.length === 0 ? (
          <p className="neutral-note">No standard Final Outcomes selected.</p>
        ) : (
          <div className="review-outcome-list">
            {state.selectedFinalOutcomeIds.map((outcomeId) => {
              const outcome = getFinalOutcome(data, outcomeId)
              if (!outcome) return null
              const outcomeImpacts = getImpactAreasForFinalOutcome(
                data,
                outcomeId,
              )
              const primaryIndicator = getPrimaryIndicatorForFinalOutcome(
                data,
                outcomeId,
              )
              const primaryLinks = selectedLinksForOutcome(
                state,
                outcomeId,
                'primary',
              )
              const relatedLinks = selectedLinksForOutcome(
                state,
                outcomeId,
                'related',
              )
              return (
                <article className="review-outcome-card" key={outcomeId}>
                  <span className="eyebrow">Standard Final Outcome</span>
                  <h3>{outcome.shortLabel ?? outcome.statement}</h3>
                  {outcome.shortLabel && <p>{outcome.statement}</p>}
                  <p>
                    <strong>Linked Impact Areas:</strong>{' '}
                    {outcomeImpacts.map((impact) => impact.theme).join(', ') ||
                      'None'}
                  </p>
                  <p>
                    <strong>Mandatory Primary indicator:</strong>{' '}
                    {primaryIndicator?.text ?? 'Primary indicator missing'}
                  </p>
                  <div className="review-pathway-groups">
                    <div>
                      <h4>Primary pathways</h4>
                      {primaryLinks.length === 0 ? (
                        <p className="neutral-note">
                          No Primary pathways selected.
                        </p>
                      ) : (
                        <ul>
                          {primaryLinks.map((link) => (
                            <li key={link.pathwayId}>
                              {getPathway(data, link.pathwayId)?.name ??
                                link.pathwayId}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <h4>Related pathways</h4>
                      {relatedLinks.length === 0 ? (
                        <p className="neutral-note">
                          No Related pathways selected.
                        </p>
                      ) : (
                        <ul>
                          {relatedLinks.map((link) => (
                            <li key={link.pathwayId}>
                              {getPathway(data, link.pathwayId)?.name ??
                                link.pathwayId}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <section
        className="review-section"
        aria-labelledby="review-pathways-heading"
      >
        <div className="review-section-heading">
          <h2 id="review-pathways-heading">Selected pathways</h2>
          <Link to="/design/configure">Change pathways</Link>
        </div>
        {uniquePathways.length === 0 ? (
          <p className="neutral-note">No standard pathways selected.</p>
        ) : (
          <div className="review-pathway-list">
            {uniquePathways.map((item) => {
              const frameworkPrimary = getPrimaryFinalOutcomeForPathway(
                data,
                item.pathway.pathwayId,
              )
              const frameworkPrimaryLabel =
                frameworkPrimary?.shortLabel ??
                frameworkPrimary?.statement ??
                'Not identified in framework data'
              const relationships = getProjectRelationshipsForPathway(
                data,
                state,
                item.pathway.pathwayId,
              )
              const relatedSelected = relationships.filter(
                (relationship) => relationship.relationshipType === 'related',
              )
              const frameworkPrimaryIsSelected = Boolean(
                frameworkPrimary &&
                state.selectedFinalOutcomeIds.includes(frameworkPrimary.id),
              )
              return (
                <article
                  className="review-pathway-card"
                  key={item.pathway.pathwayId}
                >
                  <div className="review-pathway-heading">
                    <h3>{item.name}</h3>
                    <span className={`config-status status-${item.status}`}>
                      {item.status === 'configured'
                        ? '✓ Configured'
                        : item.status === 'in-progress'
                          ? 'In progress'
                          : 'Not started'}
                    </span>
                  </div>
                  {frameworkPrimaryIsSelected ? (
                    <>
                      <p>
                        <strong>Contributes to</strong>
                      </p>
                      <ul className="review-contributes-list">
                        {relationships.map((relationship) => (
                          <li key={relationship.finalOutcomeId}>
                            <span>{relationship.label}</span>
                            <span className="overview-relationship">
                              {relationshipLabel(relationship.relationshipType)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <>
                      <p>
                        <strong>Primary Final Outcome</strong>
                      </p>
                      <p>{frameworkPrimaryLabel}</p>
                      {relatedSelected.length > 0 && (
                        <>
                          <p>
                            <strong>Selected because it also supports</strong>
                          </p>
                          <ul className="review-contributes-list">
                            {relatedSelected.map((relationship) => (
                              <li key={relationship.finalOutcomeId}>
                                {relationship.label}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </>
                  )}
                  <Link
                    className="text-button"
                    to={`/design/pathways/${item.pathway.pathwayId}/configure`}
                  >
                    {item.status === 'configured'
                      ? 'Edit configuration'
                      : 'Configure pathway'}
                  </Link>
                  <h4>Intermediate Outcome chain</h4>
                  {item.pathway.intermediateOutcomeConfigurations.map(
                    (configuration) => (
                      <IntermediateOutcomeReview
                        key={configuration.frameworkIntermediateOutcomeId}
                        data={data}
                        configuration={configuration}
                      />
                    ),
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>

      {state.customInnovation && (
        <CustomInnovationReview data={data} custom={state.customInnovation} />
      )}

      <p className="local-state-note">
        Use Save project to persist this design before leaving the application.
      </p>
    </div>
  )
}
