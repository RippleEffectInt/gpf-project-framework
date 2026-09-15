import { describe, expect, it, vi } from 'vitest'
import {
  MicrosoftGraphClient,
  MicrosoftGraphDataError,
  MicrosoftGraphForbiddenError,
  MicrosoftGraphUnauthorizedError,
} from '../../api/microsoftGraphClient'

describe('authenticated Microsoft Graph client', () => {
  it('uses the shared token provider for Graph requests', async () => {
    const getGraphAccessToken = vi.fn(async () => 'application-token')
    const fetchImplementation = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: 'drive-id' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    const client = new MicrosoftGraphClient(
      { getGraphAccessToken },
      fetchImplementation,
    )

    await expect(client.get('/sites/site-id')).resolves.toEqual({
      id: 'drive-id',
    })
    expect(getGraphAccessToken).toHaveBeenCalledTimes(1)
    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://graph.microsoft.com/v1.0/sites/site-id',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer application-token',
        }),
      }),
    )
  })

  it('distinguishes Graph 401 from SharePoint data failures', async () => {
    const client = graphClientReturning(401)
    await expect(client.get('/sites/site-id')).rejects.toBeInstanceOf(
      MicrosoftGraphUnauthorizedError,
    )
  })

  it('distinguishes Graph 403 from SharePoint data failures', async () => {
    const client = graphClientReturning(403)
    await expect(client.get('/sites/site-id')).rejects.toBeInstanceOf(
      MicrosoftGraphForbiddenError,
    )
  })

  it('uses a separate safe error for other Graph data responses', async () => {
    const client = graphClientReturning(404)
    await expect(client.get('/sites/site-id')).rejects.toBeInstanceOf(
      MicrosoftGraphDataError,
    )
  })
})

function graphClientReturning(status: number): MicrosoftGraphClient {
  return new MicrosoftGraphClient(
    { getGraphAccessToken: async () => 'application-token' },
    async () => new Response('raw upstream details', { status }),
  )
}
