import { describe, expect, it } from 'vitest'
import {
  GRAPH_CERTIFICATE_ENV_KEYS,
  GraphTokenAcquisitionError,
} from '../../api/graphCertificateAuth'
import {
  inspectStaticWebAppsPrincipal,
  parseStaticWebAppsPrincipal,
  projectApiErrorResponse,
} from '../../api/projectApi'
import { UnauthenticatedProjectRequestError } from '../../api/projectAuditPolicy'
import { SHAREPOINT_PROJECT_SERVER_ENV_KEYS } from '../../api/sharePointProjectSchema'
import {
  MicrosoftGraphForbiddenError,
  MicrosoftGraphUnauthorizedError,
} from '../../api/microsoftGraphClient'

function encodePrincipal(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64')
}

describe('GET /api/projects authentication mapping', () => {
  it('maps only SWA principal rejection to 401 authentication JSON', () => {
    expect(
      projectApiErrorResponse(new UnauthenticatedProjectRequestError()),
    ).toEqual({
      status: 401,
      body: {
        code: 'authentication',
        message: 'The project request could not be completed.',
      },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(
      projectApiErrorResponse(new MicrosoftGraphUnauthorizedError()),
    ).toMatchObject({ status: 502, body: { code: 'graph-authentication' } })
    expect(
      projectApiErrorResponse(new GraphTokenAcquisitionError()),
    ).toMatchObject({ status: 503, body: { code: 'graph-unavailable' } })
    expect(
      projectApiErrorResponse(new MicrosoftGraphForbiddenError()),
    ).toMatchObject({ status: 502, body: { code: 'graph-permission' } })
  })

  it('parses SWA principals without requiring a claims array', () => {
    const encoded = encodePrincipal({
      identityProvider: 'aad',
      userId: 'object-1',
      userDetails: 'user@example.org',
    })
    expect(parseStaticWebAppsPrincipal(encoded)).toEqual({
      identityProvider: 'aad',
      userId: 'object-1',
      userDetails: 'user@example.org',
      claims: [],
    })
  })

  it('reports missing x-ms-client-principal without decoding secrets', () => {
    expect(inspectStaticWebAppsPrincipal(null)).toEqual({
      principal: null,
      diagnostic: {
        hasHeader: false,
        headerLength: 0,
        identityProvider: null,
        hasUserId: false,
        hasUserDetails: false,
        claimsIsArray: false,
        claimCount: 0,
        parseFailure: 'missing-header',
      },
    })
  })

  it('keeps the production certificate and SharePoint environment names', () => {
    expect(GRAPH_CERTIFICATE_ENV_KEYS).toEqual({
      tenantId: 'SHAREPOINT_TENANT_ID',
      clientId: 'SHAREPOINT_CLIENT_ID',
      thumbprint: 'SHAREPOINT_CERTIFICATE_THUMBPRINT',
      pfxBase64: 'SHAREPOINT_CERTIFICATE_PFX_BASE64',
      pfxPassword: 'SHAREPOINT_CERTIFICATE_PFX_PASSWORD',
    })
    expect(SHAREPOINT_PROJECT_SERVER_ENV_KEYS).toEqual({
      siteUrl: 'SHAREPOINT_SITE_URL',
      siteId: 'SHAREPOINT_SITE_ID',
      projectDesignsListId: 'SHAREPOINT_PROJECT_DESIGNS_LIST_ID',
      projectDesignFilesLibraryListId:
        'SHAREPOINT_PROJECT_DESIGN_FILES_LIBRARY_LIST_ID',
    })
  })
})
