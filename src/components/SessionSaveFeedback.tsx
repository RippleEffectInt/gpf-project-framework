export function SessionSaveFeedback({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <span className="saved-inline" role="status" aria-live="polite">
      ✓ {message}
    </span>
  )
}

export const ADDED_SESSION_MESSAGE =
  'Added — use Save project to persist this change'
export const SAVED_SESSION_MESSAGE =
  'Change applied — use Save project to persist it'
