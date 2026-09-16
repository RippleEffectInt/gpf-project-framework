import {
  type PropsWithChildren,
  useEffect,
  useState,
} from 'react'
import {
  getCurrentUser,
  type AppUser,
} from '../services/authService'
import { AuthenticatedUserContext } from '../services/authenticationContext'

type AuthenticationLoader = () => Promise<AppUser | null>

function AuthenticationBrand() {
  return (
    <header className="app-header signed-out-header">
      <div className="header-brand">
        <div
          className="logo-placeholder"
          role="img"
          aria-label="Ripple Effect logo placeholder"
        >
          RE
        </div>
        <span className="app-name">
          Ripple Effect / Project Framework
        </span>
      </div>
    </header>
  )
}

export function AuthenticationGate({
  children,
  loadCurrentUser = getCurrentUser,
}: PropsWithChildren<{ loadCurrentUser?: AuthenticationLoader }>) {
  const [status, setStatus] = useState<
    | { kind: 'loading' }
    | { kind: 'signed-out' }
    | { kind: 'authenticated'; user: AppUser }
  >({ kind: 'loading' })

  useEffect(() => {
    let active = true
    void loadCurrentUser().then(
      (user) => {
        if (!active) return
        setStatus(
          user
            ? { kind: 'authenticated', user }
            : { kind: 'signed-out' },
        )
      },
      () => {
        if (active) setStatus({ kind: 'signed-out' })
      },
    )
    return () => {
      active = false
    }
  }, [loadCurrentUser])

  if (status.kind === 'authenticated') {
    return (
      <AuthenticatedUserContext.Provider value={status.user}>
        {children}
      </AuthenticatedUserContext.Provider>
    )
  }

  return (
    <div className="signed-out-shell">
      <AuthenticationBrand />
      <main className="signed-out-main">
        <section
          className="signed-out-panel"
          aria-busy={status.kind === 'loading'}
        >
          <h1>Project Framework</h1>
          {status.kind === 'loading' ? (
            <p role="status">Checking your sign-in…</p>
          ) : (
            <>
              <p>
                Sign in with your Ripple Effect account to continue.
              </p>
              <a
                className="button primary large signed-out-button"
                href="/.auth/login/aad?post_login_redirect_uri=%2Fprojects"
              >
                Sign in
              </a>
            </>
          )}
        </section>
      </main>
    </div>
  )
}
