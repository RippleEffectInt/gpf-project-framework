import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { App } from '../App'
import frameworkJson from '../data/framework-v1.0-normalized.json'
import { ProjectPersistenceError } from '../persistence/errors'
import { LocalProjectRepository } from '../persistence/localProjectRepository'
import { serializeProject } from '../persistence/projectSerialization'
import type {
  PersistedProjectDesignV1,
  ProjectRecord,
  ProjectRepository,
  ProjectSummary,
} from '../persistence/types'
import { FrameworkProvider, ProjectDesignProvider } from '../state/AppState'
import { initialProjectDesignState } from '../state/projectDesign'
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

function renderApp(repository: ProjectRepository, initialEntry = '/projects') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <FrameworkProvider initialData={framework}>
        <ProjectDesignProvider repository={repository}>
          <App />
        </ProjectDesignProvider>
      </FrameworkProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => window.localStorage.clear())

describe('project persistence workflow', () => {
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

  it('creates a new project and lists it in My Projects', async () => {
    const repository = new LocalProjectRepository({
      keyPrefix: 'test:create:',
    })
    renderApp(repository)

    fireEvent.click(screen.getByRole('button', { name: 'Create New Project' }))
    fireEvent.change(screen.getByLabelText('Project title *'), {
      target: { value: 'New saved project' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }))

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
    fireEvent.click(screen.getByRole('button', { name: 'Continue Editing' }))
    const title = await screen.findByLabelText('Project title *')
    expect(title).toHaveValue('Existing project')
    fireEvent.change(title, { target: { value: 'Updated project' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }))

    await waitFor(async () => {
      const record = await repository.getProject('PROJECT_1')
      expect(record?.project.project.name).toBe('Updated project')
      expect(record?.etag).toBe('"2"')
    })
  })

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
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }))

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
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }))

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
      await screen.findByRole('button', { name: 'Continue Editing' }),
    )
    const title = await screen.findByLabelText('Project title *')
    expect(title).toHaveValue('Original project')

    await repository.updateProject(
      document('Latest project from another editor'),
      created.etag,
    )
    fireEvent.change(title, { target: { value: 'My unsaved local changes' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }))

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
