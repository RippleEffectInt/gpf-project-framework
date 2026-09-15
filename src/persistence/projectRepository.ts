import { ProjectPersistenceError } from './errors'
import { LocalProjectRepository } from './localProjectRepository'
import { SharePointProjectRepository } from './sharePointProjectRepository'
import type { ProjectRepository } from './types'

export type ProjectRepositoryMode = 'local' | 'sharepoint'

export interface ProjectRepositoryConfig {
  mode: ProjectRepositoryMode
  apiBaseUrl: string
}

interface RepositoryEnvironment {
  VITE_PROJECT_REPOSITORY?: string
  VITE_PROJECT_API_BASE_URL?: string
  PROD?: boolean
  MODE?: string
}

export const GPF_REPOSITORY_MODE: ProjectRepositoryMode =
  __GPF_CLIENT_REPOSITORY_MODE__

export const GPF_REPOSITORY_MODE_MARKER =
  __GPF_CLIENT_REPOSITORY_MODE__ === 'sharepoint'
    ? 'gpf-repository-mode:sharepoint'
    : 'gpf-repository-mode:local'

export const GPF_REPOSITORY_MODE_DIAGNOSTIC =
  __GPF_CLIENT_REPOSITORY_MODE__ === 'sharepoint'
    ? '[gpf] repositoryMode:sharepoint'
    : '[gpf] repositoryMode:local'

function defaultApiBaseUrl(): string {
  return import.meta.env.VITE_PROJECT_API_BASE_URL ?? '/api/projects'
}

export function isProductionClientEnvironment(
  environment: RepositoryEnvironment,
): boolean {
  return environment.MODE === 'production' || environment.PROD === true
}

export function readProjectRepositoryConfig(
  environment: RepositoryEnvironment = {
    VITE_PROJECT_REPOSITORY: import.meta.env.VITE_PROJECT_REPOSITORY,
    VITE_PROJECT_API_BASE_URL: import.meta.env.VITE_PROJECT_API_BASE_URL,
    PROD: import.meta.env.PROD,
    MODE: import.meta.env.MODE,
  },
): ProjectRepositoryConfig {
  const productionClient = isProductionClientEnvironment(environment)
  const mode =
    environment.VITE_PROJECT_REPOSITORY ??
    (productionClient ? 'sharepoint' : 'local')
  if (mode !== 'local' && mode !== 'sharepoint') {
    throw new ProjectPersistenceError(
      'configuration',
      'VITE_PROJECT_REPOSITORY must be either "local" or "sharepoint".',
    )
  }
  if (productionClient && mode !== 'sharepoint') {
    throw new ProjectPersistenceError(
      'configuration',
      'Production builds must use the SharePoint project repository.',
    )
  }
  return {
    mode,
    apiBaseUrl: environment.VITE_PROJECT_API_BASE_URL ?? '/api/projects',
  }
}

/**
 * Vite `build` replaces `__GPF_CLIENT_REPOSITORY_MODE__` with "sharepoint" so
 * LocalProjectRepository is eliminated. Do not branch on import.meta.env.PROD:
 * Vite 7 sets PROD from NODE_ENV, which is often not "production" during CI
 * `vite build`, and that silently selected LocalProjectRepository.
 */
export function createProjectRepository(
  config?: ProjectRepositoryConfig,
): ProjectRepository {
  if (__GPF_CLIENT_REPOSITORY_MODE__ === 'sharepoint') {
    const repository = new SharePointProjectRepository(
      config?.apiBaseUrl ?? defaultApiBaseUrl(),
    )
    console.info('[gpf] repository-instance', {
      kind: repository.kind,
      apiBaseUrl: config?.apiBaseUrl ?? defaultApiBaseUrl(),
    })
    return repository
  }
  const resolved = config ?? readProjectRepositoryConfig()
  return resolved.mode === 'sharepoint'
    ? new SharePointProjectRepository(resolved.apiBaseUrl)
    : new LocalProjectRepository()
}

let configuredRepository: ProjectRepository | null = null

export function getProjectRepository(): ProjectRepository {
  configuredRepository ??= createProjectRepository()
  return configuredRepository
}
