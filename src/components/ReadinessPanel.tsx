import { Link } from 'react-router-dom'
import type { ReadinessCheck, ProjectReadiness } from '../state/projectReadiness'

export function ReadinessPanel({
  readiness,
}: {
  readiness: ProjectReadiness
}) {
  return (
    <section
      className={`readiness-panel ${readiness.ready ? 'readiness-complete' : 'readiness-incomplete'}`}
      aria-labelledby="readiness-heading"
    >
      <div className="readiness-heading">
        <span className="eyebrow">Objective design rules</span>
        <h2 id="readiness-heading">Project design readiness</h2>
        {readiness.ready ? (
          <>
            <p className="readiness-complete-title">Project design complete</p>
            <p>
              This project meets the required design rules and is ready for the
              approval stage.
            </p>
          </>
        ) : (
          <p>
            Complete the required items below. Optional related pathways,
            additional indicators, activities and inputs do not block readiness.
          </p>
        )}
      </div>
      <ul className="readiness-checklist">
        {readiness.checks.map((check) => (
          <ReadinessItem key={check.id} check={check} />
        ))}
      </ul>
    </section>
  )
}

function ReadinessItem({ check }: { check: ReadinessCheck }) {
  return (
    <li className={check.passed ? 'check-passed' : 'check-failed'}>
      <span aria-hidden="true">{check.passed ? '✓' : '✕'}</span>
      <div>
        <strong>{check.label}</strong>
        {!check.passed && check.action && (
          <Link className="readiness-action" to={check.action.to}>
            {check.action.label}
          </Link>
        )}
      </div>
    </li>
  )
}
