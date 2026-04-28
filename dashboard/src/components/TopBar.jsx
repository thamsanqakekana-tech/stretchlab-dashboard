import React from 'react'
import { useRole } from '../context/RoleContext.jsx'
import RoleBadge from './RoleBadge.jsx'

const ROLES = ['client', 'manager', 'admin']
const ROLE_COLORS = { client: '#6366f1', manager: '#f59e0b', admin: '#a855f7' }

export default function TopBar() {
  const { role, setRole } = useRole()
  const showSwitcher = import.meta.env.VITE_SHOW_ROLE_SWITCHER !== 'false'
  const activeColor = ROLE_COLORS[role] ?? '#6366f1'

  return (
    <header style={{
      height: '52px',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px', flexShrink: 0,
    }}>
      {/* Left: breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-2)', fontWeight: 400 }}>
          StretchLab
        </span>
        <span style={{ color: 'var(--border)', fontSize: '13px' }}>/</span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
          Campaign Intelligence
        </span>
      </div>

      {/* Right: role badge + switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <RoleBadge />

        {showSwitcher && (
          <div style={{
            display: 'flex',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '2px',
            gap: '2px',
          }}>
            {ROLES.map((r) => {
              const active = role === r
              return (
                <button key={r} onClick={() => setRole(r)} style={{
                  padding: '4px 12px',
                  fontSize: '11px', fontWeight: active ? 600 : 400,
                  textTransform: 'capitalize',
                  border: 'none', cursor: 'pointer',
                  borderRadius: '6px',
                  background: active ? `${ROLE_COLORS[r]}20` : 'transparent',
                  color: active ? ROLE_COLORS[r] : 'var(--muted)',
                  transition: 'all 0.15s',
                  outline: 'none',
                }}>
                  {r}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </header>
  )
}
