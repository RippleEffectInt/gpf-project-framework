import { MicrosoftGraphDataError } from './microsoftGraphClient'
import {
  SHAREPOINT_PROJECT_RESOURCE_SCHEMA,
  type SharePointGraphFields,
  type SharePointProjectServerConfig,
} from './sharePointProjectSchema'
import type {
  SharePointGraphProjectMetadataRecord,
  SharePointProjectDesignFile,
  SharePointProjectStorageGateway,
} from './sharePointProjectStorage'

export interface SharePointGraphRequestClient {
  get(path: string): Promise<unknown>
  request(path: string, init?: RequestInit): Promise<unknown>
  requestText(path: string, init?: RequestInit): Promise<string>
}

export interface SharePointDriveIdResolver {
  resolveDriveId(): Promise<string>
}

export class SharePointGraphStorageGateway implements SharePointProjectStorageGateway {
  constructor(
    private readonly config: SharePointProjectServerConfig,
    private readonly graph: SharePointGraphRequestClient,
    private readonly driveResolver: SharePointDriveIdResolver,
  ) {}

  async createDesignFile(input: {
    path: string
    content: string
    fields: SharePointGraphFields
  }): Promise<SharePointProjectDesignFile> {
    const driveId = await this.driveResolver.resolveDriveId()
    const path = graphFilePath(input.path)
    const created = await this.graph.request(
      `/drives/${encodeURIComponent(driveId)}/root:/${path}:/content`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'If-None-Match': '*',
        },
        body: input.content,
      },
    )
    const item = driveItem(created)
    await this.updateLibraryFields(driveId, item.driveItemId, input.fields)
    return this.getDesignFileByDriveItem(driveId, item.driveItemId)
  }

  async createMetadataItem(
    fields: SharePointGraphFields,
  ): Promise<SharePointGraphProjectMetadataRecord> {
    const created = await this.graph.request(this.listItemsPath(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    })
    const itemId = requiredString(created, 'id')
    return this.getMetadataItemById(itemId)
  }

  async deleteDesignFile(driveItemId: string): Promise<void> {
    const driveId = await this.driveResolver.resolveDriveId()
    await this.graph.request(
      `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(
        driveItemId,
      )}`,
      { method: 'DELETE' },
    )
  }

  async getDesignFileByPath(
    path: string,
  ): Promise<SharePointProjectDesignFile | null> {
    const driveId = await this.driveResolver.resolveDriveId()
    try {
      const raw = await this.graph.get(
        `/drives/${encodeURIComponent(driveId)}/root:/${graphFilePath(
          path,
        )}:?$select=id,name,webUrl,eTag,lastModifiedDateTime`,
      )
      const item = driveItem(raw)
      return this.getDesignFileByDriveItem(driveId, item.driveItemId)
    } catch (reason) {
      if (isNotFound(reason)) return null
      throw reason
    }
  }

  async getMetadataByProjectId(
    projectId: string,
  ): Promise<SharePointGraphProjectMetadataRecord | null> {
    const projectIdField =
      SHAREPOINT_PROJECT_RESOURCE_SCHEMA.listFields.ProjectId
    const filter = `fields/${projectIdField} eq '${escapeOData(projectId)}'`
    const query = new URLSearchParams({
      $expand: 'fields',
      $filter: filter,
      $top: '2',
    })
    const response = await this.graph.get(`${this.listItemsPath()}?${query}`)
    const items = collectionValues(response)
    if (items.length === 0) return null
    if (items.length > 1) {
      throw new MicrosoftGraphDataError(409)
    }
    return graphMetadataRecord(items[0])
  }

  async listMetadataItems(): Promise<SharePointGraphProjectMetadataRecord[]> {
    const records: SharePointGraphProjectMetadataRecord[] = []
    let path: string | null = `${this.listItemsPath()}?${new URLSearchParams({
      $expand: 'fields',
      $top: '200',
    })}`
    while (path) {
      const response = await this.graph.get(path)
      records.push(...collectionValues(response).map(graphMetadataRecord))
      path = nextLink(response)
    }
    return records
  }

  async getDesignFile(
    driveItemId: string,
  ): Promise<SharePointProjectDesignFile | null> {
    const driveId = await this.driveResolver.resolveDriveId()
    try {
      return await this.getDesignFileByDriveItem(driveId, driveItemId)
    } catch (reason) {
      if (isNotFound(reason)) return null
      throw reason
    }
  }

  async updateDesignFile(input: {
    driveItemId: string
    content: string
    ifMatch: string
    fields: SharePointGraphFields
  }): Promise<SharePointProjectDesignFile> {
    const driveId = await this.driveResolver.resolveDriveId()
    await this.graph.request(
      `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(
        input.driveItemId,
      )}/content`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'If-Match': input.ifMatch,
        },
        body: input.content,
      },
    )
    await this.updateLibraryFields(driveId, input.driveItemId, input.fields)
    return this.getDesignFileByDriveItem(driveId, input.driveItemId)
  }

  async updateMetadataItem(input: {
    itemId: string
    fields: SharePointGraphFields
    ifMatch: string
  }): Promise<SharePointGraphProjectMetadataRecord> {
    await this.graph.request(
      `${this.listItemsPath()}/${encodeURIComponent(input.itemId)}/fields`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'If-Match': input.ifMatch,
        },
        body: JSON.stringify(input.fields),
      },
    )
    return this.getMetadataItemById(input.itemId)
  }

  private async getDesignFileByDriveItem(
    driveId: string,
    driveItemId: string,
  ): Promise<SharePointProjectDesignFile> {
    const encodedDriveId = encodeURIComponent(driveId)
    const encodedItemId = encodeURIComponent(driveItemId)
    const raw = await this.graph.get(
      `/drives/${encodedDriveId}/items/${encodedItemId}?$select=id,name,webUrl,eTag,lastModifiedDateTime`,
    )
    const item = driveItem(raw)
    const content = await this.graph.requestText(
      `/drives/${encodedDriveId}/items/${encodedItemId}/content`,
    )
    return { ...item, content }
  }

  private async getMetadataItemById(
    itemId: string,
  ): Promise<SharePointGraphProjectMetadataRecord> {
    const raw = await this.graph.get(
      `${this.listItemsPath()}/${encodeURIComponent(itemId)}?$expand=fields`,
    )
    return graphMetadataRecord(raw)
  }

  private async updateLibraryFields(
    driveId: string,
    driveItemId: string,
    fields: SharePointGraphFields,
  ): Promise<void> {
    await this.graph.request(
      `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(
        driveItemId,
      )}/listItem/fields`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      },
    )
  }

  private listItemsPath(): string {
    return `/sites/${encodeURIComponent(
      this.config.siteId,
    )}/lists/${encodeURIComponent(this.config.projectDesignsListId)}/items`
  }
}

function graphMetadataRecord(
  raw: unknown,
): SharePointGraphProjectMetadataRecord {
  return {
    itemId: requiredString(raw, 'id'),
    etag: requiredString(raw, 'eTag', '@odata.etag'),
    fields: requiredRecord(raw, 'fields'),
  }
}

function driveItem(raw: unknown): Omit<SharePointProjectDesignFile, 'content'> {
  return {
    driveItemId: requiredString(raw, 'id'),
    fileName: requiredString(raw, 'name'),
    webUrl: requiredString(raw, 'webUrl'),
    etag: requiredString(raw, 'eTag', '@odata.etag'),
    modifiedAt: optionalString(raw, 'lastModifiedDateTime'),
  }
}

function collectionValues(raw: unknown): unknown[] {
  if (!isRecord(raw)) throw new MicrosoftGraphDataError(502)
  const value = raw.value
  if (!Array.isArray(value)) throw new MicrosoftGraphDataError(502)
  return value
}

function nextLink(raw: unknown): string | null {
  if (!isRecord(raw)) throw new MicrosoftGraphDataError(502)
  const value = raw['@odata.nextLink']
  if (value === undefined) return null
  if (typeof value !== 'string') throw new MicrosoftGraphDataError(502)
  return value
}

function requiredRecord(
  raw: unknown,
  property: string,
): Record<string, unknown> {
  if (!isRecord(raw)) throw new MicrosoftGraphDataError(502)
  const value = raw[property]
  if (!isRecord(value)) throw new MicrosoftGraphDataError(502)
  return value
}

function requiredString(raw: unknown, ...properties: string[]): string {
  if (!isRecord(raw)) throw new MicrosoftGraphDataError(502)
  for (const property of properties) {
    const value = raw[property]
    if (typeof value === 'string' && value) return value
  }
  throw new MicrosoftGraphDataError(502)
}

function optionalString(raw: unknown, property: string): string | undefined {
  if (!isRecord(raw)) return undefined
  const value = raw[property]
  return typeof value === 'string' && value ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNotFound(reason: unknown): boolean {
  return reason instanceof MicrosoftGraphDataError && reason.status === 404
}

function escapeOData(value: string): string {
  return value.replace(/'/g, "''")
}

function graphFilePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}
