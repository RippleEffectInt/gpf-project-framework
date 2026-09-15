import type { SharePointProjectServerConfig } from './sharePointProjectSchema'

export interface MicrosoftGraphJsonClient {
  get(path: string): Promise<unknown>
}

export class SharePointProjectDriveResolutionError extends Error {
  constructor(cause?: unknown) {
    super(
      'The Graph drive for the configured Project Design Files library could not be resolved.',
      { cause },
    )
    this.name = 'SharePointProjectDriveResolutionError'
  }
}

/**
 * Create one resolver per Function process. Successful resolution is cached;
 * rejected requests are not cached so a later invocation can recover.
 */
export class SharePointProjectDriveResolver {
  private resolvedDriveId: string | null = null
  private resolution: Promise<string> | null = null

  constructor(
    private readonly config: SharePointProjectServerConfig,
    private readonly graph: MicrosoftGraphJsonClient,
  ) {}

  resolveDriveId(): Promise<string> {
    if (this.resolvedDriveId) return Promise.resolve(this.resolvedDriveId)
    if (this.resolution) return this.resolution

    this.resolution = this.resolve().then(
      (driveId) => {
        this.resolvedDriveId = driveId
        this.resolution = null
        return driveId
      },
      (reason) => {
        this.resolution = null
        throw reason instanceof SharePointProjectDriveResolutionError
          ? reason
          : new SharePointProjectDriveResolutionError(reason)
      },
    )
    return this.resolution
  }

  async warm(): Promise<void> {
    await this.resolveDriveId()
  }

  private async resolve(): Promise<string> {
    const siteId = encodeURIComponent(this.config.siteId)
    const libraryListId = encodeURIComponent(
      this.config.projectDesignFilesLibraryListId,
    )
    const response = await this.graph.get(
      `/sites/${siteId}/lists/${libraryListId}/drive?$select=id,sharepointIds`,
    )
    if (!isRecord(response) || typeof response.id !== 'string') {
      throw new SharePointProjectDriveResolutionError()
    }

    const resolvedListId = readResolvedListId(response.sharepointIds)
    if (
      resolvedListId &&
      normalizeGuid(resolvedListId) !==
        normalizeGuid(this.config.projectDesignFilesLibraryListId)
    ) {
      throw new SharePointProjectDriveResolutionError()
    }
    return response.id
  }
}

function readResolvedListId(value: unknown): string | null {
  if (!isRecord(value)) return null
  return typeof value.listId === 'string' ? value.listId : null
}

function normalizeGuid(value: string): string {
  return value.replace(/[{}]/g, '').toLowerCase()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
