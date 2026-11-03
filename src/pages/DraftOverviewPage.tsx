import { Link, useLocation, useNavigate } from 'react-router-dom'
import { overviewBackground } from '../state/draftOverviewNavigation'
import { getProjectResumePath } from '../state/journeySelectors'
import { TheoryOfChangeGraph } from '../components/TheoryOfChangeGraph'
import { OutcomeLimitNotice } from '../components/OutcomeLimitNotice'
import { inputCategories } from '../data/inputCategories'
import { useFramework, useProjectDesign } from '../state/AppState'
import { getTheoryOfChangeReadiness } from '../state/theoryOfChangeReadiness'
import { getPathwayConfigurationStatus } from '../state/projectDesign'
import { generateTheoryOfChangeGraph } from '../theoryOfChange/generateTheoryOfChangeGraph'

export function DraftOverviewPage() {
  const { data, loading, error, retry } = useFramework()
  const { state, hasUnsavedChanges } = useProjectDesign()
  const location = useLocation()
  const navigate = useNavigate()
  const closeControl = (
    <div className="draft-overview-close">
      <button className="button secondary" type="button" autoFocus
        onClick={() => overviewBackground(location)
          ? navigate(-1)
          : navigate(getProjectResumePath(state), { replace: true })}>
        ← Back to editing
      </button>
    </div>
  )
  if (!data) return (
    <div className="state-panel" role={error ? 'alert' : 'status'}>
      {closeControl}
      <h1>{loading ? 'Loading draft overview' : 'Framework unavailable'}</h1>
      <p>{error ?? 'Preparing the current project design…'}</p>
      {error && <button className="button primary" onClick={retry}>Try again</button>}
    </div>
  )
  const readiness = getTheoryOfChangeReadiness(data, state)
  const graph = readiness.ready
    ? generateTheoryOfChangeGraph({ project: state, framework: data, inputCategories })
    : null
  const empty = state.selectedFinalOutcomeIds.length === 0 && !state.customInnovation
  return (
    <div className="page-container">
      {closeControl}
      <div className="page-heading">
        <span className="eyebrow">Work in progress</span>
        <h1>Draft project overview</h1>
        <p>{state.metadata.title || 'Untitled project'}</p>
        {state.metadata.isMultiCountry && <p>Multi-country project: {state.metadata.country || 'Countries not entered yet'}</p>}
        <p>This overview develops from your current choices as you build the project.
          It is not a completed review or an approved design. Final Review &amp; Export
          still requires the normal completion checks.</p>
        <p role="status">{hasUnsavedChanges
          ? 'Includes unsaved changes. Save project to keep them.'
          : 'Use Save project to persist your latest work.'}</p>
        <Link className="button secondary" to="/design/outcomes">Choose outcomes and pathways</Link>{' '}
        <Link className="button secondary" to="/design/configure">Configure pathways</Link>
      </div>
      <OutcomeLimitNotice />
      {empty && <p>No outcomes selected yet. Choose an outcome to start building your overview.</p>}
      <section aria-label="Draft outcomes">
        <h2>Current outcomes and pathways</h2>
        {state.selectedFinalOutcomeIds.map((id) => {
          const outcome = data.finalOutcomes.find((item) => item.id === id)
          const links = state.outcomePathwayLinks.filter((link) => link.finalOutcomeId === id)
          return <article className="review-outcome-card" key={id}>
            <h3>{outcome?.shortLabel ?? outcome?.statement ?? `Unavailable outcome (${id})`}</h3>
            {!links.some((link) => link.relationshipType === 'primary') && <p>Primary pathway still needed.</p>}
            <ul>{links.map((link) => {
              const pathway = data.pathways.find((item) => item.id === link.pathwayId)
              return <li key={link.pathwayId}>
                {pathway?.name ?? `Unavailable pathway (${link.pathwayId})`} — {link.relationshipType === 'primary' ? 'Primary' : 'Related'}
              </li>
            })}</ul>
            <Link to={`/design/outcomes/${id}`}>Edit outcome choices</Link>
          </article>
        })}
        {state.customInnovation && <article className="review-outcome-card">
          <h3>{state.customInnovation.statement || 'Untitled custom innovation outcome'}</h3>
          <p>Custom innovation draft · {state.customInnovation.pathway.intermediateOutcomes.length} Intermediate Outcomes</p>
          <Link to="/design/custom-innovation">Edit custom innovation</Link>
        </article>}
      </section>
      {state.projectPathways.length > 0 && <section aria-label="Draft pathway progress">
        <h2>Pathway progress</h2>
        {state.projectPathways.map((pathway) => {
          const configurations = pathway.intermediateOutcomeConfigurations
          const withActivities = configurations.filter((item) => item.standardActivities.length + item.projectSpecificActivities.length > 0).length
          return <article className="review-outcome-card" key={pathway.pathwayId}>
            <h3>{data.pathways.find((item) => item.id === pathway.pathwayId)?.name ?? 'Unavailable pathway'}</h3>
            <p>{getPathwayConfigurationStatus(pathway) === 'configured' ? 'Confirmed complete' : 'Not yet confirmed complete'} · {withActivities} of {configurations.length} Intermediate Outcomes have activities.</p>
            <Link to={`/design/pathways/${pathway.pathwayId}/configure`}>Configure this pathway</Link>
          </article>
        })}
      </section>}
      <section aria-label="Draft Theory of Change">
        <h2>Draft Theory of Change</h2>
        <p>The graph shows the current logic, not completion or approval. Select a node to inspect its details.</p>
        {graph ? <TheoryOfChangeGraph graph={graph} draft /> : <div className="neutral-note">
          <p>The graph needs a valid outcome and pathway structure. Your current choices remain visible above.</p>
          <ul>{readiness.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
        </div>}
      </section>
    </div>
  )
}
