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
}

export function readProjectRepositoryConfig(
  environment: RepositoryEnvironment = import.meta.env,
): ProjectRepositoryConfig {
  const mode = environment.VITE_PROJECT_REPOSITORY ?? 'local'
  if (mode !== 'local' && mode !== 'sharepoint') {
    throw new ProjectPersistenceError(
      'configuration',
      'VITE_PROJECT_REPOSITORY must be either "local" or "sharepoint".',
    )
  }
  return {
    mode,
    apiBaseUrl: environment.VITE_PROJECT_API_BASE_URL ?? '/api/projects',
  }
}

export function createProjectRepository(
  config = readProjectRepositoryConfig(),
): ProjectRepository {
  return config.mode === 'sharepoint'
    ? new SharePointProjectRepository(config.apiBaseUrl)
    : new LocalProjectRepository()
}

let configuredRepository: ProjectRepository | null = null

export function getProjectRepository(): ProjectRepository {
  configuredRepository ??= createProjectRepository()
  return configuredRepository
}
