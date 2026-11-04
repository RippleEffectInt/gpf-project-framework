import { getAdditionalIndicatorsForFinalOutcome, getPathway } from '../services/frameworkService'
import { useState } from 'react'
import { useFramework, useProjectDesign } from '../state/AppState'
import type { ProjectSpecificIndicator } from '../types/project'

export function FinalOutcomeIndicators({ outcomeId, editable = false }: { outcomeId: string; editable?: boolean }) {
  const { state, dispatch } = useProjectDesign()
  const { data } = useFramework()
  const statement = state.customInnovation?.id === outcomeId ? state.customInnovation.statement : data?.finalOutcomes.find(o => o.id === outcomeId)?.statement
  const [more, setMore] = useState(false)
  const [suggestions, setSuggestions] = useState(false)
  const [removedSuggested, setRemovedSuggested] = useState<string | null>(null)
  const selected = state.finalOutcomeSuggestedIndicatorIds?.[outcomeId] ?? []
  const available = data ? getAdditionalIndicatorsForFinalOutcome(data, outcomeId).filter(i => !selected.includes(i.id)) : []
  const pathways = state.customInnovation?.id === outcomeId ? state.customInnovation.pathway.name : state.outcomePathwayLinks.filter(l => l.finalOutcomeId === outcomeId).map(l => `${data ? getPathway(data, l.pathwayId)?.name ?? l.pathwayId : l.pathwayId} (${l.relationshipType}${state.outcomePathwayLinks.filter(other => other.pathwayId === l.pathwayId).length > 1 ? ', shared' : ''})`).join('; ')
  const [draft, setDraft] = useState<ProjectSpecificIndicator | null>(null)
  const [removed, setRemoved] = useState<ProjectSpecificIndicator | null>(null)
  const indicators = state.finalOutcomeIndicators?.[outcomeId] ?? []
  if (!editable && !indicators.length && !selected.length) return null
  return <section className="final-outcome-indicators" aria-label="Final Outcome Indicators">
    <div className="indicator-section-heading"><h3>Final Outcome Indicators</h3>{editable && <button className="button secondary" type="button" aria-expanded={more} onClick={() => setMore(!more)}>Add more indicators</button>}</div>
    {editable && <div hidden={!more} className="guided-item-actions">
      <button className="button secondary" type="button" aria-expanded={suggestions} onClick={() => setSuggestions(!suggestions)}>Add from list of suggested indicators</button>
      <button className="button secondary" type="button" onClick={() => { if (!draft) setDraft({ id: crypto.randomUUID(), wording: '', measurementNotes: '' }) }}>Add custom indicator</button>
    </div>}
    {(indicators.length > 0 || selected.length > 0 || suggestions || draft) && <><p><strong>Final Outcome:</strong> {statement || 'Outcome statement not entered yet'}</p><p><strong>Pathway(s) supporting this Final Outcome:</strong> {pathways || 'None selected yet'}. These indicators measure the Final Outcome as a whole.</p></>}
    {editable && suggestions && <div className="guided-indicator-group">{available.length ? <ul>{available.map(i => <li key={i.id}><p>{i.text}</p><button type="button" className="button secondary" aria-label={`Add: ${i.text}`} onClick={() => dispatch({ type: 'setFinalOutcomeSuggestedIndicator', finalOutcomeId: outcomeId, indicatorId: i.id, selected: true })}>Add indicator</button></li>)}</ul> : <p>No further suggested indicators for this Final Outcome. You can add a custom indicator.</p>}</div>}
    <ul className="guided-items">{selected.map(id => <li className="guided-list-item" key={id}><p>{data?.indicators.find(i => i.id === id)?.text ?? `Unavailable framework indicator (${id})`}</p><p>Suggested · Final Outcome</p>{editable && <button type="button" className="text-button" onClick={() => { setRemovedSuggested(id); dispatch({ type: 'setFinalOutcomeSuggestedIndicator', finalOutcomeId: outcomeId, indicatorId: id, selected: false }) }}>Remove suggested Final Outcome indicator</button>}</li>)}</ul>
    {editable && removedSuggested && <p role="status">Indicator removed. <button type="button" className="text-button" onClick={() => { dispatch({ type: 'setFinalOutcomeSuggestedIndicator', finalOutcomeId: outcomeId, indicatorId: removedSuggested, selected: true }); setRemovedSuggested(null) }}>Undo suggested indicator removal</button></p>}
    <ul className="guided-items">{indicators.map(indicator => <li className="guided-list-item" key={indicator.id}>
      <p>{indicator.wording}</p>
      {indicator.measurementNotes && <p>Measurement notes: {indicator.measurementNotes}</p>}
      {editable && <div className="guided-item-actions">
        <button type="button" className="text-button" onClick={() => setDraft({ ...indicator })}>Edit Final Outcome indicator</button>
        <button type="button" className="text-button" onClick={() => { setRemoved(indicator); dispatch({ type: 'deleteFinalOutcomeIndicator', finalOutcomeId: outcomeId, indicatorId: indicator.id }); if (draft?.id === indicator.id) setDraft(null) }}>Remove Final Outcome indicator</button>
      </div>}
    </li>)}</ul>
    {editable && <>
      {removed && <p role="status">Indicator removed. <button type="button" className="text-button" onClick={() => { if (!indicators.some(i => i.id === removed.id)) dispatch({ type: 'saveFinalOutcomeIndicator', finalOutcomeId: outcomeId, indicator: removed }); setRemoved(null) }}>Undo indicator removal</button></p>}
      {draft && <form className="guided-inline-editor" onSubmit={e => { e.preventDefault(); if (!draft.wording.trim()) return; dispatch({ type: 'saveFinalOutcomeIndicator', finalOutcomeId: outcomeId, indicator: { ...draft, wording: draft.wording.trim() } }); setDraft(null) }}>
        <p>Describe the measurable change for this Final Outcome. Add how and when you will measure it in the optional notes. Save this indicator before leaving the page; then save the project draft.</p>
        <label>Final Outcome indicator wording<input required value={draft.wording} onChange={e => setDraft({ ...draft, wording: e.target.value })} /></label>
        <label>Final Outcome measurement notes<textarea value={draft.measurementNotes} onChange={e => setDraft({ ...draft, measurementNotes: e.target.value })} /></label>
        <div className="guided-item-actions"><button type="submit" className="button primary">Save Final Outcome indicator</button><button type="button" className="button secondary" onClick={() => setDraft(null)}>Cancel indicator edit</button></div>
      </form>}
    </>}
  </section>
}
