import React from 'react'
import { useRole } from '../context/RoleContext.jsx'

const META = {
  client:  { color: '#6366f1', label: 'Client View' },
  manager: { color: '#f59e0b', label: 'Manager View' },
  admin:   { color: '#a855f7', label: 'Admin View' },
}

export default function RoleBadge() {
  const { role } = useRole()
  const { color, label } = META[role] ?? META.client
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '4px 10px', borderRadius: '99px',
      border: `1px solid ${color}50`,
      background: `${color}12`,
      fontSize: '11px', fontWeight: 600,
      color, letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: color }} />
      {label}
    </span>
  )
}
