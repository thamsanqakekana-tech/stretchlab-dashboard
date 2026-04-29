// Deprecated — all auth and role state is now in AuthContext.jsx
// This shim keeps any missed import from crashing.
export { useAuth as useRole, AuthProvider as RoleProvider } from './AuthContext.jsx'
