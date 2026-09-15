export interface AppUser {
  id: string
  displayName: string
  email: string
}

const developmentUser: AppUser = {
  id: 'development-user',
  displayName: 'Development User',
  email: 'developer@localhost',
}

interface StaticWebAppsClaim {
  typ: string
  val: string
}

function readClaim(
  claims: StaticWebAppsClaim[],
  names: readonly string[],
): string | undefined {
  return claims.find((claim) => names.includes(claim.typ))?.val
}

export async function getCurrentUser(): Promise<AppUser | null> {
  if (import.meta.env.DEV) return developmentUser
  try {
    const response = await fetch('/.auth/me', { credentials: 'include' })
    if (!response.ok) return null
    const raw = (await response.json()) as unknown
    if (
      typeof raw !== 'object' ||
      raw === null ||
      !('clientPrincipal' in raw) ||
      typeof raw.clientPrincipal !== 'object' ||
      raw.clientPrincipal === null
    ) {
      return null
    }
    const principal = raw.clientPrincipal as Record<string, unknown>
    if (
      typeof principal.userId !== 'string' ||
      typeof principal.userDetails !== 'string'
    ) {
      return null
    }
    const claims = Array.isArray(principal.claims)
      ? principal.claims.filter(
          (claim): claim is StaticWebAppsClaim =>
            typeof claim === 'object' &&
            claim !== null &&
            'typ' in claim &&
            typeof claim.typ === 'string' &&
            'val' in claim &&
            typeof claim.val === 'string',
        )
      : []
    return {
      id: principal.userId,
      displayName:
        readClaim(claims, [
          'name',
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
        ]) ?? principal.userDetails,
      email:
        readClaim(claims, [
          'emails',
          'preferred_username',
          'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
        ]) ?? principal.userDetails,
    }
  } catch {
    return null
  }
}
