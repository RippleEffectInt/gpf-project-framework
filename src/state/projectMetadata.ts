import type { ProjectMetadata } from '../types/project'
import { isYearMonth } from './projectDates'

export type ProjectMetadataErrors = Partial<Record<keyof ProjectMetadata, string>>

const requiredMetadataFields: Array<keyof ProjectMetadata> = [
  'title',
  'country',
  'donor',
  'fundingReference',
  'projectManager',
  'plannedStartDate',
  'plannedEndDate',
  'description',
]

export function getProjectMetadataErrors(
  metadata: ProjectMetadata,
): ProjectMetadataErrors {
  const errors: ProjectMetadataErrors = {}
  requiredMetadataFields.forEach((field) => {
    if (!metadata[field].trim()) errors[field] = 'This field is required.'
  })
  if (
    metadata.plannedStartDate &&
    !isYearMonth(metadata.plannedStartDate)
  ) {
    errors.plannedStartDate = 'Select a month and year.'
  }
  if (metadata.plannedEndDate && !isYearMonth(metadata.plannedEndDate)) {
    errors.plannedEndDate = 'Select a month and year.'
  }
  if (
    isYearMonth(metadata.plannedStartDate) &&
    isYearMonth(metadata.plannedEndDate) &&
    metadata.plannedEndDate < metadata.plannedStartDate
  ) {
    errors.plannedEndDate =
      'Potential End must not be earlier than Potential Start.'
  }
  return errors
}

export function isProjectMetadataComplete(metadata: ProjectMetadata): boolean {
  return Object.keys(getProjectMetadataErrors(metadata)).length === 0
}
