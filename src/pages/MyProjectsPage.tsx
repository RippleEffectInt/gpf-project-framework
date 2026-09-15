import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { asProjectPersistenceError } from '../persistence/errors'
import type { ProjectSummary } from '../persistence/types'
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

export function MyProjectsPage() {
  const navigate = useNavigate()
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
          [project.name, project.country, project.projectCode].some((value) =>
            value?.toLocaleLowerCase().includes(normalizedQuery),
          )),
    )
  }, [projects, query, status])

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
      await openProject(id)
      navigate('/design/details')
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
          <h1>My Projects</h1>
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

      <section className="filter-bar" aria-label="Project filters">
        <label className="search-field">
          <span>Search projects</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by project, code or country"
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
      </section>

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
      ) : visibleProjects.length === 0 ? (
        <div className="empty-state">
          <h2>
            {projects.length === 0
              ? 'No saved projects yet'
              : 'No projects match your filters'}
          </h2>
          <p>
            {projects.length === 0
              ? 'Create a project to begin a new design.'
              : 'Clear or change the search criteria to see more projects.'}
          </p>
        </div>
      ) : (
        <div className="project-grid">
          {visibleProjects.map((project) => (
            <article className="project-card" key={project.id}>
              <div className="project-card-heading">
                <div>
                  <span className="eyebrow">{project.country}</span>
                  <h2>{project.name}</h2>
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
                  onClick={() => void continueProject(project.id)}
                  disabled={openingProjectId !== null}
                >
                  {openingProjectId === project.id
                    ? 'Opening…'
                    : 'Continue Editing'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
