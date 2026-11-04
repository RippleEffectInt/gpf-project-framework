import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { DesignProgress } from '../components/DesignProgress'
import { useFramework, useProjectDesign } from '../state/AppState'
import { getFinalOutcome, getPathway, getPrimaryIndicatorForFinalOutcome, getIntermediateOutcomesInCausalOrder } from '../services/frameworkService'
import { CustomInnovationPage } from './CustomInnovationPage'
import { intermediateOutcomeHasRequiredActivity, projectDesignReducer } from '../state/projectDesign'
import { GuidedOutcomeList } from '../components/GuidedOutcomeList'
import { guidedAutomaticActions } from '../state/guidedDesign'
import { canContinueToConfigure } from '../state/journeySelectors'
import { IntermediateOutcomeConfigurationCard } from './PathwayConfigurationPage'

export function GuidedDesignPage() {
  const { data } = useFramework()
  const { state, dispatch, saveProject, saveStatus } = useProjectDesign()
  const [search] = useSearchParams()
  const [phase, setPhase] = useState<'activities' | 'indicators' | 'detailed'>(search.get('view') === 'advanced' ? 'detailed' : 'activities')
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (data && phase !== 'detailed' && canContinueToConfigure(state)) guidedAutomaticActions(data, state).forEach(dispatch)
  }, [data, state, phase, dispatch])
  if (!data) return <p role="status">Loading framework…</p>
  if (!canContinueToConfigure(state)) return <div className="page-container"><h1>Choose Primary pathways first</h1><Link to="/design/outcomes">Return to outcomes</Link></div>
  const total = state.metadata.plannedSelfHelpGroupCount
  const completionReady = state.projectPathways.length > 0 && state.projectPathways.every(p => p.intermediateOutcomeConfigurations.length > 0 && p.intermediateOutcomeConfigurations.every(io => io.primaryIndicator && intermediateOutcomeHasRequiredActivity(io)))
  const owner = new Map(state.projectPathways.map(pathway => [pathway.pathwayId,
    state.selectedFinalOutcomeIds.find(id => state.outcomePathwayLinks.some(link => link.pathwayId === pathway.pathwayId && link.finalOutcomeId === id))]))
  return <div className="page-container configuration-page guided-setup">
    <DesignProgress current="configure" />
    <h1>{phase === 'detailed' ? 'Advanced setup' : 'Guided setup'}</h1>
    <p>Review your activities and outputs, then your indicators. Edits use the same project as detailed setup. Add new custom entries before leaving this page to keep them in the saved draft.</p>
    <Link className="button secondary" to="/design/configure">Return to pathways</Link>
    <div className="page-actions setup-mode-switch" aria-label="Choose setup mode">
      <button className="button primary" aria-pressed={phase !== 'detailed'} onClick={() => setPhase('activities')}>Guided setup</button>
      <button className="button secondary" aria-pressed={phase === 'detailed'} onClick={() => setPhase('detailed')}>Advanced setup</button>
    </div>
    <div className="page-actions">
      <button className="button secondary" aria-pressed={phase === 'activities'} onClick={() => setPhase('activities')}>1. Activities &amp; outputs</button>
      <button className="button secondary" aria-pressed={phase === 'indicators'} onClick={() => setPhase('indicators')}>2. Indicators &amp; review</button>
      <button className="button secondary" disabled={saveStatus === 'saving'} onClick={async () => setMessage(await saveProject() ? 'Draft saved.' : 'Save failed. Your edits remain here; try again.')}>Save guided draft</button>
    </div>
    <p role="status">{message}</p>
    <p hidden={phase !== 'activities'} className="neutral-note">{state.guidedInitializedStepKeys ? 'Suggested activities are included automatically once for untouched steps in new designs.' : 'Existing draft selections are preserved; use Add a suggested activity to include more.'} {total && total > 0 ? `New output defaults use ${total} Self Help Groups; review quantities, units and wording.` : 'No group count is set, so quantities and units need your review.'}</p>
    <p hidden={phase !== 'indicators'} className="neutral-note">New designs start with required Primary indicators only. Add suggested or custom indicators below. Existing selections are preserved.</p>
    {state.selectedFinalOutcomeIds.map(outcomeId => {
      const outcome = getFinalOutcome(data, outcomeId)
      const primary = getPrimaryIndicatorForFinalOutcome(data, outcomeId)
      const links = state.outcomePathwayLinks.filter(link => link.finalOutcomeId === outcomeId)
      return <section id={`guided-outcome-${outcomeId}`} key={outcomeId} className="configuration-overview-card">
        <h2>{outcome?.statement ?? outcomeId}</h2>
        {links.filter(link => owner.get(link.pathwayId) === outcomeId && state.outcomePathwayLinks.filter(other => other.pathwayId === link.pathwayId).length > 1).map(link => <p className="guided-shared-note" key={link.pathwayId}>Shared activities also support {state.outcomePathwayLinks.filter(other => other.pathwayId === link.pathwayId && other.finalOutcomeId !== outcomeId).map(other => getFinalOutcome(data, other.finalOutcomeId)?.shortLabel ?? other.finalOutcomeId).join(', ')}. Edits and removals apply to every linked outcome.</p>)}
        <GuidedOutcomeList phase={phase} pathwayIds={links.filter(link => owner.get(link.pathwayId) === outcomeId).map(link => link.pathwayId)} primary={{ id: primary?.id ?? '', wording: primary?.text ?? 'Required Primary indicator missing', measurementNotes: '' }} />
        {links.map(link => {
          const pathway = state.projectPathways.find(item => item.pathwayId === link.pathwayId)
          if (!pathway) return <p key={link.pathwayId} role="alert">Pathway configuration missing.</p>
          if (owner.get(pathway.pathwayId) !== outcomeId) return <p key={pathway.pathwayId}>Shared pathway: <a href={`#guided-outcome-${owner.get(pathway.pathwayId)}`}>{getPathway(data, pathway.pathwayId)?.name ?? pathway.pathwayId}</a>. Edit its single configuration above; changes apply to all linked outcomes.</p>
          return <section id={`guided-${pathway.pathwayId}`} key={pathway.pathwayId} hidden={phase !== 'detailed'}>
            <h3>{getPathway(data, pathway.pathwayId)?.name ?? pathway.pathwayId}</h3>
            <p>Contributes to: {state.outcomePathwayLinks.filter(item => item.pathwayId === pathway.pathwayId).map(item => getFinalOutcome(data, item.finalOutcomeId)?.shortLabel ?? item.finalOutcomeId).join(', ')}. Shared activities are configured once.</p>
            <ol className="configuration-chain">{getIntermediateOutcomesInCausalOrder(data, pathway.pathwayId).map(io => {
              const configuration = pathway.intermediateOutcomeConfigurations.find(item => item.frameworkIntermediateOutcomeId === io.id)
              return configuration ? <IntermediateOutcomeConfigurationCard key={io.id} data={data} pathwayId={pathway.pathwayId} outcome={io} configuration={configuration} mode="detailed" /> : <li key={io.id} role="alert">Missing configuration for {io.statement}</li>
            })}</ol>
          </section>
        })}
      </section>
    })}
    {state.customInnovation && <section className="configuration-overview-card">
      <h2>{state.customInnovation.shortLabel || 'Custom innovation'}</h2>
      <GuidedOutcomeList phase={phase} custom primary={state.customInnovation.primaryIndicator} />
      <div hidden={phase !== 'detailed'}><CustomInnovationPage /></div>
    </section>}
    <div hidden={phase !== 'indicators'} className="guided-completion">
      <p>Confirm after reviewing your activities, outputs and indicators. Every Intermediate Outcome still needs an activity and its required indicator.</p>
      {!completionReady && <details><summary>Show steps still needing attention</summary><ul>{state.projectPathways.flatMap(p => getIntermediateOutcomesInCausalOrder(data, p.pathwayId).flatMap(io => {
        const config = p.intermediateOutcomeConfigurations.find(c => c.frameworkIntermediateOutcomeId === io.id)
        return config?.primaryIndicator && intermediateOutcomeHasRequiredActivity(config) ? [] : [<li key={`${p.pathwayId}/${io.id}`}>{io.statement}: {config?.primaryIndicator ? 'add an activity' : 'required indicator/configuration missing'}</li>]
      }))}</ul></details>}
      <button className="button secondary" disabled={!completionReady || saveStatus === 'saving'} onClick={async () => {
        const changes = state.projectPathways.map(p => ({ type: 'markPathwayConfigured' as const, pathwayId: p.pathwayId }))
        const next = changes.reduce(projectDesignReducer, state)
        changes.forEach(dispatch)
        setMessage(await saveProject(next) ? 'Reviewed pathways saved. Continue to final review when ready.' : 'Could not save. Your work remains here; try saving again.')
      }}>Confirm reviewed pathways</button>
    </div>
    <div className="page-actions">
      {phase === 'activities' ? <button className="button primary" onClick={() => setPhase('indicators')}>Continue to indicators</button> : <Link className="button primary" to="/design/configure">Check completion and continue to final review</Link>}
    </div>
  </div>
}
