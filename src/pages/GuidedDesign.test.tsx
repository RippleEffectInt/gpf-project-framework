import { generateTheoryOfChangeGraph } from '../theoryOfChange/generateTheoryOfChangeGraph'
import { inputCategories } from '../data/inputCategories'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { CURRENT_FRAMEWORK as data } from '../data/frameworkRegistry'
import { getIntermediateOutcomesInCausalOrder, getPrimaryIndicatorForIntermediateOutcome } from '../services/frameworkService'
import { initialProjectDesignState, projectDesignReducer, getPathwayConfigurationStatus } from '../state/projectDesign'
import { guidedAutomaticActions, guidedPreparationActions } from '../state/guidedDesign'
import { FrameworkProvider, ProjectDesignProvider, useProjectDesign } from '../state/AppState'
import { ConfigurePathwaysOverviewPage } from './JourneyPages'
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
function mount(state = seed(), automatic = false, route = '/design/guided') {
  return render(<MemoryRouter initialEntries={[route]}><FrameworkProvider initialData={data}><ProjectDesignProvider initialState={automatic ? state : { ...state, guidedInitializedStepKeys: undefined }}><GuidedDesignPage /><StateProbe /></ProjectDesignProvider></FrameworkProvider></MemoryRouter>)
}
function current() { return JSON.parse(screen.getByTestId('design-state').textContent!) as ReturnType<typeof seed> }
function selectTarget() {
  const select = screen.getByRole('combobox', { name: 'Supports Intermediate Outcome' }) as HTMLSelectElement
  fireEvent.change(select, { target: { value: select.options[1]!.value } })
}

describe('guided configuration', () => {
  it('adds, edits, removes and persists Final Outcome indicators without changing primary indicators', () => {
    const state = seed()
    mount(state, true)
    const primaryBefore = current().projectPathways.map(p => p.intermediateOutcomeConfigurations.map(io => io.primaryIndicator))
    fireEvent.click(screen.getByRole('button', { name: '2. Indicators & review' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add custom Final Outcome indicator' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Final Outcome indicator wording' }), { target: { value: 'Household change measure' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Final Outcome measurement notes' }), { target: { value: 'Annual survey' } })
    fireEvent.click(screen.getByRole('button', { name: 'Advanced setup' }))
    expect(screen.getByRole('textbox', { name: 'Final Outcome indicator wording' })).toHaveValue('Household change measure')
    fireEvent.click(screen.getByRole('button', { name: 'Save Final Outcome indicator' }))
    const id = state.selectedFinalOutcomeIds[0]!
    const saved = current()
    const doc = serializeProject({ id: 'final-indicators', status: 'Draft', design: saved, framework: data })
    expect(loadPersistedProject(doc, data).design.finalOutcomeIndicators).toEqual(saved.finalOutcomeIndicators)
    const legacy = structuredClone(doc); delete legacy.design.finalOutcomeIndicators
    expect(loadPersistedProject(legacy, data).design.finalOutcomeIndicators).toBeUndefined()
    const graph = generateTheoryOfChangeGraph({ project: saved, framework: data, inputCategories })
    expect(graph.nodes.some(n => n.type === 'finalOutcome' && n.data.additionalIndicators?.some(i => i.label === 'Household change measure' && i.measurementNotes === 'Annual survey'))).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Final Outcome indicator' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Final Outcome indicator wording' }), { target: { value: 'Revised measure' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Final Outcome indicator' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove Final Outcome indicator' }))
    expect(current().finalOutcomeIndicators?.[id]).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Undo indicator removal' }))
    expect(current().finalOutcomeIndicators?.[id]?.[0]?.wording).toBe('Revised measure')
    expect(current().projectPathways.map(p => p.intermediateOutcomeConfigurations.map(io => io.primaryIndicator))).toEqual(primaryBefore)
  })

  it('shows an editable guided quantity without the group checkbox and preserves saved values until edited', () => {
    const prepared = guidedPreparationActions(data, seed()).reduce(projectDesignReducer, seed())
    mount(prepared)
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]!)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Planned quantity' })).toHaveValue('12')
    expect(current().projectPathways).toEqual(prepared.projectPathways)
    expect(screen.getAllByText('Supports Outcome/s:')[0]!).toBeVisible()
    const quantity = screen.getByRole('textbox', { name: 'Planned quantity' })
    const done = screen.getByRole('button', { name: 'Done editing' })
    expect(quantity.compareDocumentPosition(done) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: 'Planned quantity' }), { target: { value: '7' } })
    const activity = current().projectPathways[0]!.intermediateOutcomeConfigurations[0]!.standardActivities[0]!
    expect(activity).toMatchObject({ plannedQuantity: 7, useProjectSelfHelpGroupTotal: false })
    fireEvent.click(screen.getByRole('button', { name: 'Advanced setup' }))
    expect(screen.getAllByRole('checkbox', { name: /Use all 12 Self Help Groups/ }).length).toBeGreaterThan(0)
  })

  it('labels outcome levels and keeps the exact canonical primary indicators', () => {
    const initial = seed()
    mount(initial, true)
    expect(screen.getByRole('heading', { name: 'Activities and Outputs for each Outcome' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /^Outcome 1:/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '2. Indicators & review' }))
    const count = initial.projectPathways[0]!.intermediateOutcomeConfigurations.length
    const table = screen.getByRole('table', { name: 'Required Primary Indicators' })
    expect(within(table).getAllByRole('row')).toHaveLength(count + 2)
    expect(within(table).getAllByRole('cell', { name: 'Intermediate Outcome' })).toHaveLength(count)
    expect(within(table).queryByRole('button')).not.toBeInTheDocument()
    expect(within(table).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(table).getByRole('rowheader', { name: data.finalOutcomes.find(o => o.id === initial.selectedFinalOutcomeIds[0])!.statement })).toBeVisible()
    expect(current().projectPathways[0]!.intermediateOutcomeConfigurations.every(io => io.additionalIndicators.length === 0)).toBe(true)
  })

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
    fireEvent.click(screen.getByRole('button', { name: 'Advanced setup' }))
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
  it('automatically populates new guided work without completing it and protects required indicators', () => {
    mount(seed(), true)
    expect(screen.queryByRole('button', { name: 'Prepare untouched steps' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Remove activity' }).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: '2. Indicators & review' }))
    expect(screen.queryByRole('button', { name: 'Remove indicator' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(current().projectPathways[0]!.intermediateOutcomeConfigurations.every(io => !io.reviewed)).toBe(true)
    expect(screen.getByRole('button', { name: 'Confirm reviewed pathways' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Add suggested indicators' }))
    const suggested = screen.getAllByRole('button', { name: /^Add: / })[0]!
    expect(suggested.closest('li')).toBeTruthy()
    expect(suggested.closest('section')?.querySelector('h3')?.textContent).toMatch(/^Intermediate Outcome: /)
    fireEvent.click(suggested)
    expect(screen.getAllByRole('button', { name: 'Remove indicator' })).toHaveLength(1)
    expect(current().projectPathways[0]!.intermediateOutcomeConfigurations.reduce((n, io) => n + io.additionalIndicators.length, 0)).toBe(1)

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
    const section = screen.getByRole('heading', { name: /Outcome \d+: Synthetic custom outcome/ }).closest('section')!
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
    const required = scoped.getByRole('table', { name: 'Required Primary Indicators' })
    expect(within(required).getByRole('cell', { name: 'Required custom IO measure' })).toBeVisible()
    expect(within(required).queryByRole('button')).not.toBeInTheDocument()
    expect(within(required).queryByRole('textbox')).not.toBeInTheDocument()
    const edited = current()
    const saved = serializeProject({ id: 'simple-guided-roundtrip', status: 'Draft', design: edited, framework: data })
    expect(loadPersistedProject(saved, data).design.customInnovation).toEqual(edited.customInnovation)
  })

  it('keeps an open advanced activity editor synchronized with simple edits', () => {
    const state = seed()
    state.projectPathways[0]!.intermediateOutcomeConfigurations[0]!.projectSpecificActivities.push({ id: 'shared-edit', wording: 'Shared edit activity', projectDetails: 'Initial notes', outputTextOverride: 'Existing output' })
    mount(state)
    fireEvent.click(screen.getByRole('button', { name: 'Advanced setup' }))
    const details = document.querySelector('details.io-configuration-card') as HTMLDetailsElement
    details.open = true
    fireEvent(details, new Event('toggle'))
    const record = within(details).getByText('Shared edit activity', { selector: 'p' }).closest('li')!
    fireEvent.click(within(record).getByRole('button', { name: 'Edit' }))
    fireEvent.change(within(details).getByRole('textbox', { name: 'Activity wording *' }), { target: { value: 'Advanced wording' } })
    fireEvent.click(screen.getByRole('button', { name: '1. Activities & outputs' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Project notes' }), { target: { value: 'Simple notes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Advanced setup' }))
    expect(within(details).getByRole('textbox', { name: 'Activity wording *' })).toHaveValue('Advanced wording')
    expect(within(details).getByRole('textbox', { name: 'Project-specific details/notes — optional' })).toHaveValue('Simple notes')
    fireEvent.change(within(details).getByRole('textbox', { name: 'Activity wording *' }), { target: { value: 'Latest wording' } })
    expect(current().projectPathways[0]!.intermediateOutcomeConfigurations[0]!.projectSpecificActivities[0]).toMatchObject({ wording: 'Latest wording', projectDetails: 'Simple notes', outputTextOverride: 'Existing output' })
  })

  it('defaults new saved designs once and preserves deliberate empty steps after save/reopen', () => {
    const fresh = seed()
    const savedBeforeGuided = serializeProject({ id: 'new-before-guided', status: 'Draft', design: fresh, framework: data })
    const reopened = loadPersistedProject(savedBeforeGuided, data).design
    const prepared = guidedAutomaticActions(data, reopened).reduce(projectDesignReducer, reopened)
    expect(prepared.projectPathways[0]!.intermediateOutcomeConfigurations.every(io => io.standardActivities.length > 0)).toBe(true)
    const first = prepared.projectPathways[0]!.intermediateOutcomeConfigurations[0]!
    const removed = first.standardActivities.reduce((state, activity) => projectDesignReducer(state, { type: 'setStandardActivity', pathwayId: 'PW_026', intermediateOutcomeId: first.frameworkIntermediateOutcomeId, frameworkActivityId: activity.frameworkActivityId, selected: false }), prepared)
    const saved = serializeProject({ id: 'removed-guided', status: 'Draft', design: removed, framework: data })
    const loaded = loadPersistedProject(saved, data).design
    expect(guidedAutomaticActions(data, loaded)).toEqual([])
    expect(loaded.projectPathways[0]!.intermediateOutcomeConfigurations[0]!.standardActivities).toEqual([])
    const legacy = structuredClone(saved)
    delete legacy.design.guidedInitializedStepKeys
    expect(guidedAutomaticActions(data, loadPersistedProject(legacy, data).design)).toEqual([])
    expect(() => loadPersistedProject({ ...saved, design: { ...saved.design, guidedInitializedStepKeys: [123] } }, data)).toThrow()
  })
  it('preserves advanced removals and existing optional/custom indicator work before first guided entry', () => {
    const fresh = seed()
    const first = guidedPreparationActions(data, fresh)[0]!
    let edited = projectDesignReducer(fresh, first)
    if (first.type !== 'setStandardActivity') throw new Error('Expected activity action')
    edited = projectDesignReducer(edited, { ...first, selected: false })
    const io = edited.projectPathways[0]!.intermediateOutcomeConfigurations[0]!
    io.projectSpecificIndicators.push({ id: 'existing-custom', wording: 'Keep this custom indicator', measurementNotes: 'Keep notes' })
    const prepared = guidedAutomaticActions(data, edited).reduce(projectDesignReducer, edited)
    expect(prepared.projectPathways[0]!.intermediateOutcomeConfigurations[0]).toEqual(io)
    expect(prepared.projectPathways[0]!.intermediateOutcomeConfigurations.slice(1).some(c => c.standardActivities.length > 0)).toBe(true)
  })
  it('does not default on advanced entry, defaults on guided entry and preserves removals on switching/reopening', () => {
    const mounted = mount(seed(), true, '/design/guided?view=advanced')
    expect(current().projectPathways[0]!.intermediateOutcomeConfigurations.every(io => io.standardActivities.length === 0)).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '1. Activities & outputs' }))
    const count = screen.getAllByRole('button', { name: 'Remove activity' }).length
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove activity' })[0]!)
    fireEvent.click(screen.getByRole('button', { name: 'Advanced setup' }))
    fireEvent.click(screen.getByRole('button', { name: '1. Activities & outputs' }))
    expect(screen.getAllByRole('button', { name: 'Remove activity' })).toHaveLength(count - 1)
    const saved = serializeProject({ id: 'switch-reopen', status: 'Draft', design: current(), framework: data })
    mounted.unmount()
    mount(loadPersistedProject(saved, data).design, true)
    expect(screen.getAllByRole('button', { name: 'Remove activity' })).toHaveLength(count - 1)
    fireEvent.click(screen.getByRole('button', { name: '2. Indicators & review' }))
    expect(screen.getByRole('button', { name: 'Add suggested indicators' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add custom indicator' })).toBeInTheDocument()
  })

  it('presents distinct guided and advanced choices and defaults shared pathways only once', () => {
    const state = seed()
    render(<MemoryRouter><FrameworkProvider initialData={data}><ProjectDesignProvider initialState={state}><ConfigurePathwaysOverviewPage /></ProjectDesignProvider></FrameworkProvider></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Choose guided setup' })).toHaveAttribute('href', '/design/guided')
    expect(screen.getByRole('link', { name: 'Choose advanced setup' })).toHaveAttribute('href', '/design/guided?view=advanced')
    const other = data.finalOutcomes.find(o => o.id !== state.selectedFinalOutcomeIds[0])!
    state.selectedFinalOutcomeIds.push(other.id)
    state.outcomePathwayLinks.push({ finalOutcomeId: other.id, pathwayId: 'PW_026', relationshipType: 'primary' })
    const actions = guidedAutomaticActions(data, state)
    const once = actions.reduce(projectDesignReducer, state)
    const twice = actions.reduce(projectDesignReducer, once)
    expect(twice).toEqual(once)
    expect(guidedAutomaticActions(data, once)).toEqual([])
    expect(new Set(once.guidedInitializedStepKeys).size).toBe(once.projectPathways[0]!.intermediateOutcomeConfigurations.length)
  })

})
