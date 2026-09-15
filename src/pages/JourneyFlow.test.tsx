import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import frameworkJson from '../data/framework-v1.0-normalized.json'
import {
  getPathwayIntermediateOutcomeSeeds,
  getPrimaryFinalOutcomeForPathway,
  getPrimaryPathwaysForFinalOutcome,
  getRelatedPathwaysForFinalOutcome,
  getSuggestedActivitiesForIntermediateOutcome,
} from '../services/frameworkService'
import { FrameworkProvider, ProjectDesignProvider } from '../state/AppState'
import {
  initialProjectDesignState,
  projectDesignReducer,
} from '../state/projectDesign'
import type { FrameworkData, PathwaySummary } from '../types/framework'
import type { ProjectDesignState } from '../types/project'
import { FinalOutcomeDetailPage, PathwayDetailPage } from './FrameworkPages'
import {
  ConfigurePathwaysOverviewPage,
  ReviewProjectPage,
} from './JourneyPages'
import { PathwayConfigurationPage } from './PathwayConfigurationPage'

const framework = frameworkJson as unknown as FrameworkData
const outcome =
  framework.finalOutcomes.find(
    (candidate) =>
      getPrimaryPathwaysForFinalOutcome(framework, candidate.id).length > 0 &&
      getRelatedPathwaysForFinalOutcome(framework, candidate.id).length > 0,
  ) ?? framework.finalOutcomes[0]

if (!outcome) throw new Error('Expected a Final Outcome in framework data.')

const primaryPathway = getPrimaryPathwaysForFinalOutcome(
  framework,
  outcome.id,
)[0]
const relatedPathway = getRelatedPathwaysForFinalOutcome(
  framework,
  outcome.id,
)[0]

if (!primaryPathway || !relatedPathway) {
  throw new Error('Expected Primary and Related pathways in framework data.')
}

function addPathway(
  state: ProjectDesignState,
  finalOutcomeId: string,
  summary: PathwaySummary,
  relationshipType = summary.relationshipType,
): ProjectDesignState {
  return projectDesignReducer(state, {
    type: 'addPathway',
    finalOutcomeId,
    pathwayId: summary.pathway.id,
    relationshipType,
    frameworkPrimaryFinalOutcomeId:
      getPrimaryFinalOutcomeForPathway(framework, summary.pathway.id)?.id ??
      finalOutcomeId,
    intermediateOutcomes: getPathwayIntermediateOutcomeSeeds(
      framework,
      summary.pathway.id,
    ),
  })
}

const completeCustomActivity = {
  id: 'custom-act-1',
  wording: 'Train local seed producers',
  projectDetails: '',
}

function addRequiredActivities(state: ProjectDesignState): ProjectDesignState {
  return state.projectPathways.reduce(
    (current, pathway) =>
      pathway.intermediateOutcomeConfigurations.reduce(
        (inner, configuration, index) => {
          const existing = inner.projectPathways
            .find((item) => item.pathwayId === pathway.pathwayId)
            ?.intermediateOutcomeConfigurations.find(
              (candidate) =>
                candidate.frameworkIntermediateOutcomeId ===
                configuration.frameworkIntermediateOutcomeId,
            )
          if (
            existing &&
            (existing.standardActivities.length > 0 ||
              existing.projectSpecificActivities.length > 0)
          ) {
            return inner
          }
          return projectDesignReducer(inner, {
            type: 'addProjectSpecificActivity',
            pathwayId: pathway.pathwayId,
            intermediateOutcomeId: configuration.frameworkIntermediateOutcomeId,
            activity: {
              id: `test-act-${pathway.pathwayId}-${index}`,
              wording: 'Required test activity',
              projectDetails: '',
            },
          })
        },
        current,
      ),
    state,
  )
}

function confirm(state: ProjectDesignState): ProjectDesignState {
  const withActivities = addRequiredActivities(state)
  return withActivities.projectPathways.reduce(
    (current, pathway) =>
      projectDesignReducer(current, {
        type: 'markPathwayConfigured',
        pathwayId: pathway.pathwayId,
      }),
    withActivities,
  )
}

function renderJourney(
  initialEntry: string,
  initialState = initialProjectDesignState,
) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <FrameworkProvider initialData={framework}>
        <ProjectDesignProvider initialState={initialState}>
          <Routes>
            <Route
              path="/design/outcomes/:outcomeId"
              element={<FinalOutcomeDetailPage />}
            />
            <Route
              path="/design/outcomes/:outcomeId/pathways/:pathwayId"
              element={<PathwayDetailPage />}
            />
            <Route
              path="/design/configure"
              element={<ConfigurePathwaysOverviewPage />}
            />
            <Route
              path="/design/pathways/:pathwayId/configure"
              element={<PathwayConfigurationPage />}
            />
            <Route path="/design/review" element={<ReviewProjectPage />} />
          </Routes>
        </ProjectDesignProvider>
      </FrameworkProvider>
    </MemoryRouter>,
  )
}

function renderApplication(
  initialEntry: string,
  initialState = initialProjectDesignState,
) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <FrameworkProvider initialData={framework}>
        <ProjectDesignProvider initialState={initialState}>
          <App />
        </ProjectDesignProvider>
      </FrameworkProvider>
    </MemoryRouter>,
  )
}

describe('linear project-design journey', () => {
  it('shows the Final Outcome indicator and pathway choices on one page', () => {
    renderJourney(`/design/outcomes/${outcome.id}`)

    expect(
      screen.getByRole('heading', { name: outcome.statement }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Mandatory primary indicator' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Primary pathways' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Related pathways' }),
    ).toBeInTheDocument()
  })

  it('keeps a Related-only selection incomplete', () => {
    const relatedOnlyState = addPathway(
      initialProjectDesignState,
      outcome.id,
      relatedPathway,
      'related',
    )
    renderJourney(`/design/outcomes/${outcome.id}`, relatedOnlyState)

    expect(
      screen.getAllByText('Primary pathway required').length,
    ).toBeGreaterThan(0)
    expect(
      screen.queryByRole('link', {
        name: 'Continue to configure pathways',
      }),
    ).not.toBeInTheDocument()
  })

  it('selecting a Primary pathway completes the outcome requirement', () => {
    renderJourney(`/design/outcomes/${outcome.id}`)

    const primaryHeading = screen.getByRole('heading', {
      name: primaryPathway.pathway.name,
    })
    const primaryCard = primaryHeading.closest('article')
    if (!primaryCard) throw new Error('Expected Primary pathway card.')
    fireEvent.click(
      within(primaryCard).getByRole('button', {
        name: 'Add pathway to basket',
      }),
    )

    expect(
      screen.getByText('✓ Outcome and Primary pathway selected'),
    ).toBeInTheDocument()
  })

  it('keeps the basket handoff disabled when an outcome lacks a Primary pathway', () => {
    const selectedOutcomeState = projectDesignReducer(
      initialProjectDesignState,
      {
        type: 'selectFinalOutcome',
        finalOutcomeId: outcome.id,
      },
    )
    renderApplication(`/design/outcomes/${outcome.id}`, selectedOutcomeState)

    expect(
      screen.getByRole('button', {
        name: 'Continue to configure pathways',
      }),
    ).toBeDisabled()
    expect(
      screen.getByText('Select a Primary pathway for 1 remaining outcome'),
    ).toBeInTheDocument()
  })

  it('does not enable the basket handoff for a Related-only selection', () => {
    const relatedOnlyState = addPathway(
      initialProjectDesignState,
      outcome.id,
      relatedPathway,
      'related',
    )
    renderApplication(`/design/outcomes/${outcome.id}`, relatedOnlyState)

    expect(
      screen.getByRole('button', {
        name: 'Continue to configure pathways',
      }),
    ).toBeDisabled()
  })

  it('enables the basket handoff after Primary requirements are met', () => {
    const validState = addPathway(
      initialProjectDesignState,
      outcome.id,
      primaryPathway,
      'primary',
    )
    renderApplication(`/design/outcomes/${outcome.id}`, validState)

    const continueLink = screen.getByRole('link', {
      name: 'Continue to configure pathways',
    })
    fireEvent.click(continueLink)

    expect(
      screen.getByRole('heading', { name: 'Configure pathways' }),
    ).toBeInTheDocument()
  })

  it.each([
    ['top', 0],
    ['bottom', 1],
  ])(
    'adds a pathway from the %s detail action and returns to its Final Outcome',
    (_placement, buttonIndex) => {
      renderJourney(
        `/design/outcomes/${outcome.id}/pathways/${primaryPathway.pathway.id}`,
      )

      const addButtons = screen.getAllByRole('button', {
        name: 'Add pathway to basket',
      })
      expect(addButtons).toHaveLength(2)
      expect(
        screen.queryByRole('link', { name: 'Configure pathway' }),
      ).not.toBeInTheDocument()

      fireEvent.click(addButtons[buttonIndex]!)

      expect(
        screen.getByRole('heading', { name: outcome.statement }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('status', {
          name: 'Pathway added to project',
        }),
      ).toBeInTheDocument()
      expect(
        document.getElementById(`pathway-card-${primaryPathway.pathway.id}`),
      ).toHaveFocus()
      const addedCard = screen
        .getByRole('heading', { name: primaryPathway.pathway.name })
        .closest('article')
      if (!addedCard) throw new Error('Expected added pathway card.')
      expect(within(addedCard).getByText('✓ In project')).toBeInTheDocument()
      expect(
        within(addedCard).getByRole('button', {
          name: 'Linked to this outcome',
        }),
      ).toBeDisabled()
      expect(
        screen.queryByRole('link', { name: 'Configure pathway' }),
      ).not.toBeInTheDocument()
    },
  )

  it('does not duplicate a pathway when added from pathway detail', () => {
    renderApplication(
      `/design/outcomes/${outcome.id}/pathways/${primaryPathway.pathway.id}`,
    )
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Add pathway to basket' })[0]!,
    )

    expect(screen.getByLabelText('Selection counts')).toHaveTextContent(
      /1 unique pathway/,
    )
    expect(
      screen.getAllByRole('heading', { name: primaryPathway.pathway.name }),
    ).toHaveLength(1)
  })

  it('shows a non-action already-in-project state on pathway detail', () => {
    const linkedState = addPathway(
      initialProjectDesignState,
      outcome.id,
      primaryPathway,
      'primary',
    )
    renderJourney(
      `/design/outcomes/${outcome.id}/pathways/${primaryPathway.pathway.id}`,
      linkedState,
    )

    expect(screen.getAllByText('Already in project')).toHaveLength(2)
    expect(
      screen.queryByRole('button', { name: 'Add pathway to basket' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Configure pathway' }),
    ).not.toBeInTheDocument()
  })

  it('uses Link pathway wording when the unique pathway already exists', () => {
    const otherOutcome = framework.finalOutcomes.find(
      (candidate) => candidate.id !== outcome.id,
    )
    if (!otherOutcome) throw new Error('Expected another Final Outcome.')
    const existingPathwayState = addPathway(
      initialProjectDesignState,
      otherOutcome.id,
      primaryPathway,
      'primary',
    )

    renderJourney(
      `/design/outcomes/${outcome.id}/pathways/${primaryPathway.pathway.id}`,
      existingPathwayState,
    )

    const linkButtons = screen.getAllByRole('button', {
      name: 'Link pathway to this outcome',
    })
    expect(linkButtons).toHaveLength(2)
    fireEvent.click(linkButtons[0]!)
    expect(
      screen.getByRole('status', {
        name: 'Pathway linked to this outcome',
      }),
    ).toBeInTheDocument()
  })

  it('lists a shared pathway once and shows both linked outcomes', () => {
    const secondOutcome = framework.finalOutcomes.find(
      (candidate) =>
        candidate.id !== outcome.id &&
        getPrimaryPathwaysForFinalOutcome(framework, candidate.id).some(
          (summary) => summary.pathway.id !== primaryPathway.pathway.id,
        ),
    )
    if (!secondOutcome) throw new Error('Expected a second Final Outcome.')
    const secondPrimaryPathway = getPrimaryPathwaysForFinalOutcome(
      framework,
      secondOutcome.id,
    ).find((summary) => summary.pathway.id !== primaryPathway.pathway.id)
    if (!secondPrimaryPathway) {
      throw new Error('Expected a distinct second Primary pathway.')
    }
    let sharedState = addPathway(
      initialProjectDesignState,
      outcome.id,
      primaryPathway,
      'primary',
    )
    sharedState = addPathway(
      sharedState,
      secondOutcome.id,
      primaryPathway,
      'related',
    )
    sharedState = addPathway(
      sharedState,
      secondOutcome.id,
      secondPrimaryPathway,
      'primary',
    )

    renderJourney('/design/configure', sharedState)

    expect(
      screen.getByRole('heading', { name: 'Selected Final Outcomes' }),
    ).toBeInTheDocument()
    const sharedPathwayHeadings = screen.getAllByRole('heading', {
      name: primaryPathway.pathway.name,
    })
    expect(sharedPathwayHeadings).toHaveLength(1)
    const sharedCard = sharedPathwayHeadings[0]?.closest('article')
    if (!sharedCard) throw new Error('Expected shared pathway card.')
    expect(within(sharedCard).getByText('Contributes to')).toBeInTheDocument()
    expect(within(sharedCard).getByText('Primary')).toBeInTheDocument()
    expect(within(sharedCard).getByText('Related')).toBeInTheDocument()
    expect(
      within(sharedCard).getByText(outcome.shortLabel ?? outcome.statement),
    ).toBeInTheDocument()
    expect(
      within(sharedCard).getByText(
        secondOutcome.shortLabel ?? secondOutcome.statement,
      ),
    ).toBeInTheDocument()
  })

  it('autosaves activity notes and custom activity edits across navigation', () => {
    let configuredState = addPathway(
      initialProjectDesignState,
      outcome.id,
      primaryPathway,
      'primary',
    )
    const intermediateOutcome =
      primaryPathway.intermediateOutcomes.find(
        (candidate) =>
          getSuggestedActivitiesForIntermediateOutcome(framework, candidate.id)
            .length > 0,
      ) ?? primaryPathway.intermediateOutcomes[0]
    if (!intermediateOutcome)
      throw new Error('Expected an Intermediate Outcome.')
    const activity = getSuggestedActivitiesForIntermediateOutcome(
      framework,
      intermediateOutcome.id,
    )[0]
    if (!activity) throw new Error('Expected a suggested activity.')
    configuredState = projectDesignReducer(configuredState, {
      type: 'setStandardActivity',
      pathwayId: primaryPathway.pathway.id,
      intermediateOutcomeId: intermediateOutcome.id,
      frameworkActivityId: activity.id,
      selected: true,
    })
    configuredState = projectDesignReducer(configuredState, {
      type: 'addProjectSpecificActivity',
      pathwayId: primaryPathway.pathway.id,
      intermediateOutcomeId: intermediateOutcome.id,
      activity: {
        id: 'custom-activity',
        wording: 'Initial project activity',
        projectDetails: 'Initial details',
      },
    })

    renderJourney(
      `/design/pathways/${primaryPathway.pathway.id}/configure`,
      configuredState,
    )

    expect(
      screen.getByText('Save the project to persist changes'),
    ).toBeInTheDocument()
    const firstStepHeading = screen.getByRole('heading', {
      name: intermediateOutcome.statement,
    })
    const firstStepSummary = firstStepHeading.closest('summary')
    if (!firstStepSummary)
      throw new Error('Expected Intermediate Outcome summary.')
    fireEvent.click(firstStepSummary)
    const notes = screen.getByLabelText(
      'Project-specific details or notes — optional',
    )
    fireEvent.change(notes, { target: { value: 'Retained project detail' } })
    const customActivityItem = screen
      .getByText('Initial project activity')
      .closest('li')
    if (!customActivityItem) throw new Error('Expected custom activity item.')
    fireEvent.click(
      within(customActivityItem).getByRole('button', { name: 'Edit' }),
    )
    const customDetails = within(
      firstStepSummary.parentElement!,
    ).getByLabelText('Project-specific details')
    fireEvent.change(customDetails, {
      target: { value: 'Autosaved custom activity details' },
    })
    fireEvent.click(
      screen.getByRole('link', { name: /Back to Configure Pathways/ }),
    )
    fireEvent.click(screen.getByRole('link', { name: 'Configure pathway' }))
    const returnedStepHeading = screen.getByRole('heading', {
      name: intermediateOutcome.statement,
    })
    const returnedStepSummary = returnedStepHeading.closest('summary')
    if (!returnedStepSummary) {
      throw new Error('Expected returned Intermediate Outcome summary.')
    }
    fireEvent.click(returnedStepSummary)

    expect(
      screen.getByLabelText('Project-specific details or notes — optional'),
    ).toHaveValue('Retained project detail')
    const returnedCustomItem = screen
      .getByText('Initial project activity')
      .closest('li')
    if (!returnedCustomItem) {
      throw new Error('Expected returned custom activity item.')
    }
    fireEvent.click(
      within(returnedCustomItem).getByRole('button', { name: 'Edit' }),
    )
    expect(
      within(returnedStepSummary.parentElement!).getByLabelText(
        'Project-specific details',
      ),
    ).toHaveValue('Autosaved custom activity details')
  })

  it('Done returns to the overview and permits review with optional sections empty', () => {
    const configuredState = addRequiredActivities(
      addPathway(
        initialProjectDesignState,
        outcome.id,
        primaryPathway,
        'primary',
      ),
    )
    renderJourney(
      `/design/pathways/${primaryPathway.pathway.id}/configure`,
      configuredState,
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Done configuring this pathway',
      }),
    )

    expect(
      screen.getByRole('heading', { name: 'Configure pathways' }),
    ).toBeInTheDocument()
    expect(screen.getByText('✓ All pathways configured')).toBeInTheDocument()
    expect(screen.getByText('✓ Configured')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Edit configuration' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Configure pathway' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Continue to review project' }),
    ).toBeInTheDocument()
  })
})

describe('custom innovation and project review', () => {
  const incomeImpact = framework.impacts.find(
    (impact) => impact.theme === 'Income',
  )
  if (!incomeImpact) throw new Error('Expected Income Impact Area.')
  const incomeImpactAreaId = incomeImpact.id

  function completeCustomState(base: ProjectDesignState): ProjectDesignState {
    return projectDesignReducer(base, {
      type: 'addCustomInnovation',
      customInnovation: {
        id: 'custom-fo-1',
        isCustom: true,
        shortLabel: 'Local seed markets',
        statement: 'Smallholder farmers access reliable local seed markets.',
        rationale: 'The standard framework does not cover this market change.',
        impactAreaIds: [incomeImpactAreaId],
        primaryIndicator: {
          id: 'custom-fo-ind-1',
          wording: 'Number of farmers using local seed markets',
          measurementNotes: '',
        },
        pathway: {
          id: 'custom-pw-1',
          isCustom: true,
          name: 'Local seed market development',
          description: 'Strengthen local seed production and trade.',
          rationale: 'Market access leads to the custom outcome.',
          intermediateOutcomes: [
            {
              id: 'custom-io-1',
              isCustom: true,
              stepNumber: 1,
              statement: 'Local seed producers increase quality supply.',
              primaryIndicator: {
                id: 'custom-io-ind-1',
                wording: 'Volume of quality seed produced locally',
                measurementNotes: '',
              },
              additionalIndicators: [],
              activities: [completeCustomActivity],
              inputs: [],
            },
          ],
        },
      },
    })
  }

  it('shows a custom innovation entry point below standard outcomes', () => {
    renderApplication('/design/outcomes')
    expect(
      screen.getByRole('heading', {
        name: "Can't find a suitable standard outcome?",
      }),
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Add custom innovation outcome' }),
    )
    expect(
      screen.getByRole('heading', { name: 'Custom innovation outcome' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/will require review by all Thematic Coordinators/),
    ).toBeInTheDocument()
  })

  it('does not allow a second Custom Innovation Outcome and offers Edit instead', () => {
    renderApplication(
      '/design/outcomes',
      completeCustomState(initialProjectDesignState),
    )
    expect(
      screen.getByText('Custom innovation outcome already added'),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Add custom innovation outcome' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Edit custom innovation outcome' }),
    ).toBeInTheDocument()
  })

  it('disables Continue to review while custom innovation is incomplete', () => {
    let state = addPathway(
      initialProjectDesignState,
      outcome.id,
      primaryPathway,
      'primary',
    )
    state = confirm(state)
    state = projectDesignReducer(state, {
      type: 'addCustomInnovation',
      customInnovation: {
        id: 'custom-fo-1',
        isCustom: true,
        shortLabel: '',
        statement: '',
        rationale: '',
        impactAreaIds: [],
        primaryIndicator: { id: 'ind', wording: '', measurementNotes: '' },
        pathway: {
          id: 'custom-pw-1',
          isCustom: true,
          name: '',
          description: '',
          rationale: '',
          intermediateOutcomes: [
            {
              id: 'custom-io-1',
              isCustom: true,
              stepNumber: 1,
              statement: '',
              primaryIndicator: {
                id: 'io-ind',
                wording: '',
                measurementNotes: '',
              },
              additionalIndicators: [],
              activities: [],
              inputs: [],
            },
          ],
        },
      },
    })
    renderJourney('/design/configure', state)
    expect(
      screen.queryByRole('link', { name: 'Continue to review project' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Complete custom outcome' }),
    ).toBeInTheDocument()
  })

  it('enables Continue to review when standard pathways are confirmed and custom content is complete', () => {
    let state = addPathway(
      initialProjectDesignState,
      outcome.id,
      primaryPathway,
      'primary',
    )
    state = confirm(completeCustomState(state))
    renderJourney('/design/configure', state)
    expect(
      screen.getByRole('link', { name: 'Continue to review project' }),
    ).toBeInTheDocument()
  })

  it('reviews a shared pathway once with both relationship types', () => {
    const secondOutcome = framework.finalOutcomes.find(
      (candidate) =>
        candidate.id !== outcome.id &&
        getPrimaryPathwaysForFinalOutcome(framework, candidate.id).some(
          (summary) => summary.pathway.id !== primaryPathway.pathway.id,
        ),
    )
    if (!secondOutcome) throw new Error('Expected a second Final Outcome.')
    const secondPrimaryPathway = getPrimaryPathwaysForFinalOutcome(
      framework,
      secondOutcome.id,
    ).find((summary) => summary.pathway.id !== primaryPathway.pathway.id)
    if (!secondPrimaryPathway) {
      throw new Error('Expected a distinct second Primary pathway.')
    }
    let sharedState = addPathway(
      initialProjectDesignState,
      outcome.id,
      primaryPathway,
      'primary',
    )
    sharedState = addPathway(
      sharedState,
      secondOutcome.id,
      primaryPathway,
      'related',
    )
    sharedState = addPathway(
      sharedState,
      secondOutcome.id,
      secondPrimaryPathway,
      'primary',
    )
    sharedState = confirm(sharedState)
    renderJourney('/design/review', sharedState)

    expect(
      screen.getByRole('heading', { name: 'Review Project Design' }),
    ).toBeInTheDocument()
    const sharedHeadings = screen.getAllByRole('heading', {
      name: primaryPathway.pathway.name,
    })
    expect(sharedHeadings).toHaveLength(1)
    const sharedCard = sharedHeadings[0]?.closest('article')
    if (!sharedCard) throw new Error('Expected shared pathway review card.')
    expect(within(sharedCard).getByText('Primary')).toBeInTheDocument()
    expect(within(sharedCard).getByText('Related')).toBeInTheDocument()
    expect(within(sharedCard).getByText('Contributes to')).toBeInTheDocument()
    expect(
      within(sharedCard).queryByText('Project relationships'),
    ).not.toBeInTheDocument()
    expect(
      within(sharedCard).queryByText('Primary Final Outcome'),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Selected pathways')).toBeInTheDocument()
    expect(screen.queryByText('CUSTOM INNOVATION')).not.toBeInTheDocument()
    expect(screen.queryByText(/Shared pathway/i)).not.toBeInTheDocument()
  })
})

describe('UX clarity for dates, related pathways and custom innovation', () => {
  const relatedPrimaryOutcome = getPrimaryFinalOutcomeForPathway(
    framework,
    relatedPathway.pathway.id,
  )
  if (!relatedPrimaryOutcome) {
    throw new Error(
      'Expected the Related pathway to have a Primary Final Outcome in framework data.',
    )
  }
  if (relatedPrimaryOutcome.id === outcome.id) {
    throw new Error(
      `Related pathway ${relatedPathway.pathway.id} unexpectedly uses the discovery Final Outcome ${outcome.id} as its Primary Final Outcome.`,
    )
  }
  const relatedPrimaryLabel =
    relatedPrimaryOutcome.shortLabel ?? relatedPrimaryOutcome.statement
  const currentOutcomeLabel = outcome.shortLabel ?? outcome.statement

  function withMetadata(state: ProjectDesignState): ProjectDesignState {
    return projectDesignReducer(state, {
      type: 'updateMetadata',
      payload: {
        title: 'Seed systems project',
        country: 'Kenya',
        donor: 'FCDO',
        fundingReference: 'REF-001',
        projectManager: 'Amina Hassan',
        plannedStartDate: '2027-03',
        plannedEndDate: '2027-11',
        description: 'A project to strengthen local seed markets.',
      },
    })
  }

  it('uses Potential implementation Month and Year fields on Project Details', () => {
    renderApplication('/design/details')
    expect(
      screen.getByText(/Potential implementation start/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Potential implementation end/)).toBeInTheDocument()
    expect(
      screen.getByLabelText('Potential implementation start month'),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('Potential implementation start year'),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('Potential implementation end month'),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('Potential implementation end year'),
    ).toBeInTheDocument()
    expect(document.querySelector('input[type="date"]')).toBeNull()
  })

  it('rejects a Potential End month earlier than Potential Start', () => {
    renderApplication('/design/details')
    fireEvent.change(screen.getByLabelText(/Project title/), {
      target: { value: 'Seed systems project' },
    })
    fireEvent.change(screen.getByLabelText('Country *'), {
      target: { value: 'Kenya' },
    })
    fireEvent.change(screen.getByLabelText('Donor *'), {
      target: { value: 'FCDO' },
    })
    fireEvent.change(screen.getByLabelText(/Funding opportunity/), {
      target: { value: 'REF-001' },
    })
    fireEvent.change(screen.getByLabelText(/Project Manager/), {
      target: { value: 'Amina Hassan' },
    })
    fireEvent.change(screen.getByLabelText(/Short project description/), {
      target: { value: 'A project to strengthen local seed markets.' },
    })
    fireEvent.change(
      screen.getByLabelText('Potential implementation start month'),
      { target: { value: '03' } },
    )
    fireEvent.change(
      screen.getByLabelText('Potential implementation start year'),
      { target: { value: '2027' } },
    )
    fireEvent.change(
      screen.getByLabelText('Potential implementation end month'),
      { target: { value: '01' } },
    )
    fireEvent.change(
      screen.getByLabelText('Potential implementation end year'),
      { target: { value: '2027' } },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(
      screen.getByText(
        'Potential End must not be earlier than Potential Start.',
      ),
    ).toBeInTheDocument()
  })

  it('reviews Potential implementation dates as month and year', () => {
    const state = withMetadata(
      confirm(
        addPathway(
          initialProjectDesignState,
          outcome.id,
          primaryPathway,
          'primary',
        ),
      ),
    )
    renderJourney('/design/review', state)
    expect(
      screen.getByText('Potential implementation start'),
    ).toBeInTheDocument()
    expect(screen.getByText('Potential implementation end')).toBeInTheDocument()
    expect(screen.getByText('March 2027')).toBeInTheDocument()
    expect(screen.getByText('November 2027')).toBeInTheDocument()
  })

  it('shows Related pathway context without treating the discovery outcome as Primary', () => {
    if (!relatedPrimaryLabel) {
      throw new Error(
        'Expected the Related pathway to have a Primary Final Outcome.',
      )
    }
    renderJourney(
      `/design/outcomes/${outcome.id}/pathways/${relatedPathway.pathway.id}`,
    )
    const relationshipBox = screen.getByRole('region', {
      name: 'Pathway relationship',
    })
    expect(relationshipBox).toHaveClass('pathway-relationship-box')
    expect(
      within(relationshipBox).getByRole('heading', {
        name: 'Related pathway for',
      }),
    ).toBeInTheDocument()
    expect(
      within(relationshipBox).getByText(currentOutcomeLabel),
    ).toBeInTheDocument()
    expect(
      within(relationshipBox).getByRole('heading', {
        name: 'Primary Final Outcome',
      }),
    ).toBeInTheDocument()
    expect(
      within(relationshipBox).getByText(relatedPrimaryLabel),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(`Approved pathway for ${currentOutcomeLabel}`),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(`Primary pathway for ${currentOutcomeLabel}`),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/project-level ID/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/framework ID/i)).not.toBeInTheDocument()
  })

  it('keeps Primary pathway wording when viewed from its own Final Outcome', () => {
    renderJourney(
      `/design/outcomes/${outcome.id}/pathways/${primaryPathway.pathway.id}`,
    )
    const relationshipBox = screen.getByRole('region', {
      name: 'Pathway relationship',
    })
    expect(
      within(relationshipBox).getByRole('heading', {
        name: 'Primary pathway for',
      }),
    ).toBeInTheDocument()
    expect(
      within(relationshipBox).getByText(currentOutcomeLabel),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(`Related pathway for ${currentOutcomeLabel}`),
    ).not.toBeInTheDocument()
  })

  it('adds a Related pathway Primary Final Outcome as a separate basket card', () => {
    if (!relatedPrimaryOutcome) {
      throw new Error(
        'Expected the Related pathway to have a Primary Final Outcome.',
      )
    }
    let state = addPathway(
      initialProjectDesignState,
      outcome.id,
      primaryPathway,
      'primary',
    )
    state = addPathway(state, outcome.id, relatedPathway, 'related')
    renderApplication(`/design/outcomes/${outcome.id}`, state)
    const basket = screen.getByRole('complementary', {
      name: 'Project summary',
    })
    expect(
      within(basket).getByRole('heading', {
        name: '2 Final Outcomes selected',
      }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Selection counts')).toHaveTextContent(
      /2 Final Outcomes · 2 unique pathways/,
    )
    expect(
      within(basket).queryByRole('heading', {
        level: 3,
        name: 'Related pathways',
      }),
    ).not.toBeInTheDocument()
    const outcomeCard = within(basket)
      .getByRole('heading', { level: 3, name: currentOutcomeLabel })
      .closest('li')
    if (!outcomeCard) throw new Error('Expected selected Final Outcome card.')
    expect(
      within(outcomeCard).getByRole('heading', { name: 'Primary pathways' }),
    ).toBeInTheDocument()
    expect(
      within(outcomeCard).getByRole('heading', { name: 'Related pathways' }),
    ).toBeInTheDocument()
    expect(within(outcomeCard).getByText('Related pathway')).toBeInTheDocument()
    const relatedContext = within(outcomeCard).getByText(
      relatedPrimaryOutcome.shortLabel ?? relatedPrimaryOutcome.statement,
      { exact: false },
    )
    expect(relatedContext.closest('small')).toHaveTextContent(
      `Also a Primary pathway for: ${relatedPrimaryOutcome.shortLabel ?? relatedPrimaryOutcome.statement}`,
    )
    const primaryOutcomeCard = within(basket)
      .getByRole('heading', {
        level: 3,
        name:
          relatedPrimaryOutcome.shortLabel ?? relatedPrimaryOutcome.statement,
      })
      .closest('li')
    if (!primaryOutcomeCard) {
      throw new Error('Expected the auto-added Primary Final Outcome card.')
    }
    expect(
      within(primaryOutcomeCard).getByText(relatedPathway.pathway.name),
    ).toBeInTheDocument()
    expect(
      within(primaryOutcomeCard).getByText(/Primary · Not started/),
    ).toBeInTheDocument()
    expect(
      state.projectPathways.filter(
        (pathway) => pathway.pathwayId === relatedPathway.pathway.id,
      ),
    ).toHaveLength(1)
  })

  it('announces that a Related pathway also added its Primary Final Outcome', () => {
    const state = addPathway(
      initialProjectDesignState,
      outcome.id,
      primaryPathway,
      'primary',
    )
    renderApplication(
      `/design/outcomes/${outcome.id}/pathways/${relatedPathway.pathway.id}`,
      state,
    )

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Add pathway to basket' })[0]!,
    )

    expect(
      screen.getByRole('status', {
        name: 'Pathway added. Its Primary Final Outcome has also been added to your project.',
      }),
    ).toBeInTheDocument()
    const basket = screen.getByRole('complementary', {
      name: 'Project summary',
    })
    expect(
      within(basket).getByRole('heading', {
        level: 2,
        name: '2 Final Outcomes selected',
      }),
    ).toBeInTheDocument()
  })

  it('removes a purely auto-added Final Outcome with its originating Related link', () => {
    let state = addPathway(
      initialProjectDesignState,
      outcome.id,
      primaryPathway,
      'primary',
    )
    state = addPathway(state, outcome.id, relatedPathway, 'related')
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderApplication(`/design/outcomes/${outcome.id}`, state)
    const basket = screen.getByRole('complementary', {
      name: 'Project summary',
    })
    const originatingCard = within(basket)
      .getByRole('heading', { level: 3, name: currentOutcomeLabel })
      .closest('li')
    if (!originatingCard) throw new Error('Expected originating outcome card.')

    fireEvent.click(
      within(originatingCard).getByRole('button', {
        name: `Remove ${relatedPathway.pathway.name} link`,
      }),
    )

    expect(confirmSpy).toHaveBeenCalledOnce()
    expect(
      within(basket).getByRole('heading', {
        level: 2,
        name: '1 Final Outcome selected',
      }),
    ).toBeInTheDocument()
    expect(within(basket).getByText('Outcome 1 of 1')).toBeInTheDocument()
    expect(
      within(basket).queryByRole('heading', {
        level: 3,
        name:
          relatedPrimaryOutcome.shortLabel ?? relatedPrimaryOutcome.statement,
      }),
    ).not.toBeInTheDocument()
    confirmSpy.mockRestore()
  })

  it('places the custom innovation entry before the standard outcome cards', () => {
    renderApplication('/design/outcomes')
    const entry = document.querySelector('.custom-innovation-entry')
    const grid = document.querySelector('.framework-grid')
    if (!entry || !grid) {
      throw new Error('Expected custom entry and standard outcome cards.')
    }
    expect(
      entry.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('shows custom pathway guidance and Add another controls', () => {
    renderApplication('/design/outcomes')
    fireEvent.click(
      screen.getByRole('button', { name: 'Add custom innovation outcome' }),
    )
    expect(
      screen.getByRole('heading', { name: 'What is a pathway?' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Around 2–5 Intermediate Outcomes is usually enough.', {
        exact: false,
      }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/project-level ID/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/framework ID/i)).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Additional indicators — optional' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Add any additional indicators that will help measure this Intermediate Outcome.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/standard framework indicators do not capture/),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Add another Intermediate Outcome' }),
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: 'Add another indicator' }).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByRole('button', { name: 'Add another activity' }).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByRole('button', { name: 'Add another input' }).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getByRole('button', {
        name: 'Save custom outcome and continue choosing outcomes',
      }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', {
        name: 'Save custom outcome and continue to configure pathways',
      }),
    ).toBeDisabled()
    expect(
      screen.getByText('Select at least one Impact Area'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Add a Primary indicator for Intermediate Outcome 1'),
    ).toBeInTheDocument()
  })

  it('allows more than five Intermediate Outcomes', () => {
    renderApplication('/design/outcomes')
    fireEvent.click(
      screen.getByRole('button', { name: 'Add custom innovation outcome' }),
    )
    for (let index = 0; index < 5; index += 1) {
      fireEvent.click(
        screen.getByRole('button', {
          name: 'Add another Intermediate Outcome',
        }),
      )
    }
    expect(screen.getByText('6 steps')).toBeInTheDocument()
    expect(screen.queryByText(/maximum of 5/i)).not.toBeInTheDocument()
  })

  it('offers both post-custom-outcome navigation choices when complete', () => {
    const incomeImpact = framework.impacts.find(
      (impact) => impact.theme === 'Income',
    )
    if (!incomeImpact) throw new Error('Expected Income Impact Area.')
    const completeCustom = projectDesignReducer(initialProjectDesignState, {
      type: 'addCustomInnovation',
      customInnovation: {
        id: 'custom-fo-1',
        isCustom: true,
        shortLabel: 'Local seed markets',
        statement: 'Smallholder farmers access reliable local seed markets.',
        rationale: 'The standard framework does not cover this market change.',
        impactAreaIds: [incomeImpact.id],
        primaryIndicator: {
          id: 'custom-fo-ind-1',
          wording: 'Number of farmers using local seed markets',
          measurementNotes: '',
        },
        pathway: {
          id: 'custom-pw-1',
          isCustom: true,
          name: 'Local seed market development',
          description: 'Strengthen local seed production and trade.',
          rationale: 'Market access leads to the custom outcome.',
          intermediateOutcomes: [
            {
              id: 'custom-io-1',
              isCustom: true,
              stepNumber: 1,
              statement: 'Local seed producers increase quality supply.',
              primaryIndicator: {
                id: 'custom-io-ind-1',
                wording: 'Volume of quality seed produced locally',
                measurementNotes: '',
              },
              additionalIndicators: [],
              activities: [completeCustomActivity],
              inputs: [],
            },
          ],
        },
      },
    })
    renderApplication('/design/custom-innovation', completeCustom)
    expect(
      screen.getByRole('link', {
        name: 'Save custom outcome and continue choosing outcomes',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: 'Save custom outcome and continue to configure pathways',
      }),
    ).toBeInTheDocument()
  })

  it('lets the user discard an incomplete custom draft', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderApplication('/design/outcomes')
    fireEvent.click(
      screen.getByRole('button', { name: 'Add custom innovation outcome' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Cancel / discard custom outcome' }),
    )
    expect(confirmSpy).toHaveBeenCalled()
    expect(
      screen.getByRole('heading', {
        name: "Can't find a suitable standard outcome?",
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Add custom innovation outcome' }),
    ).toBeInTheDocument()
    confirmSpy.mockRestore()
  })

  it('keeps a complete custom innovation card neutral and an incomplete one in attention state', () => {
    const incomeImpact = framework.impacts.find(
      (impact) => impact.theme === 'Income',
    )
    if (!incomeImpact) throw new Error('Expected Income Impact Area.')
    const completeCustom = projectDesignReducer(
      addPathway(
        initialProjectDesignState,
        outcome.id,
        primaryPathway,
        'primary',
      ),
      {
        type: 'addCustomInnovation',
        customInnovation: {
          id: 'custom-fo-1',
          isCustom: true,
          shortLabel: 'Local seed markets',
          statement: 'Smallholder farmers access reliable local seed markets.',
          rationale:
            'The standard framework does not cover this market change.',
          impactAreaIds: [incomeImpact.id],
          primaryIndicator: {
            id: 'custom-fo-ind-1',
            wording: 'Number of farmers using local seed markets',
            measurementNotes: '',
          },
          pathway: {
            id: 'custom-pw-1',
            isCustom: true,
            name: 'Local seed market development',
            description: 'Strengthen local seed production and trade.',
            rationale: 'Market access leads to the custom outcome.',
            intermediateOutcomes: [
              {
                id: 'custom-io-1',
                isCustom: true,
                stepNumber: 1,
                statement: 'Local seed producers increase quality supply.',
                primaryIndicator: {
                  id: 'custom-io-ind-1',
                  wording: 'Volume of quality seed produced locally',
                  measurementNotes: '',
                },
                additionalIndicators: [],
                activities: [completeCustomActivity],
                inputs: [],
              },
            ],
          },
        },
      },
    )
    renderApplication('/design/configure', completeCustom)
    const completeCard = screen
      .getByRole('heading', { level: 2, name: 'Local seed markets' })
      .closest('article')
    if (!completeCard) throw new Error('Expected complete custom card.')
    expect(completeCard).not.toHaveClass('needs-attention')
    expect(
      within(completeCard).getByText('Custom innovation'),
    ).toBeInTheDocument()
    expect(within(completeCard).getByText('✓ Complete')).toBeInTheDocument()
    expect(screen.queryByText(/Shared pathway/i)).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Configure pathway' }),
    ).toBeInTheDocument()
  })

  it('marks an incomplete custom innovation card as needing attention', () => {
    let state = addPathway(
      initialProjectDesignState,
      outcome.id,
      primaryPathway,
      'primary',
    )
    state = projectDesignReducer(state, {
      type: 'addCustomInnovation',
      customInnovation: {
        id: 'custom-fo-1',
        isCustom: true,
        shortLabel: '',
        statement: '',
        rationale: '',
        impactAreaIds: [],
        primaryIndicator: { id: 'ind', wording: '', measurementNotes: '' },
        pathway: {
          id: 'custom-pw-1',
          isCustom: true,
          name: '',
          description: '',
          rationale: '',
          intermediateOutcomes: [
            {
              id: 'custom-io-1',
              isCustom: true,
              stepNumber: 1,
              statement: '',
              primaryIndicator: {
                id: 'io-ind',
                wording: '',
                measurementNotes: '',
              },
              additionalIndicators: [],
              activities: [],
              inputs: [],
            },
          ],
        },
      },
    })
    renderApplication('/design/configure', state)
    const incompleteCard = screen
      .getByRole('heading', { name: 'Custom innovation outcome' })
      .closest('article')
    if (!incompleteCard) throw new Error('Expected incomplete custom card.')
    expect(incompleteCard).toHaveClass('needs-attention')
    expect(
      within(incompleteCard).getByText('Needs completion'),
    ).toBeInTheDocument()
  })

  it('preserves configuration when editing a completed pathway', () => {
    let configuredState = addPathway(
      initialProjectDesignState,
      outcome.id,
      primaryPathway,
      'primary',
    )
    const intermediateOutcome =
      primaryPathway.intermediateOutcomes.find(
        (candidate) =>
          getSuggestedActivitiesForIntermediateOutcome(framework, candidate.id)
            .length > 0,
      ) ?? primaryPathway.intermediateOutcomes[0]
    if (!intermediateOutcome)
      throw new Error('Expected an Intermediate Outcome.')
    const activity = getSuggestedActivitiesForIntermediateOutcome(
      framework,
      intermediateOutcome.id,
    )[0]
    if (!activity) throw new Error('Expected a suggested activity.')
    configuredState = projectDesignReducer(configuredState, {
      type: 'setStandardActivity',
      pathwayId: primaryPathway.pathway.id,
      intermediateOutcomeId: intermediateOutcome.id,
      frameworkActivityId: activity.id,
      selected: true,
    })
    configuredState = projectDesignReducer(configuredState, {
      type: 'updateStandardActivityNotes',
      pathwayId: primaryPathway.pathway.id,
      intermediateOutcomeId: intermediateOutcome.id,
      frameworkActivityId: activity.id,
      projectNotes: 'Kept after edit',
    })
    configuredState = confirm(configuredState)
    renderJourney('/design/configure', configuredState)
    fireEvent.click(screen.getByRole('link', { name: 'Edit configuration' }))
    const firstStepHeading = screen.getByRole('heading', {
      name: intermediateOutcome.statement,
    })
    fireEvent.click(firstStepHeading.closest('summary')!)
    expect(
      screen.getByLabelText('Project-specific details or notes — optional'),
    ).toHaveValue('Kept after edit')
    expect(
      screen.getAllByText(
        'Do you wish to select any additional indicators for this Intermediate Outcome?',
      ).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText(
        'Add a project-specific indicator only where the standard framework indicators do not capture an important measure for this project.',
      ).length,
    ).toBeGreaterThan(0)
  })

  it('uses the same basket card structure for a complete custom outcome', () => {
    const incomeImpact = framework.impacts.find(
      (impact) => impact.theme === 'Income',
    )
    if (!incomeImpact) throw new Error('Expected Income Impact Area.')
    const completeCustom = projectDesignReducer(
      addPathway(
        initialProjectDesignState,
        outcome.id,
        primaryPathway,
        'primary',
      ),
      {
        type: 'addCustomInnovation',
        customInnovation: {
          id: 'custom-fo-1',
          isCustom: true,
          shortLabel: 'Local seed markets',
          statement: 'Smallholder farmers access reliable local seed markets.',
          rationale:
            'The standard framework does not cover this market change.',
          impactAreaIds: [incomeImpact.id],
          primaryIndicator: {
            id: 'custom-fo-ind-1',
            wording: 'Number of farmers using local seed markets',
            measurementNotes: '',
          },
          pathway: {
            id: 'custom-pw-1',
            isCustom: true,
            name: 'Local seed market development',
            description: 'Strengthen local seed production and trade.',
            rationale: 'Market access leads to the custom outcome.',
            intermediateOutcomes: [
              {
                id: 'custom-io-1',
                isCustom: true,
                stepNumber: 1,
                statement: 'Local seed producers increase quality supply.',
                primaryIndicator: {
                  id: 'custom-io-ind-1',
                  wording: 'Volume of quality seed produced locally',
                  measurementNotes: '',
                },
                additionalIndicators: [],
                activities: [completeCustomActivity],
                inputs: [],
              },
            ],
          },
        },
      },
    )
    renderApplication(`/design/outcomes/${outcome.id}`, completeCustom)
    expect(
      screen.getByRole('heading', { name: 'Selected Final Outcomes' }),
    ).toBeInTheDocument()
    const customCard = screen
      .getAllByRole('link', { name: 'Local seed markets' })
      .map((link) => link.closest('li'))
      .find((item) => item?.classList.contains('basket-outcome-card'))
    if (!customCard) throw new Error('Expected custom basket card.')
    expect(customCard).toHaveClass('basket-outcome-card')
    expect(customCard).not.toHaveClass('needs-attention')
    expect(within(customCard).getByText('Outcome 2 of 2')).toBeInTheDocument()
    expect(
      within(customCard).getByRole('heading', {
        level: 3,
        name: 'Local seed markets',
      }),
    ).toBeInTheDocument()
    expect(
      customCard.querySelector('.basket-outcome-card-header'),
    ).not.toBeNull()
    expect(
      customCard.querySelector('.basket-outcome-card-content'),
    ).not.toBeNull()
    expect(
      within(customCard).getByText('Custom innovation'),
    ).toBeInTheDocument()
    expect(within(customCard).getByText('Complete')).toBeInTheDocument()
    expect(
      within(customCard).getByRole('heading', { name: 'Custom pathway' }),
    ).toBeInTheDocument()
    expect(
      within(customCard).getByText('Local seed market development'),
    ).toBeInTheDocument()
    expect(
      within(customCard).getByRole('button', {
        name: 'Remove custom innovation outcome',
      }),
    ).toBeInTheDocument()
  })

  it('shows that an incomplete custom basket card needs completion', () => {
    let state = addPathway(
      initialProjectDesignState,
      outcome.id,
      primaryPathway,
      'primary',
    )
    state = projectDesignReducer(state, {
      type: 'addCustomInnovation',
      customInnovation: {
        id: 'custom-fo-1',
        isCustom: true,
        shortLabel: '',
        statement: '',
        rationale: '',
        impactAreaIds: [],
        primaryIndicator: { id: 'ind', wording: '', measurementNotes: '' },
        pathway: {
          id: 'custom-pw-1',
          isCustom: true,
          name: '',
          description: '',
          rationale: '',
          intermediateOutcomes: [
            {
              id: 'custom-io-1',
              isCustom: true,
              stepNumber: 1,
              statement: '',
              primaryIndicator: {
                id: 'io-ind',
                wording: '',
                measurementNotes: '',
              },
              additionalIndicators: [],
              activities: [],
              inputs: [],
            },
          ],
        },
      },
    })
    renderApplication(`/design/outcomes/${outcome.id}`, state)
    const customCard = screen
      .getAllByRole('link', { name: 'Untitled custom outcome' })
      .map((link) => link.closest('li'))
      .find((item) => item?.classList.contains('basket-outcome-card'))
    if (!customCard) throw new Error('Expected incomplete custom basket card.')
    expect(customCard).toHaveClass('needs-attention')
    expect(within(customCard).getByText('Needs completion')).toBeInTheDocument()
  })

  it('shows Related pathway cards with their own Primary Final Outcome', () => {
    if (!relatedPrimaryLabel) {
      throw new Error(
        'Expected the Related pathway to have a Primary Final Outcome.',
      )
    }
    renderJourney(`/design/outcomes/${outcome.id}`)
    const relatedHeading = screen.getByRole('heading', {
      name: relatedPathway.pathway.name,
    })
    const relatedCard = relatedHeading.closest('article')
    if (!relatedCard) throw new Error('Expected Related pathway card.')
    expect(within(relatedCard).getByText('Related pathway')).toBeInTheDocument()
    expect(
      within(relatedCard).getByText(relatedPrimaryLabel),
    ).toBeInTheDocument()
    expect(
      within(relatedCard).getByText('Can also reinforce this Final Outcome.'),
    ).toBeInTheDocument()
    expect(
      within(relatedCard).getByRole('link', { name: 'View pathway' }),
    ).toBeInTheDocument()
  })
})

describe('mandatory activities, configure return and review relationships', () => {
  const currentOutcomeLabel = outcome.shortLabel ?? outcome.statement
  const relatedPrimaryOutcome = getPrimaryFinalOutcomeForPathway(
    framework,
    relatedPathway.pathway.id,
  )
  if (!relatedPrimaryOutcome) {
    throw new Error('Expected the Related pathway Primary Final Outcome.')
  }
  const relatedPrimaryOutcomeLabel =
    relatedPrimaryOutcome.shortLabel ?? relatedPrimaryOutcome.statement

  it('shows Activity required and blocks Done configuring until every Intermediate Outcome has an activity', () => {
    const state = addPathway(
      initialProjectDesignState,
      outcome.id,
      primaryPathway,
      'primary',
    )
    renderJourney(
      `/design/pathways/${primaryPathway.pathway.id}/configure`,
      state,
    )
    expect(screen.getAllByText('Activity required').length).toBeGreaterThan(0)
    expect(
      screen.getAllByText(
        'Select at least one suggested activity or add a project-specific activity for this Intermediate Outcome.',
      ).length,
    ).toBeGreaterThan(0)
    fireEvent.click(
      screen.getByRole('button', { name: 'Done configuring this pathway' }),
    )
    expect(
      screen.getByRole('heading', { name: primaryPathway.pathway.name }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Add an activity for Intermediate Outcome 1 before completing this pathway.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Configure pathways' }),
    ).not.toBeInTheDocument()
  })

  it('includes a way to return from Configure to Choose without losing configuration', () => {
    const configuredState = confirm(
      addPathway(
        initialProjectDesignState,
        outcome.id,
        primaryPathway,
        'primary',
      ),
    )
    renderApplication('/design/configure', configuredState)
    expect(
      screen.getByRole('link', {
        name: 'Add or change outcomes and pathways',
      }),
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('link', {
        name: 'Add or change outcomes and pathways',
      }),
    )
    expect(
      screen.getByRole('heading', {
        name: 'What change is this project trying to achieve?',
      }),
    ).toBeInTheDocument()
    const basket = screen.getByRole('complementary', {
      name: 'Project summary',
    })
    expect(
      within(basket).getByText(primaryPathway.pathway.name),
    ).toBeInTheDocument()
    expect(within(basket).getByText(/Configured/)).toBeInTheDocument()
  })

  it('does not reset previous pathways when another Final Outcome is added', () => {
    const secondOutcome = framework.finalOutcomes.find(
      (candidate) =>
        candidate.id !== outcome.id &&
        getPrimaryPathwaysForFinalOutcome(framework, candidate.id).some(
          (summary) => summary.pathway.id !== primaryPathway.pathway.id,
        ),
    )
    if (!secondOutcome) throw new Error('Expected a second Final Outcome.')
    const secondPrimary = getPrimaryPathwaysForFinalOutcome(
      framework,
      secondOutcome.id,
    ).find((summary) => summary.pathway.id !== primaryPathway.pathway.id)
    if (!secondPrimary)
      throw new Error('Expected a distinct second Primary pathway.')

    let state = confirm(
      addPathway(
        initialProjectDesignState,
        outcome.id,
        primaryPathway,
        'primary',
      ),
    )
    state = addPathway(state, secondOutcome.id, secondPrimary, 'primary')
    expect(state.projectPathways[0]?.pathwayId).toBe(primaryPathway.pathway.id)
    expect(
      state.projectPathways[0]?.intermediateOutcomeConfigurations.every(
        (configuration) => configuration.projectSpecificActivities.length > 0,
      ),
    ).toBe(true)
    renderJourney('/design/configure', state)
    expect(screen.getByText(primaryPathway.pathway.name)).toBeInTheDocument()
    expect(screen.getByText('✓ Configured')).toBeInTheDocument()
    expect(screen.getByText(secondPrimary.pathway.name)).toBeInTheDocument()
    expect(screen.getByText('Needs configuration')).toBeInTheDocument()
  })

  it('selecting one suggested activity satisfies the activity requirement for that Intermediate Outcome', () => {
    const intermediateOutcome =
      primaryPathway.intermediateOutcomes.find(
        (candidate) =>
          getSuggestedActivitiesForIntermediateOutcome(framework, candidate.id)
            .length > 0,
      ) ?? primaryPathway.intermediateOutcomes[0]
    if (!intermediateOutcome)
      throw new Error('Expected an Intermediate Outcome.')
    const activity = getSuggestedActivitiesForIntermediateOutcome(
      framework,
      intermediateOutcome.id,
    )[0]
    if (!activity) throw new Error('Expected a suggested activity.')
    const state = addPathway(
      initialProjectDesignState,
      outcome.id,
      primaryPathway,
      'primary',
    )
    renderJourney(
      `/design/pathways/${primaryPathway.pathway.id}/configure`,
      state,
    )
    const stepHeading = screen.getByRole('heading', {
      name: intermediateOutcome.statement,
    })
    fireEvent.click(stepHeading.closest('summary')!)
    fireEvent.click(screen.getByLabelText(activity.text))
    const card = stepHeading.closest('details')
    if (!card) throw new Error('Expected Intermediate Outcome card.')
    expect(
      within(card).queryByText('Activity required'),
    ).not.toBeInTheDocument()
    expect(within(card).getByText(/1 activit/)).toBeInTheDocument()
  })

  it('shows the related pathway under the selected Final Outcome in the basket', () => {
    if (!relatedPrimaryOutcome) {
      throw new Error(
        'Expected the Related pathway to have a Primary Final Outcome.',
      )
    }
    let state = addPathway(
      initialProjectDesignState,
      outcome.id,
      primaryPathway,
      'primary',
    )
    state = addPathway(state, outcome.id, relatedPathway, 'related')
    renderApplication(`/design/outcomes/${outcome.id}`, state)
    const basket = screen.getByRole('complementary', {
      name: 'Project summary',
    })
    const cards = within(basket).getAllByRole('listitem')
    const outcomeCards = cards.filter((card) =>
      card.classList.contains('basket-outcome-card'),
    )
    expect(outcomeCards).toHaveLength(2)
    expect(state.projectPathways).toHaveLength(2)
  })

  it('shows Also used elsewhere when one pathway is referenced by several Final Outcome cards', () => {
    if (!relatedPrimaryOutcome) {
      throw new Error(
        'Expected the Related pathway to have a Primary Final Outcome.',
      )
    }
    let state = addPathway(
      initialProjectDesignState,
      relatedPrimaryOutcome.id,
      relatedPathway,
      'primary',
    )
    state = addPathway(state, outcome.id, relatedPathway, 'related')
    state = addPathway(state, outcome.id, primaryPathway, 'primary')
    expect(
      state.projectPathways.filter(
        (pathway) => pathway.pathwayId === relatedPathway.pathway.id,
      ),
    ).toHaveLength(1)
    renderApplication(`/design/outcomes/${outcome.id}`, state)
    const basket = screen.getByRole('complementary', {
      name: 'Project summary',
    })
    expect(
      within(basket).getAllByText(relatedPathway.pathway.name).length,
    ).toBeGreaterThan(1)
    expect(
      within(basket).getAllByText('Also used elsewhere in this project').length,
    ).toBeGreaterThan(0)
    expect(
      within(basket).queryByText(/Shared pathway/i),
    ).not.toBeInTheDocument()
    expect(state.projectPathways).toHaveLength(2)
  })

  it('shows an auto-expanded pathway once on Configure with both relationships', () => {
    let state = addPathway(
      initialProjectDesignState,
      outcome.id,
      primaryPathway,
      'primary',
    )
    state = addPathway(state, outcome.id, relatedPathway, 'related')
    renderJourney('/design/configure', state)

    const pathwayHeadings = screen.getAllByRole('heading', {
      name: relatedPathway.pathway.name,
    })
    expect(pathwayHeadings).toHaveLength(1)
    const pathwayCard = pathwayHeadings[0]?.closest('article')
    if (!pathwayCard) throw new Error('Expected Configure pathway card.')
    expect(within(pathwayCard).getByText('Contributes to')).toBeInTheDocument()
    expect(within(pathwayCard).getByText('Primary')).toBeInTheDocument()
    expect(within(pathwayCard).getByText('Related')).toBeInTheDocument()
    expect(
      within(pathwayCard).getByText(currentOutcomeLabel),
    ).toBeInTheDocument()
    expect(
      within(pathwayCard).getByText(relatedPrimaryOutcomeLabel),
    ).toBeInTheDocument()
  })

  it('shows the auto-added Primary and originating Related relationships in Review', () => {
    if (!relatedPrimaryOutcome || relatedPrimaryOutcome.id === outcome.id) {
      throw new Error('Expected a distinct Related Primary Final Outcome.')
    }
    let state = addPathway(
      initialProjectDesignState,
      outcome.id,
      primaryPathway,
      'primary',
    )
    state = addPathway(state, outcome.id, relatedPathway, 'related')
    state = confirm(state)
    renderJourney('/design/review', state)
    const finalOutcomesSection = screen
      .getByRole('heading', { name: 'Standard Final Outcomes' })
      .closest('section')
    if (!finalOutcomesSection) {
      throw new Error('Expected Review Final Outcomes section.')
    }
    expect(
      within(finalOutcomesSection).getByRole('heading', {
        level: 3,
        name: currentOutcomeLabel,
      }),
    ).toBeInTheDocument()
    expect(
      within(finalOutcomesSection).getByRole('heading', {
        level: 3,
        name:
          relatedPrimaryOutcome.shortLabel ?? relatedPrimaryOutcome.statement,
      }),
    ).toBeInTheDocument()
    const relatedHeadings = screen.getAllByRole('heading', {
      name: relatedPathway.pathway.name,
    })
    expect(relatedHeadings).toHaveLength(1)
    const relatedCard = relatedHeadings[0]?.closest('article')
    if (!relatedCard) throw new Error('Expected related pathway review card.')
    expect(within(relatedCard).getByText('Contributes to')).toBeInTheDocument()
    expect(
      within(relatedCard).getByText(
        relatedPrimaryOutcome.shortLabel ?? relatedPrimaryOutcome.statement,
      ),
    ).toBeInTheDocument()
    expect(
      within(relatedCard).getByText(currentOutcomeLabel),
    ).toBeInTheDocument()
    expect(within(relatedCard).getByText('Primary')).toBeInTheDocument()
    expect(within(relatedCard).getByText('Related')).toBeInTheDocument()
    expect(
      within(relatedCard).queryByText('Primary Final Outcome'),
    ).not.toBeInTheDocument()
    expect(
      within(relatedCard).queryByText('Project relationships'),
    ).not.toBeInTheDocument()
    expect(
      within(relatedCard).getByText('Intermediate Outcome chain'),
    ).toBeInTheDocument()
  })
})

describe('basket Final Outcome orientation', () => {
  const basketOutcome = outcome
  const basketPrimaryPathway = primaryPathway
  if (!basketOutcome || !basketPrimaryPathway) {
    throw new Error('Expected the primary basket relationship test data.')
  }
  const secondOutcome = framework.finalOutcomes.find(
    (candidate) =>
      candidate.id !== basketOutcome.id &&
      getPrimaryPathwaysForFinalOutcome(framework, candidate.id).some(
        (summary) => summary.pathway.id !== basketPrimaryPathway.pathway.id,
      ),
  )
  if (!secondOutcome) throw new Error('Expected a second Final Outcome.')
  const secondPrimaryPathway = getPrimaryPathwaysForFinalOutcome(
    framework,
    secondOutcome.id,
  ).find((summary) => summary.pathway.id !== basketPrimaryPathway.pathway.id)
  if (!secondPrimaryPathway) {
    throw new Error('Expected a distinct second Primary pathway.')
  }
  const basketSecondOutcome = secondOutcome
  const basketSecondPrimaryPathway = secondPrimaryPathway
  const firstOutcomeLabel = basketOutcome.shortLabel ?? basketOutcome.statement
  const secondOutcomeLabel =
    basketSecondOutcome.shortLabel ?? basketSecondOutcome.statement

  function twoOutcomeState() {
    let state = addPathway(
      initialProjectDesignState,
      basketOutcome.id,
      basketPrimaryPathway,
      'primary',
    )
    state = addPathway(
      state,
      basketSecondOutcome.id,
      basketSecondPrimaryPathway,
      'primary',
    )
    return state
  }

  it('shows a prominent count, compact overview and two numbered outcome cards', () => {
    const state = twoOutcomeState()
    renderApplication(`/design/outcomes/${basketOutcome.id}`, state)
    const basket = screen.getByRole('complementary', {
      name: 'Project summary',
    })

    expect(
      within(basket).getByRole('heading', {
        level: 2,
        name: '2 Final Outcomes selected',
      }),
    ).toBeInTheDocument()
    expect(within(basket).getByLabelText('Selection counts')).toHaveTextContent(
      '2 Final Outcomes · 2 unique pathways',
    )

    const overview = within(basket).getByRole('navigation', {
      name: 'Selected Final Outcome overview',
    })
    expect(
      within(overview).getByRole('link', { name: firstOutcomeLabel }),
    ).toHaveAttribute('href', `#basket-outcome-${basketOutcome.id}`)
    expect(
      within(overview).getByRole('link', { name: secondOutcomeLabel }),
    ).toHaveAttribute('href', `#basket-outcome-${basketSecondOutcome.id}`)

    const cards = basket.querySelectorAll<HTMLElement>('.basket-outcome-card')
    expect(cards).toHaveLength(2)
    const firstCard = cards[0]!
    const secondCard = cards[1]!
    expect(within(firstCard).getByText('Outcome 1 of 2')).toBeInTheDocument()
    expect(within(secondCard).getByText('Outcome 2 of 2')).toBeInTheDocument()
    expect(
      within(firstCard).getByRole('heading', {
        level: 3,
        name: firstOutcomeLabel,
      }),
    ).toBeInTheDocument()
    expect(
      within(secondCard).getByRole('heading', {
        level: 3,
        name: secondOutcomeLabel,
      }),
    ).toBeInTheDocument()
    expect(
      within(firstCard).getByRole('heading', {
        level: 4,
        name: 'Primary pathways',
      }),
    ).toBeInTheDocument()
    expect(
      within(firstCard).getByText(basketPrimaryPathway.pathway.name),
    ).toBeInTheDocument()
    expect(
      within(secondCard).getByText(basketSecondPrimaryPathway.pathway.name),
    ).toBeInTheDocument()
    expect(
      within(firstCard).queryByText(basketSecondPrimaryPathway.pathway.name),
    ).not.toBeInTheDocument()
    expect(
      firstCard.querySelector('.basket-outcome-card-header'),
    ).not.toBeNull()
    expect(
      firstCard.querySelector('.basket-outcome-card-content'),
    ).not.toBeNull()
  })

  it('renumbers the remaining card and updates the count after removal', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderApplication(`/design/outcomes/${basketOutcome.id}`, twoOutcomeState())
    const basket = screen.getByRole('complementary', {
      name: 'Project summary',
    })

    fireEvent.click(
      within(basket).getByRole('button', {
        name: `Remove ${secondOutcomeLabel}`,
      }),
    )

    expect(confirmSpy).toHaveBeenCalledOnce()
    expect(
      within(basket).getByRole('heading', {
        level: 2,
        name: '1 Final Outcome selected',
      }),
    ).toBeInTheDocument()
    expect(basket.querySelectorAll('.basket-outcome-card')).toHaveLength(1)
    expect(within(basket).getByText('Outcome 1 of 1')).toBeInTheDocument()
    expect(within(basket).queryByText('Outcome 2 of 2')).not.toBeInTheDocument()
    expect(
      within(basket).queryByRole('navigation', {
        name: 'Selected Final Outcome overview',
      }),
    ).not.toBeInTheDocument()
    confirmSpy.mockRestore()
  })
})

describe('persistent project title and bulk activity selection', () => {
  function titledState(state = initialProjectDesignState): ProjectDesignState {
    return projectDesignReducer(state, {
      type: 'updateMetadata',
      payload: {
        title: 'Seed systems project',
        country: 'Kenya',
        donor: 'FCDO',
        fundingReference: 'REF-001',
        projectManager: 'Amina Hassan',
        plannedStartDate: '2027-03',
        plannedEndDate: '2027-11',
        description: 'A project to strengthen local seed markets.',
      },
    })
  }

  function intermediateOutcomeWithActivities() {
    if (!primaryPathway) {
      throw new Error('Expected a Primary pathway.')
    }
    const intermediateOutcome =
      primaryPathway.intermediateOutcomes.find(
        (candidate) =>
          getSuggestedActivitiesForIntermediateOutcome(framework, candidate.id)
            .length > 1,
      ) ??
      primaryPathway.intermediateOutcomes.find(
        (candidate) =>
          getSuggestedActivitiesForIntermediateOutcome(framework, candidate.id)
            .length > 0,
      )
    if (!intermediateOutcome) {
      throw new Error('Expected an Intermediate Outcome with suggested activities.')
    }
    const activities = getSuggestedActivitiesForIntermediateOutcome(
      framework,
      intermediateOutcome.id,
    )
    return { intermediateOutcome, activities }
  }

  function openActivityCard(statement: string) {
    const heading = screen.getByRole('heading', { name: statement })
    const summary = heading.closest('summary')
    if (!summary) throw new Error('Expected Intermediate Outcome summary.')
    fireEvent.click(summary)
    const card = heading.closest('details')
    if (!card) throw new Error('Expected Intermediate Outcome card.')
    return { heading, card }
  }

  it('keeps the project title visible after continuing from project details', () => {
    renderApplication('/design/details', titledState())
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(
      screen.getByRole('heading', {
        name: 'What change is this project trying to achieve?',
      }),
    ).toBeInTheDocument()
    const basket = screen.getByRole('complementary', {
      name: 'Project summary',
    })
    expect(basket.querySelector('.basket-project-title')).toHaveTextContent(
      'Seed systems project',
    )
  })

  it('keeps the project title visible during pathway configuration', () => {
    const state = addPathway(titledState(), outcome.id, primaryPathway, 'primary')
    renderApplication(
      `/design/pathways/${primaryPathway.pathway.id}/configure`,
      state,
    )
    expect(
      screen.getByRole('heading', { name: primaryPathway.pathway.name }),
    ).toBeInTheDocument()
    const basket = screen.getByRole('complementary', {
      name: 'Project summary',
    })
    expect(basket.querySelector('.basket-project-title')).toHaveTextContent(
      'Seed systems project',
    )
  })

  it('keeps the project title visible on the Theory of Change page', () => {
    renderApplication('/design/theory-of-change', titledState())
    expect(document.querySelector('.project-save-title')).toHaveTextContent(
      'Seed systems project',
    )
  })

  it('shows Include all activities on the pathway configuration page without expanding a step', () => {
    const { intermediateOutcome, activities } =
      intermediateOutcomeWithActivities()
    if (activities.length < 2) {
      throw new Error('Expected at least two suggested activities.')
    }
    const state = addPathway(
      titledState(),
      outcome.id,
      primaryPathway,
      'primary',
    )
    renderJourney(
      `/design/pathways/${primaryPathway.pathway.id}/configure`,
      state,
    )
    const heading = screen.getByRole('heading', {
      name: intermediateOutcome.statement,
    })
    const card = heading.closest('details')
    if (!card) throw new Error('Expected Intermediate Outcome card.')
    expect(card).not.toHaveAttribute('open')
    expect(
      within(card).getByRole('checkbox', { name: 'Include all activities' }),
    ).toBeInTheDocument()
  })

  it('selects and clears all suggested activities from Include all activities', () => {
    const { intermediateOutcome, activities } =
      intermediateOutcomeWithActivities()
    if (activities.length < 2) {
      throw new Error('Expected at least two suggested activities.')
    }
    const state = addPathway(
      titledState(),
      outcome.id,
      primaryPathway,
      'primary',
    )
    renderJourney(
      `/design/pathways/${primaryPathway.pathway.id}/configure`,
      state,
    )
    const { card } = openActivityCard(intermediateOutcome.statement)
    const includeAll = within(card).getByRole('checkbox', {
      name: 'Include all activities',
    })
    fireEvent.click(includeAll)
    for (const activity of activities) {
      expect(within(card).getByLabelText(activity.text)).toBeChecked()
    }
    expect(includeAll).toBeChecked()
    fireEvent.click(includeAll)
    for (const activity of activities) {
      expect(within(card).getByLabelText(activity.text)).not.toBeChecked()
    }
    expect(includeAll).not.toBeChecked()
  })

  it('checks Include all activities after every suggested activity is selected manually', () => {
    const { intermediateOutcome, activities } =
      intermediateOutcomeWithActivities()
    if (activities.length < 2) {
      throw new Error('Expected at least two suggested activities.')
    }
    const state = addPathway(
      titledState(),
      outcome.id,
      primaryPathway,
      'primary',
    )
    renderJourney(
      `/design/pathways/${primaryPathway.pathway.id}/configure`,
      state,
    )
    const { card } = openActivityCard(intermediateOutcome.statement)
    const includeAll = within(card).getByRole('checkbox', {
      name: 'Include all activities',
    })
    expect(includeAll).not.toBeChecked()
    fireEvent.click(within(card).getByLabelText(activities[0]!.text))
    expect(includeAll).not.toBeChecked()
    expect((includeAll as HTMLInputElement).indeterminate).toBe(true)
    for (const activity of activities.slice(1)) {
      fireEvent.click(within(card).getByLabelText(activity.text))
    }
    expect(includeAll).toBeChecked()
    expect((includeAll as HTMLInputElement).indeterminate).toBe(false)
  })

  it('preserves custom activities when Include all activities is used', () => {
    const { intermediateOutcome, activities } =
      intermediateOutcomeWithActivities()
    let state = addPathway(
      titledState(),
      outcome.id,
      primaryPathway,
      'primary',
    )
    state = projectDesignReducer(state, {
      type: 'addProjectSpecificActivity',
      pathwayId: primaryPathway.pathway.id,
      intermediateOutcomeId: intermediateOutcome.id,
      activity: completeCustomActivity,
    })
    renderJourney(
      `/design/pathways/${primaryPathway.pathway.id}/configure`,
      state,
    )
    const { card } = openActivityCard(intermediateOutcome.statement)
    fireEvent.click(
      within(card).getByRole('checkbox', { name: 'Include all activities' }),
    )
    expect(within(card).getByText(completeCustomActivity.wording)).toBeInTheDocument()
    fireEvent.click(
      within(card).getByRole('checkbox', { name: 'Include all activities' }),
    )
    expect(within(card).getByText(completeCustomActivity.wording)).toBeInTheDocument()
    for (const activity of activities) {
      expect(within(card).getByLabelText(activity.text)).not.toBeChecked()
    }
  })
})
