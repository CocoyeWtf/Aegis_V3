/* Application principale / Main application with routing */

import { Routes, Route } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { MainLayout } from './components/layout/MainLayout'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const CountryRegion = lazy(() => import('./pages/CountryRegion'))
const BaseManagement = lazy(() => import('./pages/BaseManagement'))
const PdvManagement = lazy(() => import('./pages/PdvManagement'))
const SupplierManagement = lazy(() => import('./pages/SupplierManagement'))
const VolumeManagement = lazy(() => import('./pages/VolumeManagement'))
const ContractManagement = lazy(() => import('./pages/ContractManagement'))
const DistanceMatrix = lazy(() => import('./pages/DistanceMatrix'))
const BaseActivityManagement = lazy(() => import('./pages/BaseActivityManagement'))
const ParameterSettings = lazy(() => import('./pages/ParameterSettings'))
const TourPlanning = lazy(() => import('./pages/TourPlanning'))
const TourHistory = lazy(() => import('./pages/TourHistory'))

function Loading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-lg" style={{ color: 'var(--text-muted)' }}>Chargement...</div>
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/countries" element={<CountryRegion />} />
          <Route path="/bases" element={<BaseManagement />} />
          <Route path="/pdvs" element={<PdvManagement />} />
          <Route path="/suppliers" element={<SupplierManagement />} />
          <Route path="/volumes" element={<VolumeManagement />} />
          <Route path="/contracts" element={<ContractManagement />} />
          <Route path="/distances" element={<DistanceMatrix />} />
          <Route path="/base-activities" element={<BaseActivityManagement />} />
          <Route path="/parameters" element={<ParameterSettings />} />
          <Route path="/tour-planning" element={<TourPlanning />} />
          <Route path="/tour-history" element={<TourHistory />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
