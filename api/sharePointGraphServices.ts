import {
  createGraphAccessTokenProvider,
  type ConfidentialClientApplicationFactory,
  type PfxPrivateKeyExtractor,
  type PrivateKeyValidator,
} from './graphCertificateAuth'
import { MicrosoftGraphClient } from './microsoftGraphClient'
import { SharePointProjectDriveResolver } from './sharePointProjectDriveResolver'
import {
  readSharePointProjectServerConfig,
  type SharePointProjectServerConfig,
} from './sharePointProjectSchema'

export interface SharePointGraphServices {
  config: SharePointProjectServerConfig
  graphClient: MicrosoftGraphClient
  driveResolver: SharePointProjectDriveResolver
}

export interface SharePointGraphServiceOptions {
  clientFactory?: ConfidentialClientApplicationFactory
  extractPrivateKey?: PfxPrivateKeyExtractor
  validatePrivateKey?: PrivateKeyValidator
  fetchImplementation?: typeof fetch
}

export function createSharePointGraphServices(
  environment: Record<string, string | undefined>,
  options: SharePointGraphServiceOptions = {},
): SharePointGraphServices {
  const config = readSharePointProjectServerConfig(environment)
  const tokenProvider = createGraphAccessTokenProvider(
    environment,
    options.clientFactory,
    {
      extractPrivateKey: options.extractPrivateKey,
      validatePrivateKey: options.validatePrivateKey,
    },
  )
  const graphClient = new MicrosoftGraphClient(
    tokenProvider,
    options.fetchImplementation,
  )
  return {
    config,
    graphClient,
    driveResolver: new SharePointProjectDriveResolver(config, graphClient),
  }
}

let processServices: SharePointGraphServices | null = null

/**
 * Shared Function-process services. Storage gateways should obtain their Graph
 * client and document-library drive resolver here.
 */
export function getSharePointGraphServices(): SharePointGraphServices {
  processServices ??= createSharePointGraphServices(process.env)
  return processServices
}
