import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { DesignProgress } from '../components/DesignProgress'
import { TheoryOfChangeGraph } from '../components/TheoryOfChangeGraph'
import { inputCategories } from '../data/inputCategories'
import { useFramework, useProjectDesign } from '../state/AppState'
import { getPotentialImplementationPeriod } from '../state/projectDates'
import { getTheoryOfChangeReadiness } from '../state/theoryOfChangeReadiness'
import { generateTheoryOfChangeGraph } from '../theoryOfChange/generateTheoryOfChangeGraph'

const summaryLabels = {
  impactCount: 'Impact Area',
  finalOutcomeCount: 'Final Outcome',
  pathwayCount: 'Pathway',
  intermediateOutcomeCount: 'Intermediate Outcome',
} as const

export function TheoryOfChangePage() {
  const { data, loading, error, retry } = useFramework()
  const { state } = useProjectDesign()

  const readiness = useMemo(
    () => (data ? getTheoryOfChangeReadiness(data, state) : null),
    [data, state],
  )
  const graph = useMemo(
    () =>
      data && readiness?.ready
        ? generateTheoryOfChangeGraph({
            project: state,
            framework: data,
            inputCategories,
          })
        : null,
    [data, readiness?.ready, state],
  )

  if (!data) {
    return (
      <div className="state-panel" role={error ? 'alert' : 'status'}>
        <h1>{loading ? 'Loading the framework' : 'Framework unavailable'}</h1>
        <p>{error ?? 'Preparing the Theory of Change…'}</p>
        {error && (
          <button className="button primary" type="button" onClick={retry}>
            Try again
          </button>
        )}
      </div>
    )
  }

  if (!readiness?.ready || !graph) {
    return (
      <div className="page-container toc-page">
        <DesignProgress current="review" />
        <Link className="back-link" to="/design/review">
          ← Back to Review
        </Link>
        <div className="state-panel toc-invalid-state">
          <h1>Theory of Change cannot be generated yet</h1>
          <p>Complete the following project-design requirements:</p>
          <ul>
            {readiness?.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
          <Link className="button primary" to="/design/outcomes">
            Return to project design
          </Link>
        </div>
      </div>
    )
  }

  const period = getPotentialImplementationPeriod(state.metadata)
  const hasCustom = graph.nodes.some((node) => node.custom)

  return (
    <div className="page-container toc-page">
      <DesignProgress current="review" />
      <Link className="back-link" to="/design/review">
        ← Back to Review
      </Link>
      <div className="toc-page-heading">
        <div>
          <span className="eyebrow">Generated project logic</span>
          <h1>Theory of Change</h1>
          <p>
            This visual is generated automatically from your project design. To
            change the Theory of Change, edit the project design rather than the
            diagram directly.
          </p>
        </div>
        <dl className="toc-project-context">
          <div>
            <dt>Project</dt>
            <dd>{state.metadata.title || 'Untitled project'}</dd>
          </div>
          <div>
            <dt>Country</dt>
            <dd>{state.metadata.country || 'Not set'}</dd>
          </div>
          <div>
            <dt>Potential implementation</dt>
            <dd>
              {period.startLabel} – {period.endLabel}
            </dd>
          </div>
        </dl>
      </div>

      <section className="toc-summary" aria-label="Theory of Change summary">
        {Object.entries(summaryLabels).map(([key, label]) => {
          const count = graph.summary[key as keyof typeof summaryLabels]
          return (
            <div key={key}>
              <strong>{count}</strong>
              <span>
                {label}
                {count === 1 ? '' : 's'}
              </span>
            </div>
          )
        })}
      </section>

      <section className="toc-legend" aria-labelledby="toc-legend-heading">
        <h2 id="toc-legend-heading">Legend</h2>
        <div className="toc-legend-items">
          <span>
            <i className="toc-legend-node impact" aria-hidden="true" />
            Impact
          </span>
          <span>
            <i className="toc-legend-node final-outcome" aria-hidden="true" />
            Final Outcome
          </span>
          <span>
            <i className="toc-legend-node pathway" aria-hidden="true" />
            Pathway
          </span>
          <span>
            <i
              className="toc-legend-node intermediate-outcome"
              aria-hidden="true"
            />
            Intermediate Outcome
          </span>
          <span>
            <i className="toc-legend-line primary" aria-hidden="true" />
            Solid line · Primary pathway relationship
          </span>
          <span>
            <i className="toc-legend-line related" aria-hidden="true" />
            Dashed line · Related pathway relationship
          </span>
          {hasCustom && (
            <span>
              <i className="toc-legend-custom" aria-hidden="true" />
              Custom innovation
            </span>
          )}
        </div>
      </section>

      <TheoryOfChangeGraph graph={graph} />
      <p className="toc-export-note">
        Image export is deliberately deferred until full-graph capture can
        include every branch, the legend and project title without clipping.
      </p>
    </div>
  )
}
