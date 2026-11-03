import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DesignProgress } from '../components/DesignProgress'
import { useFramework, useProjectDesign } from '../state/AppState'
import { getFinalOutcome, getPathway, getPrimaryIndicatorForFinalOutcome, getIntermediateOutcomesInCausalOrder } from '../services/frameworkService'
import { displayedOutputText } from '../state/activityOutputs'
import { guidedPreparationActions } from '../state/guidedDesign'
import { canContinueToConfigure } from '../state/journeySelectors'
import { IntermediateOutcomeConfigurationCard } from './PathwayConfigurationPage'

export function GuidedDesignPage() {
  const { data } = useFramework()
  const { state, dispatch, saveProject, saveStatus } = useProjectDesign()
  const [phase, setPhase] = useState<'activities' | 'indicators' | 'detailed'>('activities')
  const [message, setMessage] = useState('')
  if (!data) return <p role="status">Loading framework…</p>
  if (!canContinueToConfigure(state)) return <div className="page-container"><h1>Choose Primary pathways first</h1><Link to="/design/outcomes">Return to outcomes</Link></div>
  const actions = guidedPreparationActions(data, state)
  const total = state.metadata.plannedSelfHelpGroupCount
  const owner = new Map(state.projectPathways.map(pathway => [pathway.pathwayId,
    state.selectedFinalOutcomeIds.find(id => state.outcomePathwayLinks.some(link => link.pathwayId === pathway.pathwayId && link.finalOutcomeId === id))]))
  return <div className="page-container configuration-page guided-setup">
    <DesignProgress current="configure" />
    <h1>Guided setup</h1>
    <p>One project, two ways to edit. Detailed setup uses the same selections and values. Add custom entries before leaving this page; unfinished new-entry form text is not saved.</p>
    <Link className="button secondary" to="/design/configure">Return to pathways</Link>
    <div className="page-actions">
      <button className="button secondary" aria-pressed={phase === 'activities'} onClick={() => setPhase('activities')}>1. Activities &amp; outputs</button>
      <button className="button secondary" aria-pressed={phase === 'indicators'} onClick={() => setPhase('indicators')}>2. Indicators &amp; review</button>
      <button className="button secondary" aria-pressed={phase === 'detailed'} onClick={() => setPhase('detailed')}>Detailed setup</button>
      <button className="button secondary" disabled={saveStatus === 'saving'} onClick={async () => setMessage(await saveProject() ? 'Draft saved.' : 'Save failed. Your edits remain here; try again.')}>Save guided draft</button>
    </div>
    <p role="status">{message}</p>
    <section hidden={phase !== 'activities'} className="state-panel">
      <h2>Prepare editable activity defaults</h2>
      <p>Include all suggested activities for steps with no activities yet. Existing selections, custom activities and reviewed steps are preserved. This does not mark the design complete.</p>
      <p>{total && total > 0 ? `The starting quantity is ${total} Self Help Groups from Project details. These are group-reach defaults, not numbers of people, events or facilities. Review every activity and change its quantity and unit where needed.` : 'No positive group count is set. Activities will be included with quantities and units left blank.'} Remove activities that are not relevant. Missing output wording still needs your input.</p>
      <p>Linked SHG quantities follow changes to the project group total. Manually edited quantities can be independent; check any numbers in custom output wording separately.</p>
      <button className="button primary" disabled={!actions.length} onClick={() => {
        actions.forEach(dispatch)
        setMessage(`Added ${actions.length} suggested activities with editable defaults. Review these before confirming steps.`)
      }}>Prepare untouched steps</button>
      <Link to="/design/details">Edit project group count</Link>
    </section>
    <section hidden={phase !== 'indicators'}>
      <h2>Consolidated indicator review</h2>
      <p>Required Primary indicators stay included. Review optional indicators and add project-specific indicators under the relevant Intermediate Outcome. Standard Final Outcome custom indicators are not supported. Group counts are not indicator targets.</p>
      <p>Review activities and outputs before confirming each step below. Final review and export keep their existing checks.</p>
    </section>
    {state.selectedFinalOutcomeIds.map(outcomeId => {
      const outcome = getFinalOutcome(data, outcomeId)
      const primary = getPrimaryIndicatorForFinalOutcome(data, outcomeId)
      const links = state.outcomePathwayLinks.filter(link => link.finalOutcomeId === outcomeId)
      return <section key={outcomeId} className="configuration-overview-card">
        <h2>{outcome?.statement ?? outcomeId}</h2>
        <div hidden={phase !== 'indicators'} className="mandatory-selection"><strong>Final Outcome Primary indicator · Required</strong><p>{primary?.text ?? 'Primary indicator missing — framework review required.'}</p></div>
        {links.map(link => {
          const pathway = state.projectPathways.find(item => item.pathwayId === link.pathwayId)
          if (!pathway) return <p key={link.pathwayId} role="alert">Pathway configuration missing.</p>
          if (owner.get(pathway.pathwayId) !== outcomeId) return <p key={pathway.pathwayId}>Shared pathway: <a href={`#guided-${pathway.pathwayId}`}>{getPathway(data, pathway.pathwayId)?.name ?? pathway.pathwayId}</a>. Edit its single configuration above; changes apply to all linked outcomes.</p>
          return <section id={`guided-${pathway.pathwayId}`} key={pathway.pathwayId}>
            <h3>{getPathway(data, pathway.pathwayId)?.name ?? pathway.pathwayId}</h3>
            <p>Contributes to: {state.outcomePathwayLinks.filter(item => item.pathwayId === pathway.pathwayId).map(item => getFinalOutcome(data, item.finalOutcomeId)?.shortLabel ?? item.finalOutcomeId).join(', ')}. Shared activities are configured once.</p>
            <ol className="configuration-chain">{getIntermediateOutcomesInCausalOrder(data, pathway.pathwayId).map(io => {
              const configuration = pathway.intermediateOutcomeConfigurations.find(item => item.frameworkIntermediateOutcomeId === io.id)
              return configuration ? <IntermediateOutcomeConfigurationCard key={io.id} data={data} pathwayId={pathway.pathwayId} outcome={io} configuration={configuration} mode={phase} /> : <li key={io.id} role="alert">Missing configuration for {io.statement}</li>
            })}</ol>
          </section>
        })}
      </section>
    })}
    {state.customInnovation && <section className="state-panel">
      <h2>{state.customInnovation.shortLabel || 'Custom innovation'}</h2>
      <p>No standard defaults are invented for custom innovation. Use its editor to change or add activities, outputs and indicators.</p>
      <div hidden={phase === 'activities'}><strong>Final Outcome Primary indicator · Required</strong><p>{state.customInnovation.primaryIndicator.wording || 'Not entered yet'}</p></div>
      {state.customInnovation.pathway.intermediateOutcomes.map(io => <section key={io.id}>
        <h3>{io.statement || 'Untitled custom Intermediate Outcome'}</h3>
        <div hidden={phase === 'activities'}><strong>Primary indicator · Required</strong><p>{io.primaryIndicator.wording || 'Not entered yet'}</p>
          <ul>{io.additionalIndicators.map(indicator => <li key={indicator.id}>{indicator.wording} — {indicator.measurementNotes}</li>)}</ul>
        </div>
        <div hidden={phase === 'indicators'}><ul>{io.activities.map(activity => <li key={activity.id}>{activity.wording} — {displayedOutputText(activity) ?? 'Output needs review'}</li>)}</ul>{!io.activities.length && <p>No activities yet.</p>}</div>
      </section>)}
      <Link to="/design/custom-innovation">Edit / add custom innovation activities and indicators</Link>
    </section>}
    <div className="page-actions">
      {phase === 'activities' ? <button className="button primary" onClick={() => setPhase('indicators')}>Continue to indicators</button> : <Link className="button primary" to="/design/configure">Check completion and continue to final review</Link>}
    </div>
  </div>
}
