import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import frameworkJson from '../data/framework-v1.0-normalized.json'
import {
  getPathwayIntermediateOutcomeSeeds,
  getPrimaryFinalOutcomeForPathway,
  getPrimaryIndicatorForFinalOutcome,
  getPrimaryIndicatorForIntermediateOutcome,
  getPrimaryPathwaysForFinalOutcome,
  getRelatedPathwaysForFinalOutcome,
} from '../services/frameworkService'
import { FrameworkProvider, ProjectDesignProvider } from '../state/AppState'
import {
  initialProjectDesignState,
  projectDesignReducer,
} from '../state/projectDesign'
import type { FrameworkData, PathwaySummary } from '../types/framework'
import type { ProjectDesignState } from '../types/project'
import { ReviewProjectPage } from './ReviewProjectPage'
import { TheoryOfChangePage } from './TheoryOfChangePage'

const framework = frameworkJson as unknown as FrameworkData
const outcome = framework.finalOutcomes.find(
  (candidate) =>
    getPrimaryPathwaysForFinalOutcome(framework, candidate.id).length > 0 &&
    getRelatedPathwaysForFinalOutcome(framework, candidate.id).some(
      (summary) =>
        getPrimaryFinalOutcomeForPathway(framework, summary.pathway.id)?.id !==
        candidate.id,
    ),
)
if (!outcome) throw new Error('Expected Theory of Change outcome test data.')
const primaryPathway = getPrimaryPathwaysForFinalOutcome(
  framework,
  outcome.id,
)[0]
const relatedPathway = getRelatedPathwaysForFinalOutcome(
  framework,
  outcome.id,
).find(
  (summary) =>
    getPrimaryFinalOutcomeForPathway(framework, summary.pathway.id)?.id !==
    outcome.id,
)
if (!primaryPathway || !relatedPathway) {
  throw new Error('Expected Theory of Change pathway test data.')
}
const relatedPrimaryOutcome = getPrimaryFinalOutcomeForPathway(
  framework,
  relatedPathway.pathway.id,
)
if (!relatedPrimaryOutcome) {
  throw new Error('Expected Related pathway Primary Final Outcome.')
}
const selectedOutcome = outcome
const selectedPrimaryPathway = primaryPathway
const selectedRelatedPathway = relatedPathway

function addPathway(
  state: ProjectDesignState,
  finalOutcomeId: string,
  summary: PathwaySummary,
): ProjectDesignState {
  const primaryOutcome = getPrimaryFinalOutcomeForPathway(
    framework,
    summary.pathway.id,
  )
  return projectDesignReducer(state, {
    type: 'addPathway',
    finalOutcomeId,
    pathwayId: summary.pathway.id,
    relationshipType: summary.relationshipType,
    frameworkPrimaryFinalOutcomeId: primaryOutcome?.id ?? finalOutcomeId,
    intermediateOutcomes: getPathwayIntermediateOutcomeSeeds(
      framework,
      summary.pathway.id,
    ),
  })
}

function simpleState(): ProjectDesignState {
  return addPathway(
    initialProjectDesignState,
    selectedOutcome.id,
    selectedPrimaryPathway,
  )
}

function sharedState(): ProjectDesignState {
  return addPathway(simpleState(), selectedOutcome.id, selectedRelatedPathway)
}

function complete(state: ProjectDesignState): ProjectDesignState {
  let next = state
  state.projectPathways.forEach((pathway) => {
    pathway.intermediateOutcomeConfigurations.forEach(
      (configuration, index) => {
        next = projectDesignReducer(next, {
          type: 'addProjectSpecificActivity',
          pathwayId: pathway.pathwayId,
          intermediateOutcomeId: configuration.frameworkIntermediateOutcomeId,
          activity: {
            id: `toc-activity-${pathway.pathwayId}-${index}`,
            wording: 'Complete the planned activity',
            projectDetails: '',
          },
        })
      },
    )
    next = projectDesignReducer(next, {
      type: 'markPathwayConfigured',
      pathwayId: pathway.pathwayId,
    })
  })
  return next
}

function renderRoutes(initialEntry: string, initialState = simpleState()) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <FrameworkProvider initialData={framework}>
        <ProjectDesignProvider initialState={initialState}>
          <Routes>
            <Route
              path="/design/theory-of-change"
              element={<TheoryOfChangePage />}
            />
            <Route path="/design/review" element={<ReviewProjectPage />} />
            <Route
              path="/design/outcomes"
              element={<h1>Project design choices</h1>}
            />
          </Routes>
        </ProjectDesignProvider>
      </FrameworkProvider>
    </MemoryRouter>,
  )
}

afterEach(() => vi.restoreAllMocks())

describe('Theory of Change page', () => {
  it('shows View Theory of Change on Review when the project is eligible', () => {
    renderRoutes('/design/review', complete(simpleState()))
    expect(
      screen.getByRole('link', { name: 'View Theory of Change' }),
    ).toHaveAttribute('href', '/design/theory-of-change')
  })

  it('renders the generated graph summary', () => {
    renderRoutes('/design/theory-of-change')
    const summary = screen.getByLabelText('Theory of Change summary')
    expect(summary).toHaveTextContent(/1Final Outcome/)
    expect(summary).toHaveTextContent(/1Pathway/)
    expect(summary).toHaveTextContent(
      `${primaryPathway.intermediateOutcomes.length}Intermediate Outcomes`,
    )
  })

  it('shows persistent semantic column headings with details collapsed initially', () => {
    renderRoutes('/design/theory-of-change')
    const headings = screen.getByRole('group', {
      name: 'Theory of Change columns',
    })
    expect(within(headings).getByText('Pathway')).toBeInTheDocument()
    expect(
      within(headings).getByText('Intermediate Outcomes'),
    ).toBeInTheDocument()
    expect(within(headings).getByText('Final Outcomes')).toBeInTheDocument()
    expect(within(headings).getByText('Impacts')).toBeInTheDocument()
    expect(
      screen.queryByRole('complementary', {
        name: 'Theory of Change node details',
      }),
    ).not.toBeInTheDocument()
  })

  it('returns the graph to full width when node details are closed', () => {
    renderRoutes('/design/theory-of-change')
    fireEvent.click(
      screen.getByRole('button', {
        name: `View details for Final Outcome: ${
          outcome.shortLabel ?? outcome.statement
        }`,
      }),
    )
    expect(document.querySelector('.toc-workspace')).toHaveClass('has-detail')
    fireEvent.click(screen.getByRole('button', { name: 'Close node details' }))
    expect(document.querySelector('.toc-workspace')).not.toHaveClass(
      'has-detail',
    )
    expect(
      screen.queryByRole('complementary', {
        name: 'Theory of Change node details',
      }),
    ).not.toBeInTheDocument()
  })

  it('distinguishes Primary and Related relationships by legend line style', () => {
    renderRoutes('/design/theory-of-change', sharedState())
    const legend = screen
      .getByRole('heading', { name: 'Legend' })
      .closest('section')
    if (!legend) throw new Error('Expected Theory of Change legend.')
    expect(
      within(legend).getByText('Solid line · Primary pathway relationship'),
    ).toBeInTheDocument()
    expect(
      within(legend).getByText('Dashed line · Related pathway relationship'),
    ).toBeInTheDocument()
    expect(legend.querySelector('.toc-legend-line.primary')).not.toBeNull()
    expect(legend.querySelector('.toc-legend-line.related')).not.toBeNull()
  })

  it('opens Final Outcome detail from a keyboard-accessible node button', () => {
    renderRoutes('/design/theory-of-change')
    fireEvent.click(
      screen.getByRole('button', {
        name: `View details for Final Outcome: ${
          outcome.shortLabel ?? outcome.statement
        }`,
      }),
    )
    const panel = screen.getByRole('complementary', {
      name: 'Theory of Change node details',
    })
    expect(
      within(panel).getByRole('heading', {
        level: 2,
        name: outcome.shortLabel ?? outcome.statement,
      }),
    ).toHaveFocus()
  })

  it('opens pathway detail from its node', () => {
    renderRoutes('/design/theory-of-change')
    fireEvent.click(
      screen.getByRole('button', {
        name: `View details for Pathway: ${primaryPathway.pathway.name}`,
      }),
    )
    const panel = screen.getByRole('complementary', {
      name: 'Theory of Change node details',
    })
    expect(
      within(panel).getByRole('heading', {
        level: 2,
        name: primaryPathway.pathway.name,
      }),
    ).toBeInTheDocument()
  })

  it('opens Intermediate Outcome detail from its node', () => {
    const firstStep = [...primaryPathway.intermediateOutcomes].sort(
      (left, right) => left.stepNumber - right.stepNumber,
    )[0]
    if (!firstStep) throw new Error('Expected Intermediate Outcome test data.')
    renderRoutes('/design/theory-of-change')
    fireEvent.click(
      screen.getByRole('button', {
        name: `View details for Intermediate Outcome: Step ${firstStep.stepNumber}`,
      }),
    )
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: firstStep.statement,
      }),
    ).toBeInTheDocument()
  })

  it('shows the correct Primary indicator in node detail', () => {
    const indicator = getPrimaryIndicatorForFinalOutcome(framework, outcome.id)
    if (!indicator) throw new Error('Expected Final Outcome indicator.')
    renderRoutes('/design/theory-of-change')
    fireEvent.click(
      screen.getByRole('button', {
        name: `View details for Final Outcome: ${
          outcome.shortLabel ?? outcome.statement
        }`,
      }),
    )
    expect(screen.getByText(indicator.text)).toBeInTheDocument()
  })

  it('lists Primary and Related Final Outcome relationships in pathway detail', () => {
    renderRoutes('/design/theory-of-change', sharedState())
    fireEvent.click(
      screen.getByRole('button', {
        name: `View details for Pathway: ${relatedPathway.pathway.name}`,
      }),
    )
    const panel = screen.getByRole('complementary', {
      name: 'Theory of Change node details',
    })
    expect(within(panel).getByText('Primary')).toBeInTheDocument()
    expect(within(panel).getByText('Related')).toBeInTheDocument()
    expect(
      within(panel).getByText(
        relatedPrimaryOutcome.shortLabel ?? relatedPrimaryOutcome.statement,
      ),
    ).toBeInTheDocument()
    expect(
      within(panel).getByText(outcome.shortLabel ?? outcome.statement),
    ).toBeInTheDocument()
  })

  it('shows objective missing requirements for an invalid project', () => {
    renderRoutes('/design/theory-of-change', initialProjectDesignState)
    expect(
      screen.getByRole('heading', {
        name: 'Theory of Change cannot be generated yet',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Select at least one Final Outcome.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Return to project design' }),
    ).toHaveAttribute('href', '/design/outcomes')
  })

  it('returns to Review without losing the project relationships', () => {
    const state = complete(sharedState())
    renderRoutes('/design/theory-of-change', state)
    fireEvent.click(screen.getByRole('link', { name: '← Back to Review' }))
    expect(
      screen.getByRole('heading', { name: 'Review Project Design' }),
    ).toBeInTheDocument()
    const pathwayHeadings = screen.getAllByRole('heading', {
      name: relatedPathway.pathway.name,
    })
    expect(pathwayHeadings).toHaveLength(1)
  })

  it('shows Intermediate Outcome indicators, activities and inputs in detail only', () => {
    const firstStep = [...primaryPathway.intermediateOutcomes].sort(
      (left, right) => left.stepNumber - right.stepNumber,
    )[0]
    if (!firstStep) throw new Error('Expected Intermediate Outcome test data.')
    const indicator = getPrimaryIndicatorForIntermediateOutcome(
      framework,
      firstStep.id,
    )
    if (!indicator) throw new Error('Expected Intermediate Outcome indicator.')
    const withActivity = projectDesignReducer(simpleState(), {
      type: 'addProjectSpecificActivity',
      pathwayId: primaryPathway.pathway.id,
      intermediateOutcomeId: firstStep.id,
      activity: {
        id: 'toc-detail-activity',
        wording: 'Facilitate market planning',
        projectDetails: 'Quarterly',
      },
    })
    const withInput = projectDesignReducer(withActivity, {
      type: 'addInput',
      pathwayId: primaryPathway.pathway.id,
      intermediateOutcomeId: firstStep.id,
      input: {
        id: 'toc-detail-input',
        inputCategoryId: 'other',
        details: 'Market analysis support',
      },
    })
    renderRoutes('/design/theory-of-change', withInput)
    expect(
      screen.queryByText('Facilitate market planning'),
    ).not.toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', {
        name: `View details for Intermediate Outcome: Step ${firstStep.stepNumber}`,
      }),
    )
    expect(screen.getByText(indicator.text)).toBeInTheDocument()
    expect(screen.getByText('Facilitate market planning')).toBeInTheDocument()
    expect(screen.getByText('Market analysis support')).toBeInTheDocument()
  })
})
