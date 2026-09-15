import { useState } from 'react'
import {
  getMonthOptions,
  getYearOptions,
  parseYearMonth,
  toYearMonthValue,
} from '../state/projectDates'

export function MonthYearFields({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  const parsed = parseYearMonth(value)
  const [draft, setDraft] = useState({
    month: parsed?.month ?? '',
    year: parsed?.year ?? '',
  })
  const month = parsed?.month ?? draft.month
  const year = parsed?.year ?? draft.year
  const errorId = `${id}-error`

  const update = (nextMonth: string, nextYear: string) => {
    setDraft({ month: nextMonth, year: nextYear })
    onChange(toYearMonthValue(nextYear, nextMonth))
  }

  return (
    <fieldset className="month-year-fields">
      <legend>{label} *</legend>
      <div className="month-year-selects">
        <label>
          <span className="visually-hidden">Month</span>
          <select
            aria-label={`${label} month`}
            value={month}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => update(event.target.value, year)}
          >
            <option value="">Month</option>
            {getMonthOptions().map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="visually-hidden">Year</span>
          <select
            aria-label={`${label} year`}
            value={year}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => update(month, event.target.value)}
          >
            <option value="">Year</option>
            {getYearOptions().map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <small className="field-error" id={errorId}>
          {error}
        </small>
      )}
    </fieldset>
  )
}
