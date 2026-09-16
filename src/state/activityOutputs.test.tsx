import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PlannedOutputEditor } from '../components/PlannedOutputEditor'
import {
  CURRENT_FRAMEWORK,
  HISTORIC_FRAMEWORK,
  getFrameworkByVersion,
} from '../data/frameworkRegistry'
import {
  loadPersistedProject,
  serializeProject,
} from '../persistence/projectSerialization'
import { getPathwayIntermediateOutcomeSeeds } from '../services/frameworkService'
import type { SuggestedActivity } from '../types/framework'
import type {
  ActivityOutputPlanning,
  ProjectDesignState,
} from '../types/project'
import {
  OUTPUT_UNIT_OPTIONS,
  createActivityOutputPlanning,
  createCustomActivityOutputPlanning,
  displayedOutputText,
  generateOutputText,
  isOutputConfigured,
  recountSelfHelpGroupOutputs,
} from './activityOutputs'
import {
  initialProjectDesignState,
  projectDesignReducer,
} from './projectDesign'

const outputActivity: SuggestedActivity = {
  id: 'ACT_OUTPUT',
  intermediateOutcomeId: 'IO_1',
  text: 'Train people on keyhole garden construction',
  sortOrder: 1,
  active: true,
  outputPhrase: 'trained in keyhole garden construction',
}

function OutputHarness({
  initial,
  activity = outputActivity,
  plannedSelfHelpGroupCount = null,
}: {
  initial: ActivityOutputPlanning
  activity?: Pick<SuggestedActivity, 'outputPhrase' | 'text'>
  plannedSelfHelpGroupCount?: number | null
}) {
  const [planning, setPlanning] = useState(initial)
  return (
    <>
      <PlannedOutputEditor
        planning={planning}
        activity={activity}
        plannedSelfHelpGroupCount={plannedSelfHelpGroupCount}
        onChange={setPlanning}
      />
      <output data-testid="planning-state">
        {JSON.stringify(planning)}
      </output>
    </>
  )
}

function planning(
  overrides: Partial<ActivityOutputPlanning> = {},
): ActivityOutputPlanning {
  return {
    ...createActivityOutputPlanning(),
    ...overrides,
  }
}

function currentFrameworkState(): {
  state: ProjectDesignState
  pathwayId: string
  intermediateOutcomeId: string
} {
  const pathway = CURRENT_FRAMEWORK.pathways.find((item) => item.active)
  if (!pathway) throw new Error('Expected an active pathway.')
  let state = projectDesignReducer(initialProjectDesignState, {
    type: 'selectFinalOutcome',
    finalOutcomeId: pathway.primaryFinalOutcomeId,
  })
  state = projectDesignReducer(state, {
    type: 'addPathway',
    finalOutcomeId: pathway.primaryFinalOutcomeId,
    pathwayId: pathway.id,
    relationshipType: 'primary',
    frameworkPrimaryFinalOutcomeId: pathway.primaryFinalOutcomeId,
    intermediateOutcomes: getPathwayIntermediateOutcomeSeeds(
      CURRENT_FRAMEWORK,
      pathway.id,
    ),
  })
  const intermediateOutcomeId =
    state.projectPathways[0]?.intermediateOutcomeConfigurations[0]
      ?.frameworkIntermediateOutcomeId
  if (!intermediateOutcomeId) {
    throw new Error('Expected a seeded Intermediate Outcome.')
  }
  return { state, pathwayId: pathway.id, intermediateOutcomeId }
}

describe('planned output units and generated wording', () => {
  it('starts with the unit unselected', () => {
    expect(createActivityOutputPlanning().outputUnitSelection).toBeNull()
    render(<OutputHarness initial={planning()} />)
    expect(screen.getByRole('combobox', { name: 'Output unit' })).toHaveValue(
      '',
    )
  })

  it('keeps No unit distinct from an unconfigured unit', () => {
    const unconfigured = planning({ plannedQuantity: 4 })
    const noUnit = planning({
      plannedQuantity: 4,
      outputUnitSelection: 'no-unit',
    })
    expect(unconfigured.outputUnitSelection).toBeNull()
    expect(noUnit.outputUnitSelection).toBe('no-unit')
    expect(generateOutputText(outputActivity.outputPhrase, unconfigured)).toBeNull()
    expect(generateOutputText(outputActivity.outputPhrase, noUnit)).toBe(
      '4 trained in keyhole garden construction',
    )
    expect(isOutputConfigured(noUnit, outputActivity.outputPhrase)).toBe(true)
  })

  it('renders every controlled dropdown value', () => {
    render(<OutputHarness initial={planning()} />)
    const select = screen.getByRole('combobox', { name: 'Output unit' })
    for (const option of OUTPUT_UNIT_OPTIONS) {
      expect(
        within(select).getByRole('option', { name: option.label }),
      ).toHaveValue(option.value)
    }
  })

  it('persists Other custom unit text in project-owned planning', () => {
    render(<OutputHarness initial={planning()} />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Output unit' }), {
      target: { value: 'other' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Other output unit' }), {
      target: { value: 'producer networks' },
    })
    expect(screen.getByTestId('planning-state')).toHaveTextContent(
      '"outputUnitSelection":"other"',
    )
    expect(screen.getByTestId('planning-state')).toHaveTextContent(
      '"customOutputUnit":"producer networks"',
    )
  })

  it('generates quantity, selected unit and output phrase', () => {
    const configured = planning({
      plannedQuantity: 50,
      outputUnitSelection: 'self-help-groups',
    })
    expect(generateOutputText(outputActivity.outputPhrase, configured)).toBe(
      '50 Self Help Groups trained in keyhole garden construction',
    )
  })

  it('omits the unit when No unit is explicitly selected', () => {
    expect(
      generateOutputText(
        'market linkage events facilitated',
        planning({
          plannedQuantity: 4,
          outputUnitSelection: 'no-unit',
        }),
      ),
    ).toBe('4 market linkage events facilitated')
  })

  it('does not generate prohibited outcome wording from a framework phrase', () => {
    expect(
      generateOutputText(
        'successfully adopting keyhole gardens',
        planning({
          plannedQuantity: 50,
          outputUnitSelection: 'self-help-groups',
        }),
      ),
    ).toBeNull()
  })
})

describe('Self Help Group total shortcut', () => {
  it('appears only after Self Help Groups is selected and a total exists', () => {
    render(
      <OutputHarness
        initial={planning()}
        plannedSelfHelpGroupCount={50}
      />,
    )
    expect(
      screen.queryByRole('checkbox', {
        name: 'Use all 50 Self Help Groups',
      }),
    ).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox', { name: 'Output unit' }), {
      target: { value: 'self-help-groups' },
    })
    expect(
      screen.getByRole('checkbox', {
        name: 'Use all 50 Self Help Groups',
      }),
    ).toBeInTheDocument()
  })

  it('uses the actual project total when selected', () => {
    render(
      <OutputHarness
        initial={planning({
          outputUnitSelection: 'self-help-groups',
        })}
        plannedSelfHelpGroupCount={50}
      />,
    )
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Use all 50 Self Help Groups',
      }),
    )
    expect(screen.getByTestId('planning-state')).toHaveTextContent(
      '"plannedQuantity":50',
    )
    expect(screen.getByTestId('planning-state')).toHaveTextContent(
      '"useProjectSelfHelpGroupTotal":true',
    )
  })

  it('follows project total changes only for use-all activities', () => {
    const [linked, manual] = recountSelfHelpGroupOutputs(
      [
        {
          frameworkActivityId: 'ACT_LINKED',
          projectNotes: '',
          ...planning({
            plannedQuantity: 50,
            outputUnitSelection: 'self-help-groups',
            useProjectSelfHelpGroupTotal: true,
          }),
        },
        {
          frameworkActivityId: 'ACT_MANUAL',
          projectNotes: '',
          ...planning({
            plannedQuantity: 12,
            outputUnitSelection: 'self-help-groups',
            useProjectSelfHelpGroupTotal: false,
          }),
        },
      ],
      80,
    )
    expect(linked?.plannedQuantity).toBe(80)
    expect(manual?.plannedQuantity).toBe(12)
  })
})

describe('planned output wording', () => {
  it('persists wording overrides and reset restores generated wording', () => {
    render(
      <OutputHarness
        initial={planning({
          plannedQuantity: 2,
          outputUnitSelection: 'demonstration-plots',
          outputTextOverride: 'Two farmer-managed plots established',
        })}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit wording' }))
    expect(screen.getByLabelText('Output wording')).toHaveValue(
      'Two farmer-managed plots established',
    )
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Reset to generated wording',
      }),
    )
    expect(screen.getByTestId('planning-state')).toHaveTextContent(
      '"outputTextOverride":null',
    )
    expect(
      screen.getByText(
        'Planned output: 2 demonstration plots trained in keyhole garden construction',
      ),
    ).toBeInTheDocument()
  })

  it('handles a null outputPhrase safely with user wording', () => {
    render(
      <OutputHarness
        initial={planning({
          outputUnitSelection: 'no-unit',
        })}
        activity={{ text: 'Ambiguous activity', outputPhrase: null }}
      />,
    )
    expect(
      screen.getByText(/no usable framework output phrase/i),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Output wording')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Output wording'), {
      target: { value: 'Partnership planning support delivered' },
    })
    expect(screen.getByTestId('planning-state')).toHaveTextContent(
      'Partnership planning support delivered',
    )
  })

  it('supports custom activities without generating a phrase', () => {
    const custom = {
      ...createCustomActivityOutputPlanning(6, 'people'),
      outputTextOverride: '6 people coached as local facilitators',
    }
    expect(displayedOutputText(custom, null)).toBe(
      '6 people coached as local facilitators',
    )
    expect(isOutputConfigured(custom, null)).toBe(true)
  })
})

describe('planned output persistence and framework versions', () => {
  it('loads historical projects without a Self Help Group total', () => {
    const historic = serializeProject({
      id: 'PROJECT_1',
      status: 'Draft',
      design: {
        ...initialProjectDesignState,
        metadata: {
          ...initialProjectDesignState.metadata,
          title: 'Historic project',
        },
      },
      framework: HISTORIC_FRAMEWORK,
    })
    delete historic.design.metadata.plannedSelfHelpGroupCount
    const loaded = loadPersistedProject(historic, CURRENT_FRAMEWORK)
    expect(loaded.design.metadata.plannedSelfHelpGroupCount).toBeNull()
  })

  it('persists Self Help Group totals and standard activity output overrides', () => {
    const seeded = currentFrameworkState()
    const frameworkActivity =
      CURRENT_FRAMEWORK.suggestedActivities.find(
        (activity) =>
          activity.intermediateOutcomeId === seeded.intermediateOutcomeId,
      )
    if (!frameworkActivity) {
      throw new Error('Expected a suggested activity.')
    }
    let state = projectDesignReducer(seeded.state, {
      type: 'updateMetadata',
      payload: {
        title: 'Output project',
        plannedSelfHelpGroupCount: 50,
      },
    })
    state = projectDesignReducer(state, {
      type: 'setStandardActivity',
      pathwayId: seeded.pathwayId,
      intermediateOutcomeId: seeded.intermediateOutcomeId,
      frameworkActivityId: frameworkActivity.id,
      selected: true,
      output: planning({
        plannedQuantity: 50,
        outputUnitSelection: 'self-help-groups',
        useProjectSelfHelpGroupTotal: true,
        outputTextOverride: '50 Self Help Groups received market support',
      }),
    })

    const document = serializeProject({
      id: 'PROJECT_1',
      status: 'Draft',
      design: state,
      framework: CURRENT_FRAMEWORK,
    })
    const loaded = loadPersistedProject(document, CURRENT_FRAMEWORK)
    const activity =
      loaded.design.projectPathways[0]?.intermediateOutcomeConfigurations[0]
        ?.standardActivities[0]

    expect(document.design.metadata.plannedSelfHelpGroupCount).toBe(50)
    expect(loaded.design.metadata.plannedSelfHelpGroupCount).toBe(50)
    expect(activity).toMatchObject({
      outputUnitSelection: 'self-help-groups',
      useProjectSelfHelpGroupTotal: true,
      outputTextOverride:
        '50 Self Help Groups received market support',
    })
  })

  it('persists custom activity quantity, unit and wording', () => {
    const seeded = currentFrameworkState()
    let state = projectDesignReducer(seeded.state, {
      type: 'updateMetadata',
      payload: { title: 'Custom output project' },
    })
    state = projectDesignReducer(state, {
      type: 'addProjectSpecificActivity',
      pathwayId: seeded.pathwayId,
      intermediateOutcomeId: seeded.intermediateOutcomeId,
      activity: {
        id: 'custom-act',
        wording: 'Host farmer clinics',
        projectDetails: 'Monthly',
        ...createCustomActivityOutputPlanning(4, 'events'),
        outputTextOverride: '4 farmer clinics hosted',
      },
    })
    const document = serializeProject({
      id: 'PROJECT_1',
      status: 'Draft',
      design: state,
      framework: CURRENT_FRAMEWORK,
    })
    const loaded = loadPersistedProject(document, CURRENT_FRAMEWORK)
    expect(
      loaded.design.projectPathways[0]?.intermediateOutcomeConfigurations[0]
        ?.projectSpecificActivities[0],
    ).toMatchObject({
      id: 'custom-act',
      plannedQuantity: 4,
      outputUnitSelection: 'events',
      outputTextOverride: '4 farmer clinics hosted',
    })
  })

  it('keeps existing framework IDs and protected activity fields unchanged', () => {
    const collections = [
      'thematicAreas',
      'impacts',
      'finalOutcomes',
      'pathways',
      'intermediateOutcomes',
      'indicators',
      'suggestedActivities',
    ] as const
    for (const collection of collections) {
      expect(CURRENT_FRAMEWORK[collection].map((item) => item.id)).toEqual(
        HISTORIC_FRAMEWORK[collection].map((item) => item.id),
      )
    }
    expect(
      CURRENT_FRAMEWORK.suggestedActivities.map((activity) => ({
        text: activity.text,
        intermediateOutcomeId: activity.intermediateOutcomeId,
        sortOrder: activity.sortOrder,
      })),
    ).toEqual(
      HISTORIC_FRAMEWORK.suggestedActivities.map((activity) => ({
        text: activity.text,
        intermediateOutcomeId: activity.intermediateOutcomeId,
        sortOrder: activity.sortOrder,
      })),
    )
  })

  it('retains and resolves the exact historical framework version', () => {
    const historic = serializeProject({
      id: 'PROJECT_1',
      status: 'Draft',
      design: {
        ...initialProjectDesignState,
        metadata: {
          ...initialProjectDesignState.metadata,
          title: 'Historic framework project',
        },
      },
      framework: HISTORIC_FRAMEWORK,
    })
    const loaded = loadPersistedProject(historic, CURRENT_FRAMEWORK)
    expect(loaded.document.frameworkVersion).toBe(
      HISTORIC_FRAMEWORK.frameworkVersion,
    )
    expect(getFrameworkByVersion(historic.frameworkVersion)).toBe(
      HISTORIC_FRAMEWORK,
    )
  })

  it('preserves all five deliberately null output phrases', () => {
    expect(
      CURRENT_FRAMEWORK.suggestedActivities.filter(
        (activity) => activity.outputPhrase === null,
      ),
    ).toHaveLength(5)
  })
})
