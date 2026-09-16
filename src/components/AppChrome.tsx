import { useLayoutEffect, useState } from 'react'
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { useAuthenticatedUser } from '../services/authenticationContext'
import { useFramework, useProjectDesign } from '../state/AppState'
import {
  canContinueToConfigure,
  getIncompleteFinalOutcomeIds,
  getSelectedFinalOutcomeCount,
} from '../state/journeySelectors'
import { getCustomInnovationValidation } from '../state/customInnovation'
import { getFinalOutcomeSelectionSource } from '../state/projectDesign'
import {
  getBasketSelectedOutcomes,
  type BasketPathwayItem,
} from '../state/pathwayRelationships'

const configurationStatusLabels = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  configured: 'Configured',
} as const

function BasketPathwayRow({
  pathway,
  onRemove,
}: {
  pathway: BasketPathwayItem
  onRemove: () => void
}) {
  return (
    <li
      className={`basket-pathway-row basket-pathway-${pathway.relationshipType}`}
    >
      <div className="basket-pathway-main">
        <strong className="basket-pathway-name">{pathway.name}</strong>
        {pathway.relationshipType === 'related' && (
          <span className="relationship-badge">Related pathway</span>
        )}
        <span className="basket-pathway-status">
          {pathway.relationshipType === 'primary'
            ? `Primary · ${configurationStatusLabels[pathway.status]}`
            : configurationStatusLabels[pathway.status]}
        </span>
        {pathway.primaryFinalOutcomeLabel && (
          <small className="basket-related-primary-outcome">
            <span>Also a Primary pathway for:</span>{' '}
            {pathway.primaryFinalOutcomeLabel}
          </small>
        )}
        {pathway.usedElsewhere && (
          <small>Also used elsewhere in this project</small>
        )}
      </div>
      <button
        type="button"
        className="icon-button"
        onClick={onRemove}
        aria-label={`Remove ${pathway.name} link`}
      >
        ×
      </button>
    </li>
  )
}

const internalLinks = [
  { label: 'Project Designs', to: '/projects' },
  { label: 'Design Project', to: '/design/details' },
] as const

// Add approved organisational destinations here when URLs are confirmed.
const externalLinks: ReadonlyArray<{ label: string; href: string }> = []

function Header() {
  const user = useAuthenticatedUser()

  return (
    <header className="app-header">
      <div className="header-brand">
        <div
          className="logo-placeholder"
          role="img"
          aria-label="Ripple Effect logo placeholder"
          title="Replace with approved Ripple Effect logo asset"
        >
          RE
        </div>
        <span className="app-name">Project Framework</span>
      </div>
      <nav className="primary-nav" aria-label="Application pages">
        {internalLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => (isActive ? 'active' : undefined)}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
      {externalLinks.length > 0 && (
        <nav className="external-nav" aria-label="Other applications">
          {externalLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
            >
              {link.label} <span aria-hidden="true">↗</span>
            </a>
          ))}
        </nav>
      )}
      <div className="profile" aria-label="Current user">
        <span className="avatar" aria-hidden="true">
          {user?.displayName.charAt(0) ?? '—'}
        </span>
        <span>{user?.displayName ?? 'Identity unavailable'}</span>
        {user && !import.meta.env.DEV && (
          <a
            className="header-sign-out"
            href="/.auth/logout?post_logout_redirect_uri=%2F"
          >
            Sign out
          </a>
        )}
      </div>
    </header>
  )
}

function ProjectSaveBar() {
  const {
    state,
    activeProject,
    saveStatus,
    saveError,
    recoveryAvailable,
    metadataSyncRequired,
    metadataSyncing,
    metadataSyncError,
    saveProject,
    retryMetadataSync,
    reloadLatestProject,
    restoreUnsavedChanges,
  } = useProjectDesign()
  const projectTitle = state.metadata.title.trim() || 'Untitled project'
  const statusMessage =
    metadataSyncRequired && saveStatus === 'dirty'
      ? 'Unsaved changes. The previously saved design also needs its project-list information synchronising.'
      : metadataSyncRequired
        ? metadataSyncing
          ? 'Project design saved. Synchronising project-list information…'
          : metadataSyncError
            ? `Project design saved. Project-list information still needs synchronising. ${metadataSyncError.message}`
            : 'Project design saved, but its project-list information still needs synchronising.'
        : saveStatus === 'saving'
          ? 'Saving project…'
          : saveStatus === 'dirty'
            ? 'Unsaved changes'
            : saveStatus === 'conflict'
              ? saveError?.message
              : saveStatus === 'error'
                ? saveError?.message
                : activeProject
                  ? `Saved ${new Date(activeProject.modifiedAt).toLocaleString()}`
                  : 'New project — not saved yet'

  return (
    <div
      className={`project-save-bar save-${saveStatus}`}
      role={
        saveStatus === 'error' || saveStatus === 'conflict' || metadataSyncError
          ? 'alert'
          : 'status'
      }
    >
      <div className="project-save-identity">
        <span className="eyebrow">Editing project</span>
        <p className="project-save-title" title={projectTitle}>
          {projectTitle}
        </p>
      </div>
      <span className="project-save-status">{statusMessage}</span>
      <div className="project-save-actions">
        {metadataSyncRequired && (
          <button
            className="button secondary"
            type="button"
            onClick={() => void retryMetadataSync()}
            disabled={metadataSyncing}
          >
            {metadataSyncing ? 'Synchronising…' : 'Retry metadata sync'}
          </button>
        )}
        {saveStatus === 'conflict' && (
          <button
            className="button secondary"
            type="button"
            onClick={() => void reloadLatestProject()}
          >
            Reload latest version
          </button>
        )}
        {recoveryAvailable && saveStatus !== 'conflict' && (
          <button
            className="button secondary"
            type="button"
            onClick={restoreUnsavedChanges}
          >
            Restore my unsaved changes
          </button>
        )}
        <button
          className="button primary"
          type="button"
          onClick={() => void saveProject()}
          disabled={
            saveStatus === 'saving' ||
            saveStatus === 'clean' ||
            saveStatus === 'conflict'
          }
        >
          {saveStatus === 'saving' ? 'Saving…' : 'Save project'}
        </button>
      </div>
    </div>
  )
}

function ProjectBasket({
  open,
  onClose,
  showConfigureHandoff,
}: {
  open: boolean
  onClose: () => void
  showConfigureHandoff: boolean
}) {
  const navigate = useNavigate()
  const { data } = useFramework()
  const {
    state,
    dispatch,
    saveProject,
    saveStatus,
    hasUnsavedChanges,
  } = useProjectDesign()
  const projectTitle = state.metadata.title.trim() || 'Untitled project'
  const incompleteOutcomeCount = getIncompleteFinalOutcomeIds(state).length
  const configureAvailable = canContinueToConfigure(state)
  const outcomeCount = getSelectedFinalOutcomeCount(state)
  const custom = state.customInnovation
  const customValidation = getCustomInnovationValidation(custom)
  const selectedOutcomes = data ? getBasketSelectedOutcomes(data, state) : []
  const uniquePathwayCount = state.projectPathways.length + (custom ? 1 : 0)
  const outcomeOverview = [
    ...selectedOutcomes.map((item) => ({
      id: `basket-outcome-${item.outcomeId}`,
      label: item.label,
    })),
    ...(custom
      ? [
          {
            id: 'basket-outcome-custom',
            label: custom.shortLabel || 'Untitled custom outcome',
          },
        ]
      : []),
  ]

  const saveAndConfigure = async () => {
    if (hasUnsavedChanges) {
      const saved = await saveProject()
      if (!saved) return
    }
    onClose()
    navigate('/design/configure')
  }

  const removeOutcome = (finalOutcomeId: string) => {
    const linkedPathwayIds = state.outcomePathwayLinks
      .filter((link) => link.finalOutcomeId === finalOutcomeId)
      .map((link) => link.pathwayId)
    const orphanCount = linkedPathwayIds.filter(
      (pathwayId) =>
        !state.outcomePathwayLinks.some(
          (link) =>
            link.pathwayId === pathwayId &&
            link.finalOutcomeId !== finalOutcomeId,
        ),
    ).length
    const dependentRelatedLinkCount = state.outcomePathwayLinks.filter(
      (link) =>
        link.finalOutcomeId !== finalOutcomeId &&
        link.relationshipType === 'related' &&
        state.outcomePathwayLinks.some(
          (primaryLink) =>
            primaryLink.finalOutcomeId === finalOutcomeId &&
            primaryLink.pathwayId === link.pathwayId &&
            primaryLink.relationshipType === 'primary',
        ),
    ).length
    const message =
      dependentRelatedLinkCount > 0
        ? `Remove this Final Outcome? ${dependentRelatedLinkCount} Related pathway link${
            dependentRelatedLinkCount === 1 ? '' : 's'
          } depend${
            dependentRelatedLinkCount === 1 ? 's' : ''
          } on its Primary pathways and will also be removed.`
        : orphanCount > 0
          ? `Remove this final outcome? ${orphanCount} pathway${orphanCount === 1 ? '' : 's'} used only here will also be removed.`
          : 'Remove this final outcome? Pathways linked to other outcomes will be retained.'
    if (window.confirm(message)) {
      dispatch({ type: 'removeFinalOutcome', finalOutcomeId })
    }
  }

  const removeLink = (finalOutcomeId: string, pathwayId: string) => {
    const linkBeingRemoved = state.outcomePathwayLinks.find(
      (link) =>
        link.pathwayId === pathwayId && link.finalOutcomeId === finalOutcomeId,
    )
    const otherLinks = state.outcomePathwayLinks.filter(
      (link) =>
        link.pathwayId === pathwayId && link.finalOutcomeId !== finalOutcomeId,
    )
    const primaryLink = otherLinks.find(
      (link) => link.relationshipType === 'primary',
    )
    const removesAutoAddedOutcome = Boolean(
      linkBeingRemoved?.relationshipType === 'related' &&
      primaryLink &&
      getFinalOutcomeSelectionSource(state, primaryLink.finalOutcomeId) ===
        'related-pathway' &&
      !otherLinks.some((link) => link.relationshipType === 'related') &&
      !state.outcomePathwayLinks.some(
        (link) =>
          link.finalOutcomeId === primaryLink.finalOutcomeId &&
          link.pathwayId !== pathwayId,
      ),
    )
    const removesDependentRelatedLinks = Boolean(
      linkBeingRemoved?.relationshipType === 'primary' &&
      otherLinks.some((link) => link.relationshipType === 'related'),
    )
    const message = removesAutoAddedOutcome
      ? 'Remove this Related pathway? Its automatically included Primary Final Outcome has no other selected pathways and will also be removed.'
      : removesDependentRelatedLinks
        ? 'Remove this Primary pathway? Its Related pathway links will also be removed.'
        : otherLinks.length === 0
          ? 'Remove this pathway link? The pathway is not used by another outcome and will be removed from the project.'
          : 'Remove this pathway link? The pathway will remain under its other Final Outcome.'
    if (window.confirm(message)) {
      dispatch({
        type: 'removeOutcomePathwayLink',
        finalOutcomeId,
        pathwayId,
      })
    }
  }

  return (
    <aside
      className={`project-basket ${open ? 'basket-open' : ''}`}
      aria-label="Project summary"
    >
      <div className="basket-summary">
        <div className="basket-heading">
          <div>
            <span className="eyebrow">Current project</span>
            <p className="basket-project-title" title={projectTitle}>
              {projectTitle}
            </p>
            <h2>
              {outcomeCount} Final Outcome{outcomeCount === 1 ? '' : 's'}{' '}
              selected
            </h2>
          </div>
          <button
            className="icon-button basket-close"
            type="button"
            onClick={onClose}
            aria-label="Close project summary"
          >
            ×
          </button>
        </div>
        <p className="basket-counts" aria-label="Selection counts">
          {outcomeCount} Final Outcome{outcomeCount === 1 ? '' : 's'} ·{' '}
          {uniquePathwayCount} unique pathway
          {uniquePathwayCount === 1 ? '' : 's'}
        </p>
        {outcomeOverview.length > 1 && (
          <nav
            className="basket-outcome-overview"
            aria-label="Selected Final Outcome overview"
          >
            <span>Selected outcomes</span>
            <ol>
              {outcomeOverview.map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`} title={item.label}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}
      </div>
      {outcomeCount === 0 ? (
        <div className="empty-basket">
          <p>Your project basket is empty.</p>
          <p>Add a final outcome to begin shaping the project logic.</p>
        </div>
      ) : (
        <section
          className="basket-section"
          aria-labelledby="basket-outcomes-heading"
        >
          <h3 className="visually-hidden" id="basket-outcomes-heading">
            Selected Final Outcomes
          </h3>
          <ol className="basket-outcomes">
            {selectedOutcomes.map((item, index) => (
              <li
                className="basket-outcome-card"
                id={`basket-outcome-${item.outcomeId}`}
                key={item.outcomeId}
              >
                <header className="basket-outcome-card-header">
                  <span className="basket-outcome-position">
                    Outcome {index + 1} of {outcomeCount}
                  </span>
                  <div className="basket-item-row">
                    <h3 className="basket-outcome-title">
                      <NavLink
                        className="basket-outcome-link"
                        to={`/design/outcomes/${item.outcomeId}`}
                        onClick={onClose}
                      >
                        {item.label}
                      </NavLink>
                    </h3>
                    <button
                      type="button"
                      className="text-button danger"
                      onClick={() => removeOutcome(item.outcomeId)}
                      aria-label={`Remove ${item.label}`}
                    >
                      Remove
                    </button>
                  </div>
                  <div
                    className={`basket-requirement ${
                      item.primaryCount > 0
                        ? 'requirement-met'
                        : 'needs-attention'
                    }`}
                  >
                    {item.primaryCount > 0
                      ? `${item.primaryCount} Primary pathway${
                          item.primaryCount === 1 ? '' : 's'
                        } selected`
                      : 'Primary pathway required'}
                  </div>
                </header>
                <div className="basket-outcome-card-content">
                  {item.primaryPathways.length === 0 ? (
                    <NavLink
                      className="basket-add-link"
                      to={`/design/outcomes/${item.outcomeId}`}
                      onClick={onClose}
                    >
                      Complete outcome selection
                    </NavLink>
                  ) : (
                    <div className="basket-pathway-group basket-primary-pathways">
                      <h4>Primary pathways</h4>
                      <ul className="basket-pathways">
                        {item.primaryPathways.map((pathway) => (
                          <BasketPathwayRow
                            key={pathway.pathwayId}
                            pathway={pathway}
                            onRemove={() =>
                              removeLink(item.outcomeId, pathway.pathwayId)
                            }
                          />
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="basket-pathway-group basket-related-pathways">
                    <h4>Related pathways</h4>
                    {item.relatedPathways.length === 0 ? (
                      <p className="basket-empty-related">None selected</p>
                    ) : (
                      <ul className="basket-pathways">
                        {item.relatedPathways.map((pathway) => (
                          <BasketPathwayRow
                            key={pathway.pathwayId}
                            pathway={pathway}
                            onRemove={() =>
                              removeLink(item.outcomeId, pathway.pathwayId)
                            }
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </li>
            ))}
            {custom && (
              <li
                className={`basket-outcome-card ${
                  customValidation.complete ? '' : 'needs-attention'
                }`}
                id="basket-outcome-custom"
              >
                <header className="basket-outcome-card-header">
                  <span className="basket-outcome-position">
                    Outcome {selectedOutcomes.length + 1} of {outcomeCount}
                  </span>
                  <div className="basket-item-row">
                    <h3 className="basket-outcome-title">
                      <NavLink
                        className="basket-outcome-link"
                        to="/design/custom-innovation"
                        onClick={onClose}
                      >
                        {custom.shortLabel || 'Untitled custom outcome'}
                      </NavLink>
                    </h3>
                    <button
                      type="button"
                      className="text-button danger"
                      onClick={() => {
                        if (
                          window.confirm(
                            'Remove the Custom Innovation Outcome and its custom pathway, indicators, activities and inputs?',
                          )
                        ) {
                          dispatch({ type: 'removeCustomInnovation' })
                        }
                      }}
                      aria-label="Remove custom innovation outcome"
                    >
                      Remove
                    </button>
                  </div>
                  <span className="relationship-badge">Custom innovation</span>
                  <div
                    className={`basket-requirement ${
                      customValidation.complete
                        ? 'requirement-met'
                        : 'needs-attention'
                    }`}
                  >
                    {customValidation.complete
                      ? 'Complete'
                      : 'Needs completion'}
                  </div>
                </header>
                <div className="basket-outcome-card-content">
                  <p className="basket-custom-statement">
                    {custom.statement ||
                      'Final Outcome statement still needed.'}
                  </p>
                  <div className="basket-pathway-group basket-custom-pathway-group">
                    <h4>Custom pathway</h4>
                    <p className="basket-custom-pathway">
                      {custom.pathway.name || 'Not named yet'}
                    </p>
                  </div>
                </div>
              </li>
            )}
          </ol>
        </section>
      )}
      {showConfigureHandoff && (
        <div className="basket-handoff">
          <p>
            When you have finished choosing outcomes and pathways, continue to
            configure your selected pathways.
          </p>
          {configureAvailable ? (
            <button
              className="button primary large basket-continue"
              type="button"
              onClick={() => void saveAndConfigure()}
              disabled={saveStatus === 'saving'}
            >
              {saveStatus === 'saving'
                ? 'Saving…'
                : 'Save & configure pathways'}
            </button>
          ) : (
            <>
              <p className="basket-handoff-requirement" role="status">
                {state.selectedFinalOutcomeIds.length === 0
                  ? 'Select a Final Outcome and a Primary pathway to continue'
                  : `Select a Primary pathway for ${incompleteOutcomeCount} remaining outcome${
                      incompleteOutcomeCount === 1 ? '' : 's'
                    }`}
              </p>
              <button
                className="button primary large basket-continue"
                type="button"
                disabled
              >
                Save & configure pathways
              </button>
            </>
          )}
        </div>
      )}
    </aside>
  )
}

export function AppLayout() {
  const location = useLocation()
  const { state } = useProjectDesign()
  const [basketOpen, setBasketOpen] = useState(false)
  const isDesignPage = location.pathname.startsWith('/design')
  const showBasket =
    isDesignPage && location.pathname !== '/design/theory-of-change'
  const showConfigureHandoff = location.pathname.startsWith('/design/outcomes')

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0 })
  }, [location.pathname])

  return (
    <>
      <Header />
      {isDesignPage && <ProjectSaveBar />}
      <div className={`app-shell ${showBasket ? 'with-basket' : ''}`}>
        <main id="main-content">
          <Outlet />
        </main>
        {showBasket && (
          <>
            <button
              type="button"
              className="mobile-basket-button"
              onClick={() => setBasketOpen(true)}
              aria-label={`Open project summary with ${getSelectedFinalOutcomeCount(state)} selected outcomes`}
            >
              Project summary ({getSelectedFinalOutcomeCount(state)})
            </button>
            <ProjectBasket
              open={basketOpen}
              onClose={() => setBasketOpen(false)}
              showConfigureHandoff={showConfigureHandoff}
            />
            {basketOpen && (
              <button
                type="button"
                className="basket-backdrop"
                aria-label="Close project summary"
                onClick={() => setBasketOpen(false)}
              />
            )}
          </>
        )}
      </div>
    </>
  )
}
