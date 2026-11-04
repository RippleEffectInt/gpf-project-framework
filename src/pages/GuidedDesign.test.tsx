import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { CURRENT_FRAMEWORK as data } from '../data/frameworkRegistry'
import { getIntermediateOutcomesInCausalOrder, getPrimaryIndicatorForIntermediateOutcome } from '../services/frameworkService'
import { initialProjectDesignState, projectDesignReducer, getPathwayConfigurationStatus } from '../state/projectDesign'
import { guidedPreparationActions } from '../state/guidedDesign'
import { FrameworkProvider, ProjectDesignProvider, useProjectDesign } from '../state/AppState'
import { GuidedDesignPage } from './GuidedDesignPage'
import { createBlankCustomInnovation } from '../state/customInnovation'
import { serializeProject, loadPersistedProject } from '../persistence/projectSerialization'

function seed(total: number | null = 12) {
  const pathway = data.pathways.find(p => p.id === 'PW_026')!
  return projectDesignReducer({ ...initialProjectDesignState, metadata: { ...initialProjectDesignState.metadata, plannedSelfHelpGroupCount: total } }, {
    type: 'addPathway', pathwayId: pathway.id, finalOutcomeId: pathway.primaryFinalOutcomeId,
    frameworkPrimaryFinalOutcomeId: pathway.primaryFinalOutcomeId, relationshipType: 'primary',
    intermediateOutcomes: getIntermediateOutcomesInCausalOrder(data, pathway.id).map(io => ({ frameworkIntermediateOutcomeId: io.id, primaryIndicatorId: getPrimaryIndicatorForIntermediateOutcome(data, io.id)?.id ?? null })),
  })
}

function StateProbe() {
  const { state } = useProjectDesign()
  return <output data-testid="design-state" hidden>{JSON.stringify(state)}</output>
}
function mount(state = seed()) {
  return render(<MemoryRouter><FrameworkProvider initialData={data}><ProjectDesignProvider initialState={state}><GuidedDesignPage /><StateProbe /></ProjectDesignProvider></FrameworkProvider></MemoryRouter>)
}
function current() { return JSON.parse(screen.getByTestId('design-state').textContent!) as ReturnType<typeof seed> }
function selectTarget() {
  const select = screen.getByRole('combobox', { name: 'Supports Intermediate Outcome' }) as HTMLSelectElement
  fireEvent.change(select, { target: { value: select.options[1]!.value } })
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
  it('shows a plain selected-activity list; editing and removal preserve the associated output', () => {
    const initial = seed()
    const prepared = guidedPreparationActions(data, initial).reduce(projectDesignReducer, initial)
    const first = prepared.projectPathways[0]!.intermediateOutcomeConfigurations[0]!.standardActivities[0]!
    first.projectNotes = 'Original note'
    first.outputTextOverride = 'Original measurable output'
    mount(prepared)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByText('Original measurable output')).toBeVisible()
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]!)
    fireEvent.change(screen.getByRole('textbox', { name: 'Project notes' }), { target: { value: 'Updated note' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove activity' })[0]!)
    expect(current().projectPathways[0]!.intermediateOutcomeConfigurations[0]!.standardActivities.some(a => a.frameworkActivityId === first.frameworkActivityId)).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Undo removal' }))
    expect(current().projectPathways[0]!.intermediateOutcomeConfigurations[0]!.standardActivities.find(a => a.frameworkActivityId === first.frameworkActivityId)).toMatchObject({ ...first, projectNotes: 'Updated note' })
  })
  it('edits a shared pathway once and links the other outcome to its visible owner', () => {
    const initial = seed()
    const state = guidedPreparationActions(data, initial).reduce(projectDesignReducer, initial)
    const other = data.finalOutcomes.find(o => o.id !== state.selectedFinalOutcomeIds[0])!
    state.selectedFinalOutcomeIds.push(other.id)
    state.outcomePathwayLinks.push({ finalOutcomeId: other.id, pathwayId: 'PW_026', relationshipType: 'primary' })
    mount(state)
    const count = state.projectPathways[0]!.intermediateOutcomeConfigurations.reduce((sum, io) => sum + io.standardActivities.length, 0)
    expect(screen.getAllByRole('button', { name: 'Remove activity' })).toHaveLength(count)
    const link = screen.getByRole('link', { name: data.pathways.find(p => p.id === 'PW_026')!.name })
    expect(link).toHaveAttribute('href', `#guided-outcome-${state.selectedFinalOutcomeIds[0]}`)
  })
  it('preserves new-entry drafts across simple stages and detailed setup, and attaches additions explicitly', () => {
    mount()
    fireEvent.click(screen.getByRole('button', { name: 'Add custom activity' }))
    selectTarget()
    fireEvent.change(screen.getByRole('textbox', { name: 'Activity wording *' }), { target: { value: 'Local demonstration activity' } })
    fireEvent.click(screen.getByRole('button', { name: 'Detailed setup' }))
    fireEvent.click(screen.getByRole('button', { name: '2. Indicators & review' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add custom indicator' }))
    selectTarget()
    fireEvent.change(screen.getByRole('textbox', { name: 'Indicator wording *' }), { target: { value: 'Local measure' } })
    fireEvent.click(screen.getByRole('button', { name: '1. Activities & outputs' }))
    expect(screen.getByRole('textbox', { name: 'Activity wording *' })).toHaveValue('Local demonstration activity')
    fireEvent.click(screen.getByRole('button', { name: 'Add activity' }))
    expect(current().projectPathways[0]!.intermediateOutcomeConfigurations[0]!.projectSpecificActivities[0]?.wording).toBe('Local demonstration activity')
    fireEvent.click(screen.getByRole('button', { name: '2. Indicators & review' }))
    expect(screen.getByRole('textbox', { name: 'Indicator wording *' })).toHaveValue('Local measure')
    fireEvent.click(screen.getByRole('button', { name: 'Add indicator' }))
    expect(current().projectPathways[0]!.intermediateOutcomeConfigurations[0]!.projectSpecificIndicators[0]?.wording).toBe('Local measure')
    expect(screen.getByRole('button', { name: 'Confirm reviewed pathways' })).toBeDisabled()
    expect(screen.getAllByText('Required Primary indicator').length).toBeGreaterThan(0)
    const custom = screen.getByRole('button', { name: 'Remove indicator' }).closest('li')!
    fireEvent.click(within(custom).getByRole('button', { name: 'Edit' }))
    fireEvent.change(within(custom).getByRole('textbox', { name: 'Indicator wording' }), { target: { value: 'Revised local measure' } })
    fireEvent.click(within(custom).getByRole('button', { name: 'Remove indicator' }))
    expect(current().projectPathways[0]!.intermediateOutcomeConfigurations[0]!.projectSpecificIndicators).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Undo removal' }))
    expect(current().projectPathways[0]!.intermediateOutcomeConfigurations[0]!.projectSpecificIndicators[0]?.wording).toBe('Revised local measure')
  })
  it('does not populate or complete work on navigation and protects required indicators', () => {
    mount()
    fireEvent.click(screen.getByText(/Prepare suggested activities/))
    fireEvent.click(screen.getByRole('button', { name: 'Prepare untouched steps' }))
    expect(screen.getByRole('button', { name: 'Prepare untouched steps' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '2. Indicators & review' }))
    expect(screen.queryByRole('button', { name: 'Remove indicator' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(current().projectPathways[0]!.intermediateOutcomeConfigurations.every(io => !io.reviewed)).toBe(true)
    expect(screen.getByRole('button', { name: 'Confirm reviewed pathways' })).toBeEnabled()
  })
  it('supports custom innovation activity edits and undo while protecting its required indicators', () => {
    const state = seed()
    state.customInnovation = createBlankCustomInnovation()
    const custom = state.customInnovation
    custom.shortLabel = 'Synthetic custom outcome'
    custom.primaryIndicator.wording = 'Required custom outcome measure'
    const io = custom.pathway.intermediateOutcomes[0]!
    io.statement = 'Synthetic custom intermediate outcome'
    io.primaryIndicator.wording = 'Required custom IO measure'
    io.activities.push({ id: 'synthetic-custom-activity', wording: 'Custom community visit', projectDetails: 'Original detail', outputTextOverride: 'Twelve community visits', plannedQuantity: 12, outputUnitSelection: 'events' })
    mount(state)
    const section = screen.getByRole('heading', { name: 'Synthetic custom outcome' }).closest('section')!
    const scoped = within(section)
    expect(scoped.getByText('Twelve community visits', { selector: 'p' })).toBeVisible()
    fireEvent.click(scoped.getByRole('button', { name: 'Edit' }))
    fireEvent.change(scoped.getByRole('textbox', { name: 'Activity wording' }), { target: { value: 'Revised community visit' } })
    fireEvent.click(scoped.getByRole('button', { name: 'Remove activity' }))
    expect(current().customInnovation!.pathway.intermediateOutcomes[0]!.activities).toHaveLength(0)
    fireEvent.click(scoped.getByRole('button', { name: 'Undo removal' }))
    expect(current().customInnovation!.pathway.intermediateOutcomes[0]!.activities[0]).toMatchObject({ wording: 'Revised community visit', outputTextOverride: 'Twelve community visits', projectDetails: 'Original detail' })
    fireEvent.click(screen.getByRole('button', { name: '2. Indicators & review' }))
    expect(scoped.queryByRole('button', { name: 'Remove indicator' })).not.toBeInTheDocument()
    const required = scoped.getByText('Required custom IO measure', { selector: 'p' }).closest('li')!
    fireEvent.click(within(required).getByRole('button', { name: 'Edit' }))
    fireEvent.change(within(required).getByRole('textbox', { name: 'Indicator wording' }), { target: { value: 'Revised required measure' } })
    const edited = current()
    const saved = serializeProject({ id: 'simple-guided-roundtrip', status: 'Draft', design: edited, framework: data })
    expect(loadPersistedProject(saved, data).design.customInnovation).toEqual(edited.customInnovation)
  })

  it('keeps an open advanced activity editor synchronized with simple edits', () => {
    const state = seed()
    state.projectPathways[0]!.intermediateOutcomeConfigurations[0]!.projectSpecificActivities.push({ id: 'shared-edit', wording: 'Shared edit activity', projectDetails: 'Initial notes', outputTextOverride: 'Existing output' })
    mount(state)
    fireEvent.click(screen.getByRole('button', { name: 'Detailed setup' }))
    const details = document.querySelector('details.io-configuration-card') as HTMLDetailsElement
    details.open = true
    fireEvent(details, new Event('toggle'))
    const record = within(details).getByText('Shared edit activity', { selector: 'p' }).closest('li')!
    fireEvent.click(within(record).getByRole('button', { name: 'Edit' }))
    fireEvent.change(within(details).getByRole('textbox', { name: 'Activity wording *' }), { target: { value: 'Advanced wording' } })
    fireEvent.click(screen.getByRole('button', { name: '1. Activities & outputs' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Project notes' }), { target: { value: 'Simple notes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Detailed setup' }))
    expect(within(details).getByRole('textbox', { name: 'Activity wording *' })).toHaveValue('Advanced wording')
    expect(within(details).getByRole('textbox', { name: 'Project-specific details/notes — optional' })).toHaveValue('Simple notes')
    fireEvent.change(within(details).getByRole('textbox', { name: 'Activity wording *' }), { target: { value: 'Latest wording' } })
    expect(current().projectPathways[0]!.intermediateOutcomeConfigurations[0]!.projectSpecificActivities[0]).toMatchObject({ wording: 'Latest wording', projectDetails: 'Simple notes', outputTextOverride: 'Existing output' })
  })

})
