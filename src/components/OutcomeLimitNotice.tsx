import { useProjectDesign } from '../state/AppState'
import { finalOutcomeCount, MAX_FINAL_OUTCOMES } from '../state/outcomeLimit'

export function OutcomeLimitNotice() {
  const { state } = useProjectDesign()
  const count = finalOutcomeCount(state)
  return (
    <p className="neutral-note" role="status">
      {count} of {MAX_FINAL_OUTCOMES} Final Outcomes selected. Custom innovation and
      Primary outcomes added by Related pathways count towards this limit.
      {count > MAX_FINAL_OUTCOMES && ' This existing project exceeds the limit. All selections are retained and can still be edited and saved. Remove outcomes before adding any more.'}
      {count === MAX_FINAL_OUTCOMES && ' The limit is reached. You can still configure existing outcomes; remove an outcome before adding another.'}
    </p>
  )
}
