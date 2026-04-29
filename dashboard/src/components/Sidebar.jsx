import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

const NAV = {
  client: [
    { path: '/',            label: 'Campaign Pulse',      icon: '◎' },
    { path: '/results',     label: 'Studio Performance',  icon: '◈' },
    { path: '/partnership', label: 'Partnership Actions', icon: '✦' },
  ],
  manager: [
    { path: '/manager/status',        label: 'Campaign Status',   icon: '◉' },
    { path: '/manager/cancellations', label: 'Cancellation Dive', icon: '◇' },
    { path: '/manager/calltiming',    label: 'Call Timing',       icon: '⊡' },
    { path: '/manager/pipeline',      label: 'At-Risk Pipeline',  icon: '◈' },
    { path: '/manager/actionplan',    label: 'Action Plan',       icon: '✦' },
  ],
  admin: [
    { path: '/admin/drift',           label: 'Data Drift',     icon: '◎' },
    { path: '/admin/reconciliation',  label: 'Reconciliation', icon: '⊞' },
    { path: '/admin/flexologists',    label: 'Flexologists',   icon: '◇' },
    { path: '/admin/explorer',        label: 'Raw Data',       icon: '⊡' },
    { path: '/admin/health',          label: 'System Health',  icon: '◷' },
  ],
}

const SECTION_COLORS = {
  client:  '#6366f1',
  manager: '#f59e0b',
  admin:   '#a855f7',
}

function NavItem({ path, label, color }) {
  const location = useLocation()
  const active = location.pathname === path

  return (
    <NavLink to={path} style={{ textDecoration: 'none', display: 'block', marginBottom: '1px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '7px 10px',
        borderRadius: '7px',
        background: active ? `${color}14` : 'transparent',
        borderLeft: active ? `2px solid ${color}` : '2px solid transparent',
        color: active ? color : 'var(--muted)',
        fontSize: '13px', fontWeight: active ? 600 : 400,
        cursor: 'pointer', transition: 'all 0.12s',
      }}>
        {label}
      </div>
    </NavLink>
  )
}

function Section({ items, color, label }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <p style={{
        fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: 'var(--muted)',
        padding: '0 10px', marginBottom: '4px',
      }}>
        {label}
      </p>
      {items.map(({ path, label: l }) => (
        <NavItem key={path} path={path} label={l} color={color} />
      ))}
    </div>
  )
}

export default function Sidebar() {
  const { viewRole } = useAuth()

  return (
    <nav style={{
      width: '210px', minWidth: '210px',
      background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      padding: '16px 10px',
      overflowY: 'auto',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Logo */}
      <div style={{
        padding: '4px 10px 16px',
        borderBottom: '1px solid var(--border)',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '26px', height: '26px', borderRadius: '7px',
            background: 'var(--accent)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: 800, color: '#fff',
          }}>
            S
          </div>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', margin: 0, lineHeight: 1.2 }}>
              StretchLab
            </p>
            <p style={{ fontSize: '10px', color: 'var(--muted)', margin: 0 }}>
              Feb–May 2026
            </p>
          </div>
        </div>
      </div>

      <Section items={NAV.client}  color={SECTION_COLORS.client}  label="Client" />

      {(viewRole === 'manager' || viewRole === 'admin') && (
        <Section items={NAV.manager} color={SECTION_COLORS.manager} label="Manager" />
      )}

      {viewRole === 'admin' && (
        <Section items={NAV.admin} color={SECTION_COLORS.admin} label="Admin" />
      )}
    </nav>
  )
}
