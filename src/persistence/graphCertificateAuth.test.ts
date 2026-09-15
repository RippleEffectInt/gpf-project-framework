import { Buffer } from 'node:buffer'
import { describe, expect, it, vi } from 'vitest'
import type { AuthenticationResult, Configuration } from '@azure/msal-node'
import {
  GRAPH_APPLICATION_SCOPE,
  GraphAccessTokenProvider,
  GraphCredentialConfigurationError,
  GraphTokenAcquisitionError,
  createGraphAccessTokenProvider,
  extractRsaPrivateKeyFromPfx,
  readGraphCertificateCredential,
  type ConfidentialClientApplicationLike,
} from '../../api/graphCertificateAuth'

const placeholderPfxBytes = Uint8Array.from([1, 2, 3, 4])
const placeholderPem = [
  '-----BEGIN PRIVATE KEY-----',
  'bm90LXJlYWwta2V5LW1hdGVyaWFs',
  '-----END PRIVATE KEY-----',
].join('\r\n')

function environment() {
  return {
    SHAREPOINT_TENANT_ID: 'tenant-id',
    SHAREPOINT_CLIENT_ID: 'client-id',
    SHAREPOINT_CERTIFICATE_THUMBPRINT:
      '35368FD73B7C981AFE8382FCCA09070F8758FFE0',
    SHAREPOINT_CERTIFICATE_PFX_BASE64:
      Buffer.from(placeholderPfxBytes).toString('base64'),
    SHAREPOINT_CERTIFICATE_PFX_PASSWORD: 'pfx-password',
  }
}

function successfulReaderOptions() {
  return {
    extractPrivateKey: vi.fn(
      (pfxBytes: Uint8Array, password: string) => {
        void pfxBytes
        void password
        return placeholderPem
      },
    ),
    validatePrivateKey: vi.fn(),
  }
}

function authenticationResult(
  accessToken = 'graph-access-token',
): AuthenticationResult {
  return {
    accessToken,
    expiresOn: new Date('2026-09-15T18:00:00.000Z'),
  } as AuthenticationResult
}

describe('server Graph PFX certificate credentials', () => {
  it('accepts a valid parsed PFX with the correct password', () => {
    const options = successfulReaderOptions()
    const credential = readGraphCertificateCredential(environment(), options)

    expect(options.extractPrivateKey).toHaveBeenCalledTimes(1)
    expect(
      Array.from(options.extractPrivateKey.mock.calls[0]?.[0] ?? []),
    ).toEqual(Array.from(placeholderPfxBytes))
    expect(options.extractPrivateKey.mock.calls[0]?.[1]).toBe('pfx-password')
    expect(credential.tenantId).toBe('tenant-id')
    expect(credential.clientId).toBe('client-id')
    expect(credential.thumbprint).toBe(
      '35368FD73B7C981AFE8382FCCA09070F8758FFE0',
    )
  })

  it('converts extracted CRLF key text to unencrypted PKCS#8 PEM in memory', () => {
    const credential = readGraphCertificateCredential(
      environment(),
      successfulReaderOptions(),
    )

    expect(credential.privateKey).toBe(
      [
        '-----BEGIN PRIVATE KEY-----',
        'bm90LXJlYWwta2V5LW1hdGVyaWFs',
        '-----END PRIVATE KEY-----',
        '',
      ].join('\n'),
    )
  })

  it.each([
    ['tenant ID', 'SHAREPOINT_TENANT_ID'],
    ['client ID', 'SHAREPOINT_CLIENT_ID'],
    ['thumbprint', 'SHAREPOINT_CERTIFICATE_THUMBPRINT'],
    ['PFX', 'SHAREPOINT_CERTIFICATE_PFX_BASE64'],
    ['PFX password', 'SHAREPOINT_CERTIFICATE_PFX_PASSWORD'],
  ])('rejects a missing %s', (_label, missingName) => {
    const values: Record<string, string | undefined> = environment()
    delete values[missingName]

    expect(() =>
      readGraphCertificateCredential(values, successfulReaderOptions()),
    ).toThrowError(
      expect.objectContaining({
        code: 'missing-environment-variable',
        message: expect.stringContaining(missingName),
      }),
    )
  })

  it('rejects an invalid certificate thumbprint', () => {
    expect(() =>
      readGraphCertificateCredential(
        {
          ...environment(),
          SHAREPOINT_CERTIFICATE_THUMBPRINT: 'not-a-thumbprint',
        },
        successfulReaderOptions(),
      ),
    ).toThrowError(expect.objectContaining({ code: 'invalid-thumbprint' }))
  })

  it('rejects malformed base64 before parsing the PFX', () => {
    const options = successfulReaderOptions()
    expect(() =>
      readGraphCertificateCredential(
        {
          ...environment(),
          SHAREPOINT_CERTIFICATE_PFX_BASE64: '***not-base64***',
        },
        options,
      ),
    ).toThrowError(expect.objectContaining({ code: 'malformed-base64' }))
    expect(options.extractPrivateKey).not.toHaveBeenCalled()
  })

  it('rejects malformed PFX bytes safely', () => {
    expect(() =>
      extractRsaPrivateKeyFromPfx(placeholderPfxBytes, 'pfx-password'),
    ).toThrowError(expect.objectContaining({ code: 'invalid-pfx' }))
  })

  it('distinguishes an incorrect PFX password', () => {
    expect(() =>
      readGraphCertificateCredential(environment(), {
        extractPrivateKey: () => {
          throw new GraphCredentialConfigurationError('incorrect-pfx-password')
        },
      }),
    ).toThrowError(expect.objectContaining({ code: 'incorrect-pfx-password' }))
  })

  it('distinguishes a PFX with no private key', () => {
    expect(() =>
      readGraphCertificateCredential(environment(), {
        extractPrivateKey: () => {
          throw new GraphCredentialConfigurationError('no-private-key')
        },
      }),
    ).toThrowError(expect.objectContaining({ code: 'no-private-key' }))
  })

  it('distinguishes an unsupported non-RSA private key', () => {
    expect(() =>
      readGraphCertificateCredential(environment(), {
        extractPrivateKey: () => {
          throw new GraphCredentialConfigurationError('unsupported-private-key')
        },
      }),
    ).toThrowError(expect.objectContaining({ code: 'unsupported-private-key' }))
  })

  it('passes only extracted PEM and thumbprint to one MSAL client', () => {
    let configuration: Configuration | undefined
    const client: ConfidentialClientApplicationLike = {
      acquireTokenByClientCredential: vi.fn(async () => authenticationResult()),
    }
    createGraphAccessTokenProvider(
      environment(),
      (value) => {
        configuration = value
        return client
      },
      successfulReaderOptions(),
    )

    expect(configuration?.auth).toEqual(
      expect.objectContaining({
        authority: 'https://login.microsoftonline.com/tenant-id',
        clientId: 'client-id',
        clientCertificate: {
          thumbprint: '35368FD73B7C981AFE8382FCCA09070F8758FFE0',
          privateKey: expect.stringContaining('-----BEGIN PRIVATE KEY-----'),
        },
      }),
    )
    expect(configuration?.auth).not.toHaveProperty('clientSecret')
  })

  it('acquires an application token for the Graph default scope', async () => {
    const acquireTokenByClientCredential = vi.fn(async () =>
      authenticationResult(),
    )
    const provider = new GraphAccessTokenProvider(
      { acquireTokenByClientCredential },
      () => new Date('2026-09-15T17:00:00.000Z').getTime(),
    )

    await expect(provider.getGraphAccessToken()).resolves.toBe(
      'graph-access-token',
    )
    expect(acquireTokenByClientCredential).toHaveBeenCalledWith({
      scopes: [GRAPH_APPLICATION_SCOPE],
    })
  })

  it('returns a safe error when token acquisition fails', async () => {
    const provider = new GraphAccessTokenProvider({
      acquireTokenByClientCredential: vi.fn(async () => {
        throw new Error(
          `MSAL failure containing ${environment().SHAREPOINT_CERTIFICATE_PFX_PASSWORD}`,
        )
      }),
    })

    const error = await provider.getGraphAccessToken().catch((reason) => reason)

    expect(error).toBeInstanceOf(GraphTokenAcquisitionError)
    expect(String(error)).not.toContain(
      environment().SHAREPOINT_CERTIFICATE_PFX_PASSWORD,
    )
  })

  it('reuses a valid cached application token', async () => {
    const acquireTokenByClientCredential = vi.fn(async () =>
      authenticationResult(),
    )
    const provider = new GraphAccessTokenProvider(
      { acquireTokenByClientCredential },
      () => new Date('2026-09-15T17:00:00.000Z').getTime(),
    )

    await provider.getGraphAccessToken()
    await provider.getGraphAccessToken()

    expect(acquireTokenByClientCredential).toHaveBeenCalledTimes(1)
  })

  it('never includes PFX or password material in thrown errors', () => {
    const secretMarker = 'DO-NOT-EXPOSE-PFX-OR-PASSWORD'
    let error: unknown
    try {
      readGraphCertificateCredential({
        ...environment(),
        SHAREPOINT_CERTIFICATE_PFX_BASE64: secretMarker,
        SHAREPOINT_CERTIFICATE_PFX_PASSWORD: secretMarker,
      })
    } catch (reason) {
      error = reason
    }

    expect(error).toBeInstanceOf(GraphCredentialConfigurationError)
    expect(String(error)).not.toContain(secretMarker)
  })
})
