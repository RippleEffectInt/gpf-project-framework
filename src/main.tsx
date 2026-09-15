import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { FrameworkProvider, ProjectDesignProvider } from './state/AppState'
import './styles.css'

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
