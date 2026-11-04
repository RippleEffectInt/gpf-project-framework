import { useState, type ReactNode } from 'react'
import { PlannedOutputEditor } from './PlannedOutputEditor'
import { useFramework, useProjectDesign } from '../state/AppState'
import { createActivityOutputPlanning, displayedOutputText, normalizeActivityOutput } from '../state/activityOutputs'
import { getAdditionalIndicatorsForIntermediateOutcome, getIndicator, getIntermediateOutcomesInCausalOrder, getPathway, getSuggestedActivitiesForIntermediateOutcome } from '../services/frameworkService'
import type { ProjectDesignAction } from '../state/projectDesign'
import type { ProjectSpecificActivity, ProjectSpecificIndicator } from '../types/project'
import type { SuggestedActivity } from '../types/framework'

function ActivityItem({ activity, standard, fixedWording = false, context, onChange, onRemove }: {
  activity: ProjectSpecificActivity; standard?: SuggestedActivity; fixedWording?: boolean; context: string
  onChange: (activity: ProjectSpecificActivity) => void; onRemove: () => void
}) {
  const [editing, setEditing] = useState(false)
  const { state } = useProjectDesign()
  return <li className="guided-list-item">
    <p className="guided-item-title">Activity: {activity.wording || 'Untitled activity'}</p>
    <p className="guided-output"><strong>Output:</strong> {displayedOutputText(activity, standard?.outputPhrase) ?? 'Not specified yet'}</p>
    <div className="guided-item-actions">
      <button type="button" className="text-button" hidden={editing} onClick={() => setEditing(true)}>Edit</button>
      <button type="button" className="text-button" onClick={onRemove}>Remove activity</button>
    </div>
    <div className="guided-inline-editor" hidden={!editing}>
      <p className="guided-context"><strong>Supports Outcome/s:</strong> {context}</p>
      {!fixedWording && <p className="field-guidance">Activity wording: describe what your team will do, using a clear action such as train, establish or facilitate.</p>}
      {fixedWording ? <p>Standard activity wording is fixed to keep the framework consistent. Use project notes to explain how you will deliver it, then check the planned output below.</p> : <label>Activity wording<input value={activity.wording} onChange={e => onChange({ ...activity, wording: e.target.value })} /></label>}
      <p className="field-guidance">Project notes are optional: describe who will take part, where and when the activity will happen, and any local adaptations.</p>
      <label>Project notes<textarea value={activity.projectDetails} onChange={e => onChange({ ...activity, projectDetails: e.target.value })} /></label>
      <PlannedOutputEditor guided planning={normalizeActivityOutput(activity)} activity={standard} plannedSelfHelpGroupCount={state.metadata.plannedSelfHelpGroupCount} onChange={output => onChange({ ...activity, ...output })} />
      <div className="guided-item-actions"><button type="button" className="button secondary" onClick={() => setEditing(false)}>Done editing</button></div>
    </div>
  </li>
}

function IndicatorItem({ indicator, required = false, context, onChange, onRemove }: {
  indicator: ProjectSpecificIndicator; required?: boolean; context: string
  onChange?: (indicator: ProjectSpecificIndicator) => void; onRemove?: () => void
}) {
  const [editing, setEditing] = useState(false)
  return <li className="guided-list-item">
    <p className="guided-item-title">{indicator.wording || 'Indicator not entered yet'}</p>
    {required && <span className="lock-label">Required Primary indicator</span>}
    <p className="guided-context"><strong>Measures:</strong> {context}</p>
    {indicator.measurementNotes && <p>{indicator.measurementNotes}</p>}
    <div className="guided-item-actions">
      {onChange && <button type="button" className="text-button" onClick={() => setEditing(!editing)}>{editing ? 'Done editing' : 'Edit'}</button>}
      {!required && onRemove && <button type="button" className="text-button" onClick={onRemove}>Remove indicator</button>}
    </div>
    {onChange && <div className="guided-inline-editor" hidden={!editing}>
      <p>{context}</p>
      <p>Describe the measurable change you will track. In measurement notes, explain how, when and from what source you will collect the information.</p>
      <label>Indicator wording<input value={indicator.wording} onChange={e => onChange({ ...indicator, wording: e.target.value })} /></label>
      <label>Measurement notes<textarea value={indicator.measurementNotes} onChange={e => onChange({ ...indicator, measurementNotes: e.target.value })} /></label>
    </div>}
  </li>
}

export function GuidedOutcomeList({ pathwayIds = [], custom = false, primary, finalOutcomeStatement, finalIndicators, finalPathways, phase }: {
  pathwayIds?: string[]; custom?: boolean; primary?: ProjectSpecificIndicator; finalOutcomeStatement: string; finalIndicators: ReactNode; finalPathways: string
  phase: 'activities' | 'indicators' | 'detailed'
}) {
  const { data } = useFramework()
  const { state, dispatch } = useProjectDesign()
  const [addingActivity, setAddingActivity] = useState(false)
  const [addingIndicator, setAddingIndicator] = useState(false)
  const [activityTarget, setActivityTarget] = useState('')
  const [indicatorTarget, setIndicatorTarget] = useState('')
  const [activityDraft, setActivityDraft] = useState<ProjectSpecificActivity>({ id: '', wording: '', projectDetails: '', ...createActivityOutputPlanning() })
  const [indicatorDraft, setIndicatorDraft] = useState<ProjectSpecificIndicator>({ id: '', wording: '', measurementNotes: '' })
  const [undo, setUndo] = useState<ProjectDesignAction[]>([])
  const [showAvailable, setShowAvailable] = useState(false)
  const [moreIndicators, setMoreIndicators] = useState(false)
  if (!data) return null
  const targets = custom ? (state.customInnovation?.pathway.intermediateOutcomes ?? []).map(io => ({
    key: io.id, pathwayId: '', pathwayLabel: state.customInnovation?.pathway.name || 'Custom pathway', ioId: io.id, statement: io.statement || 'Untitled Intermediate Outcome', label: io.statement || 'Untitled Intermediate Outcome',
    standardActivities: [], activities: io.activities, primary: io.primaryIndicator,
    optional: [], indicators: io.additionalIndicators,
  })) : pathwayIds.flatMap(pathwayId => getIntermediateOutcomesInCausalOrder(data, pathwayId).flatMap(io => {
    const configuration = state.projectPathways.find(p => p.pathwayId === pathwayId)?.intermediateOutcomeConfigurations.find(c => c.frameworkIntermediateOutcomeId === io.id)
    if (!configuration) return []
    return [{ key: `${pathwayId}/${io.id}`, pathwayId, pathwayLabel: `${getPathway(data, pathwayId)?.name ?? pathwayId}${state.outcomePathwayLinks.filter(l => l.pathwayId === pathwayId).length > 1 ? ' (shared pathway)' : ''}`, ioId: io.id, statement: io.statement,
      label: `${getPathway(data, pathwayId)?.name ?? pathwayId} · ${io.statement}`,
      standardActivities: configuration.standardActivities, activities: configuration.projectSpecificActivities,
      primary: { id: configuration.primaryIndicator?.frameworkIndicatorId ?? '', wording: getIndicator(data, configuration.primaryIndicator?.frameworkIndicatorId)?.text ?? 'Required Primary indicator missing', measurementNotes: '' },
      optional: configuration.additionalIndicators, indicators: configuration.projectSpecificIndicators,
    }]
  }))
  type Target = typeof targets[number]
  const activityAction = (target: Target, activity: ProjectSpecificActivity, add: boolean): ProjectDesignAction => custom
    ? { type: add ? 'addCustomIoActivity' : 'updateCustomIoActivity', intermediateOutcomeId: target.ioId, activity }
    : { type: add ? 'addProjectSpecificActivity' : 'updateProjectSpecificActivity', pathwayId: target.pathwayId, intermediateOutcomeId: target.ioId, activity }
  const indicatorAction = (target: Target, indicator: ProjectSpecificIndicator, add: boolean): ProjectDesignAction => custom
    ? { type: add ? 'addCustomIoAdditionalIndicator' : 'updateCustomIoAdditionalIndicator', intermediateOutcomeId: target.ioId, indicator }
    : { type: add ? 'addProjectSpecificIndicator' : 'updateProjectSpecificIndicator', pathwayId: target.pathwayId, intermediateOutcomeId: target.ioId, indicator }
  const remove = (action: ProjectDesignAction, restore: ProjectDesignAction[]) => { dispatch(action); setUndo(restore) }
  const restoreRemoval = () => {
    const first = undo[0]
    if (!first || !('intermediateOutcomeId' in first)) return
    const target = targets.find(t => t.ioId === first.intermediateOutcomeId && (!('pathwayId' in first) || t.pathwayId === first.pathwayId))
    // Another view may already have restored and edited the same record.
    // Never replace those newer values with the old undo snapshot.
    const present = !target || ('frameworkActivityId' in first
      ? target.standardActivities.some(a => a.frameworkActivityId === first.frameworkActivityId)
      : 'frameworkIndicatorId' in first
        ? target.optional.some(i => i.frameworkIndicatorId === first.frameworkIndicatorId)
        : 'activity' in first
          ? target.activities.some(a => a.id === first.activity.id)
          : 'indicator' in first && target.indicators.some(i => i.id === first.indicator.id))
    if (!present) undo.forEach(dispatch)
    setUndo([])
  }
  const activityCount = targets.reduce((sum, t) => sum + t.standardActivities.length + t.activities.length, 0)
  return <div className="guided-simple-list">
    {undo.length > 0 && <p role="status">Item removed. <button className="text-button" onClick={restoreRemoval}>Undo removal</button></p>}
    <div hidden={phase !== 'activities'}>
      {targets.length > 0 && !activityCount && <p>No activities selected yet.</p>}
      <div>{targets.map(target => <section className="guided-activity-outcome" key={target.key}>
        <h3>Intermediate Outcome: {target.statement}</h3><p><strong>Pathway:</strong> {target.pathwayLabel}</p>
        {!target.standardActivities.length && !target.activities.length && <p>No activities selected for this Intermediate Outcome yet.</p>}
        <ul className="guided-items">{[
        ...target.standardActivities.map(selection => {
          const standard = getSuggestedActivitiesForIntermediateOutcome(data, target.ioId).find(a => a.id === selection.frameworkActivityId)
          const address = { pathwayId: target.pathwayId, intermediateOutcomeId: target.ioId, frameworkActivityId: selection.frameworkActivityId }
          const activity = { ...selection, id: selection.frameworkActivityId, wording: standard?.text ?? selection.frameworkActivityId, projectDetails: selection.projectNotes }
          return <ActivityItem key={`${target.key}/${activity.id}`} activity={activity} standard={standard} fixedWording context={target.label}
            onChange={next => { dispatch({ type: 'updateStandardActivityNotes', ...address, projectNotes: next.projectDetails }); dispatch({ type: 'updateStandardActivityOutput', ...address, output: normalizeActivityOutput(next) }) }}
            onRemove={() => remove({ type: 'setStandardActivity', ...address, selected: false }, [{ type: 'setStandardActivity', ...address, selected: true, output: normalizeActivityOutput(selection) }, { type: 'updateStandardActivityNotes', ...address, projectNotes: selection.projectNotes }])} />
        }),
        ...target.activities.map(activity => <ActivityItem key={`${target.key}/${activity.id}`} activity={activity} context={target.label}
          onChange={next => dispatch(activityAction(target, next, false))}
          onRemove={() => remove(custom ? { type: 'deleteCustomIoActivity', intermediateOutcomeId: target.ioId, activityId: activity.id } : { type: 'deleteProjectSpecificActivity', pathwayId: target.pathwayId, intermediateOutcomeId: target.ioId, activityId: activity.id }, [activityAction(target, activity, true)])} />),
      ]}</ul></section>)}</div>
      <button className="button secondary" disabled={!targets.length} onClick={() => setAddingActivity(!addingActivity)}>{addingActivity ? 'Close activity form' : 'Add custom activity'}</button>
      <form className="guided-inline-editor" hidden={!addingActivity} onSubmit={e => {
        e.preventDefault(); const target = targets.find(t => t.key === activityTarget)
        if (!target || !activityDraft.wording.trim()) return
        dispatch(activityAction(target, { ...activityDraft, id: crypto.randomUUID(), wording: activityDraft.wording.trim() }, true))
        setActivityDraft({ id: '', wording: '', projectDetails: '', ...createActivityOutputPlanning() }); setAddingActivity(false)
      }}>
        <p>Choose the Intermediate Outcome this new item will support. It will be saved with that step in the pathway.</p>
        <label>Supports Intermediate Outcome<select required value={activityTarget} onChange={e => setActivityTarget(e.target.value)}><option value="">Choose an Intermediate Outcome</option>{targets.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}</select></label>
        <p>Describe the action your team will carry out. Use project notes for optional delivery details such as participants, location and timing.</p>
        <label>Activity wording *<input required value={activityDraft.wording} onChange={e => setActivityDraft({ ...activityDraft, wording: e.target.value })} /></label>
        <label>Project notes<textarea value={activityDraft.projectDetails} onChange={e => setActivityDraft({ ...activityDraft, projectDetails: e.target.value })} /></label>
        <PlannedOutputEditor guided planning={normalizeActivityOutput(activityDraft)} plannedSelfHelpGroupCount={state.metadata.plannedSelfHelpGroupCount} onChange={output => setActivityDraft({ ...activityDraft, ...output })} />
        <button className="button primary" type="submit">Add activity</button>
      </form>
      {!custom && <details className="guided-available"><summary>Add a suggested activity</summary>{targets.map(target => <div key={target.key}><p>{target.label}</p>{getSuggestedActivitiesForIntermediateOutcome(data, target.ioId).filter(a => !target.standardActivities.some(s => s.frameworkActivityId === a.id)).map(a => <button className="text-button" key={a.id} onClick={() => dispatch({ type: 'setStandardActivity', pathwayId: target.pathwayId, intermediateOutcomeId: target.ioId, frameworkActivityId: a.id, selected: true })}>Add: {a.text}</button>)}</div>)}</details>}
    </div>
    <div hidden={phase === 'activities'}>
      <div hidden={phase === 'detailed'} className="guided-required-table" role="region" aria-label={`Required Primary Indicators for ${finalOutcomeStatement}`} tabIndex={0}>
        <table>
          <caption>Required Primary Indicators</caption>
          <thead><tr><th scope="col">Outcome level</th><th scope="col">Outcome statement</th><th scope="col">Required Primary indicator</th></tr></thead>
          <tbody>
            {primary && <tr><td>Final Outcome</td><th scope="row">{finalOutcomeStatement}<p className="guided-pathway-context">Pathway(s): {finalPathways || 'None selected yet'}</p></th><td>{primary.wording || 'Primary indicator not entered yet'}{primary.measurementNotes && <p>Measurement notes: {primary.measurementNotes}</p>}</td></tr>}
            {targets.map(target => <tr key={target.key}><td>Intermediate Outcome</td><th scope="row">{target.statement}<p className="guided-pathway-context">Pathway: {target.pathwayLabel}</p></th><td>{target.primary.wording || 'Primary indicator not entered yet'}{target.primary.measurementNotes && <p>Measurement notes: {target.primary.measurementNotes}</p>}</td></tr>)}
          </tbody>
        </table>
      </div>
      {finalIndicators}
      <section hidden={phase === 'detailed'} aria-label="Intermediate Outcome Indicators">
      <div className="indicator-section-heading"><h3>Intermediate Outcome Indicators</h3><button className="button secondary" aria-expanded={moreIndicators} onClick={() => setMoreIndicators(!moreIndicators)}>Add more indicators</button></div>
      <div hidden={!moreIndicators} className="guided-item-actions">
        <button className="button secondary" aria-expanded={showAvailable} onClick={() => setShowAvailable(!showAvailable)}>Add from list of suggested indicators</button>
        <button className="button secondary" disabled={!targets.length} aria-expanded={addingIndicator} onClick={() => setAddingIndicator(!addingIndicator)}>Add custom indicator</button>
      </div>
      <ul className="guided-items">
        {targets.flatMap(target => [
          ...target.optional.map(selection => <IndicatorItem key={`${target.key}/${selection.frameworkIndicatorId}`} indicator={{ id: selection.frameworkIndicatorId, wording: getIndicator(data, selection.frameworkIndicatorId)?.text ?? selection.frameworkIndicatorId, measurementNotes: '' }} context={`Intermediate Outcome: ${target.statement} · Pathway: ${target.pathwayLabel}`}
            onRemove={() => remove({ type: 'setAdditionalIndicator', pathwayId: target.pathwayId, intermediateOutcomeId: target.ioId, frameworkIndicatorId: selection.frameworkIndicatorId, selected: false }, [{ type: 'setAdditionalIndicator', pathwayId: target.pathwayId, intermediateOutcomeId: target.ioId, frameworkIndicatorId: selection.frameworkIndicatorId, selected: true }])} />),
          ...target.indicators.map(indicator => <IndicatorItem key={`${target.key}/${indicator.id}`} indicator={indicator} context={`Intermediate Outcome: ${target.statement} · Pathway: ${target.pathwayLabel}`} onChange={next => dispatch(indicatorAction(target, next, false))}
            onRemove={() => remove(custom ? { type: 'deleteCustomIoAdditionalIndicator', intermediateOutcomeId: target.ioId, indicatorId: indicator.id } : { type: 'deleteProjectSpecificIndicator', pathwayId: target.pathwayId, intermediateOutcomeId: target.ioId, indicatorId: indicator.id }, [indicatorAction(target, indicator, true)])} />),
        ])}
      </ul>
      <form className="guided-inline-editor" hidden={!addingIndicator} onSubmit={e => {
        e.preventDefault(); const target = targets.find(t => t.key === indicatorTarget)
        if (!target || !indicatorDraft.wording.trim()) return
        dispatch(indicatorAction(target, { ...indicatorDraft, id: crypto.randomUUID(), wording: indicatorDraft.wording.trim() }, true))
        setIndicatorDraft({ id: '', wording: '', measurementNotes: '' }); setAddingIndicator(false)
      }}>
        <p>Choose the Intermediate Outcome this new item will support. It will be saved with that step in the pathway.</p>
        <label>Supports Intermediate Outcome<select required value={indicatorTarget} onChange={e => setIndicatorTarget(e.target.value)}><option value="">Choose an Intermediate Outcome</option>{targets.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}</select></label>
        <p>Describe the measurable change you will track. In measurement notes, explain how, when and from what source you will collect the information.</p>
      <label>Indicator wording *<input required value={indicatorDraft.wording} onChange={e => setIndicatorDraft({ ...indicatorDraft, wording: e.target.value })} /></label>
        <label>Measurement notes<textarea value={indicatorDraft.measurementNotes} onChange={e => setIndicatorDraft({ ...indicatorDraft, measurementNotes: e.target.value })} /></label>
        <button className="button primary" type="submit">Add indicator</button>
      </form>
      <div className="guided-indicator-options">
        <div hidden={!showAvailable}>
          <p>{custom ? 'Custom innovation has no framework suggestions. Add a custom indicator instead.' : 'Choose optional indicators for the relevant Intermediate Outcome below.'}</p>
          {targets.map(target => {
            const available = getAdditionalIndicatorsForIntermediateOutcome(data, target.ioId).filter(i => !target.optional.some(s => s.frameworkIndicatorId === i.id))
            return <section className="guided-indicator-group" key={target.key}>
              <h4>Intermediate Outcome: {target.statement}</h4><p><strong>Pathway:</strong> {target.pathwayLabel}</p>
              {available.length ? <ul>{available.map(i => <li key={i.id}>
                <p>{i.text}</p>
                <button className="button secondary" aria-label={`Add: ${i.text}`} onClick={() => dispatch({ type: 'setAdditionalIndicator', pathwayId: target.pathwayId, intermediateOutcomeId: target.ioId, frameworkIndicatorId: i.id, selected: true })}>Add indicator</button>
              </li>)}</ul> : <p>No further suggested indicators for this Intermediate Outcome.</p>}
            </section>
          })}
        </div>
      </div>
      </section>
    </div>
  </div>
}
