import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext.jsx'
import { supabase } from '../../lib/supabaseClient.js'
import Card from '../../components/Card.jsx'

// ─── Seed items (state persisted in Supabase + localStorage, definitions stay in code) ───
const SEED_ITEMS = [
  {
    key: 'sl_1', owner: 'StretchLab',
    label: 'Log session outcomes in ClubReady within 24 hours of each appointment',
    urgency: 'High', deadline: 'Ongoing SLA',
  },
  {
    key: 'sl_2', owner: 'StretchLab',
    label: 'Notify Execo before cancelling or rescheduling any booked session',
    urgency: 'High', deadline: 'Ongoing',
  },
  {
    key: 'sl_3', owner: 'StretchLab',
    label: 'Keep flexologist calendars up to date before sessions are booked',
    urgency: 'High', deadline: 'Ongoing',
  },
  {
    key: 'sl_4', owner: 'StretchLab',
    label: 'Review admin cancellation triggers at Bunker Hill and Shreveport',
    urgency: 'Medium', deadline: 'Weekly',
  },
  {
    key: 'sl_5', owner: 'StretchLab',
    label: 'Notify Execo when a re-engaged lead converts to a membership',
    urgency: 'Medium', deadline: 'Ongoing',
  },
  {
    key: 'ex_1', owner: 'Execo',
    label: 'Confirm upcoming pipeline sessions for the current week',
    urgency: 'High', deadline: 'Every Monday',
  },
  {
    key: 'ex_2', owner: 'Execo',
    label: 'Flag unpaid leads in pipeline as pre-session priority',
    urgency: 'High', deadline: 'Ongoing',
  },
  {
    key: 'ex_3', owner: 'Execo',
    label: 'Update StretchLab on any data drift between ClubReady and the internal tracker',
    urgency: 'Medium', deadline: 'Weekly',
  },
]

// ─── Urgency palette ──────────────────────────────────────────────────────────
const URGENCY_CONFIG = {
  High:   { color: '#d97706', bg: 'rgba(217,119,6,0.10)'  },
  Medium: { color: '#6366f1', bg: 'rgba(99,102,241,0.10)' },
  Watch:  { color: '#94a3b8', bg: 'rgba(148,163,184,0.10)' },
}

// ─── Week helpers ─────────────────────────────────────────────────────────────
function getMondayOf(d) {
  const day = new Date(d)
  const dow  = day.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  day.setDate(day.getDate() + diff)
  day.setHours(0, 0, 0, 0)
  return day
}

function isSameWeek(d1, d2) {
  return getMondayOf(d1).getTime() === getMondayOf(d2).getTime()
}

function isEffectivelyChecked(row, deadline) {
  if (!row?.checked) return false
  const ongoing = deadline.toLowerCase().includes('ongoing')
  if (ongoing) return true
  if (!row.checked_at) return false
  return isSameWeek(new Date(row.checked_at), new Date())
}

// ─── localStorage fallback ────────────────────────────────────────────────────
const LS_KEY = 'pa_rows_v1'

function lsLoad() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') } catch { return {} }
}

function lsSave(rows) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(rows)) } catch {}
}

// ─── Author label from email ──────────────────────────────────────────────────
function authorFromEmail(email) {
  if (!email) return 'Execo'
  return email.endsWith('@stretchlab.com') ? 'StretchLab' : 'Execo'
}

// ─── Format date for display ──────────────────────────────────────────────────
function fmtDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── ChecklistItem ────────────────────────────────────────────────────────────
function ChecklistItem({ item, row, onToggle, saving, isLast = false, animIndex = 0 }) {
  const checked   = isEffectivelyChecked(row, item.deadline)
  const urg       = URGENCY_CONFIG[item.urgency] ?? URGENCY_CONFIG.Watch
  const isOngoing = item.deadline.toLowerCase().includes('ongoing')

  return (
    <div
      className="pa-item"
      style={{
        display: 'flex', gap: '12px', padding: '12px 8px',
        borderBottom: isLast ? 'none' : '1px solid var(--border)',
        opacity: checked ? 0.55 : 1,
        transition: 'opacity 0.2s ease',
        animationDelay: `${animIndex * 45}ms`,
        cursor: saving ? 'wait' : 'pointer',
      }}
      onClick={() => !saving && onToggle(item, row, checked)}
    >
      {/* Custom animated checkbox */}
      <div
        className={`pa-check-box${checked ? ' checked' : ''}`}
        style={{ marginTop: '2px' }}
      />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: '13px', fontWeight: 500, color: 'var(--text)',
          margin: '0 0 6px', lineHeight: 1.5,
          textDecoration: checked ? 'line-through' : 'none',
        }}>
          {item.label}
        </p>

        {/* Tags row */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{
            fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px',
            color: urg.color, background: urg.bg,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            {item.urgency}
          </span>
          <span style={{
            fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px',
            color: 'var(--muted)', background: 'var(--surface-2)',
            letterSpacing: '0.04em',
          }}>
            {isOngoing ? 'Ongoing' : `Due ${item.deadline}`}
          </span>
        </div>

        {/* Completion note */}
        {checked && row?.checked_by && (
          <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '6px 0 0', fontStyle: 'italic' }}>
            {row.checked_by} marked complete {fmtDate(row.checked_at)}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Notes panel ─────────────────────────────────────────────────────────────
function NotesPanel({ notes, onAdd, saving }) {
  const [text, setText] = useState('')

  const handleSubmit = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setText('')
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
  }

  return (
    <Card style={{ marginTop: '20px' }}>
      <p style={{
        fontSize: '11px', fontWeight: 700, color: 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 16px',
      }}>
        Shared Notes
      </p>

      {/* Input */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Add a note visible to both sides… (Cmd+Enter to submit)"
          rows={2}
          style={{
            flex: 1, background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: '8px', padding: '10px 12px',
            color: 'var(--text)', fontSize: '13px', fontFamily: 'DM Sans, sans-serif',
            resize: 'vertical', outline: 'none', lineHeight: 1.5,
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={saving || !text.trim()}
          style={{
            alignSelf: 'flex-end', padding: '9px 18px',
            background: text.trim() ? 'var(--accent)' : 'var(--border)',
            color: text.trim() ? '#fff' : 'var(--muted)',
            border: 'none', borderRadius: '8px', fontSize: '12px',
            fontWeight: 600, cursor: text.trim() ? 'pointer' : 'default',
            fontFamily: 'inherit', transition: 'background 0.15s ease',
          }}
        >
          {saving ? 'Saving…' : 'Add note'}
        </button>
      </div>

      {/* Notes list — newest first */}
      {notes.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--muted)', fontStyle: 'italic', margin: 0 }}>
          No notes yet. Add the first one above.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[...notes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((note, i) => (
            <div key={note.id ?? i} style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderLeft: '3px solid var(--accent)',
              borderRadius: '8px', padding: '10px 14px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{
                  fontSize: '10px', fontWeight: 700, color: 'var(--accent)',
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                }}>
                  {note.author ?? 'Unknown'}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {note.created_at
                    ? new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
                      ' · ' + new Date(note.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                    : ''}
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text)', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {note.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PartnershipActions() {
  const { viewRole: role, user } = useAuth()
  const isManagerView = role === 'manager' || role === 'admin'

  const authorLabel = authorFromEmail(user?.email)

  const [rows,        setRows]        = useState({})
  const [notes,       setNotes]       = useState([])
  const [loadError,   setLoadError]   = useState(null)
  const [savingItem,  setSavingItem]  = useState(false)
  const [savingNote,  setSavingNote]  = useState(false)
  const [dataLoaded,  setDataLoaded]  = useState(false)
  const [itemError,   setItemError]   = useState(null)

  // Load checklist state + notes; localStorage fires instantly, Supabase overlays
  useEffect(() => {
    // Apply localStorage immediately to avoid flash of unchecked state
    const local = lsLoad()
    if (Object.keys(local).length) setRows(local)

    if (!supabase) { setDataLoaded(true); return }

    Promise.all([
      supabase.from('partnership_actions').select('*'),
      supabase.from('partnership_notes').select('*').order('created_at', { ascending: false }).limit(100),
    ]).then(([actionsRes, notesRes]) => {
      if (actionsRes.error) {
        console.warn('[PartnershipActions] actions load error:', actionsRes.error.message)
        setLoadError('Checklist state could not be loaded — showing locally saved state.')
      } else if (actionsRes.data?.length) {
        const map = {}
        actionsRes.data.forEach(r => { map[r.item_key] = r })
        setRows(map)
        lsSave(map)
      }

      if (!notesRes.error) {
        setNotes(notesRes.data ?? [])
      }
      setDataLoaded(true)
    }).catch(err => {
      console.warn('[PartnershipActions] load error:', err)
      setLoadError('Could not connect to the database. Showing locally saved state.')
      setDataLoaded(true)
    })
  }, [])

  // Toggle a checklist item
  const handleToggle = useCallback(async (item, row, currentlyChecked) => {
    const newChecked = !currentlyChecked
    const now        = new Date().toISOString()

    // Build updated row object and write to state + localStorage synchronously
    const updatedRow = {
      item_key:   item.key,
      checked:    newChecked,
      checked_by: newChecked ? authorLabel : null,
      checked_at: newChecked ? now : null,
    }

    setRows(prev => {
      const next = { ...prev, [item.key]: updatedRow }
      lsSave(next)
      return next
    })

    if (!supabase) return

    setSavingItem(true)
    try {
      const { error } = await supabase
        .from('partnership_actions')
        .upsert(updatedRow, { onConflict: 'item_key' })
      if (error) {
        console.warn('[PartnershipActions] upsert error:', error.message)
        setItemError('Saved locally. Cloud sync failed — changes will persist on this device.')
        setTimeout(() => setItemError(null), 4000)
      }
    } finally {
      setSavingItem(false)
    }
  }, [authorLabel])

  // Add a note
  const handleAddNote = useCallback(async (content) => {
    if (!content.trim()) return
    const optimistic = {
      id:         Date.now(),
      content,
      author:     authorLabel,
      created_at: new Date().toISOString(),
    }
    setNotes(prev => [optimistic, ...prev])

    if (!supabase) return
    setSavingNote(true)
    try {
      const { data, error } = await supabase
        .from('partnership_notes')
        .insert({ content, author: authorLabel })
        .select()
        .single()
      if (error) {
        console.warn('[PartnershipActions] note insert error:', error.message)
      } else if (data) {
        setNotes(prev => prev.map(n => n.id === optimistic.id ? data : n))
      }
    } finally {
      setSavingNote(false)
    }
  }, [authorLabel])

  // Hidden from manager/admin — Action Plan page serves that view
  if (isManagerView) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
          Partnership Actions is a client-facing page. Use Action Plan for the manager view.
        </p>
      </div>
    )
  }

  if (!dataLoaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading…</p>
      </div>
    )
  }

  const slItems    = SEED_ITEMS.filter(i => i.owner === 'StretchLab')
  const exItems    = SEED_ITEMS.filter(i => i.owner === 'Execo')
  const totalItems = SEED_ITEMS.length
  const totalDone  = SEED_ITEMS.filter(i => isEffectivelyChecked(rows[i.key], i.deadline)).length

  return (
    <div style={{ maxWidth: '1100px' }}>
      <style>{`
        @keyframes pa-fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pa-item {
          animation: pa-fadeInUp 0.35s ease both;
          border-radius: 8px;
          transition: background 0.15s ease;
        }
        .pa-item:hover {
          background: var(--surface-2, rgba(255,255,255,0.03));
        }
        .pa-check-box {
          width: 18px; height: 18px; border-radius: 5px;
          border: 2px solid var(--border); flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.15s ease, border-color 0.15s ease, transform 0.12s ease;
          cursor: pointer;
        }
        .pa-check-box.checked {
          background: var(--accent); border-color: var(--accent);
          transform: scale(1.1);
        }
        .pa-check-box.checked::after {
          content: '';
          width: 5px; height: 9px;
          border-right: 2px solid #fff; border-bottom: 2px solid #fff;
          transform: rotate(45deg) translate(-1px, -1px);
          display: block;
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
          Partnership Actions
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>
          A shared working space for StretchLab and Execo. Check off items as they're completed.
          Items reset weekly unless marked as ongoing.
        </p>
      </div>

      {/* Combined progress bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px',
        padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '10px',
      }}>
        <div style={{ flex: 1, height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{
            width: `${totalItems > 0 ? (totalDone / totalItems) * 100 : 0}%`,
            height: '100%', background: 'var(--accent)', borderRadius: '3px',
            transition: 'width 0.4s ease',
          }} />
        </div>
        <span style={{
          fontSize: '11px', fontWeight: 700, color: 'var(--muted)',
          fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap',
        }}>
          {totalDone}/{totalItems} complete
        </span>
      </div>

      {/* DB warning */}
      {loadError && (
        <div style={{
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: '8px', padding: '10px 14px', marginBottom: '16px',
        }}>
          <p style={{ fontSize: '12px', color: '#d97706', margin: 0 }}>{loadError}</p>
        </div>
      )}

      {/* Inline sync error */}
      {itemError && (
        <div style={{
          background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: '8px', padding: '8px 14px', marginBottom: '16px',
        }}>
          <p style={{ fontSize: '12px', color: '#d97706', margin: 0 }}>{itemError}</p>
        </div>
      )}

      {/* Two-column checklist */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '0', alignItems: 'flex-start' }}>

        {/* StretchLab column */}
        <Card style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
              StretchLab
            </span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace' }}>
              {slItems.filter(i => isEffectivelyChecked(rows[i.key], i.deadline)).length}/{slItems.length}
            </span>
          </div>
          <div style={{ height: '3px', background: 'var(--border)', borderRadius: '2px', marginBottom: '16px', overflow: 'hidden' }}>
            <div style={{
              width: `${slItems.length > 0 ? (slItems.filter(i => isEffectivelyChecked(rows[i.key], i.deadline)).length / slItems.length) * 100 : 0}%`,
              height: '100%', background: '#6366f1', borderRadius: '2px', transition: 'width 0.3s ease',
            }} />
          </div>
          {slItems.map((item, idx) => (
            <ChecklistItem
              key={item.key}
              item={item}
              row={rows[item.key]}
              onToggle={handleToggle}
              saving={savingItem}
              isLast={idx === slItems.length - 1}
              animIndex={idx}
            />
          ))}
        </Card>

        {/* Execo column */}
        <Card style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
              Execo
            </span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace' }}>
              {exItems.filter(i => isEffectivelyChecked(rows[i.key], i.deadline)).length}/{exItems.length}
            </span>
          </div>
          <div style={{ height: '3px', background: 'var(--border)', borderRadius: '2px', marginBottom: '16px', overflow: 'hidden' }}>
            <div style={{
              width: `${exItems.length > 0 ? (exItems.filter(i => isEffectivelyChecked(rows[i.key], i.deadline)).length / exItems.length) * 100 : 0}%`,
              height: '100%', background: 'var(--accent)', borderRadius: '2px', transition: 'width 0.3s ease',
            }} />
          </div>
          {exItems.map((item, idx) => (
            <ChecklistItem
              key={item.key}
              item={item}
              row={rows[item.key]}
              onToggle={handleToggle}
              saving={savingItem}
              isLast={idx === exItems.length - 1}
              animIndex={idx}
            />
          ))}
        </Card>

      </div>

      {/* Notes panel */}
      <NotesPanel
        notes={notes}
        onAdd={handleAddNote}
        saving={savingNote}
      />

    </div>
  )
}
