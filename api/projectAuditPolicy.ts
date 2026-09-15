export interface StaticWebAppsPrincipalClaim {
  typ: string
  val: string
}

export interface VerifiedStaticWebAppsPrincipal {
  identityProvider: string
  userId: string
  userDetails: string
  claims: StaticWebAppsPrincipalClaim[]
}

export interface HumanProjectAuditFields {
  CreatedByName: string
  CreatedByEmail: string
  CreatedByObjectId: string
  ModifiedByName: string
  ModifiedByEmail: string
  ModifiedByObjectId: string
}

export type UnauthenticatedProjectRequestReason =
  | 'no-principal'
  | 'identity-provider-not-aad'
  | 'missing-user-id'
  | 'missing-user-details'

export class UnauthenticatedProjectRequestError extends Error {
  readonly status = 401

  constructor(
    public readonly reason: UnauthenticatedProjectRequestReason = 'no-principal',
    public readonly identityProvider: string | null = null,
  ) {
    super('A verified authenticated principal is required.')
    this.name = 'UnauthenticatedProjectRequestError'
  }
}

export type ProjectRepositoryOperation = 'list' | 'read' | 'create' | 'update'

function claim(
  principal: VerifiedStaticWebAppsPrincipal,
  names: readonly string[],
): string | undefined {
  return principal.claims.find((candidate) => names.includes(candidate.typ))
    ?.val
}

export function requireAuthenticatedProjectPrincipal(
  principal: VerifiedStaticWebAppsPrincipal | null | undefined,
): VerifiedStaticWebAppsPrincipal {
  if (!principal) {
    throw new UnauthenticatedProjectRequestError('no-principal')
  }
  if (principal.identityProvider !== 'aad') {
    throw new UnauthenticatedProjectRequestError(
      'identity-provider-not-aad',
      principal.identityProvider,
    )
  }
  if (!principal.userId.trim()) {
    throw new UnauthenticatedProjectRequestError(
      'missing-user-id',
      principal.identityProvider,
    )
  }
  if (!principal.userDetails.trim()) {
    throw new UnauthenticatedProjectRequestError(
      'missing-user-details',
      principal.identityProvider,
    )
  }
  return principal
}

export function authorizeProjectRepositoryOperation(
  principal: VerifiedStaticWebAppsPrincipal | null | undefined,
  operation: ProjectRepositoryOperation,
): VerifiedStaticWebAppsPrincipal {
  void operation
  return requireAuthenticatedProjectPrincipal(principal)
}

function humanIdentity(
  rawPrincipal: VerifiedStaticWebAppsPrincipal | null | undefined,
) {
  const principal = requireAuthenticatedProjectPrincipal(rawPrincipal)
  const name =
    claim(principal, [
      'name',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
    ]) ?? principal.userDetails
  const email =
    claim(principal, [
      'email',
      'emails',
      'preferred_username',
      'upn',
      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
    ]) ?? principal.userDetails
  if (!name.trim() || !email.trim()) {
    throw new UnauthenticatedProjectRequestError()
  }
  return {
    name,
    email,
    objectId: principal.userId,
  }
}

export function auditFieldsForProjectCreate(
  principal: VerifiedStaticWebAppsPrincipal | null | undefined,
): HumanProjectAuditFields {
  const identity = humanIdentity(principal)
  return {
    CreatedByName: identity.name,
    CreatedByEmail: identity.email,
    CreatedByObjectId: identity.objectId,
    ModifiedByName: identity.name,
    ModifiedByEmail: identity.email,
    ModifiedByObjectId: identity.objectId,
  }
}

export function auditFieldsForProjectUpdate(
  existing: Pick<
    HumanProjectAuditFields,
    'CreatedByName' | 'CreatedByEmail' | 'CreatedByObjectId'
  >,
  principal: VerifiedStaticWebAppsPrincipal | null | undefined,
): HumanProjectAuditFields {
  const identity = humanIdentity(principal)
  return {
    CreatedByName: existing.CreatedByName,
    CreatedByEmail: existing.CreatedByEmail,
    CreatedByObjectId: existing.CreatedByObjectId,
    ModifiedByName: identity.name,
    ModifiedByEmail: identity.email,
    ModifiedByObjectId: identity.objectId,
  }
}
