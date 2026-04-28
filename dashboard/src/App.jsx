import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useRole } from './context/RoleContext.jsx'
import Sidebar from './components/Sidebar.jsx'
import TopBar from './components/TopBar.jsx'

// Client pages
import CampaignPulse from './pages/client/CampaignPulse.jsx'
import Results from './pages/client/Results.jsx'
import PartnershipActions from './pages/client/PartnershipActions.jsx'

// Manager pages
import CampaignStatus from './pages/manager/CampaignStatus.jsx'
import CancellationDeep from './pages/manager/CancellationDeep.jsx'
import CallTimingHeatmap from './pages/manager/CallTimingHeatmap.jsx'
import AtRiskPipeline from './pages/manager/AtRiskPipeline.jsx'
import ActionPlan from './pages/manager/ActionPlan.jsx'

// Admin pages
import DataDrift from './pages/admin/DataDrift.jsx'
import PipelineReconciliation from './pages/admin/PipelineReconciliation.jsx'
import LoyalsnapEngagement from './pages/admin/LoyalsnapEngagement.jsx'
import FlexologistPerformance from './pages/admin/FlexologistPerformance.jsx'
import RawDataExplorer from './pages/admin/RawDataExplorer.jsx'
import SystemHealth from './pages/admin/SystemHealth.jsx'

function RequireRole({ allowed, children }) {
  const { role } = useRole()
  if (!allowed.includes(role)) {
    return <Navigate to="/" replace />
  }
  return children
}

export default function App() {
  const { role } = useRole()

  return (
    <div
      data-role={role}
      style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}
    >
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar />
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <Routes>
            {/* Client routes — 4 pages */}
            <Route path="/" element={<CampaignPulse />} />
            <Route path="/results" element={<Results />} />
            <Route path="/markets" element={<Navigate to="/" replace />} />
            <Route path="/partnership" element={<PartnershipActions />} />

            {/* Legacy redirects — old routes preserved so existing links don't break */}
            <Route path="/studios"         element={<Navigate to="/results"      replace />} />
            <Route path="/outcomes"        element={<Navigate to="/results"      replace />} />
            <Route path="/cancellations"   element={<Navigate to="/partnership"  replace />} />
            <Route path="/forecast"        element={<Navigate to="/"             replace />} />
            <Route path="/recommendations" element={<Navigate to="/partnership"  replace />} />

            {/* Manager routes */}
            <Route
              path="/manager/status"
              element={
                <RequireRole allowed={['manager', 'admin']}>
                  <CampaignStatus />
                </RequireRole>
              }
            />
            <Route
              path="/manager/cancellations"
              element={
                <RequireRole allowed={['manager', 'admin']}>
                  <CancellationDeep />
                </RequireRole>
              }
            />
            <Route
              path="/manager/calltiming"
              element={
                <RequireRole allowed={['manager', 'admin']}>
                  <CallTimingHeatmap />
                </RequireRole>
              }
            />
            <Route
              path="/manager/pipeline"
              element={
                <RequireRole allowed={['manager', 'admin']}>
                  <AtRiskPipeline />
                </RequireRole>
              }
            />
            <Route
              path="/manager/actionplan"
              element={
                <RequireRole allowed={['manager', 'admin']}>
                  <ActionPlan />
                </RequireRole>
              }
            />
            <Route
              path="/manager/loyalsnap"
              element={
                <RequireRole allowed={['manager', 'admin']}>
                  <LoyalsnapEngagement />
                </RequireRole>
              }
            />

            {/* Admin routes */}
            <Route
              path="/admin/drift"
              element={
                <RequireRole allowed={['admin']}>
                  <DataDrift />
                </RequireRole>
              }
            />
            <Route
              path="/admin/reconciliation"
              element={
                <RequireRole allowed={['admin']}>
                  <PipelineReconciliation />
                </RequireRole>
              }
            />
            <Route
              path="/admin/flexologists"
              element={
                <RequireRole allowed={['admin']}>
                  <FlexologistPerformance />
                </RequireRole>
              }
            />
            <Route
              path="/admin/explorer"
              element={
                <RequireRole allowed={['admin']}>
                  <RawDataExplorer />
                </RequireRole>
              }
            />
            <Route
              path="/admin/health"
              element={
                <RequireRole allowed={['admin']}>
                  <SystemHealth />
                </RequireRole>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
