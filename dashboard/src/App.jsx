import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import Sidebar from './components/Sidebar.jsx'
import TopBar from './components/TopBar.jsx'
import LoginPage from './pages/LoginPage.jsx'

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
import FlexologistPerformance from './pages/admin/FlexologistPerformance.jsx'
import RawDataExplorer from './pages/admin/RawDataExplorer.jsx'
import SystemHealth from './pages/admin/SystemHealth.jsx'

function FullScreenSpinner() {
  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <span style={{
        width: '20px', height: '20px',
        border: '2px solid var(--border)', borderTopColor: 'var(--accent)',
        borderRadius: '50%', display: 'inline-block',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function Dashboard() {
  const { viewRole } = useAuth()

  return (
    <div
      data-role={viewRole}
      style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}
    >
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar />
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <Routes>
            {/* Client routes */}
            <Route path="/"            element={<CampaignPulse />} />
            <Route path="/results"     element={<Results />} />
            <Route path="/partnership" element={<PartnershipActions />} />

            {/* Legacy redirects */}
            <Route path="/markets"         element={<Navigate to="/"            replace />} />
            <Route path="/studios"         element={<Navigate to="/results"     replace />} />
            <Route path="/outcomes"        element={<Navigate to="/results"     replace />} />
            <Route path="/cancellations"   element={<Navigate to="/partnership" replace />} />
            <Route path="/forecast"        element={<Navigate to="/"            replace />} />
            <Route path="/recommendations" element={<Navigate to="/partnership" replace />} />

            {/* Manager routes — DB RLS enforces data access */}
            <Route path="/manager/status"        element={<CampaignStatus />} />
            <Route path="/manager/cancellations" element={<CancellationDeep />} />
            <Route path="/manager/calltiming"    element={<CallTimingHeatmap />} />
            <Route path="/manager/pipeline"      element={<AtRiskPipeline />} />
            <Route path="/manager/actionplan"    element={<ActionPlan />} />

            {/* Admin routes */}
            <Route path="/admin/drift"          element={<DataDrift />} />
            <Route path="/admin/reconciliation" element={<PipelineReconciliation />} />
            <Route path="/admin/flexologists"   element={<FlexologistPerformance />} />
            <Route path="/admin/explorer"       element={<RawDataExplorer />} />
            <Route path="/admin/health"         element={<SystemHealth />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) return <FullScreenSpinner />
  if (!user)   return <LoginPage />
  return <Dashboard />
}
