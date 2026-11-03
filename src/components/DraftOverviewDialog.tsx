import { useEffect, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

export function DraftOverviewDialog({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const navigate = useNavigate()
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const scrollPosition = { left: window.scrollX, top: window.scrollY }
    // Native modal keeps focus inside the overview and restores it on close.
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
    return () => {
      if (typeof dialog.close === 'function') dialog.close()
      // Restoring focus to the launch link can otherwise scroll the editor.
      window.scrollTo(scrollPosition)
    }
  }, [])
  return (
    <dialog ref={ref} className="draft-overview-dialog" aria-label="Draft project overview"
      onCancel={(event) => { event.preventDefault(); navigate(-1) }}>
      {children}
    </dialog>
  )
}
