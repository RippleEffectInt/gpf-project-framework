import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { App } from '../App'
import frameworkJson from '../data/framework-v1.0-normalized.json'
import { ProjectPersistenceError } from '../persistence/errors'
import { LocalProjectRepository } from '../persistence/localProjectRepository'
import { SharePointProjectRepository } from '../persistence/sharePointProjectRepository'
import { serializeProject } from '../persistence/projectSerialization'
import { AuthenticatedUserContext } from '../services/authenticationContext'
import type { AppUser } from '../services/authService'
import {
  getPathwayIntermediateOutcomeSeeds,
  getPrimaryPathwaysForFinalOutcome,
} from '../services/frameworkService'
import type {
  PersistedProjectDesignV1,
  ProjectRecord,
  ProjectRepository,
  ProjectSummary,
} from '../persistence/types'
import { FrameworkProvider, ProjectDesignProvider } from '../state/AppState'
import {
  initialProjectDesignState,
  projectDesignReducer,
} from '../state/projectDesign'
import type { FrameworkData } from '../types/framework'
import type { ProjectDesignState } from '../types/project'

const framework = frameworkJson as FrameworkData

function design(name: string): ProjectDesignState {
  return {
    ...initialProjectDesignState,
    metadata: {
      ...initialProjectDesignState.metadata,
      title: name,
      country: 'Uganda',
    },
  }
}

function document(name: string): PersistedProjectDesignV1 {
  return serializeProject({
    id: 'PROJECT_1',
    status: 'Draft',
    design: design(name),
    framework,
  })
}

function resumeDesign(
  name: string,
  completion: 'selected' | 'partial' | 'complete',
): ProjectDesignState {
  const outcome = framework.finalOutcomes.find(
    (candidate) =>
      getPrimaryPathwaysForFinalOutcome(framework, candidate.id).length > 0,
  )
  if (!outcome) throw new Error('Expected a Final Outcome.')
  const pathway = getPrimaryPathwaysForFinalOutcome(
    framework,
    outcome.id,
  )[0]
  if (!pathway) throw new Error('Expected a Primary pathway.')
  let state = projectDesignReducer(design(name), {
    type: 'addPathway',
    finalOutcomeId: outcome.id,
    pathwayId: pathway.pathway.id,
    relationshipType: 'primary',
    frameworkPrimaryFinalOutcomeId:
      pathway.pathway.primaryFinalOutcomeId,
    intermediateOutcomes: getPathwayIntermediateOutcomeSeeds(
      framework,
      pathway.pathway.id,
    ),
  })
  if (completion === 'selected') return state
  const configurations =
    state.projectPathways[0]?.intermediateOutcomeConfigurations ?? []
  const configurationsToComplete =
    completion === 'complete' ? configurations : configurations.slice(0, 1)
  configurationsToComplete.forEach((configuration, index) => {
    state = projectDesignReducer(state, {
      type: 'addProjectSpecificActivity',
      pathwayId: pathway.pathway.id,
      intermediateOutcomeId:
        configuration.frameworkIntermediateOutcomeId,
      activity: {
        id: `RESUME_ACTIVITY_${index}`,
        wording: 'Resume test activity',
        projectDetails: '',
      },
    })
  })
  return completion === 'complete'
    ? projectDesignReducer(state, {
        type: 'markPathwayConfigured',
        pathwayId: pathway.pathway.id,
      })
    : state
}

function record(
  project: PersistedProjectDesignV1,
  etag = '"combined-etag"',
): ProjectRecord {
  return {
    project,
    etag,
    createdAt: '2026-09-15T10:00:00.000Z',
    modifiedAt: '2026-09-15T10:00:00.000Z',
  }
}

function renderApp(
  repository: ProjectRepository,
  initialEntry = '/projects',
  user: AppUser | null = null,
) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <FrameworkProvider initialData={framework}>
        <ProjectDesignProvider repository={repository}>
          <AuthenticatedUserContext.Provider value={user}>
            <App />
          </AuthenticatedUserContext.Provider>
        </ProjectDesignProvider>
      </FrameworkProvider>
    </MemoryRouter>,
  )
}

function fillRequiredProjectDetails(title: string) {
  fireEvent.change(screen.getByLabelText('Project title *'), {
    target: { value: title },
  })
  fireEvent.change(screen.getByLabelText('Country *'), {
    target: { value: 'Uganda' },
  })
  fireEvent.change(
    screen.getByLabelText('Funding opportunity / reference *'),
    { target: { value: 'REF-001' } },
  )
  fireEvent.change(
    screen.getByLabelText('Potential implementation start month'),
    { target: { value: '03' } },
  )
  fireEvent.change(
    screen.getByLabelText('Potential implementation start year'),
    { target: { value: '2027' } },
  )
  fireEvent.change(
    screen.getByLabelText('Potential implementation end month'),
    { target: { value: '11' } },
  )
  fireEvent.change(
    screen.getByLabelText('Potential implementation end year'),
    { target: { value: '2027' } },
  )
  fireEvent.change(screen.getByLabelText('Short project description *'), {
    target: { value: 'A complete project description.' },
  })
}

beforeEach(() => window.localStorage.clear())

describe('project persistence workflow', () => {
  it('saves valid Project Details before continuing', async () => {
    let resolveSave: (saved: ProjectRecord) => void = () => undefined
    let submitted: PersistedProjectDesignV1 | null = null
    const repository: ProjectRepository = {
      createProject: (project) => {
        submitted = project
        return new Promise<ProjectRecord>((resolve) => {
          resolveSave = resolve
        })
      },
      updateProject: async (project) => record(project),
      getProject: async () => null,
      listProjects: async () => [],
    }
    renderApp(repository, '/design/details')
    fillRequiredProjectDetails('Save and continue project')

    expect(screen.getByLabelText('Potential Donor')).toHaveValue('')
    expect(
      screen.queryByLabelText(/Project Manager/i),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Save Draft' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Continue' }),
    ).not.toBeInTheDocument()
    const saveAndContinue = screen.getByRole('button', {
      name: 'Save & continue',
    })
    fireEvent.click(saveAndContinue)

    expect(saveAndContinue).toBeDisabled()
    expect(saveAndContinue).toHaveTextContent('Saving…')
    expect(
      screen.getByRole('heading', { name: 'Tell us about the project' }),
    ).toBeInTheDocument()
    const savedProject = submitted as PersistedProjectDesignV1 | null
    expect(savedProject?.project.name).toBe('Save and continue project')
    if (!savedProject) throw new Error('Expected a submitted project.')
    resolveSave(record(savedProject))

    expect(
      await screen.findByRole('heading', {
        name: 'What change is this project trying to achieve?',
      }),
    ).toBeInTheDocument()
  })

  it('keeps Project Details and edits in place when Save & continue fails', async () => {
    const repository: ProjectRepository = {
      createProject: async () => {
        throw new ProjectPersistenceError('network')
      },
      updateProject: async () => {
        throw new ProjectPersistenceError('network')
      },
      getProject: async () => null,
      listProjects: async () => [],
    }
    renderApp(repository, '/design/details')
    fillRequiredProjectDetails('Unsaved complete project')

    fireEvent.click(
      screen.getByRole('button', { name: 'Save & continue' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The project could not be reached. Check your connection and try again.',
    )
    expect(
      screen.getByRole('heading', { name: 'Tell us about the project' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Project title *')).toHaveValue(
      'Unsaved complete project',
    )
  })

  it('shows project list loading while the repository request is pending', async () => {
    let resolveProjects: (projects: ProjectSummary[]) => void = () => undefined
    const repository: ProjectRepository = {
      createProject: async (): Promise<ProjectRecord> => {
        throw new Error('not used')
      },
      updateProject: async (): Promise<ProjectRecord> => {
        throw new Error('not used')
      },
      getProject: async () => null,
      listProjects: () =>
        new Promise<ProjectSummary[]>((resolve) => {
          resolveProjects = resolve
        }),
    }
    renderApp(repository)

    expect(screen.getByRole('status')).toHaveTextContent('Loading projects')
    resolveProjects([])
    expect(await screen.findByText('No saved projects yet')).toBeInTheDocument()
  })

  it('separates human-owned projects from all accessible project designs', async () => {
    const human: AppUser = {
      id: 'human-object-id',
      displayName: 'Human User',
      email: 'human@example.org',
    }
    const identity = (
      objectId: string,
      email: string,
      name = 'Audit user',
    ) => ({ objectId, email, name })
    const projects: ProjectSummary[] = [
      {
        id: 'CREATED',
        name: 'Created by human',
        country: 'Kenya',
        status: 'Draft',
        frameworkVersion: framework.frameworkVersion,
        schemaVersion: 1,
        modifiedAt: '2026-09-14T10:00:00.000Z',
        createdBy: identity('human-object-id', 'old-email@example.org'),
        modifiedBy: identity('other-object-id', 'other@example.org'),
      },
      {
        id: 'MODIFIED',
        name: 'Modified by human',
        projectCode: 'MOD-1',
        country: 'Uganda',
        status: 'Approved',
        frameworkVersion: framework.frameworkVersion,
        schemaVersion: 1,
        modifiedAt: '2026-09-16T10:00:00.000Z',
        modifiedBy: identity('', ' HUMAN@EXAMPLE.ORG '),
      },
      {
        id: 'BOTH',
        name: 'Created and modified by human',
        country: 'Tanzania',
        status: 'Submitted',
        frameworkVersion: framework.frameworkVersion,
        schemaVersion: 1,
        modifiedAt: '2026-09-15T10:00:00.000Z',
        potentialDonor: 'FCDO',
        createdBy: identity('human-object-id', 'human@example.org'),
        modifiedBy: identity('human-object-id', 'human@example.org'),
      },
      {
        id: 'OTHER',
        name: 'Another team project',
        country: 'Rwanda',
        status: 'Draft',
        frameworkVersion: framework.frameworkVersion,
        schemaVersion: 1,
        modifiedAt: '2026-09-13T10:00:00.000Z',
        createdBy: identity('other-object-id', 'other@example.org'),
        modifiedBy: identity('second-object-id', 'human@example.org'),
      },
    ]
    const repository: ProjectRepository = {
      createProject: async (project) => record(project),
      updateProject: async (project) => record(project),
      getProject: async () => null,
      listProjects: async () => projects,
    }
    renderApp(repository, '/projects', human)

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Project Designs',
      }),
    ).toBeInTheDocument()
    const mine = screen.getByRole('region', { name: 'My Projects' })
    const all = screen.getByRole('region', { name: 'All Project Designs' })
    expect(
      within(mine).getAllByRole('article').map((card) => card.textContent),
    ).toEqual([
      expect.stringContaining('Modified by human'),
      expect.stringContaining('Created and modified by human'),
      expect.stringContaining('Created by human'),
    ])
    expect(within(mine).getAllByRole('article')).toHaveLength(3)
    expect(within(all).getAllByRole('article')).toHaveLength(4)

    fireEvent.change(
      within(all).getByRole('searchbox', {
        name: 'Search project designs',
      }),
      { target: { value: 'FCDO' } },
    )
    expect(within(all).getAllByRole('article')).toHaveLength(1)
    expect(
      within(all).getByRole('heading', {
        name: 'Created and modified by human',
      }),
    ).toBeInTheDocument()
  })

  it('creates a new project and lists it in Project Designs', async () => {
    const repository = new LocalProjectRepository({
      keyPrefix: 'test:create:',
    })
    renderApp(repository)

    fireEvent.click(screen.getByRole('button', { name: 'Create New Project' }))
    fireEvent.change(screen.getByLabelText('Project title *'), {
      target: { value: 'New saved project' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }))

    await waitFor(async () => {
      await expect(repository.listProjects()).resolves.toEqual([
        expect.objectContaining({ name: 'New saved project' }),
      ])
    })
    expect(screen.getByText('Project saved.')).toBeInTheDocument()
  })

  it('opens and updates an existing project', async () => {
    const repository = new LocalProjectRepository({
      keyPrefix: 'test:update:',
    })
    await repository.createProject(document('Existing project'))
    renderApp(repository)

    expect(await screen.findByText('Existing project')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continue editing' }))
    expect(
      await screen.findByRole('heading', {
        name: 'What change is this project trying to achieve?',
      }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'Design Project' }))
    const title = await screen.findByLabelText('Project title *')
    expect(title).toHaveValue('Existing project')
    fireEvent.change(title, { target: { value: 'Updated project' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }))

    await waitFor(async () => {
      const record = await repository.getProject('PROJECT_1')
      expect(record?.project.project.name).toBe('Updated project')
      expect(record?.etag).toBe('"2"')
    })
  })

  it('loads an older project that retains Project Manager metadata', async () => {
    const repository = new LocalProjectRepository({
      keyPrefix: 'test:legacy-manager:',
    })
    const legacyDesign = design('Legacy manager project')
    legacyDesign.metadata.projectManager = 'Legacy Project Manager'
    await repository.createProject(
      serializeProject({
        id: 'LEGACY_PROJECT',
        status: 'Draft',
        design: legacyDesign,
        framework,
      }),
    )
    renderApp(repository)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Continue editing' }),
    )

    expect(
      await screen.findByRole('heading', {
        name: 'What change is this project trying to achieve?',
      }),
    ).toBeInTheDocument()
  })

  it.each([
    ['selected', 'Configure pathways'],
    ['partial', 'Configure pathways'],
    ['complete', 'Review Project Design'],
  ] as const)(
    'resumes a %s saved design at its furthest sensible stage',
    async (completion, expectedHeading) => {
      const designState = resumeDesign(
        `${completion} resume project`,
        completion,
      )
      const project = serializeProject({
        id: `RESUME_${completion.toUpperCase()}`,
        status: 'Draft',
        design: designState,
        framework,
      })
      const saved = record(project)
      const repository: ProjectRepository = {
        createProject: async (candidate) => record(candidate),
        updateProject: async (candidate) => record(candidate),
        getProject: async (id) =>
          id === project.project.id ? saved : null,
        listProjects: async () => [
          {
            id: project.project.id,
            name: project.project.name,
            country: project.project.country,
            status: project.project.status,
            frameworkVersion: project.frameworkVersion,
            schemaVersion: project.schemaVersion,
            modifiedAt: saved.modifiedAt,
          },
        ],
      }
      renderApp(repository)

      fireEvent.click(
        await screen.findByRole('button', { name: 'Continue editing' }),
      )

      expect(
        await screen.findByRole('heading', {
          level: 1,
          name: expectedHeading,
        }),
      ).toBeInTheDocument()
    },
  )

  it('keeps local edits when a save fails', async () => {
    const repository: ProjectRepository = {
      createProject: async () => {
        throw new ProjectPersistenceError('network')
      },
      updateProject: async () => {
        throw new ProjectPersistenceError('network')
      },
      getProject: async () => null,
      listProjects: async () => [],
    }
    renderApp(repository, '/design/details')

    const title = screen.getByLabelText('Project title *')
    fireEvent.change(title, { target: { value: 'Unsaved local project' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The project could not be reached. Check your connection and try again.',
    )
    expect(title).toHaveValue('Unsaved local project')
    expect(
      screen.getByRole('button', { name: 'Save project' }),
    ).not.toBeDisabled()
  })

  it('marks the design saved and offers metadata-only retry after a partial save', async () => {
    const retryMetadataSync = vi.fn(async () =>
      record(document('Authoritative saved project'), '"synced-etag"'),
    )
    const repository: ProjectRepository = {
      createProject: async (project) => ({
        status: 'metadata-sync-required',
        record: record(project),
        metadataSyncToken: 'opaque-sync-token',
      }),
      updateProject: async (project) => record(project),
      retryMetadataSync,
      getProject: async () => null,
      listProjects: async () => [],
    }
    renderApp(repository, '/design/details')

    const title = screen.getByLabelText('Project title *')
    fireEvent.change(title, {
      target: { value: 'Authoritative saved project' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }))

    expect(
      await screen.findByText(
        'Project design saved, but its project-list information still needs synchronising.',
      ),
    ).toBeInTheDocument()
    expect(title).toHaveValue('Authoritative saved project')
    expect(screen.getByRole('button', { name: 'Save project' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Retry metadata sync' }))
    await waitFor(() =>
      expect(retryMetadataSync).toHaveBeenCalledWith(
        expect.any(String),
        'opaque-sync-token',
      ),
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Retry metadata sync' }),
      ).not.toBeInTheDocument(),
    )
  })

  it('surfaces an ETag conflict and can reload then restore local work', async () => {
    const repository = new LocalProjectRepository({
      keyPrefix: 'test:conflict:',
    })
    const created = await repository.createProject(document('Original project'))
    renderApp(repository)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Continue editing' }),
    )
    fireEvent.click(
      await screen.findByRole('link', { name: 'Design Project' }),
    )
    const title = await screen.findByLabelText('Project title *')
    expect(title).toHaveValue('Original project')

    await repository.updateProject(
      document('Latest project from another editor'),
      created.etag,
    )
    fireEvent.change(title, { target: { value: 'My unsaved local changes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This project was changed elsewhere after you opened it. Your unsaved work has not been overwritten.',
    )
    expect(title).toHaveValue('My unsaved local changes')

    fireEvent.click(
      screen.getByRole('button', { name: 'Reload latest version' }),
    )
    await waitFor(() =>
      expect(title).toHaveValue('Latest project from another editor'),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Restore my unsaved changes' }),
    )
    expect(title).toHaveValue('My unsaved local changes')
  })

  it('issues GET /api/projects when My Projects loads through SharePointProjectRepository', async () => {
    const fetchImplementation = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(String(input)).toBe('/api/projects')
        expect(init?.method).toBe('GET')
        expect(init?.credentials).toBe('include')
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    )
    const repository = new SharePointProjectRepository(
      '/api/projects',
      fetchImplementation,
    )
    renderApp(repository)

    expect(await screen.findByText('No saved projects yet')).toBeInTheDocument()
    expect(fetchImplementation).toHaveBeenCalledTimes(1)
    expect(fetchImplementation).toHaveBeenCalledWith(
      '/api/projects',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      }),
    )
  })

  it('shows a safe project list error', async () => {
    const repository: ProjectRepository = {
      createProject: async (): Promise<ProjectRecord> => {
        throw new Error('not used')
      },
      updateProject: async (): Promise<ProjectRecord> => {
        throw new Error('not used')
      },
      getProject: async () => null,
      listProjects: async (): Promise<ProjectSummary[]> => {
        throw new ProjectPersistenceError('permission')
      },
    }
    renderApp(repository)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You do not have permission to access this project.',
    )
  })
})
