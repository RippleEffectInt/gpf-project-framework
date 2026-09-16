import { describe, expect, it } from 'vitest'
import { getProjectMetadataErrors } from './projectMetadata'
import {
  formatYearMonthDisplay,
  getPotentialImplementationPeriod,
  isYearMonth,
  toYearMonthValue,
} from './projectDates'

const validMetadata = {
  title: 'Seed systems project',
  country: 'Kenya',
  donor: 'FCDO',
  fundingReference: 'REF-001',
  projectManager: 'Amina Hassan',
  plannedStartDate: '2027-03',
  plannedEndDate: '2027-11',
  description: 'A project to strengthen local seed markets.',
  plannedSelfHelpGroupCount: null,
}

describe('potential implementation month and year', () => {
  it('stores and displays YYYY-MM as a month name and year', () => {
    expect(isYearMonth('2027-03')).toBe(true)
    expect(isYearMonth('2027-03-01')).toBe(false)
    expect(toYearMonthValue('2027', '03')).toBe('2027-03')
    expect(formatYearMonthDisplay('2027-03')).toBe('March 2027')
    expect(getPotentialImplementationPeriod(validMetadata)).toEqual({
      start: '2027-03',
      end: '2027-11',
      startLabel: 'March 2027',
      endLabel: 'November 2027',
    })
  })

  it('rejects a Potential End that is earlier than Potential Start', () => {
    const errors = getProjectMetadataErrors({
      ...validMetadata,
      plannedStartDate: '2027-03',
      plannedEndDate: '2027-01',
    })
    expect(errors.plannedEndDate).toBe(
      'Potential End must not be earlier than Potential Start.',
    )
  })

  it('accepts the same month for Potential Start and Potential End', () => {
    expect(
      getProjectMetadataErrors({
        ...validMetadata,
        plannedStartDate: '2027-03',
        plannedEndDate: '2027-03',
      }),
    ).toEqual({})
  })
})
