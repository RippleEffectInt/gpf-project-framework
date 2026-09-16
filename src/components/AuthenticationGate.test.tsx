import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AuthenticationGate } from './AuthenticationGate'

const authenticatedUser = {
  id: 'entra-user-id',
  displayName: 'Ripple Effect User',
  email: 'user@rippleeffect.org',
}

describe('application authentication gate', () => {
  it('shows the branded signed-out screen to an unauthenticated user', async () => {
    render(
      <AuthenticationGate loadCurrentUser={async () => null}>
        <div>Protected project application</div>
      </AuthenticationGate>,
    )

    expect(
      await screen.findByRole('heading', { name: 'Project Framework' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Sign in with your Ripple Effect account to continue.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Ripple Effect / Project Framework'),
    ).toBeInTheDocument()
  })

  it('uses the Azure Static Web Apps Microsoft Entra login endpoint', async () => {
    render(
      <AuthenticationGate loadCurrentUser={async () => null}>
        <div>Protected project application</div>
      </AuthenticationGate>,
    )

    expect(await screen.findByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/.auth/login/aad?post_login_redirect_uri=%2Fprojects',
    )
  })

  it('does not render project UI for an unauthenticated user', async () => {
    render(
      <AuthenticationGate loadCurrentUser={async () => null}>
        <nav>My Projects</nav>
        <button>Create project</button>
      </AuthenticationGate>,
    )

    await screen.findByRole('link', { name: 'Sign in' })
    expect(screen.queryByText('My Projects')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Create project' }),
    ).not.toBeInTheDocument()
  })

  it('renders the project application for an authenticated user', async () => {
    render(
      <AuthenticationGate
        loadCurrentUser={async () => authenticatedUser}
      >
        <nav>My Projects</nav>
      </AuthenticationGate>,
    )

    expect(await screen.findByText('My Projects')).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Sign in' }),
    ).not.toBeInTheDocument()
  })
})
