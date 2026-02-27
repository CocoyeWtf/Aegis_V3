/* Application principale / Main application with routing */

import { Routes, Route } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { MainLayout } from './components/layout/MainLayout'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { DefaultRedirect } from './components/auth/DefaultRedirect'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const CountryRegion = lazy(() => import('./pages/CountryRegion'))
const BaseManagement = lazy(() => import('./pages/BaseManagement'))
const PdvManagement = lazy(() => import('./pages/PdvManagement'))
const SupplierManagement = lazy(() => import('./pages/SupplierManagement'))
const VolumeManagement = lazy(() => import('./pages/VolumeManagement'))
const ContractManagement = lazy(() => import('./pages/ContractManagement'))
const DistanceMatrix = lazy(() => import('./pages/DistanceMatrix'))
const FuelPrices = lazy(() => import('./pages/FuelPrices'))
const KmTax = lazy(() => import('./pages/KmTax'))
const BaseActivityManagement = lazy(() => import('./pages/BaseActivityManagement'))
const ParameterSettings = lazy(() => import('./pages/ParameterSettings'))
const TourPlanning = lazy(() => import('./pages/TourPlanning'))
const TourHistory = lazy(() => import('./pages/TourHistory'))
const TransporterSummary = lazy(() => import('./pages/TransporterSummary'))
const LoaderManagement = lazy(() => import('./pages/LoaderManagement'))
const Operations = lazy(() => import('./pages/Operations'))
const GuardPost = lazy(() => import('./pages/GuardPost'))
const UserManagement = lazy(() => import('./pages/admin/UserManagement'))
const RoleManagement = lazy(() => import('./pages/admin/RoleManagement'))
const AuditLog = lazy(() => import('./pages/AuditLog'))
const Help = lazy(() => import('./pages/Help'))
const DeviceManagement = lazy(() => import('./pages/DeviceManagement'))
const Tracking = lazy(() => import('./pages/Tracking'))
const SupportTypes = lazy(() => import('./pages/SupportTypes'))
const PdvPickupRequests = lazy(() => import('./pages/PdvPickupRequests'))
const BaseReception = lazy(() => import('./pages/BaseReception'))
const PdvDeliverySchedule = lazy(() => import('./pages/PdvDeliverySchedule'))
const SurchargeTypes = lazy(() => import('./pages/SurchargeTypes'))
const AideDecision = lazy(() => import('./pages/AideDecision'))
const DetachedMap = lazy(() => import('./pages/DetachedMap'))

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
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/map-detached" element={<DetachedMap />} />
          <Route element={<MainLayout />}>
            <Route path="/" element={<DefaultRedirect><Dashboard /></DefaultRedirect>} />
            <Route path="/countries" element={<CountryRegion />} />
            <Route path="/bases" element={<BaseManagement />} />
            <Route path="/pdvs" element={<PdvManagement />} />
            <Route path="/suppliers" element={<SupplierManagement />} />
            <Route path="/volumes" element={<VolumeManagement />} />
            <Route path="/contracts" element={<ContractManagement />} />
            <Route path="/distances" element={<DistanceMatrix />} />
            <Route path="/fuel-prices" element={<FuelPrices />} />
            <Route path="/km-tax" element={<KmTax />} />
            <Route path="/base-activities" element={<BaseActivityManagement />} />
            <Route path="/parameters" element={<ParameterSettings />} />
            <Route path="/tour-planning" element={<TourPlanning />} />
            <Route path="/tour-history" element={<TourHistory />} />
            <Route path="/transporter-summary" element={<TransporterSummary />} />
            <Route path="/loaders" element={<LoaderManagement />} />
            <Route path="/operations" element={<Operations />} />
            <Route path="/guard-post" element={<GuardPost />} />
            <Route path="/audit" element={<AuditLog />} />
            <Route path="/admin/users" element={<UserManagement />} />
            <Route path="/admin/roles" element={<RoleManagement />} />
            <Route path="/devices" element={<DeviceManagement />} />
            <Route path="/tracking" element={<Tracking />} />
            <Route path="/support-types" element={<SupportTypes />} />
            <Route path="/pickup-requests" element={<PdvPickupRequests />} />
            <Route path="/base-reception" element={<BaseReception />} />
            <Route path="/surcharge-types" element={<SurchargeTypes />} />
            <Route path="/aide-decision" element={<AideDecision />} />
            <Route path="/pdv-deliveries" element={<PdvDeliverySchedule />} />
            <Route path="/help" element={<Help />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}
