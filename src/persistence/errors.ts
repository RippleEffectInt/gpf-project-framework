export type ProjectPersistenceErrorCode =
  | 'network'
  | 'authentication'
  | 'permission'
  | 'not-found'
  | 'malformed-data'
  | 'unsupported-schema'
  | 'conflict'
  | 'orphan-storage'
  | 'framework-incompatible'
  | 'configuration'

const safeMessages: Record<ProjectPersistenceErrorCode, string> = {
  network:
    'The project could not be reached. Check your connection and try again.',
  authentication: 'Your session has expired. Sign in again and retry.',
  permission: 'You do not have permission to access this project.',
  'not-found': 'The project could not be found. It may have been moved.',
  'malformed-data':
    'The saved project data is invalid and cannot be opened safely.',
  'unsupported-schema':
    'This project was saved with an unsupported project schema version.',
  conflict:
    'This project was changed elsewhere after you opened it. Your unsaved work has not been overwritten.',
  'orphan-storage':
    'The project file was created, but it could not be linked or cleaned up. Support must reconcile this storage record.',
  'framework-incompatible':
    'This project requires a framework version that is not available in this app.',
  configuration:
    'Project persistence is not configured correctly for this environment.',
}

export class ProjectPersistenceError extends Error {
  constructor(
    public readonly code: ProjectPersistenceErrorCode,
    message = safeMessages[code],
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'ProjectPersistenceError'
  }
}

export function asProjectPersistenceError(
  reason: unknown,
): ProjectPersistenceError {
  if (reason instanceof ProjectPersistenceError) return reason
  return new ProjectPersistenceError('network', undefined, { cause: reason })
}
