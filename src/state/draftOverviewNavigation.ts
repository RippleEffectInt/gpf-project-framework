import type { Location } from 'react-router-dom'

export function overviewBackground(location: Location): Location | undefined {
  const background = (location.state as { backgroundLocation?: Location } | null)?.backgroundLocation
  return location.pathname === '/design/overview' &&
    typeof background?.pathname === 'string' &&
    background.pathname.startsWith('/design/') &&
    background.pathname !== '/design/overview'
    ? background : undefined
}
