import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import MembersPage from '@/pages/MembersPage'
import ProgramsPage from '@/pages/ProgramsPage'
import FunctionalAreasPage from '@/pages/FunctionalAreasPage'
import TeamsPage from '@/pages/TeamsPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/members" replace />} />
        <Route path="/members" element={<MembersPage />} />
        <Route path="/programs" element={<ProgramsPage />} />
        <Route path="/functional-areas" element={<FunctionalAreasPage />} />
        <Route path="/teams" element={<TeamsPage />} />
      </Route>
    </Routes>
  )
}
