import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import {
  GPF_REPOSITORY_MODE,
  GPF_REPOSITORY_MODE_DIAGNOSTIC,
  GPF_REPOSITORY_MODE_MARKER,
} from './persistence/projectRepository'
import { FrameworkProvider, ProjectDesignProvider } from './state/AppState'
import './styles.css'

document.documentElement.dataset.gpfRepositoryMode = GPF_REPOSITORY_MODE
document.documentElement.dataset.gpfRepositoryMarker = GPF_REPOSITORY_MODE_MARKER
console.info(GPF_REPOSITORY_MODE_DIAGNOSTIC)

const root = document.getElementById('root')
if (!root) throw new Error('Application root element was not found.')

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <FrameworkProvider>
        <ProjectDesignProvider>
          <App />
        </ProjectDesignProvider>
      </FrameworkProvider>
    </BrowserRouter>
  </StrictMode>,
)
