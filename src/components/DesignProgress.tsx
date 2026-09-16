import { Link } from 'react-router-dom'

export type DesignStage = 'choose' | 'configure' | 'review'

const stages: Array<{
  id: DesignStage
  number: number
  label: string
  to: string
}> = [
  {
    id: 'choose',
    number: 1,
    label: 'Choose outcomes and pathways',
    to: '/design/outcomes',
  },
  {
    id: 'configure',
    number: 2,
    label: 'Configure pathways',
    to: '/design/configure',
  },
  {
    id: 'review',
    number: 3,
    label: 'Review & Export',
    to: '/design/review',
  },
]

export function DesignProgress({ current }: { current: DesignStage }) {
  const currentIndex = stages.findIndex((stage) => stage.id === current)
  return (
    <nav className="design-progress" aria-label="Project design progress">
      <ol>
        {stages.map((stage, index) => {
          const isCurrent = stage.id === current
          const isAvailable = index <= currentIndex
          return (
            <li
              key={stage.id}
              className={`${isCurrent ? 'current' : ''} ${
                index < currentIndex ? 'complete' : ''
              }`}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {isAvailable && !isCurrent ? (
                <Link to={stage.to}>
                  <span>{stage.number}</span>
                  {stage.label}
                </Link>
              ) : (
                <div>
                  <span>{stage.number}</span>
                  {stage.label}
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
