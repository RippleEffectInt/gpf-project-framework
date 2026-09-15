import { ProjectPersistenceError } from './errors'
import { parseProjectRecord } from './projectRecord'
import type {
  PersistedProjectDesignV1,
  ProjectRepository,
  ProjectSaveResult,
  ProjectSummary,
} from './types'

type FetchImplementation = typeof fetch

function browserFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const fetchFn = globalThis.fetch
  if (typeof fetchFn !== 'function') {
    throw new TypeError('globalThis.fetch is not available')
  }
  return fetchFn.call(globalThis, input, init)
}

function mapResponseError(status: number): ProjectPersistenceError {
  if (status === 401) return new ProjectPersistenceError('authentication')
  if (status === 403) return new ProjectPersistenceError('permission')
  if (status === 404) return new ProjectPersistenceError('not-found')
  if (status === 409 || status === 412) {
    return new ProjectPersistenceError('conflict')
  }
  return new ProjectPersistenceError('network')
}

function parseSummary(raw: unknown): ProjectSummary {
  if (
    typeof raw !== 'object' ||
    raw === null ||
    !('id' in raw) ||
    typeof raw.id !== 'string' ||
    !('name' in raw) ||
    typeof raw.name !== 'string' ||
    !('status' in raw) ||
    !['Draft', 'Submitted', 'Changes Requested', 'Approved'].includes(
      String(raw.status),
    ) ||
    !('frameworkVersion' in raw) ||
    typeof raw.frameworkVersion !== 'string' ||
    !('schemaVersion' in raw) ||
    typeof raw.schemaVersion !== 'number' ||
    !('modifiedAt' in raw) ||
    typeof raw.modifiedAt !== 'string'
  ) {
    throw new ProjectPersistenceError('malformed-data')
  }
  return {
    id: raw.id,
    name: raw.name,
    projectCode:
      'projectCode' in raw && typeof raw.projectCode === 'string'
        ? raw.projectCode
        : undefined,
    country:
      'country' in raw && typeof raw.country === 'string'
        ? raw.country
        : undefined,
    status: raw.status as ProjectSummary['status'],
    frameworkVersion: raw.frameworkVersion,
    schemaVersion: raw.schemaVersion,
    modifiedAt: raw.modifiedAt,
  }
}

function parseSaveResult(
  raw: unknown,
  responseEtag: string | null,
): ProjectSaveResult {
  if (
    typeof raw === 'object' &&
    raw !== null &&
    'status' in raw &&
    raw.status === 'metadata-sync-required' &&
    'record' in raw &&
    'metadataSyncToken' in raw &&
    typeof raw.metadataSyncToken === 'string'
  ) {
    const record = parseProjectRecord(raw.record)
    return {
      status: 'metadata-sync-required',
      record: responseEtag ? { ...record, etag: responseEtag } : record,
      metadataSyncToken: raw.metadataSyncToken,
    }
  }
  const record = parseProjectRecord(raw)
  return responseEtag ? { ...record, etag: responseEtag } : record
}

export class SharePointProjectRepository implements ProjectRepository {
  readonly kind = 'sharepoint' as const
  private readonly baseUrl: string
  private readonly fetchImplementation: FetchImplementation

  constructor(
    baseUrl = '/api/projects',
    fetchImplementation: FetchImplementation = browserFetch,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '') || '/api/projects'
    this.fetchImplementation = fetchImplementation
  }

  private requestUrl(path: string): string {
    return `${this.baseUrl}${path}`
  }

  private async request(
    path: string,
    init?: RequestInit,
  ): Promise<{ body: unknown; etag: string | null }> {
    const url = this.requestUrl(path)
    const requestInit: RequestInit = {
      ...init,
      method: init?.method ?? 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    }
    console.info('[gpf] request:before-fetch', {
      url,
      method: requestInit.method,
      fetchType: typeof this.fetchImplementation,
    })
    let response: Response
    try {
      response = await this.fetchImplementation(url, requestInit)
    } catch (reason) {
      console.info('[gpf] request:caught', {
        phase: 'fetch',
        name: reason instanceof Error ? reason.name : 'unknown',
        message: reason instanceof Error ? reason.message : 'unknown',
      })
      throw new ProjectPersistenceError('network', undefined, {
        cause: reason,
      })
    }
    if (!response.ok) throw mapResponseError(response.status)
    try {
      return {
        body: (await response.json()) as unknown,
        etag: response.headers.get('ETag'),
      }
    } catch (reason) {
      throw new ProjectPersistenceError('malformed-data', undefined, {
        cause: reason,
      })
    }
  }

  async createProject(project: PersistedProjectDesignV1) {
    const response = await this.request('', {
      method: 'POST',
      body: JSON.stringify(project),
    })
    return parseSaveResult(response.body, response.etag)
  }

  async updateProject(project: PersistedProjectDesignV1, etag: string) {
    const response = await this.request(
      `/${encodeURIComponent(project.project.id)}`,
      {
        method: 'PUT',
        headers: { 'If-Match': etag },
        body: JSON.stringify(project),
      },
    )
    return parseSaveResult(response.body, response.etag)
  }

  async retryMetadataSync(projectId: string, metadataSyncToken: string) {
    const response = await this.request(
      `/${encodeURIComponent(projectId)}/metadata-sync`,
      {
        method: 'POST',
        body: JSON.stringify({ metadataSyncToken }),
      },
    )
    return parseSaveResult(response.body, response.etag)
  }

  async getProject(id: string) {
    try {
      const response = await this.request(`/${encodeURIComponent(id)}`)
      const record = parseProjectRecord(response.body)
      return response.etag ? { ...record, etag: response.etag } : record
    } catch (reason) {
      if (
        reason instanceof ProjectPersistenceError &&
        reason.code === 'not-found'
      ) {
        return null
      }
      throw reason
    }
  }

  async listProjects(): Promise<ProjectSummary[]> {
    console.info('[gpf] list:entered', {
      kind: this.kind,
      url: this.requestUrl(''),
    })
    const { body } = await this.request('', { method: 'GET' })
    if (!Array.isArray(body)) {
      throw new ProjectPersistenceError('malformed-data')
    }
    return body.map(parseSummary)
  }
}
