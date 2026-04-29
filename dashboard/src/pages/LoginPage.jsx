import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      const msg = err.message || ''
      if (msg.toLowerCase().includes('invalid')) {
        setError('Incorrect email or password.')
      } else if (msg.toLowerCase().includes('email')) {
        setError('Please enter a valid email address.')
      } else {
        setError('Sign-in failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'DM Sans, sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: '380px', padding: '0 16px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '12px',
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', fontWeight: 800, color: '#fff',
            fontFamily: 'JetBrains Mono, monospace',
            margin: '0 auto 12px',
          }}>
            S
          </div>
          <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
            StretchLab
          </p>
          <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>
            Campaign Intelligence · Execo BI
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          padding: '28px 28px 24px',
        }}>
          <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)', margin: '0 0 20px' }}>
            Sign in to your account
          </p>

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '10px 12px', borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg)', color: 'var(--text)',
                  fontSize: '13px', outline: 'none',
                  fontFamily: 'DM Sans, sans-serif',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e  => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••••"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '10px 40px 10px 12px', borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg)', color: 'var(--text)',
                    fontSize: '13px', outline: 'none',
                    fontFamily: 'DM Sans, sans-serif',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e  => e.target.style.borderColor = 'var(--border)'}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{
                    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--muted)', fontSize: '12px', padding: '2px 4px',
                  }}
                >
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                padding: '10px 12px', borderRadius: '8px',
                background: '#ef444418', border: '1px solid var(--danger)',
                fontSize: '12px', color: 'var(--danger)',
                marginBottom: '16px',
              }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '11px',
                borderRadius: '8px', border: 'none',
                background: loading ? 'var(--border)' : 'var(--accent)',
                color: loading ? 'var(--muted)' : '#fff',
                fontSize: '13px', fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'background 0.15s',
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              {loading && (
                <span style={{
                  width: '12px', height: '12px',
                  border: '2px solid var(--muted)', borderTopColor: 'transparent',
                  borderRadius: '50%', display: 'inline-block',
                  animation: 'spin 0.7s linear infinite',
                }} />
              )}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--muted)', marginTop: '20px' }}>
          Powered by Execo BI · StretchLab B2C Campaign
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
