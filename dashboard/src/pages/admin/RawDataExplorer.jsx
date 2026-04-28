import React, { useState, useMemo } from 'react'
import { useData } from '../../hooks/useData.js'
import { loadBookings } from '../../utils/dataLoader.js'
import Card from '../../components/Card.jsx'

const PAGE_SIZE = 20

const COLUMNS = [
  { key: 'booking_id', label: 'ID' },
  { key: 'first_name', label: 'First' },
  { key: 'last_name', label: 'Last' },
  { key: 'booking_date', label: 'Date' },
  { key: 'booking_location', label: 'Studio', transform: (v) => v?.replace('StretchLab ', '') },
  { key: 'current_status', label: 'Status' },
  { key: 'attribution_method', label: 'Attribution' },
  { key: 'has_show', label: 'Show', transform: (v) => (v ? 'Yes' : 'No') },
  { key: 'is_cancelled', label: 'Cancel', transform: (v) => (v ? 'Yes' : '—') },
]

function exportCSV(rows) {
  const headers = COLUMNS.map((c) => c.label).join(',')
  const body = rows
    .map((row) =>
      COLUMNS.map((c) => {
        const v = row[c.key] ?? ''
        const str = c.transform ? c.transform(v) : v
        return `"${String(str).replace(/"/g, '""')}"`
      }).join(',')
    )
    .join('\n')
  const blob = new Blob([`${headers}\n${body}`], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'stretchlab_export.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function RawDataExplorer() {
  const { data, loading } = useData(loadBookings)
  const [search, setSearch] = useState('')
  const [studioFilter, setStudioFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)

  const studios = useMemo(
    () => [...new Set((data ?? []).map((r) => r.booking_location).filter(Boolean))].sort(),
    [data]
  )
  const statuses = useMemo(
    () => [...new Set((data ?? []).map((r) => r.current_status).filter(Boolean))].sort(),
    [data]
  )

  const filtered = useMemo(() => {
    if (!data) return []
    let rows = data
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(
        (r) =>
          (r.first_name ?? '').toLowerCase().includes(q) ||
          (r.last_name ?? '').toLowerCase().includes(q)
      )
    }
    if (studioFilter) rows = rows.filter((r) => r.booking_location === studioFilter)
    if (statusFilter) rows = rows.filter((r) => r.current_status === statusFilter)
    return rows
  }, [data, search, studioFilter, statusFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // Reset page when filters change
  const handleSearch = (v) => { setSearch(v); setPage(0) }
  const handleStudio = (v) => { setStudioFilter(v); setPage(0) }
  const handleStatus = (v) => { setStatusFilter(v); setPage(0) }

  if (loading) return <div style={{ color: 'var(--muted)', padding: '40px' }}>Loading booking data…</div>

  return (
    <div style={{ maxWidth: '1200px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--admin)', marginBottom: '4px' }}>
        Raw Data Explorer
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '24px' }}>
        {(data ?? []).length.toLocaleString()} total bookings · paginated · {PAGE_SIZE}/page
      </p>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name…"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '7px',
            padding: '8px 12px',
            color: 'var(--text)',
            fontSize: '13px',
            outline: 'none',
            width: '200px',
          }}
        />
        <select
          value={studioFilter}
          onChange={(e) => handleStudio(e.target.value)}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '7px',
            padding: '8px 12px',
            color: studioFilter ? 'var(--text)' : 'var(--muted)',
            fontSize: '13px',
            outline: 'none',
          }}
        >
          <option value="">All Studios</option>
          {studios.map((s) => <option key={s} value={s}>{s?.replace('StretchLab ', '')}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => handleStatus(e.target.value)}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '7px',
            padding: '8px 12px',
            color: statusFilter ? 'var(--text)' : 'var(--muted)',
            fontSize: '13px',
            outline: 'none',
          }}
        >
          <option value="">All Statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button
          onClick={() => exportCSV(visible)}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--admin)',
            borderRadius: '7px',
            padding: '8px 16px',
            color: 'var(--admin)',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            marginLeft: 'auto',
          }}
        >
          Export visible ({visible.length})
        </button>
      </div>

      <Card style={{ overflowX: 'auto', marginBottom: '16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--muted)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} style={{ padding: '20px', color: 'var(--muted)', textAlign: 'center' }}>
                  No bookings match filters.
                </td>
              </tr>
            )}
            {visible.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg)' }}>
                {COLUMNS.map((c) => {
                  const raw = row[c.key] ?? ''
                  const val = c.transform ? c.transform(raw) : raw
                  return (
                    <td
                      key={c.key}
                      style={{
                        padding: '8px 10px',
                        color: c.key === 'has_show' && val === 'Yes'
                          ? 'var(--accent)'
                          : c.key === 'is_cancelled' && val === 'Yes'
                          ? 'var(--danger)'
                          : 'var(--muted)',
                        fontFamily: ['booking_id', 'booking_date'].includes(c.key) ? 'JetBrains Mono' : undefined,
                        fontSize: c.key === 'booking_id' ? '10px' : '12px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {String(val)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Pagination */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          style={{ padding: '6px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', color: page === 0 ? 'var(--border)' : 'var(--text)', cursor: page === 0 ? 'default' : 'pointer', fontSize: '12px' }}
        >
          Prev
        </button>
        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
          {page + 1} / {Math.max(1, totalPages)} ({filtered.length} rows)
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={page >= totalPages - 1}
          style={{ padding: '6px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', color: page >= totalPages - 1 ? 'var(--border)' : 'var(--text)', cursor: page >= totalPages - 1 ? 'default' : 'pointer', fontSize: '12px' }}
        >
          Next
        </button>
      </div>
    </div>
  )
}
