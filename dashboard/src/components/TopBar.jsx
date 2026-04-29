import React from 'react'
import { useAuth } from '../context/AuthContext.jsx'

const VIEW_LABELS  = { client: 'Client View', manager: 'Manager View', admin: 'Admin View' }
const ROLE_COLORS  = { client: '#6366f1', manager: '#f59e0b', admin: '#a855f7' }

export default function TopBar() {
  const { user, userRole, viewRole, setViewRole, signOut, ALLOWED_VIEWS } = useAuth()

  const allowed     = ALLOWED_VIEWS[userRole] ?? ['client']
  const activeColor = ROLE_COLORS[viewRole] ?? '#6366f1'
  const fullName    = user?.user_metadata?.full_name ?? user?.email ?? ''
  const initials    = fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const org         = user?.user_metadata?.organization ?? ''

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
        <span style={{ fontSize: '13px', color: 'var(--text-2)', fontWeight: 400 }}>StretchLab</span>
        <span style={{ color: 'var(--border)', fontSize: '13px' }}>/</span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>Campaign Intelligence</span>
      </div>

      {/* Right: user info + view switcher + logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

        {/* View switcher — hidden for clients, 2-toggle for managers, 3-toggle for admin */}
        {allowed.length > 1 && (
          <div style={{
            display: 'flex',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '2px', gap: '2px',
          }}>
            {allowed.map(v => {
              const active = viewRole === v
              const color  = ROLE_COLORS[v]
              return (
                <button key={v} onClick={() => setViewRole(v)} style={{
                  padding: '4px 12px',
                  fontSize: '11px', fontWeight: active ? 600 : 400,
                  border: 'none', cursor: 'pointer',
                  borderRadius: '6px',
                  background: active ? `${color}20` : 'transparent',
                  color: active ? color : 'var(--muted)',
                  transition: 'all 0.15s', outline: 'none',
                  whiteSpace: 'nowrap',
                }}>
                  {VIEW_LABELS[v]}
                </button>
              )
            })}
          </div>
        )}

        {/* User chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%',
            background: `${activeColor}22`,
            border: `1px solid ${activeColor}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', fontWeight: 700, color: activeColor,
            flexShrink: 0,
          }}>
            {initials || '?'}
          </div>
          <div style={{ lineHeight: 1.3 }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>
              {fullName.split(' ')[0]}
            </p>
            {org && (
              <p style={{ fontSize: '10px', color: 'var(--muted)', margin: 0 }}>{org}</p>
            )}
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={signOut}
          title="Sign out"
          style={{
            padding: '5px 12px', borderRadius: '7px',
            border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--muted)',
            fontSize: '11px', fontWeight: 500,
            cursor: 'pointer', transition: 'all 0.15s',
            fontFamily: 'DM Sans, sans-serif',
          }}
          onMouseEnter={e => { e.target.style.borderColor = 'var(--danger)'; e.target.style.color = 'var(--danger)' }}
          onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--muted)' }}
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
