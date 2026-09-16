import { describe, expect, it } from 'vitest'
import {
  CURRENT_FRAMEWORK,
  HISTORIC_FRAMEWORK,
} from '../data/frameworkRegistry'
import { serializeProject } from '../persistence/projectSerialization'
import type { ProjectRecord } from '../persistence/types'
import { isGeneratedOutputPhraseAllowed } from '../state/activityOutputs'
import type {
  ProjectDesignState,
  ProjectIntermediateOutcomeConfiguration,
} from '../types/project'
import {
  buildProjectExportModel,
  buildProjectExportModelFromRecord,
  ProjectExportError,
} from './buildProjectExportModel'
import { projectExportBaseName } from './download'
import {
  buildProjectDesignWorkbook,
  renderProjectDesignWorkbook,
} from './excelExport'

function exportRecord(): {
  record: ProjectRecord
  activityNames: {
    selfHelpGroups: string
    noUnitOverride: string
    unconfigured: string
    customOther: string
  }
} {
  const framework = CURRENT_FRAMEWORK
  const pathway = framework.pathways.find((candidate) => {
    const links = framework.finalOutcomePathwayLinks.filter(
      (link) =>
        link.pathwayId === candidate.id && link.appSelectable,
    )
    const outcomes = framework.intermediateOutcomes.filter(
      (outcome) => outcome.pathwayId === candidate.id,
    )
    return (
      links.some(
        (link) => link.pathwayRelationshipType === 'primary',
      ) &&
      links.some(
        (link) => link.pathwayRelationshipType === 'related',
      ) &&
      outcomes.length >= 2 &&
      outcomes.some(
        (outcome) =>
          outcome.additionalIndicatorIds.length > 0 &&
          framework.suggestedActivities.filter(
            (activity) =>
              activity.intermediateOutcomeId === outcome.id &&
              isGeneratedOutputPhraseAllowed(activity.outputPhrase),
          ).length >= 2,
      )
    )
  })
  if (!pathway) {
    throw new Error('Expected a pathway suitable for export tests.')
  }
  const primaryLink = framework.finalOutcomePathwayLinks.find(
    (link) =>
      link.pathwayId === pathway.id &&
      link.appSelectable &&
      link.pathwayRelationshipType === 'primary',
  )
  const relatedLink = framework.finalOutcomePathwayLinks.find(
    (link) =>
      link.pathwayId === pathway.id &&
      link.appSelectable &&
      link.pathwayRelationshipType === 'related',
  )
  if (!primaryLink || !relatedLink) {
    throw new Error('Expected Primary and Related pathway links.')
  }
  const outcomes = framework.intermediateOutcomes
    .filter((outcome) => outcome.pathwayId === pathway.id)
    .sort((left, right) => left.stepNumber - right.stepNumber)
  const configuredOutcome =
    outcomes.find(
      (outcome) =>
        outcome.additionalIndicatorIds.length > 0 &&
        framework.suggestedActivities.filter(
          (activity) =>
            activity.intermediateOutcomeId === outcome.id &&
            isGeneratedOutputPhraseAllowed(activity.outputPhrase),
        ).length >= 2,
    ) ?? outcomes[0]
  const otherOutcome = outcomes.find(
    (outcome) => outcome.id !== configuredOutcome?.id,
  )
  if (!configuredOutcome || !otherOutcome) {
    throw new Error('Expected two Intermediate Outcomes.')
  }
  const configuredActivities = framework.suggestedActivities.filter(
    (activity) =>
      activity.intermediateOutcomeId === configuredOutcome.id &&
      isGeneratedOutputPhraseAllowed(activity.outputPhrase),
  )
  const unconfiguredActivity = framework.suggestedActivities.find(
    (activity) => activity.intermediateOutcomeId === otherOutcome.id,
  )
  const primaryIndicatorId = configuredOutcome.primaryIndicatorIds[0]
  const additionalIndicatorId =
    configuredOutcome.additionalIndicatorIds[0]
  const otherPrimaryIndicatorId = otherOutcome.primaryIndicatorIds[0]
  if (
    !configuredActivities[0] ||
    !configuredActivities[1] ||
    !unconfiguredActivity ||
    !primaryIndicatorId ||
    !additionalIndicatorId ||
    !otherPrimaryIndicatorId
  ) {
    throw new Error('Expected complete framework export fixtures.')
  }

  const configurations: ProjectIntermediateOutcomeConfiguration[] = [
    {
      projectPathwayId: pathway.id,
      frameworkIntermediateOutcomeId: configuredOutcome.id,
      primaryIndicator: {
        frameworkIndicatorId: primaryIndicatorId,
        role: 'primary',
        mandatory: true,
      },
      additionalIndicators: [
        {
          frameworkIndicatorId: additionalIndicatorId,
          role: 'additional',
          mandatory: false,
        },
      ],
      projectSpecificIndicators: [
        {
          id: 'PROJECT_INDICATOR',
          wording: 'Project-specific quality measure',
          measurementNotes: 'Reviewed quarterly',
        },
      ],
      standardActivities: [
        {
          frameworkActivityId: configuredActivities[0].id,
          projectNotes: 'Delivered through field teams',
          plannedQuantity: 30,
          outputUnitSelection: 'self-help-groups',
          customOutputUnit: null,
          useProjectSelfHelpGroupTotal: true,
          outputTextOverride: null,
        },
        {
          frameworkActivityId: configuredActivities[1].id,
          projectNotes: '',
          plannedQuantity: 4,
          outputUnitSelection: 'no-unit',
          customOutputUnit: null,
          useProjectSelfHelpGroupTotal: false,
          outputTextOverride: 'Four reviewed delivery events completed',
        },
      ],
      projectSpecificActivities: [
        {
          id: 'PROJECT_ACTIVITY',
          wording: 'Coach producer networks',
          projectDetails: 'Locally designed coaching',
          plannedQuantity: 3,
          outputUnitSelection: 'other',
          customOutputUnit: 'farmer networks',
          useProjectSelfHelpGroupTotal: false,
          outputTextOverride: '3 farmer networks coached',
        },
      ],
      inputs: [
        {
          id: 'PROJECT_INPUT',
          inputCategoryId: 'training-facilitation',
          details: 'Facilitator time',
        },
      ],
      reviewed: true,
    },
    {
      projectPathwayId: pathway.id,
      frameworkIntermediateOutcomeId: otherOutcome.id,
      primaryIndicator: {
        frameworkIndicatorId: otherPrimaryIndicatorId,
        role: 'primary',
        mandatory: true,
      },
      additionalIndicators: [],
      projectSpecificIndicators: [],
      standardActivities: [
        {
          frameworkActivityId: unconfiguredActivity.id,
          projectNotes: '',
        },
      ],
      projectSpecificActivities: [],
      inputs: [],
      reviewed: true,
    },
  ]

  const impactId = framework.impacts[0]?.id
  if (!impactId) throw new Error('Expected an Impact Area.')
  const state: ProjectDesignState = {
    metadata: {
      title: 'Export Test Project',
      country: 'Uganda',
      donor: 'Example donor',
      fundingReference: 'FUND-42',
      projectManager: 'Project manager',
      plannedStartDate: '2027-03',
      plannedEndDate: '2029-02',
      description: 'Export test design',
      plannedSelfHelpGroupCount: 50,
    },
    selectedFinalOutcomeIds: [
      primaryLink.finalOutcomeId,
      relatedLink.finalOutcomeId,
    ],
    finalOutcomeSelectionSources: {
      [primaryLink.finalOutcomeId]: 'direct',
      [relatedLink.finalOutcomeId]: 'direct',
    },
    projectPathways: [
      {
        pathwayId: pathway.id,
        intermediateOutcomeConfigurations: configurations.reverse(),
      },
    ],
    outcomePathwayLinks: [
      {
        finalOutcomeId: primaryLink.finalOutcomeId,
        pathwayId: pathway.id,
        relationshipType: 'primary',
      },
      {
        finalOutcomeId: relatedLink.finalOutcomeId,
        pathwayId: pathway.id,
        relationshipType: 'related',
      },
    ],
    customInnovation: {
      id: 'CUSTOM_OUTCOME',
      isCustom: true,
      shortLabel: 'Custom resilience outcome',
      statement: 'Local systems provide inclusive resilience support',
      rationale: 'Project-specific result',
      impactAreaIds: [impactId],
      primaryIndicator: {
        id: 'CUSTOM_FO_INDICATOR',
        wording: 'Quality of local resilience support',
        measurementNotes: 'Annual review',
      },
      pathway: {
        id: 'CUSTOM_PATHWAY',
        isCustom: true,
        name: 'Custom resilience pathway',
        description: 'A project-owned pathway',
        rationale: 'Required in this context',
        intermediateOutcomes: [
          {
            id: 'CUSTOM_IO_2',
            isCustom: true,
            stepNumber: 2,
            statement: 'Partners coordinate resilience support',
            primaryIndicator: {
              id: 'CUSTOM_IO_2_PRIMARY',
              wording: 'Coordination quality',
              measurementNotes: '',
            },
            additionalIndicators: [],
            activities: [],
            inputs: [],
          },
          {
            id: 'CUSTOM_IO_1',
            isCustom: true,
            stepNumber: 1,
            statement: 'Partners receive coordination support',
            primaryIndicator: {
              id: 'CUSTOM_IO_1_PRIMARY',
              wording: 'Partners supported',
              measurementNotes: '',
            },
            additionalIndicators: [
              {
                id: 'CUSTOM_IO_ADDITIONAL',
                wording: 'Partner feedback',
                measurementNotes: '',
              },
            ],
            activities: [
              {
                id: 'CUSTOM_ACTIVITY',
                wording: 'Host coordination workshops',
                projectDetails: 'Quarterly',
                plannedQuantity: 2,
                outputUnitSelection: 'community-workshops',
                customOutputUnit: null,
                useProjectSelfHelpGroupTotal: false,
                outputTextOverride:
                  '2 Community workshops hosted with partners',
              },
            ],
            inputs: [
              {
                id: 'CUSTOM_INPUT',
                inputCategoryId: 'training-facilitation',
                details: 'Workshop facilitation',
              },
            ],
          },
        ],
      },
    },
    lastSavedAt: null,
  }
  const document = serializeProject({
    id: 'PROJECT_EXPORT',
    projectCode: 'UG/2027:Export',
    status: 'Draft',
    design: state,
    framework,
  })
  return {
    record: {
      project: document,
      etag: '"export"',
      createdAt: '2026-09-15T10:00:00.000Z',
      modifiedAt: '2026-09-16T11:00:00.000Z',
    },
    activityNames: {
      selfHelpGroups: configuredActivities[0].text,
      noUnitOverride: configuredActivities[1].text,
      unconfigured: unconfiguredActivity.text,
      customOther: 'Coach producer networks',
    },
  }
}

describe('saved project export model', () => {
  it('exports metadata, multiple outcomes and shared pathway relationships', () => {
    const { record } = exportRecord()
    const model = buildProjectExportModel(
      record,
      CURRENT_FRAMEWORK,
      new Date('2026-09-16T12:00:00.000Z'),
    )

    expect(model.metadata).toMatchObject({
      projectTitle: 'Export Test Project',
      projectCode: 'UG/2027:Export',
      country: 'Uganda',
      plannedStart: 'March 2027',
      plannedEnd: 'February 2029',
      plannedSelfHelpGroupCount: 50,
      frameworkVersion: CURRENT_FRAMEWORK.frameworkVersion,
      frameworkSchemaVersion: CURRENT_FRAMEWORK.schemaVersion,
      projectSchemaVersion: 1,
      modifiedAt: '2026-09-16T11:00:00.000Z',
      exportDate: '2026-09-16T12:00:00.000Z',
    })
    expect(model.summary.finalOutcomeCount).toBe(3)
    expect(model.summary.uniquePathwayCount).toBe(2)
    expect(
      model.resultsFramework.map((row) => row.pathwayRelationship),
    ).toContain('Primary')
    expect(
      model.resultsFramework.map((row) => row.pathwayRelationship),
    ).toContain('Related')
    const standardRows = model.resultsFramework.filter(
      (row) => row.frameworkSource === 'Standard framework',
    )
    expect(
      new Set(standardRows.map((row) => row.finalOutcome)).size,
    ).toBe(2)
    expect(
      standardRows
        .filter(
          (row) =>
            row.pathway === standardRows[0]?.pathway &&
            row.pathwayRelationship === 'Primary',
        )
        .map((row) => row.intermediateOutcomeStep),
    ).toEqual(
      [...new Set(
        standardRows
          .filter(
            (row) => row.pathwayRelationship === 'Primary',
          )
          .map((row) => row.intermediateOutcomeStep),
      )].sort((left, right) => left - right),
    )
  })

  it('exports indicators, activities, outputs and inputs without promoting outputs', () => {
    const { record, activityNames } = exportRecord()
    const model = buildProjectExportModelFromRecord(record)

    expect(
      model.indicators.some(
        (row) =>
          row.resultLevel === 'Final Outcome' &&
          row.indicatorType === 'Primary' &&
          row.requirement === 'Mandatory',
      ),
    ).toBe(true)
    expect(
      model.indicators.some(
        (row) => row.indicatorType === 'Additional',
      ),
    ).toBe(true)
    expect(
      model.indicators.some(
        (row) => row.indicatorType === 'Project-specific',
      ),
    ).toBe(true)

    const shgActivity = model.activitiesOutputs.find(
      (row) => row.activity === activityNames.selfHelpGroups,
    )
    expect(shgActivity).toMatchObject({
      activityType: 'Standard',
      plannedQuantity: 50,
      unit: 'Self Help Groups',
    })
    expect(shgActivity?.plannedOutput).toMatch(/^50 Self Help Groups /)

    const overridden = model.activitiesOutputs.find(
      (row) => row.activity === activityNames.noUnitOverride,
    )
    expect(overridden).toMatchObject({
      unit: 'No unit',
      plannedOutput: 'Four reviewed delivery events completed',
    })

    const customOther = model.activitiesOutputs.find(
      (row) => row.activity === activityNames.customOther,
    )
    expect(customOther).toMatchObject({
      activityType: 'Custom',
      unit: 'farmer networks',
      plannedOutput: '3 farmer networks coached',
    })

    const unconfigured = model.activitiesOutputs.find(
      (row) => row.activity === activityNames.unconfigured,
    )
    expect(unconfigured).toMatchObject({
      plannedQuantity: null,
      unit: '',
      plannedOutput: '',
    })
    expect(model.inputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ input: 'Facilitator time' }),
        expect.objectContaining({ input: 'Workshop facilitation' }),
      ]),
    )
    expect(
      model.donorLogframe.some(
        (row) =>
          row.resultsLevel === 'Intermediate Outcome' &&
          row.plannedOutputs.includes('Self Help Groups'),
      ),
    ).toBe(true)
    expect(
      model.donorLogframe.some(
        (row) =>
          row.resultStatement.includes('Self Help Groups trained'),
      ),
    ).toBe(false)
  })

  it('integrates ordered Custom Innovation content into every structure', () => {
    const { record } = exportRecord()
    const model = buildProjectExportModelFromRecord(record)
    const customResults = model.resultsFramework.filter(
      (row) => row.frameworkSource === 'Custom innovation',
    )

    expect(
      customResults.map((row) => row.intermediateOutcomeStep),
    ).toEqual([1, 2])
    expect(customResults[0]).toMatchObject({
      finalOutcome: 'Local systems provide inclusive resilience support',
      pathway: 'Custom resilience pathway',
    })
    expect(
      model.indicators.some(
        (row) =>
          row.frameworkSource === 'Custom innovation' &&
          row.indicator === 'Partner feedback',
      ),
    ).toBe(true)
    expect(
      model.activitiesOutputs.some(
        (row) =>
          row.activity === 'Host coordination workshops' &&
          row.plannedOutput ===
            '2 Community workshops hosted with partners',
      ),
    ).toBe(true)
  })

  it('creates every required workbook sheet with filterable columns', () => {
    const { record } = exportRecord()
    const exportModel = buildProjectExportModelFromRecord(record)
    const workbook = buildProjectDesignWorkbook(exportModel)

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Project Summary',
      'Results Framework',
      'Activities & Outputs',
      'Indicators',
      'Inputs',
      'Donor Logframe',
    ])
    expect(
      workbook.getWorksheet('Project Summary')?.getCell('B2').value,
    ).toBe('Export Test Project')
    const activities = workbook.getWorksheet('Activities & Outputs')
    expect(activities?.getRow(1).values).toEqual([
      undefined,
      'Final Outcome',
      'Pathway',
      'Intermediate Outcome',
      'Activity',
      'Activity type',
      'Project-specific activity details/notes',
      'Planned quantity',
      'Unit',
      'Planned output',
    ])
    expect(activities?.views[0]).toMatchObject({
      state: 'frozen',
      ySplit: 1,
    })
    expect(activities?.autoFilter).toBeTruthy()
    expect(
      projectExportBaseName(exportModel),
    ).toBe('UG_2027_Export')

    const emptyInputsWorkbook = buildProjectDesignWorkbook({
      ...exportModel,
      inputs: [],
    })
    expect(
      emptyInputsWorkbook.getWorksheet('Inputs')?.getCell('A2').value,
    ).toBe('No records configured')
  })

  it('serializes the workbook as a downloadable xlsx file', async () => {
    const { record } = exportRecord()
    const blob = await renderProjectDesignWorkbook(
      buildProjectExportModelFromRecord(record),
    )

    expect(blob.type).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    expect(blob.size).toBeGreaterThan(1_000)
  })

  it('refuses to substitute a different framework version', () => {
    const { record } = exportRecord()
    expect(() =>
      buildProjectExportModel(record, HISTORIC_FRAMEWORK),
    ).toThrow(ProjectExportError)
  })
})
