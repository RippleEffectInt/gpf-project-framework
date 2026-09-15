import { ProjectPersistenceError } from './errors'
import { parseProjectRecord, toProjectSummary } from './projectRecord'
import type {
  PersistedProjectDesignV1,
  ProjectAuditIdentity,
  ProjectRecord,
  ProjectRepository,
  ProjectSummary,
} from './types'

interface ProjectStorage {
  readonly length: number
  clear(): void
  getItem(key: string): string | null
  key(index: number): string | null
  removeItem(key: string): void
  setItem(key: string, value: string): void
}

interface LocalProjectRepositoryOptions {
  storage?: ProjectStorage
  keyPrefix?: string
  now?: () => string
  identity?: ProjectAuditIdentity
}

function cloneRecord(record: ProjectRecord): ProjectRecord {
  return parseProjectRecord(JSON.parse(JSON.stringify(record)) as unknown)
}

export class LocalProjectRepository implements ProjectRepository {
  private readonly storage: ProjectStorage
  private readonly keyPrefix: string
  private readonly now: () => string
  private readonly identity?: ProjectAuditIdentity

  constructor(options: LocalProjectRepositoryOptions = {}) {
    this.storage = options.storage ?? window.localStorage
    this.keyPrefix = options.keyPrefix ?? 'project-framework:project:'
    this.now = options.now ?? (() => new Date().toISOString())
    this.identity = options.identity
  }

  private key(id: string): string {
    return `${this.keyPrefix}${id}`
  }

  async createProject(
    project: PersistedProjectDesignV1,
  ): Promise<ProjectRecord> {
    if (this.storage.getItem(this.key(project.project.id))) {
      throw new ProjectPersistenceError('conflict')
    }
    const timestamp = this.now()
    const record: ProjectRecord = {
      project,
      etag: '"1"',
      createdAt: timestamp,
      modifiedAt: timestamp,
      createdBy: this.identity,
      modifiedBy: this.identity,
    }
    this.storage.setItem(this.key(project.project.id), JSON.stringify(record))
    return cloneRecord(record)
  }

  async updateProject(
    project: PersistedProjectDesignV1,
    etag: string,
  ): Promise<ProjectRecord> {
    const current = await this.getProject(project.project.id)
    if (!current) throw new ProjectPersistenceError('not-found')
    if (current.etag !== etag) throw new ProjectPersistenceError('conflict')
    const revision = Number(current.etag.replace(/\D/g, '')) || 1
    const record: ProjectRecord = {
      ...current,
      project,
      etag: `"${revision + 1}"`,
      modifiedAt: this.now(),
      modifiedBy: this.identity,
    }
    this.storage.setItem(this.key(project.project.id), JSON.stringify(record))
    return cloneRecord(record)
  }

  async getProject(id: string): Promise<ProjectRecord | null> {
    const raw = this.storage.getItem(this.key(id))
    if (!raw) return null
    try {
      return parseProjectRecord(JSON.parse(raw) as unknown)
    } catch (reason) {
      if (reason instanceof ProjectPersistenceError) throw reason
      throw new ProjectPersistenceError('malformed-data', undefined, {
        cause: reason,
      })
    }
  }

  async listProjects(): Promise<ProjectSummary[]> {
    const projects: ProjectSummary[] = []
    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index)
      if (!key?.startsWith(this.keyPrefix)) continue
      const id = key.slice(this.keyPrefix.length)
      const record = await this.getProject(id)
      if (record) projects.push(toProjectSummary(record))
    }
    return projects.sort((left, right) =>
      right.modifiedAt.localeCompare(left.modifiedAt),
    )
  }
}
