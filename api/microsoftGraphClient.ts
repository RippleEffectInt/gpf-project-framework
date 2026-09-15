import {
  getGraphAccessToken,
  type GraphAccessTokenProvider,
} from './graphCertificateAuth'
import type { MicrosoftGraphJsonClient } from './sharePointProjectDriveResolver'

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0'

export class MicrosoftGraphUnauthorizedError extends Error {
  readonly status = 401

  constructor() {
    super('Microsoft Graph rejected the application authentication token.')
    this.name = 'MicrosoftGraphUnauthorizedError'
  }
}

export class MicrosoftGraphForbiddenError extends Error {
  readonly status = 403

  constructor() {
    super('Microsoft Graph denied access to the requested SharePoint resource.')
    this.name = 'MicrosoftGraphForbiddenError'
  }
}

export class MicrosoftGraphDataError extends Error {
  constructor(public readonly status: number) {
    super('Microsoft Graph could not complete the SharePoint data request.')
    this.name = 'MicrosoftGraphDataError'
  }
}

export interface GraphTokenProvider {
  getGraphAccessToken(): Promise<string>
}

export class MicrosoftGraphClient implements MicrosoftGraphJsonClient {
  constructor(
    private readonly tokenProvider: GraphTokenProvider,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  async get(path: string): Promise<unknown> {
    return this.request(path)
  }

  async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await this.execute(path, init)
    if (response.status === 204) return null
    try {
      return (await response.json()) as unknown
    } catch {
      throw new MicrosoftGraphDataError(response.status)
    }
  }

  async requestText(path: string, init: RequestInit = {}): Promise<string> {
    const response = await this.execute(path, init)
    return response.text()
  }

  private async execute(path: string, init: RequestInit): Promise<Response> {
    const accessToken = await this.tokenProvider.getGraphAccessToken()
    const response = await this.fetchImplementation(graphUrl(path), {
      ...init,
      headers: {
        Accept: 'application/json',
        ...init.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    })
    if (response.status === 401) throw new MicrosoftGraphUnauthorizedError()
    if (response.status === 403) throw new MicrosoftGraphForbiddenError()
    if (!response.ok) throw new MicrosoftGraphDataError(response.status)
    return response
  }
}

let processGraphClient: MicrosoftGraphClient | null = null

export function getMicrosoftGraphClient(): MicrosoftGraphClient {
  processGraphClient ??= new MicrosoftGraphClient({
    getGraphAccessToken,
  })
  return processGraphClient
}

export function graphClientForTokenProvider(
  tokenProvider: GraphAccessTokenProvider,
  fetchImplementation: typeof fetch = fetch,
): MicrosoftGraphClient {
  return new MicrosoftGraphClient(tokenProvider, fetchImplementation)
}

function graphUrl(path: string): string {
  if (!path.startsWith('http')) {
    return `${GRAPH_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
  }
  const url = new URL(path)
  if (url.origin !== 'https://graph.microsoft.com') {
    throw new MicrosoftGraphDataError(400)
  }
  return url.toString()
}
