import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type PropsWithChildren,
} from 'react'
import { loadFramework } from '../services/frameworkService'
import {
  asProjectPersistenceError,
  ProjectPersistenceError,
} from '../persistence/errors'
import { getProjectRepository } from '../persistence/projectRepository'
import {
  loadPersistedProject,
  serializeProject,
} from '../persistence/projectSerialization'
import type {
  ProjectRecord,
  ProjectRepository,
  ProjectSummary,
} from '../persistence/types'
import { isMetadataSyncRequiredResult } from '../persistence/types'
import type { FrameworkData } from '../types/framework'
import type { ProjectDesignState, ProjectStatus } from '../types/project'
import {
  CURRENT_FRAMEWORK,
  getFrameworkByVersion,
} from '../data/frameworkRegistry'
import {
  initialProjectDesignState,
  projectDesignReducer,
  type ProjectDesignAction,
} from './projectDesign'

interface FrameworkContextValue {
  data: FrameworkData | null
  loading: boolean
  error: string | null
  retry: () => void
  selectFrameworkVersion: (frameworkVersion: string) => boolean
}

const FrameworkContext = createContext<FrameworkContextValue | null>(null)

interface FrameworkProviderProps extends PropsWithChildren {
  initialData?: FrameworkData
}

export function FrameworkProvider({
  children,
  initialData,
}: FrameworkProviderProps) {
  const [data, setData] = useState<FrameworkData | null>(initialData ?? null)
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState<string | null>(null)

  const fetchFramework = useCallback(() => {
    void loadFramework()
      .then(setData)
      .catch((reason: unknown) => {
        const message =
          reason instanceof Error ? reason.message : 'Unable to load framework.'
        setError(message)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!initialData) fetchFramework()
  }, [fetchFramework, initialData])

  const retry = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchFramework()
  }, [fetchFramework])

  const selectFrameworkVersion = useCallback((frameworkVersion: string) => {
    const selected = getFrameworkByVersion(frameworkVersion)
    if (!selected) return false
    setData(selected)
    setLoading(false)
    setError(null)
    return true
  }, [])

  const value = useMemo(
    () => ({
      data,
      loading,
      error,
      retry,
      selectFrameworkVersion,
    }),
    [data, error, loading, retry, selectFrameworkVersion],
  )
  return (
    <FrameworkContext.Provider value={value}>
      {children}
    </FrameworkContext.Provider>
  )
}

export function useFramework(): FrameworkContextValue {
  const context = useContext(FrameworkContext)
  if (!context) {
    throw new Error('useFramework must be used within FrameworkProvider.')
  }
  return context
}

export type ProjectSaveStatus =
  'clean' | 'dirty' | 'saving' | 'error' | 'conflict'

interface ActiveProject {
  id: string
  projectCode?: string
  status: ProjectStatus
  etag: string
  modifiedAt: string
}

interface ProjectDesignContextValue {
  state: ProjectDesignState
  dispatch: Dispatch<ProjectDesignAction>
  activeProject: ActiveProject | null
  saveStatus: ProjectSaveStatus
  saveError: ProjectPersistenceError | null
  hasUnsavedChanges: boolean
  recoveryAvailable: boolean
  metadataSyncRequired: boolean
  metadataSyncing: boolean
  metadataSyncError: ProjectPersistenceError | null
  saveProject: () => Promise<boolean>
  retryMetadataSync: () => Promise<void>
  startNewProject: () => void
  openProject: (id: string) => Promise<void>
  reloadLatestProject: () => Promise<void>
  restoreUnsavedChanges: () => void
  listProjects: () => Promise<ProjectSummary[]>
  pathwayNavigationFeedback: PathwayNavigationFeedback | null
  announcePathwayNavigation: (feedback: PathwayNavigationFeedback) => void
  clearPathwayNavigationFeedback: () => void
}

export interface PathwayNavigationFeedback {
  finalOutcomeId: string
  pathwayId: string
  message: string
}

const ProjectDesignContext = createContext<ProjectDesignContextValue | null>(
  null,
)

interface ProjectDesignProviderProps extends PropsWithChildren {
  initialState?: ProjectDesignState
  repository?: ProjectRepository
}

interface MetadataSyncState {
  token: string
  syncing: boolean
  error: ProjectPersistenceError | null
}

function createProjectId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `project-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function ProjectDesignProvider({
  children,
  initialState = initialProjectDesignState,
  repository = getProjectRepository(),
}: ProjectDesignProviderProps) {
  const { data: framework, selectFrameworkVersion } = useFramework()
  const [state, reducerDispatch] = useReducer(
    projectDesignReducer,
    initialState,
  )
  const revisionRef = useRef(0)
  const [activeProject, setActiveProject] = useState<ActiveProject | null>(null)
  const [saveStatus, setSaveStatus] = useState<ProjectSaveStatus>('clean')
  const [saveError, setSaveError] = useState<ProjectPersistenceError | null>(
    null,
  )
  const [recoveryState, setRecoveryState] = useState<ProjectDesignState | null>(
    null,
  )
  const [metadataSyncState, setMetadataSyncState] =
    useState<MetadataSyncState | null>(null)
  const [pathwayNavigationFeedback, setPathwayNavigationFeedback] =
    useState<PathwayNavigationFeedback | null>(null)
  const dispatch = useCallback<Dispatch<ProjectDesignAction>>((action) => {
    reducerDispatch(action)
    if (
      action.type !== 'saveDraft' &&
      action.type !== 'replaceState' &&
      action.type !== 'reset'
    ) {
      revisionRef.current += 1
      setSaveStatus((current) =>
        current === 'conflict' ? 'conflict' : 'dirty',
      )
      setSaveError((current) => (current?.code === 'conflict' ? current : null))
    }
  }, [])

  const applyRecord = useCallback(
    (record: ProjectRecord, preserveRecovery = false) => {
      const exactFramework =
        record.project.frameworkVersion === framework?.frameworkVersion
          ? framework
          : getFrameworkByVersion(record.project.frameworkVersion)
      if (!exactFramework) {
        throw new ProjectPersistenceError(
          'configuration',
          'The exact framework version for this project is unavailable.',
        )
      }
      const loaded = loadPersistedProject(record.project, exactFramework)
      selectFrameworkVersion(exactFramework.frameworkVersion)
      reducerDispatch({
        type: 'replaceState',
        state: { ...loaded.design, lastSavedAt: record.modifiedAt },
      })
      revisionRef.current = 0
      setActiveProject({
        id: record.project.project.id,
        projectCode: record.project.project.projectCode,
        status: record.project.project.status,
        etag: record.etag,
        modifiedAt: record.modifiedAt,
      })
      setSaveStatus('clean')
      setSaveError(null)
      setMetadataSyncState(null)
      if (!preserveRecovery) setRecoveryState(null)
    },
    [framework, selectFrameworkVersion],
  )

  const saveProject = useCallback(async (): Promise<boolean> => {
    if (!framework) {
      setSaveError(
        new ProjectPersistenceError(
          'configuration',
          'The framework must finish loading before this project can be saved.',
        ),
      )
      setSaveStatus('error')
      return false
    }
    const designToSave = state
    if (!designToSave.metadata.title.trim()) {
      setSaveError(
        new ProjectPersistenceError(
          'configuration',
          'Add a project title before saving.',
        ),
      )
      setSaveStatus('error')
      return false
    }
    const revisionAtStart = revisionRef.current
    setSaveStatus('saving')
    setSaveError(null)
    try {
      const document = serializeProject({
        id: activeProject?.id ?? createProjectId(),
        projectCode: activeProject?.projectCode,
        status: activeProject?.status ?? 'Draft',
        design: designToSave,
        framework,
      })
      const result = activeProject
        ? await repository.updateProject(document, activeProject.etag)
        : await repository.createProject(document)
      const metadataSyncRequired = isMetadataSyncRequiredResult(result)
      const record = metadataSyncRequired ? result.record : result
      setActiveProject({
        id: record.project.project.id,
        projectCode: record.project.project.projectCode,
        status: record.project.project.status,
        etag: record.etag,
        modifiedAt: record.modifiedAt,
      })
      reducerDispatch({ type: 'saveDraft', savedAt: record.modifiedAt })
      setSaveStatus(revisionRef.current === revisionAtStart ? 'clean' : 'dirty')
      setMetadataSyncState(
        metadataSyncRequired
          ? {
              token: result.metadataSyncToken,
              syncing: false,
              error: null,
            }
          : null,
      )
      setRecoveryState(null)
      return true
    } catch (reason) {
      const error = asProjectPersistenceError(reason)
      setSaveError(error)
      setSaveStatus(error.code === 'conflict' ? 'conflict' : 'error')
      if (error.code === 'conflict') setRecoveryState(designToSave)
      return false
    }
  }, [activeProject, framework, repository, state])

  const retryMetadataSync = useCallback(async () => {
    if (!activeProject || !metadataSyncState) return
    if (!repository.retryMetadataSync) {
      setMetadataSyncState((current) =>
        current
          ? {
              ...current,
              error: new ProjectPersistenceError(
                'configuration',
                'Metadata synchronisation is unavailable in this environment.',
              ),
            }
          : null,
      )
      return
    }
    setMetadataSyncState((current) =>
      current ? { ...current, syncing: true, error: null } : null,
    )
    try {
      const result = await repository.retryMetadataSync(
        activeProject.id,
        metadataSyncState.token,
      )
      const stillRequired = isMetadataSyncRequiredResult(result)
      const record = stillRequired ? result.record : result
      setActiveProject({
        id: record.project.project.id,
        projectCode: record.project.project.projectCode,
        status: record.project.project.status,
        etag: record.etag,
        modifiedAt: record.modifiedAt,
      })
      setMetadataSyncState(
        stillRequired
          ? {
              token: result.metadataSyncToken,
              syncing: false,
              error: null,
            }
          : null,
      )
    } catch (reason) {
      setMetadataSyncState((current) =>
        current
          ? {
              ...current,
              syncing: false,
              error: asProjectPersistenceError(reason),
            }
          : null,
      )
    }
  }, [activeProject, metadataSyncState, repository])

  const startNewProject = useCallback(() => {
    selectFrameworkVersion(CURRENT_FRAMEWORK.frameworkVersion)
    reducerDispatch({ type: 'reset' })
    revisionRef.current = 0
    setActiveProject(null)
    setSaveStatus('clean')
    setSaveError(null)
    setRecoveryState(null)
    setMetadataSyncState(null)
    setPathwayNavigationFeedback(null)
  }, [selectFrameworkVersion])

  const openProject = useCallback(
    async (id: string) => {
      try {
        const record = await repository.getProject(id)
        if (!record) throw new ProjectPersistenceError('not-found')
        applyRecord(record)
      } catch (reason) {
        const error = asProjectPersistenceError(reason)
        setSaveError(error)
        throw error
      }
    },
    [applyRecord, repository],
  )

  const reloadLatestProject = useCallback(async () => {
    if (!activeProject) return
    try {
      const localRecovery = recoveryState ?? state
      const record = await repository.getProject(activeProject.id)
      if (!record) throw new ProjectPersistenceError('not-found')
      setRecoveryState(localRecovery)
      applyRecord(record, true)
    } catch (reason) {
      const error = asProjectPersistenceError(reason)
      setSaveError(error)
      setSaveStatus(error.code === 'conflict' ? 'conflict' : 'error')
    }
  }, [activeProject, applyRecord, recoveryState, repository, state])

  const restoreUnsavedChanges = useCallback(() => {
    if (!recoveryState) return
    reducerDispatch({ type: 'replaceState', state: recoveryState })
    revisionRef.current += 1
    setRecoveryState(null)
    setSaveError(null)
    setSaveStatus('dirty')
  }, [recoveryState])

  const listProjects = useCallback(
    () => repository.listProjects(),
    [repository],
  )
  const announcePathwayNavigation = useCallback(
    (feedback: PathwayNavigationFeedback) =>
      setPathwayNavigationFeedback(feedback),
    [],
  )
  const clearPathwayNavigationFeedback = useCallback(
    () => setPathwayNavigationFeedback(null),
    [],
  )
  const value = useMemo(
    () => ({
      state,
      dispatch,
      activeProject,
      saveStatus,
      saveError,
      hasUnsavedChanges:
        saveStatus === 'dirty' ||
        saveStatus === 'saving' ||
        saveStatus === 'error' ||
        saveStatus === 'conflict',
      recoveryAvailable: recoveryState !== null,
      metadataSyncRequired: metadataSyncState !== null,
      metadataSyncing: metadataSyncState?.syncing ?? false,
      metadataSyncError: metadataSyncState?.error ?? null,
      saveProject,
      retryMetadataSync,
      startNewProject,
      openProject,
      reloadLatestProject,
      restoreUnsavedChanges,
      listProjects,
      pathwayNavigationFeedback,
      announcePathwayNavigation,
      clearPathwayNavigationFeedback,
    }),
    [
      announcePathwayNavigation,
      activeProject,
      clearPathwayNavigationFeedback,
      dispatch,
      listProjects,
      openProject,
      pathwayNavigationFeedback,
      metadataSyncState,
      recoveryState,
      reloadLatestProject,
      restoreUnsavedChanges,
      saveError,
      saveProject,
      saveStatus,
      state,
      startNewProject,
      retryMetadataSync,
    ],
  )
  return (
    <ProjectDesignContext.Provider value={value}>
      {children}
    </ProjectDesignContext.Provider>
  )
}

export function useProjectDesign(): ProjectDesignContextValue {
  const context = useContext(ProjectDesignContext)
  if (!context) {
    throw new Error(
      'useProjectDesign must be used within ProjectDesignProvider.',
    )
  }
  return context
}
