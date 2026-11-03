import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { DraftOverviewDialog } from './components/DraftOverviewDialog'
import { overviewBackground } from './state/draftOverviewNavigation'
import { AppLayout } from './components/AppChrome'
import {
  ChoosePathwaysPage,
  FinalOutcomeDetailPage,
  FindFinalOutcomesPage,
  PathwayDetailPage,
} from './pages/FrameworkPages'
import { MyProjectsPage } from './pages/MyProjectsPage'
import {
  ConfigurePathwaysOverviewPage,
  ReviewProjectPage,
} from './pages/JourneyPages'
import { CustomInnovationPage } from './pages/CustomInnovationPage'
import { PathwayConfigurationPage } from './pages/PathwayConfigurationPage'
import { GuidedDesignPage } from './pages/GuidedDesignPage'
import { ProjectDetailsPage } from './pages/ProjectDetailsPage'

const TheoryOfChangePage = lazy(async () => {
  const page = await import('./pages/TheoryOfChangePage')
  return { default: page.TheoryOfChangePage }
})

const DraftOverviewPage = lazy(async () => {
  const page = await import('./pages/DraftOverviewPage')
  return { default: page.DraftOverviewPage }
})

export function App() {
  const location = useLocation()
  const background = overviewBackground(location)
  return (
    <>
    <Routes location={background ?? location}>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate replace to="/projects" />} />
        <Route path="/projects" element={<MyProjectsPage />} />
        <Route path="/design/details" element={<ProjectDetailsPage />} />
        <Route path="/design/outcomes" element={<FindFinalOutcomesPage />} />
        <Route
          path="/design/custom-innovation"
          element={<CustomInnovationPage />}
        />
        <Route
          path="/design/outcomes/:outcomeId"
          element={<FinalOutcomeDetailPage />}
        />
        <Route
          path="/design/outcomes/:outcomeId/pathways"
          element={<ChoosePathwaysPage />}
        />
        <Route
          path="/design/outcomes/:outcomeId/pathways/:pathwayId"
          element={<PathwayDetailPage />}
        />
        <Route
          path="/design/pathways/:pathwayId/configure"
          element={<PathwayConfigurationPage />}
        />
        <Route
          path="/design/configure"
          element={<ConfigurePathwaysOverviewPage />}
        />
        <Route path="/design/guided" element={<GuidedDesignPage />} />
        <Route path="/design/review" element={<ReviewProjectPage />} />
        <Route path="/design/overview" element={
          <Suspense fallback={<p role="status">Loading draft overview…</p>}>
            <DraftOverviewPage />
          </Suspense>
        } />
        <Route
          path="/design/theory-of-change"
          element={
            <Suspense
              fallback={
                <div className="state-panel" role="status">
                  <h1>Loading Theory of Change</h1>
                  <p>Preparing the generated visual…</p>
                </div>
              }
            >
              <TheoryOfChangePage />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate replace to="/projects" />} />
      </Route>
    </Routes>
    {background && (
      <DraftOverviewDialog>
        <Suspense fallback={<p role="status">Loading draft overview…</p>}>
          <DraftOverviewPage />
        </Suspense>
      </DraftOverviewDialog>
    )}
    </>
  )
}
