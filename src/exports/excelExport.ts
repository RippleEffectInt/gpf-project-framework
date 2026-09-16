import ExcelJS from 'exceljs'
import type { ProjectExportModel } from './types'

type CellValue = ExcelJS.CellValue

const HEADER_FILL = 'FF24543D'
const HEADER_TEXT = 'FFFFFFFF'

function styleHeader(row: ExcelJS.Row) {
  row.height = 24
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_TEXT } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: HEADER_FILL },
    }
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'left',
      wrapText: true,
    }
  })
}

function columnLetter(index: number): string {
  let value = index
  let result = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    value = Math.floor((value - 1) / 26)
  }
  return result
}

function addTabularSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  headers: string[],
  widths: number[],
  rows: CellValue[][],
) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  sheet.addRow(headers)
  styleHeader(sheet.getRow(1))
  sheet.columns.forEach((column, index) => {
    column.width = widths[index] ?? 20
    column.alignment = { vertical: 'top', wrapText: true }
  })
  if (rows.length === 0) {
    sheet.addRow(['No records configured'])
    sheet.getCell('A2').font = { italic: true, color: { argb: 'FF5A6861' } }
  } else {
    rows.forEach((row) => sheet.addRow(row))
  }
  sheet.autoFilter = {
    from: 'A1',
    to: `${columnLetter(headers.length)}1`,
  }
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return
    row.alignment = { vertical: 'top', wrapText: true }
  })
  return sheet
}

function addProjectSummary(
  workbook: ExcelJS.Workbook,
  model: ProjectExportModel,
) {
  const sheet = workbook.addWorksheet('Project Summary')
  sheet.columns = [{ width: 38 }, { width: 80 }]
  sheet.addRow(['Project Summary', 'Value'])
  styleHeader(sheet.getRow(1))

  const metadataRows: Array<[string, CellValue]> = [
    ['Project title', model.metadata.projectTitle],
    ['Project code', model.metadata.projectCode || 'Not set'],
    ['Country', model.metadata.country || 'Not set'],
    ['Status', model.metadata.status],
    ['Planned/potential start', model.metadata.plannedStart],
    ['Planned/potential end', model.metadata.plannedEnd],
    [
      'Planned number of Self Help Groups',
      model.metadata.plannedSelfHelpGroupCount ?? 'Not set',
    ],
    ['Framework version', model.metadata.frameworkVersion],
    ['Framework schema version', model.metadata.frameworkSchemaVersion],
    ['Project schema version', model.metadata.projectSchemaVersion],
    ['Last saved/modified date', new Date(model.metadata.modifiedAt)],
    ['Export date', new Date(model.metadata.exportDate)],
  ]
  metadataRows.forEach((row) => sheet.addRow(row))
  sheet.getCell('B12').numFmt = 'yyyy-mm-dd hh:mm'
  sheet.getCell('B13').numFmt = 'yyyy-mm-dd hh:mm'

  sheet.addRow([])
  const summaryHeader = sheet.addRow(['Design summary', 'Value'])
  styleHeader(summaryHeader)
  ;[
    [
      'Selected Impact Areas',
      model.summary.selectedImpactAreas.join('; ') || 'None selected',
    ],
    ['Number of Final Outcomes', model.summary.finalOutcomeCount],
    ['Number of unique pathways', model.summary.uniquePathwayCount],
    [
      'Number of Intermediate Outcomes',
      model.summary.intermediateOutcomeCount,
    ],
    [
      'Number of selected activities',
      model.summary.selectedActivityCount,
    ],
    [
      'Number of configured planned outputs',
      model.summary.configuredPlannedOutputCount,
    ],
  ].forEach((row) => sheet.addRow(row))
  sheet.eachRow((row) => {
    row.alignment = { vertical: 'top', wrapText: true }
  })
}

export function buildProjectDesignWorkbook(
  model: ProjectExportModel,
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Ripple Effect Project Framework'
  workbook.created = new Date(model.metadata.exportDate)
  workbook.modified = new Date(model.metadata.exportDate)
  workbook.properties.date1904 = false

  addProjectSummary(workbook, model)

  addTabularSheet(
    workbook,
    'Results Framework',
    [
      'Impact Area',
      'Final Outcome',
      'Pathway',
      'Pathway relationship',
      'Intermediate Outcome step',
      'Intermediate Outcome',
      'Framework source',
    ],
    [22, 48, 32, 20, 18, 52, 22],
    model.resultsFramework.map((row) => [
      row.impactArea,
      row.finalOutcome,
      row.pathway,
      row.pathwayRelationship,
      row.intermediateOutcomeStep,
      row.intermediateOutcome,
      row.frameworkSource,
    ]),
  )

  addTabularSheet(
    workbook,
    'Activities & Outputs',
    [
      'Final Outcome',
      'Pathway',
      'Intermediate Outcome',
      'Activity',
      'Activity type',
      'Project-specific activity details/notes',
      'Planned quantity',
      'Unit',
      'Planned output',
    ],
    [45, 30, 48, 48, 16, 38, 16, 24, 55],
    model.activitiesOutputs.map((row) => [
      row.finalOutcome,
      row.pathway,
      row.intermediateOutcome,
      row.activity,
      row.activityType,
      row.projectDetails,
      row.plannedQuantity,
      row.unit,
      row.plannedOutput,
    ]),
  )

  addTabularSheet(
    workbook,
    'Indicators',
    [
      'Result level',
      'Final Outcome',
      'Pathway',
      'Intermediate Outcome',
      'Indicator',
      'Indicator type',
      'Requirement',
      'Framework source',
    ],
    [20, 45, 30, 48, 55, 20, 16, 22],
    model.indicators.map((row) => [
      row.resultLevel,
      row.finalOutcome,
      row.pathway,
      row.intermediateOutcome,
      row.indicator,
      row.indicatorType,
      row.requirement,
      row.frameworkSource,
    ]),
  )

  addTabularSheet(
    workbook,
    'Inputs',
    [
      'Final Outcome',
      'Pathway',
      'Intermediate Outcome',
      'Input category',
      'Input',
    ],
    [45, 30, 48, 26, 55],
    model.inputs.map((row) => [
      row.finalOutcome,
      row.pathway,
      row.intermediateOutcome,
      row.inputCategory,
      row.input,
    ]),
  )

  addTabularSheet(
    workbook,
    'Donor Logframe',
    [
      'Results Level',
      'Result Statement',
      'Final Outcome',
      'Indicator',
      'Pathway / Context',
      'Key Activities',
      'Planned Outputs',
    ],
    [22, 55, 55, 55, 42, 52, 58],
    model.donorLogframe.map((row) => [
      row.resultsLevel,
      row.resultStatement,
      row.finalOutcome,
      row.indicator,
      row.pathwayContext,
      row.keyActivities,
      row.plannedOutputs,
    ]),
  )

  return workbook
}

export async function renderProjectDesignWorkbook(
  model: ProjectExportModel,
): Promise<Blob> {
  const workbook = buildProjectDesignWorkbook(model)
  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}
