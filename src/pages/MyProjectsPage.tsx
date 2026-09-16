import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { asProjectPersistenceError } from '../persistence/errors'
import type {
  ProjectAuditIdentity,
  ProjectSummary,
} from '../persistence/types'
import { useAuthenticatedUser } from '../services/authenticationContext'
import type { AppUser } from '../services/authService'
import { getProjectResumePath } from '../state/journeySelectors'
import { useProjectDesign } from '../state/AppState'

function formatModifiedDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Unknown'
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
}

function auditIdentityMatchesUser(
  identity: ProjectAuditIdentity | undefined,
  user: AppUser,
): boolean {
  if (!identity) return false
  const userObjectId = user.id.trim().toLocaleLowerCase()
  const auditObjectId = identity.objectId.trim().toLocaleLowerCase()
  if (userObjectId && auditObjectId) {
    return userObjectId === auditObjectId
  }
  const userEmail = user.email.trim().toLocaleLowerCase()
  const auditEmail = identity.email.trim().toLocaleLowerCase()
  return Boolean(userEmail && auditEmail && userEmail === auditEmail)
}

function projectBelongsToUser(
  project: ProjectSummary,
  user: AppUser | null,
): boolean {
  return Boolean(
    user &&
      (auditIdentityMatchesUser(project.createdBy, user) ||
        auditIdentityMatchesUser(project.modifiedBy, user)),
  )
}

function ProjectCard({
  project,
  opening,
  onContinue,
}: {
  project: ProjectSummary
  opening: boolean
  onContinue: () => void
}) {
  return (
    <article className="project-card">
      <div className="project-card-heading">
        <div>
          <span className="eyebrow">{project.country}</span>
          <h3>{project.name}</h3>
        </div>
        <span
          className={`status status-${project.status
            .toLocaleLowerCase()
            .replace(' ', '-')}`}
        >
          {project.status}
        </span>
      </div>
      <dl className="project-metadata">
        <div>
          <dt>Project Code</dt>
          <dd>{project.projectCode || 'Not set'}</dd>
        </div>
        {project.potentialDonor && (
          <div>
            <dt>Potential Donor</dt>
            <dd>{project.potentialDonor}</dd>
          </div>
        )}
        <div>
          <dt>Framework</dt>
          <dd>{project.frameworkVersion}</dd>
        </div>
        <div>
          <dt>Last updated</dt>
          <dd>{formatModifiedDate(project.modifiedAt)}</dd>
        </div>
      </dl>
      <div className="project-card-actions">
        <button
          className="button secondary"
          type="button"
          onClick={onContinue}
          disabled={opening}
        >
          {opening ? 'Opening…' : 'Continue editing'}
        </button>
      </div>
    </article>
  )
}

export function MyProjectsPage() {
  const navigate = useNavigate()
  const user = useAuthenticatedUser()
  const { hasUnsavedChanges, listProjects, openProject, startNewProject } =
    useProjectDesign()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [openingProjectId, setOpeningProjectId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    let cancelled = false
    console.info('[gpf] my-projects:load-start')
    void listProjects()
      .then((items) => {
        if (!cancelled) {
          setProjects(items)
          setLoadError('')
        }
      })
      .catch((reason: unknown) => {
        const error = asProjectPersistenceError(reason)
        console.info('[gpf] my-projects:caught', {
          name: reason instanceof Error ? reason.name : typeof reason,
          code: error.code,
          message: error.message,
        })
        if (!cancelled) setLoadError(error.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [listProjects])

  const visibleProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return projects.filter(
      (project) =>
        (!status || project.status === status) &&
        (!normalizedQuery ||
          [
            project.name,
            project.projectCode,
            project.country,
            project.potentialDonor,
          ].some((value) =>
            value?.toLocaleLowerCase().includes(normalizedQuery),
          )),
    )
  }, [projects, query, status])
  const myProjects = useMemo(
    () =>
      projects
        .filter((project) => projectBelongsToUser(project, user))
        .sort((left, right) =>
          right.modifiedAt.localeCompare(left.modifiedAt),
        ),
    [projects, user],
  )

  const confirmReplaceUnsavedWork = () =>
    !hasUnsavedChanges ||
    window.confirm(
      'This will replace the unsaved project currently in the editor. Continue?',
    )

  const createNewProject = () => {
    if (!confirmReplaceUnsavedWork()) return
    startNewProject()
    navigate('/design/details')
  }

  const continueProject = async (id: string) => {
    if (!confirmReplaceUnsavedWork()) return
    setOpeningProjectId(id)
    setLoadError('')
    try {
      const design = await openProject(id)
      navigate(getProjectResumePath(design))
    } catch (reason) {
      setLoadError(asProjectPersistenceError(reason).message)
    } finally {
      setOpeningProjectId(null)
    }
  }

  return (
    <div className="page-container projects-page">
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">Project portfolio</span>
          <h1>Project Designs</h1>
          <p>
            Create and manage project designs using Ripple Effect’s standard
            Monitoring, Evaluation and Learning framework.
          </p>
        </div>
        <button
          className="button primary large"
          type="button"
          onClick={createNewProject}
        >
          Create New Project
        </button>
      </div>

      {loadError && (
        <div className="data-error" role="alert">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="state-panel" role="status">
          <h2>Loading projects</h2>
          <p>Retrieving your saved project designs…</p>
        </div>
      ) : (
        <>
          <section
            className="project-list-section"
            aria-labelledby="my-projects-heading"
          >
            <div className="project-list-heading">
              <h2 id="my-projects-heading">My Projects</h2>
              <p>Projects you created or most recently modified.</p>
            </div>
            {myProjects.length === 0 ? (
              <div className="empty-state compact-empty-state">
                <p>No projects currently match your audit identity.</p>
              </div>
            ) : (
              <div className="project-grid">
                {myProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    opening={openingProjectId === project.id}
                    onContinue={() => void continueProject(project.id)}
                  />
                ))}
              </div>
            )}
          </section>

          <section
            className="project-list-section"
            aria-labelledby="all-project-designs-heading"
          >
            <div className="project-list-heading">
              <h2 id="all-project-designs-heading">All Project Designs</h2>
              <p>All project designs you are permitted to access.</p>
            </div>
            <div className="filter-bar" aria-label="Project filters">
              <label className="search-field">
                <span>Search project designs</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by project, code, country or donor"
                />
              </label>
              <label>
                <span>Status</span>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="">All statuses</option>
                  <option>Draft</option>
                  <option>Submitted</option>
                  <option>Changes Requested</option>
                  <option>Approved</option>
                </select>
              </label>
            </div>
            {visibleProjects.length === 0 ? (
              <div className="empty-state">
                <h3>
                  {projects.length === 0
                    ? 'No saved projects yet'
                    : 'No projects match your filters'}
                </h3>
                <p>
                  {projects.length === 0
                    ? 'Create a project to begin a new design.'
                    : 'Clear or change the search criteria to see more projects.'}
                </p>
              </div>
            ) : (
              <div className="project-grid">
                {visibleProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    opening={openingProjectId === project.id}
                    onContinue={() => void continueProject(project.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
