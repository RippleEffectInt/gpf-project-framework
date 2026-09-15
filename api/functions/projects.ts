import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions'
import {
  getProjectApiService,
  inspectStaticWebAppsPrincipal,
  projectApiErrorResponse,
  type ClientPrincipalParseDiagnostic,
  type ProjectApiResponse,
} from '../projectApi'
import { UnauthenticatedProjectRequestError } from '../projectAuditPolicy'

async function projectsCollection(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const inspected = inspectStaticWebAppsPrincipal(
    readClientPrincipalHeader(request),
  )
  try {
    const service = getProjectApiService()
    const response =
      request.method === 'GET'
        ? await service.list(inspected.principal)
        : await service.create(inspected.principal, await request.json())
    return httpResponse(response)
  } catch (reason) {
    return failedResponse(reason, context, inspected.diagnostic)
  }
}

async function projectItem(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const inspected = inspectStaticWebAppsPrincipal(
    readClientPrincipalHeader(request),
  )
  try {
    const service = getProjectApiService()
    const projectId = request.params.projectId
    const response =
      request.method === 'GET'
        ? await service.get(inspected.principal, projectId)
        : await service.update(
            inspected.principal,
            projectId,
            await request.json(),
            request.headers.get('if-match'),
          )
    return httpResponse(response)
  } catch (reason) {
    return failedResponse(reason, context, inspected.diagnostic)
  }
}

async function metadataSync(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const inspected = inspectStaticWebAppsPrincipal(
    readClientPrincipalHeader(request),
  )
  try {
    const body = (await request.json()) as unknown
    const metadataSyncToken =
      typeof body === 'object' && body !== null && 'metadataSyncToken' in body
        ? body.metadataSyncToken
        : undefined
    return httpResponse(
      await getProjectApiService().retryMetadataSync(
        inspected.principal,
        request.params.projectId,
        metadataSyncToken,
      ),
    )
  } catch (reason) {
    return failedResponse(reason, context, inspected.diagnostic)
  }
}

app.http('projects-collection', {
  route: 'projects',
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler: projectsCollection,
})

app.http('project-item', {
  route: 'projects/{projectId}',
  methods: ['GET', 'PUT'],
  authLevel: 'anonymous',
  handler: projectItem,
})

app.http('project-metadata-sync', {
  route: 'projects/{projectId}/metadata-sync',
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: metadataSync,
})

function readClientPrincipalHeader(request: HttpRequest): string | null {
  return (
    request.headers.get('x-ms-client-principal') ??
    request.headers.get('X-MS-CLIENT-PRINCIPAL')
  )
}

function httpResponse(response: ProjectApiResponse): HttpResponseInit {
  return {
    status: response.status,
    jsonBody: response.body,
    headers: response.headers,
  }
}

function failedResponse(
  reason: unknown,
  context: InvocationContext,
  principalDiagnostic?: ClientPrincipalParseDiagnostic,
): HttpResponseInit {
  const response = projectApiErrorResponse(reason)
  context.error('Project API request failed safely.', {
    status: response.status,
    errorType: reason instanceof Error ? reason.name : 'UnknownError',
    principalAuthReason:
      reason instanceof UnauthenticatedProjectRequestError
        ? reason.reason
        : undefined,
    identityProvider:
      reason instanceof UnauthenticatedProjectRequestError
        ? reason.identityProvider
        : principalDiagnostic?.identityProvider,
    principalDiagnostic,
  })
  return httpResponse(response)
}
