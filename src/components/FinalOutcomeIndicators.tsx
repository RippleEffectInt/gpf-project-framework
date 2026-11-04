import { useState } from 'react'
import { useProjectDesign } from '../state/AppState'
import type { ProjectSpecificIndicator } from '../types/project'

export function FinalOutcomeIndicators({ outcomeId, editable = false }: { outcomeId: string; editable?: boolean }) {
  const { state, dispatch } = useProjectDesign()
  const [draft, setDraft] = useState<ProjectSpecificIndicator | null>(null)
  const [removed, setRemoved] = useState<ProjectSpecificIndicator | null>(null)
  const indicators = state.finalOutcomeIndicators?.[outcomeId] ?? []
  if (!editable && !indicators.length) return null
  return <section className="final-outcome-indicators">
    <h3>Custom Final Outcome indicators</h3>
    {editable && <p>Optional measures for this Final Outcome as a whole. These do not replace its required Primary indicator or the indicators for Intermediate Outcomes.</p>}
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
      {!draft && <button type="button" className="button secondary" onClick={() => setDraft({ id: crypto.randomUUID(), wording: '', measurementNotes: '' })}>Add custom Final Outcome indicator</button>}
      {draft && <form className="guided-inline-editor" onSubmit={e => { e.preventDefault(); if (!draft.wording.trim()) return; dispatch({ type: 'saveFinalOutcomeIndicator', finalOutcomeId: outcomeId, indicator: { ...draft, wording: draft.wording.trim() } }); setDraft(null) }}>
        <p>Describe the measurable change for this Final Outcome. Add how and when you will measure it in the optional notes. Save this indicator before leaving the page; then save the project draft.</p>
        <label>Final Outcome indicator wording<input required value={draft.wording} onChange={e => setDraft({ ...draft, wording: e.target.value })} /></label>
        <label>Final Outcome measurement notes<textarea value={draft.measurementNotes} onChange={e => setDraft({ ...draft, measurementNotes: e.target.value })} /></label>
        <div className="guided-item-actions"><button type="submit" className="button primary">Save Final Outcome indicator</button><button type="button" className="button secondary" onClick={() => setDraft(null)}>Cancel indicator edit</button></div>
      </form>}
    </>}
  </section>
}
