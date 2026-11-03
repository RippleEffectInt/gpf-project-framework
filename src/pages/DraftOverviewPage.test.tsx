import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import frameworkJson from '../data/framework-v1.0-normalized.json'
import { FrameworkProvider, ProjectDesignProvider, useProjectDesign } from '../state/AppState'
import { initialProjectDesignState, projectDesignReducer } from '../state/projectDesign'
import { getPathwayIntermediateOutcomeSeeds } from '../services/frameworkService'
import { createBlankCustomInnovation } from '../state/customInnovation'
import { canContinueToReview } from '../state/journeySelectors'
import type { FrameworkData } from '../types/framework'
import type { ProjectDesignState } from '../types/project'
import { DraftOverviewPage } from './DraftOverviewPage'

vi.mock('../components/TheoryOfChangeGraph', () => ({
  TheoryOfChangeGraph: ({ draft }: { draft?: boolean }) => <div data-testid="draft-graph">{draft ? 'Draft graph' : 'Graph rendered'}</div>,
}))
const framework = frameworkJson as FrameworkData
const pathway = framework.pathways.find((item) => item.active)!
const outcomeId = pathway.primaryFinalOutcomeId

function AddChoice() {
  const { dispatch } = useProjectDesign()
  return <button onClick={() => dispatch({ type: 'selectFinalOutcome', finalOutcomeId: outcomeId })}>Add test outcome</button>
}
function show(state: ProjectDesignState = initialProjectDesignState) {
  return render(<MemoryRouter><FrameworkProvider initialData={framework}>
    <ProjectDesignProvider initialState={state}><AddChoice /><DraftOverviewPage /></ProjectDesignProvider>
  </FrameworkProvider></MemoryRouter>)
}
describe('draft project overview', () => {
  it('shows an honest empty state and updates as choices change', () => {
    show()
    expect(screen.getByRole('heading', { name: 'Draft project overview' })).toBeInTheDocument()
    expect(screen.getByText(/No outcomes selected yet/)).toBeInTheDocument()
    expect(screen.queryByTestId('draft-graph')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add test outcome' }))
    expect(screen.queryByText(/No outcomes selected yet/)).not.toBeInTheDocument()
    expect(screen.getByText('Primary pathway still needed.')).toBeInTheDocument()
    expect(screen.getByText(/Includes unsaved changes/)).toBeInTheDocument()
  })
  it('shows the graph before activity completion without unlocking final review', () => {
    const state = projectDesignReducer(initialProjectDesignState, {
      type: 'addPathway', finalOutcomeId: outcomeId, pathwayId: pathway.id,
      relationshipType: 'primary', frameworkPrimaryFinalOutcomeId: outcomeId,
      intermediateOutcomes: getPathwayIntermediateOutcomeSeeds(framework, pathway.id),
    })
    expect(canContinueToReview(state)).toBe(false)
    show(state)
    expect(screen.getByTestId('draft-graph')).toBeInTheDocument()
    expect(screen.getByTestId('draft-graph')).toHaveTextContent('Draft graph')
    expect(screen.getByText(/Not yet confirmed complete/)).toHaveTextContent(/0 of \d+ Intermediate Outcomes have activities/)
    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument()
  })
  it('retains a partial custom draft and explains why its graph is unavailable', () => {
    show({ ...initialProjectDesignState, customInnovation: createBlankCustomInnovation() })
    expect(screen.getByRole('heading', { name: 'Untitled custom innovation outcome' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit custom innovation' })).toBeInTheDocument()
    expect(screen.queryByTestId('draft-graph')).not.toBeInTheDocument()
    expect(screen.getByText(/Custom innovation: Custom outcome Primary indicator is required/)).toBeInTheDocument()
  })
})
