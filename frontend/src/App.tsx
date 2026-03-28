import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import MembersPage from '@/pages/MembersPage'
import ProgramsPage from '@/pages/ProgramsPage'
import AgenciesPage from '@/pages/AgenciesPage'
import FunctionalAreasPage from '@/pages/FunctionalAreasPage'
import TeamsPage from '@/pages/TeamsPage'
import OrgTreePage from '@/pages/trees/OrgTreePage'
import ProgramTreePage from '@/pages/trees/ProgramTreePage'
import AreaTreePage from '@/pages/trees/AreaTreePage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/members" replace />} />
        <Route path="/members" element={<MembersPage />} />
        <Route path="/programs" element={<ProgramsPage />} />
        <Route path="/agencies" element={<AgenciesPage />} />
        <Route path="/functional-areas" element={<FunctionalAreasPage />} />
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/tree/org" element={<OrgTreePage />} />
        <Route path="/tree/programs" element={<ProgramTreePage />} />
        <Route path="/tree/programs/:id" element={<ProgramTreePage />} />
        <Route path="/tree/areas" element={<AreaTreePage />} />
        <Route path="/tree/areas/:id" element={<AreaTreePage />} />
      </Route>
    </Routes>
  )
}
