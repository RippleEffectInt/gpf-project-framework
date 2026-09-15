import { createPrivateKey } from 'node:crypto'
import {
  ConfidentialClientApplication,
  LogLevel,
  type AuthenticationResult,
  type ClientCredentialRequest,
  type Configuration,
} from '@azure/msal-node'
import forge from 'node-forge'

export const GRAPH_CERTIFICATE_ENV_KEYS = {
  tenantId: 'SHAREPOINT_TENANT_ID',
  clientId: 'SHAREPOINT_CLIENT_ID',
  thumbprint: 'SHAREPOINT_CERTIFICATE_THUMBPRINT',
  pfxBase64: 'SHAREPOINT_CERTIFICATE_PFX_BASE64',
  pfxPassword: 'SHAREPOINT_CERTIFICATE_PFX_PASSWORD',
} as const

export const GRAPH_APPLICATION_SCOPE = 'https://graph.microsoft.com/.default'

export interface GraphCertificateCredential {
  tenantId: string
  clientId: string
  thumbprint: string
  privateKey: string
}

export type GraphCredentialConfigurationErrorCode =
  | 'missing-environment-variable'
  | 'invalid-thumbprint'
  | 'malformed-base64'
  | 'invalid-pfx'
  | 'incorrect-pfx-password'
  | 'no-private-key'
  | 'unsupported-private-key'
  | 'invalid-private-key'

export class GraphCredentialConfigurationError extends Error {
  constructor(
    public readonly code: GraphCredentialConfigurationErrorCode,
    environmentVariable?: string,
  ) {
    super(
      environmentVariable
        ? `Microsoft Graph certificate configuration is invalid: ${environmentVariable}.`
        : 'Microsoft Graph certificate configuration is invalid.',
    )
    this.name = 'GraphCredentialConfigurationError'
  }
}

export class GraphTokenAcquisitionError extends Error {
  constructor() {
    super('Microsoft Graph authentication is temporarily unavailable.')
    this.name = 'GraphTokenAcquisitionError'
  }
}

export interface ConfidentialClientApplicationLike {
  acquireTokenByClientCredential(
    request: ClientCredentialRequest,
  ): Promise<AuthenticationResult | null>
}

export type ConfidentialClientApplicationFactory = (
  configuration: Configuration,
) => ConfidentialClientApplicationLike

export type PfxPrivateKeyExtractor = (
  pfxBytes: Uint8Array,
  password: string,
) => string

export type PrivateKeyValidator = (privateKey: string) => void

export interface GraphCertificateReaderOptions {
  extractPrivateKey?: PfxPrivateKeyExtractor
  validatePrivateKey?: PrivateKeyValidator
}

export function readGraphCertificateCredential(
  environment: Record<string, string | undefined>,
  options: GraphCertificateReaderOptions = {},
): GraphCertificateCredential {
  const tenantId = requiredTrimmedValue(
    environment,
    GRAPH_CERTIFICATE_ENV_KEYS.tenantId,
  )
  const clientId = requiredTrimmedValue(
    environment,
    GRAPH_CERTIFICATE_ENV_KEYS.clientId,
  )
  const rawThumbprint = requiredTrimmedValue(
    environment,
    GRAPH_CERTIFICATE_ENV_KEYS.thumbprint,
  )
  const pfxBase64 = requiredTrimmedValue(
    environment,
    GRAPH_CERTIFICATE_ENV_KEYS.pfxBase64,
  )
  const pfxPassword = requiredSecretValue(
    environment,
    GRAPH_CERTIFICATE_ENV_KEYS.pfxPassword,
  )

  if (!/^[A-Fa-f0-9]{40}$/.test(rawThumbprint)) {
    throw new GraphCredentialConfigurationError('invalid-thumbprint')
  }
  const pfxBytes = decodePfx(pfxBase64)
  const extractPrivateKey =
    options.extractPrivateKey ?? extractRsaPrivateKeyFromPfx
  let extractedPrivateKey: string
  try {
    extractedPrivateKey = extractPrivateKey(pfxBytes, pfxPassword)
  } catch (reason) {
    if (reason instanceof GraphCredentialConfigurationError) throw reason
    throw new GraphCredentialConfigurationError('invalid-pfx')
  }

  const privateKey = normalizePkcs8Pem(extractedPrivateKey)
  const validatePrivateKey = options.validatePrivateKey ?? validatePemPrivateKey
  validatePrivateKey(privateKey)
  return {
    tenantId,
    clientId,
    thumbprint: rawThumbprint.toUpperCase(),
    privateKey,
  }
}

export class GraphAccessTokenProvider {
  private cachedToken: { accessToken: string; expiresAt: number } | null = null
  private tokenRequest: Promise<string> | null = null

  constructor(
    private readonly client: ConfidentialClientApplicationLike,
    private readonly now: () => number = Date.now,
  ) {}

  getGraphAccessToken(): Promise<string> {
    if (
      this.cachedToken &&
      this.cachedToken.expiresAt - this.now() > 5 * 60 * 1000
    ) {
      return Promise.resolve(this.cachedToken.accessToken)
    }
    if (this.tokenRequest) return this.tokenRequest

    this.tokenRequest = this.acquireToken().finally(() => {
      this.tokenRequest = null
    })
    return this.tokenRequest
  }

  private async acquireToken(): Promise<string> {
    try {
      const result = await this.client.acquireTokenByClientCredential({
        scopes: [GRAPH_APPLICATION_SCOPE],
      })
      if (!result?.accessToken) throw new GraphTokenAcquisitionError()
      this.cachedToken = {
        accessToken: result.accessToken,
        expiresAt: result.expiresOn?.getTime() ?? this.now() + 10 * 60 * 1000,
      }
      return result.accessToken
    } catch {
      throw new GraphTokenAcquisitionError()
    }
  }
}

export function createGraphAccessTokenProvider(
  environment: Record<string, string | undefined>,
  clientFactory: ConfidentialClientApplicationFactory = (configuration) =>
    new ConfidentialClientApplication(configuration),
  readerOptions: GraphCertificateReaderOptions = {},
): GraphAccessTokenProvider {
  const credential = readGraphCertificateCredential(environment, readerOptions)
  const client = clientFactory({
    auth: {
      authority: `https://login.microsoftonline.com/${encodeURIComponent(
        credential.tenantId,
      )}`,
      clientId: credential.clientId,
      clientCertificate: {
        thumbprint: credential.thumbprint,
        privateKey: credential.privateKey,
      },
    },
    system: {
      loggerOptions: {
        loggerCallback: () => undefined,
        piiLoggingEnabled: false,
        logLevel: LogLevel.Error,
      },
    },
  })
  return new GraphAccessTokenProvider(client)
}

let processTokenProvider: GraphAccessTokenProvider | null = null

export function getGraphAccessToken(): Promise<string> {
  processTokenProvider ??= createGraphAccessTokenProvider(process.env)
  return processTokenProvider.getGraphAccessToken()
}

export function extractRsaPrivateKeyFromPfx(
  pfxBytes: Uint8Array,
  password: string,
): string {
  let pfxAsn1: forge.asn1.Asn1
  try {
    pfxAsn1 = forge.asn1.fromDer(
      forge.util.createBuffer(Buffer.from(pfxBytes).toString('binary')),
    )
  } catch {
    throw new GraphCredentialConfigurationError('invalid-pfx')
  }

  let pfx: forge.pkcs12.Pkcs12Pfx
  try {
    pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, password)
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : ''
    if (/password|mac could not be verified/i.test(message)) {
      throw new GraphCredentialConfigurationError('incorrect-pfx-password')
    }
    if (/unsupported|unknown oid|not rsa/i.test(message)) {
      throw new GraphCredentialConfigurationError('unsupported-private-key')
    }
    throw new GraphCredentialConfigurationError('invalid-pfx')
  }

  const shroudedKeyBagOid = forge.pki.oids.pkcs8ShroudedKeyBag
  const keyBagOid = forge.pki.oids.keyBag
  if (!shroudedKeyBagOid || !keyBagOid) {
    throw new GraphCredentialConfigurationError('invalid-pfx')
  }
  const keyBags = [
    ...(pfx.getBags({ bagType: shroudedKeyBagOid })[shroudedKeyBagOid] ?? []),
    ...(pfx.getBags({ bagType: keyBagOid })[keyBagOid] ?? []),
  ]
  if (keyBags.length === 0) {
    throw new GraphCredentialConfigurationError('no-private-key')
  }
  const privateKey = keyBags.find((bag) => bag.key)?.key
  if (!privateKey) {
    throw new GraphCredentialConfigurationError('unsupported-private-key')
  }

  try {
    const rsaPrivateKey = forge.pki.privateKeyToAsn1(privateKey)
    const pkcs8PrivateKey = forge.pki.wrapRsaPrivateKey(rsaPrivateKey)
    return forge.pki.privateKeyInfoToPem(pkcs8PrivateKey)
  } catch {
    throw new GraphCredentialConfigurationError('unsupported-private-key')
  }
}

function requiredTrimmedValue(
  environment: Record<string, string | undefined>,
  name: string,
): string {
  const value = environment[name]?.trim()
  if (!value) {
    throw new GraphCredentialConfigurationError(
      'missing-environment-variable',
      name,
    )
  }
  return value
}

function requiredSecretValue(
  environment: Record<string, string | undefined>,
  name: string,
): string {
  const value = environment[name]
  if (value === undefined || value.length === 0) {
    throw new GraphCredentialConfigurationError(
      'missing-environment-variable',
      name,
    )
  }
  return value
}

function decodePfx(value: string): Uint8Array {
  if (
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  ) {
    throw new GraphCredentialConfigurationError('malformed-base64')
  }
  return Buffer.from(value, 'base64')
}

function normalizePkcs8Pem(privateKey: string): string {
  const normalized = `${privateKey.replace(/\r\n?/g, '\n').trim()}\n`
  if (
    !normalized.startsWith('-----BEGIN PRIVATE KEY-----\n') ||
    !normalized.endsWith('\n-----END PRIVATE KEY-----\n')
  ) {
    throw new GraphCredentialConfigurationError('invalid-private-key')
  }
  return normalized
}

function validatePemPrivateKey(privateKey: string): void {
  try {
    const key = createPrivateKey({ key: privateKey, format: 'pem' })
    if (key.type !== 'private' || key.asymmetricKeyType !== 'rsa') {
      throw new Error()
    }
  } catch {
    throw new GraphCredentialConfigurationError('invalid-private-key')
  }
}
