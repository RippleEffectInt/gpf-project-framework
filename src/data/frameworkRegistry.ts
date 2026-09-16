import type { FrameworkData } from '../types/framework'
import historicFrameworkJson from './framework-v1.0-normalized.json'
import currentFrameworkJson from './framework-v1.1-output-phrase-reviewed-ambiguous.json'

export const HISTORIC_FRAMEWORK = historicFrameworkJson as FrameworkData
export const CURRENT_FRAMEWORK = currentFrameworkJson as FrameworkData

export const HISTORIC_FRAMEWORK_VERSION = HISTORIC_FRAMEWORK.frameworkVersion
export const CURRENT_FRAMEWORK_VERSION = CURRENT_FRAMEWORK.frameworkVersion
export const CURRENT_FRAMEWORK_SCHEMA_VERSION = CURRENT_FRAMEWORK.schemaVersion

const FRAMEWORKS_BY_VERSION: Record<string, FrameworkData> = {
  [HISTORIC_FRAMEWORK.frameworkVersion]: HISTORIC_FRAMEWORK,
  [CURRENT_FRAMEWORK.frameworkVersion]: CURRENT_FRAMEWORK,
}

export function getFrameworkByVersion(
  frameworkVersion: string,
): FrameworkData | null {
  return FRAMEWORKS_BY_VERSION[frameworkVersion] ?? null
}

export function listFrameworkVersions(): string[] {
  return Object.keys(FRAMEWORKS_BY_VERSION)
}
