import { createContext, useContext } from 'react'
import type { AppUser } from './authService'

export const AuthenticatedUserContext = createContext<AppUser | null>(null)

export function useAuthenticatedUser(): AppUser | null {
  return useContext(AuthenticatedUserContext)
}
