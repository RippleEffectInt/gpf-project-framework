import { useState, type ReactNode, type ToggleEvent } from 'react'

export function OptionalQuestion({
  question,
  help,
  defaultOpen = false,
  children,
}: {
  question: string
  help?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <details
      className="optional-question"
      open={open}
      onToggle={(event: ToggleEvent<HTMLDetailsElement>) => {
        setOpen(event.currentTarget.open)
      }}
    >
      <summary>{question}</summary>
      {help ? <p className="section-help">{help}</p> : null}
      {children}
    </details>
  )
}
