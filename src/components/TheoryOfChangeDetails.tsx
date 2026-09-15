import { useEffect, useRef } from 'react'
import type {
  TocActivityDetail,
  TocIndicatorDetail,
  TocInputDetail,
  TocNode,
} from '../theoryOfChange/types'

function EmptyDetail({ children }: { children: string }) {
  return <p className="neutral-note">{children}</p>
}

function IndicatorList({ indicators }: { indicators: TocIndicatorDetail[] }) {
  if (indicators.length === 0) {
    return <EmptyDetail>No additional indicators selected.</EmptyDetail>
  }
  return (
    <ul className="toc-detail-list">
      {indicators.map((indicator, index) => (
        <li key={`${indicator.label}-${index}`}>
          <span>{indicator.label}</span>
          {indicator.measurementNotes && (
            <small>{indicator.measurementNotes}</small>
          )}
          {indicator.custom && (
            <span className="toc-detail-tag">Project-specific</span>
          )}
        </li>
      ))}
    </ul>
  )
}

function ActivityList({ activities }: { activities: TocActivityDetail[] }) {
  if (activities.length === 0) {
    return <EmptyDetail>No activities selected.</EmptyDetail>
  }
  return (
    <ul className="toc-detail-list">
      {activities.map((activity, index) => (
        <li key={`${activity.label}-${index}`}>
          <span>{activity.label}</span>
          {activity.projectNotes && <small>{activity.projectNotes}</small>}
          {activity.custom && (
            <span className="toc-detail-tag">Project-specific</span>
          )}
        </li>
      ))}
    </ul>
  )
}

function InputList({ inputs }: { inputs: TocInputDetail[] }) {
  if (inputs.length === 0) {
    return <EmptyDetail>No inputs recorded.</EmptyDetail>
  }
  return (
    <ul className="toc-detail-list">
      {inputs.map((input, index) => (
        <li key={`${input.category}-${index}`}>
          <strong>{input.category}</strong>
          <span>{input.details}</span>
        </li>
      ))}
    </ul>
  )
}

function NodeDetails({ node }: { node: TocNode }) {
  switch (node.type) {
    case 'impact':
      return (
        <>
          <span className="eyebrow">Impact Area · {node.data.theme}</span>
          <h2>{node.title}</h2>
          <p>{node.data.statement}</p>
        </>
      )
    case 'finalOutcome':
      return (
        <>
          <span className="eyebrow">
            {node.custom ? 'Custom innovation' : 'Standard Final Outcome'}
          </span>
          <h2>{node.title}</h2>
          {node.title !== node.data.statement && <p>{node.data.statement}</p>}
          <section>
            <h3>Impact Areas</h3>
            {node.data.impactLabels.length === 0 ? (
              <EmptyDetail>No linked Impact Areas.</EmptyDetail>
            ) : (
              <ul className="toc-detail-list compact">
                {node.data.impactLabels.map((impact) => (
                  <li key={impact}>{impact}</li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3>Primary indicator</h3>
            {node.data.primaryIndicator ? (
              <>
                <p>{node.data.primaryIndicator.label}</p>
                {node.data.primaryIndicator.measurementNotes && (
                  <small>{node.data.primaryIndicator.measurementNotes}</small>
                )}
              </>
            ) : (
              <EmptyDetail>Primary indicator unavailable.</EmptyDetail>
            )}
          </section>
        </>
      )
    case 'pathway':
      return (
        <>
          <span className="eyebrow">
            {node.custom ? 'Custom innovation pathway' : 'Project pathway'}
          </span>
          <h2>{node.title}</h2>
          {node.data.description && <p>{node.data.description}</p>}
          <p className="toc-detail-status">
            <strong>Configuration status:</strong>{' '}
            {node.data.configurationStatus === 'custom'
              ? 'Custom pathway complete'
              : node.data.configurationStatus}
          </p>
          <section>
            <h3>Contributes to</h3>
            <ul className="toc-relationship-list">
              {node.data.relationships.map((relationship) => (
                <li key={relationship.finalOutcomeId}>
                  <span>{relationship.finalOutcomeLabel}</span>
                  <span
                    className={`overview-relationship relationship-${relationship.relationshipType}`}
                  >
                    {relationship.relationshipType === 'primary'
                      ? 'Primary'
                      : 'Related'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )
    case 'intermediateOutcome':
      return (
        <>
          <span className="eyebrow">
            {node.custom ? 'Custom innovation · ' : ''}
            Intermediate Outcome · Step {node.data.stepNumber}
          </span>
          <h2>{node.data.statement}</h2>
          <section>
            <h3>Primary indicator</h3>
            {node.data.primaryIndicator ? (
              <>
                <p>{node.data.primaryIndicator.label}</p>
                {node.data.primaryIndicator.measurementNotes && (
                  <small>{node.data.primaryIndicator.measurementNotes}</small>
                )}
              </>
            ) : (
              <EmptyDetail>Primary indicator unavailable.</EmptyDetail>
            )}
          </section>
          <section>
            <h3>Additional indicators</h3>
            <IndicatorList indicators={node.data.additionalIndicators} />
          </section>
          <section>
            <h3>Activities</h3>
            <ActivityList activities={node.data.activities} />
          </section>
          <section>
            <h3>Inputs</h3>
            <InputList inputs={node.data.inputs} />
          </section>
        </>
      )
  }
}

export function TheoryOfChangeDetails({
  node,
  onClose,
}: {
  node: TocNode | null
  onClose: () => void
}) {
  const headingContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!node) return
    const heading =
      headingContainerRef.current?.querySelector<HTMLElement>('h2')
    heading?.setAttribute('tabindex', '-1')
    heading?.focus()
  }, [node])

  useEffect(() => {
    if (!node) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [node, onClose])

  if (!node) return null

  return (
    <aside
      className="toc-detail-panel is-open"
      aria-label="Theory of Change node details"
      aria-live="polite"
    >
      <button
        className="icon-button toc-detail-close"
        type="button"
        onClick={onClose}
        aria-label="Close node details"
      >
        ×
      </button>
      <div className="toc-detail-content" ref={headingContainerRef}>
        <NodeDetails node={node} />
      </div>
    </aside>
  )
}
