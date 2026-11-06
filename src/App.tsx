import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'
import Loading from './components/Loading.tsx'
import ProtectedRoute from './components/ProtectedRoute.tsx'
import Landing from './pages/Landing.tsx'
import Login from './pages/Login.tsx'
import NotFound from './pages/NotFound.tsx'
import StudentSurvey from './pages/StudentSurvey.tsx'

// Instructor pages are code-split so students never download Recharts/qrcode.
const Dashboard = lazy(() => import('./pages/Dashboard.tsx'))
const SurveyEditor = lazy(() => import('./pages/SurveyEditor.tsx'))
const PresentSurvey = lazy(() => import('./pages/PresentSurvey.tsx'))
const Results = lazy(() => import('./pages/Results.tsx'))

// Routes per UI.md §1
export default function App() {
  return (
    <Suspense fallback={<Loading message="Loading..." />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/s/:slug" element={<StudentSurvey />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/surveys/new" element={<SurveyEditor />} />
          <Route path="/surveys/:id/edit" element={<SurveyEditor />} />
          <Route path="/surveys/:id/present" element={<PresentSurvey />} />
          <Route path="/surveys/:id/results" element={<Results />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
