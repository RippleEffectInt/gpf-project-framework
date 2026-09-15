import {
  app,
  type HttpRequest,
  type HttpResponseInit,
  type InvocationContext,
} from '@azure/functions'
import {
  getProjectApiService,
  parseStaticWebAppsPrincipal,
  projectApiErrorResponse,
  type ProjectApiResponse,
} from '../projectApi'

async function projectsCollection(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const service = getProjectApiService()
    const principal = principalFrom(request)
    const response =
      request.method === 'GET'
        ? await service.list(principal)
        : await service.create(principal, await request.json())
    return httpResponse(response)
  } catch (reason) {
    return failedResponse(reason, context)
  }
}

async function projectItem(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const service = getProjectApiService()
    const principal = principalFrom(request)
    const projectId = request.params.projectId
    const response =
      request.method === 'GET'
        ? await service.get(principal, projectId)
        : await service.update(
            principal,
            projectId,
            await request.json(),
            request.headers.get('if-match'),
          )
    return httpResponse(response)
  } catch (reason) {
    return failedResponse(reason, context)
  }
}

async function metadataSync(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const body = (await request.json()) as unknown
    const metadataSyncToken =
      typeof body === 'object' && body !== null && 'metadataSyncToken' in body
        ? body.metadataSyncToken
        : undefined
    return httpResponse(
      await getProjectApiService().retryMetadataSync(
        principalFrom(request),
        request.params.projectId,
        metadataSyncToken,
      ),
    )
  } catch (reason) {
    return failedResponse(reason, context)
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

function principalFrom(request: HttpRequest) {
  return parseStaticWebAppsPrincipal(
    request.headers.get('x-ms-client-principal'),
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
): HttpResponseInit {
  const response = projectApiErrorResponse(reason)
  context.error('Project API request failed safely.', {
    status: response.status,
    errorType: reason instanceof Error ? reason.name : 'UnknownError',
  })
  return httpResponse(response)
}
