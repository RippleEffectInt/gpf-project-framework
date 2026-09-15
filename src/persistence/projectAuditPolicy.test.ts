import { describe, expect, it } from 'vitest'
import {
  auditFieldsForProjectCreate,
  auditFieldsForProjectUpdate,
  authorizeProjectRepositoryOperation,
  requireAuthenticatedProjectPrincipal,
  type VerifiedStaticWebAppsPrincipal,
} from '../../api/projectAuditPolicy'

function principal(
  userId: string,
  name: string,
  email: string,
): VerifiedStaticWebAppsPrincipal {
  return {
    identityProvider: 'aad',
    userId,
    userDetails: email,
    claims: [
      { typ: 'name', val: name },
      { typ: 'preferred_username', val: email },
    ],
  }
}

describe('project API human audit policy', () => {
  it('populates creator and modifier fields from the authenticated principal on create', () => {
    const fields = auditFieldsForProjectCreate(
      principal('object-1', 'First User', 'first@example.org'),
    )

    expect(fields).toEqual({
      CreatedByName: 'First User',
      CreatedByEmail: 'first@example.org',
      CreatedByObjectId: 'object-1',
      ModifiedByName: 'First User',
      ModifiedByEmail: 'first@example.org',
      ModifiedByObjectId: 'object-1',
    })
  })

  it('preserves creator fields and replaces modifier fields on update', () => {
    const fields = auditFieldsForProjectUpdate(
      {
        CreatedByName: 'Original Creator',
        CreatedByEmail: 'creator@example.org',
        CreatedByObjectId: 'creator-object',
      },
      principal('editor-object', 'Current Editor', 'editor@example.org'),
    )

    expect(fields).toEqual({
      CreatedByName: 'Original Creator',
      CreatedByEmail: 'creator@example.org',
      CreatedByObjectId: 'creator-object',
      ModifiedByName: 'Current Editor',
      ModifiedByEmail: 'editor@example.org',
      ModifiedByObjectId: 'editor-object',
    })
  })

  it('rejects missing and non-Entra principals', () => {
    expect(() => requireAuthenticatedProjectPrincipal(null)).toThrowError(
      expect.objectContaining({ status: 401 }),
    )
    expect(() =>
      requireAuthenticatedProjectPrincipal({
        ...principal('object-1', 'User', 'user@example.org'),
        identityProvider: 'github',
      }),
    ).toThrowError(
      expect.objectContaining({
        status: 401,
        reason: 'identity-provider-not-aad',
        identityProvider: 'github',
      }),
    )
  })

  it('makes the baseline repository authorization decision server-side', () => {
    const authenticated = principal(
      'object-1',
      'Authorized User',
      'user@example.org',
    )

    expect(authorizeProjectRepositoryOperation(authenticated, 'update')).toBe(
      authenticated,
    )
    expect(() =>
      authorizeProjectRepositoryOperation(undefined, 'read'),
    ).toThrowError(expect.objectContaining({ status: 401 }))
  })
})
