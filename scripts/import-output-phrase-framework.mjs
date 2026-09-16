import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [sourceJsonArg, sourceCsvArg, historicArg, outputJsonArg] =
  process.argv.slice(2)

if (!sourceJsonArg || !sourceCsvArg || !historicArg || !outputJsonArg) {
  throw new Error(
    'Usage: node scripts/import-output-phrase-framework.mjs <source-json> <review-csv> <historic-json> <output-json>',
  )
}

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
      }
    } else if (character === '"') {
      quoted = true
    } else if (character === ',') {
      row.push(field)
      field = ''
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''))
      rows.push(row)
      row = []
      field = ''
    } else {
      field += character
    }
  }

  if (field || row.length > 0) {
    row.push(field.replace(/\r$/, ''))
    rows.push(row)
  }

  const [headers, ...records] = rows
  if (!headers) return []
  headers[0] = headers[0]?.replace(/^\uFEFF/, '') ?? ''
  return records
    .filter((values) => values.some((value) => value !== ''))
    .map((values) =>
      Object.fromEntries(
        headers.map((header, index) => [header, values[index] ?? '']),
      ),
    )
}

function assertSameRecord(historic, proposed, field) {
  if (historic[field] !== proposed[field]) {
    throw new Error(
      `Activity ${historic.id} changed protected field ${field}.`,
    )
  }
}

const source = JSON.parse(readFileSync(resolve(sourceJsonArg), 'utf8'))
const historic = JSON.parse(readFileSync(resolve(historicArg), 'utf8'))
const reviewRows = parseCsv(readFileSync(resolve(sourceCsvArg), 'utf8'))
const reviewById = new Map(reviewRows.map((row) => [row.activityId, row]))

for (const collection of [
  'thematicAreas',
  'impacts',
  'finalOutcomes',
  'finalOutcomeImpactLinks',
  'pathways',
  'finalOutcomePathwayLinks',
  'intermediateOutcomes',
  'indicators',
  'inputCategories',
]) {
  if (
    JSON.stringify(source[collection]) !==
    JSON.stringify(historic[collection])
  ) {
    throw new Error(`Protected framework collection ${collection} changed.`)
  }
}

if (
  source.suggestedActivities.length !== historic.suggestedActivities.length ||
  reviewRows.length !== historic.suggestedActivities.length
) {
  throw new Error('Source, review and historic activity counts must match.')
}

const historicById = new Map(
  historic.suggestedActivities.map((activity) => [activity.id, activity]),
)

const suggestedActivities = source.suggestedActivities.map((activity) => {
  const historicActivity = historicById.get(activity.id)
  const review = reviewById.get(activity.id)
  if (!historicActivity || !review) {
    throw new Error(`Activity ${activity.id} is missing from a source.`)
  }

  for (const field of [
    'id',
    'text',
    'intermediateOutcomeId',
    'sortOrder',
    'active',
  ]) {
    assertSameRecord(historicActivity, activity, field)
  }
  if (review.intermediateOutcomeId !== activity.intermediateOutcomeId) {
    throw new Error(`Review row for ${activity.id} does not match the JSON.`)
  }

  const { defaultOutputMode, defaultOutputUnit, outputTemplate, ...clean } =
    activity
  void defaultOutputMode
  void defaultOutputUnit
  void outputTemplate

  return {
    ...clean,
    outputPhrase: review.outputPhrase.trim() || null,
  }
})

const imported = {
  ...source,
  suggestedActivities,
}

writeFileSync(resolve(outputJsonArg), `${JSON.stringify(imported, null, 2)}\n`)

const nullOutputPhrases = suggestedActivities.filter(
  (activity) => activity.outputPhrase === null,
).length

console.log(
  JSON.stringify(
    {
      frameworkVersion: imported.frameworkVersion,
      schemaVersion: imported.schemaVersion,
      activities: suggestedActivities.length,
      nullOutputPhrases,
      protectedActivityFieldsUnchanged: true,
    },
    null,
    2,
  ),
)
