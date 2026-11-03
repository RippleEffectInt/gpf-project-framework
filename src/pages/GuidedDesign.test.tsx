import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { CURRENT_FRAMEWORK as data } from '../data/frameworkRegistry'
import { getIntermediateOutcomesInCausalOrder, getPrimaryIndicatorForIntermediateOutcome } from '../services/frameworkService'
import { initialProjectDesignState, projectDesignReducer, getPathwayConfigurationStatus } from '../state/projectDesign'
import { guidedPreparationActions } from '../state/guidedDesign'
import { FrameworkProvider, ProjectDesignProvider } from '../state/AppState'
import { GuidedDesignPage } from './GuidedDesignPage'
import { serializeProject, loadPersistedProject } from '../persistence/projectSerialization'

function seed(total: number | null = 12) {
  const pathway = data.pathways.find(p => p.id === 'PW_026')!
  return projectDesignReducer({ ...initialProjectDesignState, metadata: { ...initialProjectDesignState.metadata, plannedSelfHelpGroupCount: total } }, {
    type: 'addPathway', pathwayId: pathway.id, finalOutcomeId: pathway.primaryFinalOutcomeId,
    frameworkPrimaryFinalOutcomeId: pathway.primaryFinalOutcomeId, relationshipType: 'primary',
    intermediateOutcomes: getIntermediateOutcomesInCausalOrder(data, pathway.id).map(io => ({ frameworkIntermediateOutcomeId: io.id, primaryIndicatorId: getPrimaryIndicatorForIntermediateOutcome(data, io.id)?.id ?? null })),
  })
}

describe('guided configuration', () => {
  it('creates editable group defaults once, keeps primary indicators and requires review', () => {
    const initial = seed()
    const actions = guidedPreparationActions(data, initial)
    expect(actions.length).toBeGreaterThan(0)
    const prepared = actions.reduce(projectDesignReducer, initial)
    for (const io of prepared.projectPathways[0]!.intermediateOutcomeConfigurations) {
      expect(io.primaryIndicator).toEqual(initial.projectPathways[0]!.intermediateOutcomeConfigurations.find(x => x.frameworkIntermediateOutcomeId === io.frameworkIntermediateOutcomeId)!.primaryIndicator)
      expect(io.reviewed).toBe(false)
      for (const activity of io.standardActivities) expect(activity).toMatchObject({ plannedQuantity: 12, outputUnitSelection: 'self-help-groups', useProjectSelfHelpGroupTotal: true })
    }
    expect(getPathwayConfigurationStatus(prepared.projectPathways[0]!)).toBe('in-progress')
    expect(guidedPreparationActions(data, prepared)).toEqual([])
    const document = serializeProject({ id: 'guided-test', status: 'Draft', design: prepared, framework: data })
    expect(loadPersistedProject(document, data).design.projectPathways).toEqual(prepared.projectPathways)
  })
  it('leaves units and quantities blank without a group count and preserves existing work', () => {
    const initial = seed(null)
    const first = guidedPreparationActions(data, initial)[0]!
    const edited = projectDesignReducer(initial, first)
    const configuration = edited.projectPathways[0]!.intermediateOutcomeConfigurations.find(io => io.standardActivities.length)!
    expect(configuration.standardActivities[0]).toMatchObject({ plannedQuantity: null, outputUnitSelection: null })
    const result = guidedPreparationActions(data, edited).reduce(projectDesignReducer, edited)
    expect(result.projectPathways[0]!.intermediateOutcomeConfigurations.find(io => io.frameworkIntermediateOutcomeId === configuration.frameworkIntermediateOutcomeId)).toEqual(configuration)
  })
  it('does not overwrite custom activities or a reviewed empty step', () => {
    const initial = seed()
    const io = initial.projectPathways[0]!.intermediateOutcomeConfigurations[0]!
    io.reviewed = true
    expect(guidedPreparationActions(data, initial).some(action => 'intermediateOutcomeId' in action && action.intermediateOutcomeId === io.frameworkIntermediateOutcomeId)).toBe(false)
    io.reviewed = false
    io.projectSpecificActivities.push({ id: 'custom', wording: 'Custom work', projectDetails: '', plannedQuantity: 3, outputUnitSelection: 'events', customOutputUnit: null, useProjectSelfHelpGroupTotal: false, outputTextOverride: 'Three events' })
    expect(guidedPreparationActions(data, initial).some(action => 'intermediateOutcomeId' in action && action.intermediateOutcomeId === io.frameworkIntermediateOutcomeId)).toBe(false)
  })
  it('shows shared pathways once and keeps all linked outcomes visible', () => {
    const state = seed()
    const other = data.finalOutcomes.find(o => o.id !== state.selectedFinalOutcomeIds[0])!
    state.selectedFinalOutcomeIds.push(other.id)
    state.outcomePathwayLinks.push({ finalOutcomeId: other.id, pathwayId: 'PW_026', relationshipType: 'primary' })
    render(<MemoryRouter><FrameworkProvider initialData={data}><ProjectDesignProvider initialState={state}><GuidedDesignPage /></ProjectDesignProvider></FrameworkProvider></MemoryRouter>)
    expect(screen.getAllByLabelText('Activity wording *')).toHaveLength(state.projectPathways[0]!.intermediateOutcomeConfigurations.length)
    expect(screen.getByText(/Edit its single configuration above/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: other.statement })).toBeInTheDocument()
  })
  it('supports custom activity and indicator additions without bypassing completion', () => {
    render(<MemoryRouter><FrameworkProvider initialData={data}><ProjectDesignProvider initialState={seed()}><GuidedDesignPage /></ProjectDesignProvider></FrameworkProvider></MemoryRouter>)
    const activity = screen.getAllByLabelText('Activity wording *')[0]!
    fireEvent.change(activity, { target: { value: 'Local demonstration activity' } })
    fireEvent.submit(activity.closest('form')!)
    expect(screen.getByText('Local demonstration activity')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '2. Indicators & review' }))
    const completion = screen.getAllByRole('button', { name: 'Done with this step' })
    expect(completion[0]).toBeEnabled()
    expect(completion[1]).toBeDisabled()
    fireEvent.click(screen.getAllByText('Do you wish to add any project-specific indicators for this Intermediate Outcome?')[0]!)
    const indicator = screen.getAllByLabelText('Indicator wording *')[0]!
    fireEvent.change(indicator, { target: { value: 'Locally defined additional measure' } })
    fireEvent.submit(indicator.closest('form')!)
    expect(screen.getByText('Locally defined additional measure')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Detailed setup' }))
    expect(screen.getByText('Locally defined additional measure')).toBeInTheDocument()
    expect(screen.getByText('Local demonstration activity')).toBeInTheDocument()
  })
  it('keeps editors mounted between guided stages and detailed view; navigation never applies defaults', () => {
    render(<MemoryRouter><FrameworkProvider initialData={data}><ProjectDesignProvider initialState={seed()}><GuidedDesignPage /></ProjectDesignProvider></FrameworkProvider></MemoryRouter>)
    const prepare = screen.getByRole('button', { name: 'Prepare untouched steps' })
    expect(prepare).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: '2. Indicators & review' }))
    const input = screen.getAllByLabelText('Indicator wording *')[0]!
    fireEvent.change(input, { target: { value: 'Unsubmitted custom measure' } })
    fireEvent.click(screen.getByRole('button', { name: 'Detailed setup' }))
    expect(input).toHaveValue('Unsubmitted custom measure')
    fireEvent.click(screen.getByRole('button', { name: '1. Activities & outputs' }))
    expect(prepare).toBeEnabled()
    fireEvent.click(prepare)
    expect(prepare).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '2. Indicators & review' }))
    expect(screen.getAllByLabelText('Indicator wording *')[0]).toBe(input)
    expect(input).toHaveValue('Unsubmitted custom measure')
    expect(screen.getByText(/Added .* suggested activities/)).toBeInTheDocument()
  })
})
