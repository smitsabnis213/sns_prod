import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Eye, EyeOff, Leaf, LockKeyhole, Mail, Phone, ShieldCheck, Sprout } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Brand } from '../components/StorefrontParts'
import { ApiError, formatApiError } from '../services/api'
import { useAuth } from '../state/AppState'
import type { AccountRole } from '../types'

export function AuthPage({ role }: { role: AccountRole }) {
  const { login, role: currentRole, user, loading, sessionNotice, clearSessionNotice } = useAuth()
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const isBuddy = role === 'buddy'

  if (!loading && user && currentRole === role) return <Navigate to={isBuddy ? '/buddy' : '/'} replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    const cleanedPhone = phone.trim().replace(/\s+/g, '')
    if (!isBuddy && !/^[+()\d-]{8,18}$/.test(cleanedPhone)) {
      setError('Enter a valid phone number to continue.')
      return
    }
    if (isBuddy && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || password.length < 1)) {
      setError('Enter the email address and password for your Buddy account.')
      return
    }
    setBusy(true)
    try {
      await login(role, isBuddy ? { email: email.trim(), password } : { phone: cleanedPhone })
      navigate(isBuddy ? '/buddy' : '/', { replace: true })
    } catch (reason) {
      const credentialError = reason instanceof ApiError && reason.status === 401
      const inactiveBuddy = isBuddy && reason instanceof ApiError && reason.status === 403
      setError(credentialError
        ? isBuddy ? 'That email address or password was not recognized.' : 'That phone number was not recognized.'
        : inactiveBuddy
          ? 'This Buddy account is not approved or active yet. Please contact Buddyyaa support.'
          : formatApiError(reason))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-page__left">
        <div className="auth-page__nav"><Brand /><Link to="/"><ArrowLeft size={16} /> Back to Buddyyaa</Link></div>
        <motion.div className="auth-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="auth-card__mark"><span>{isBuddy ? <Sprout size={24} /> : <Leaf size={24} />}</span></div>
          <span className="eyebrow">{isBuddy ? 'YOUR LOCAL BUSINESS, CONNECTED' : 'FRESHNESS, CLOSER TO HOME'}</span>
          <h1>{isBuddy ? 'Welcome back, Buddy.' : 'Good to have you here.'}</h1>
          <p className="muted">{isBuddy ? 'Sign in to manage orders assigned to your Buddy account.' : 'Sign in to explore what your neighborhood has in store.'}</p>

          <div className="auth-mode-tabs" role="group" aria-label="Choose sign-in mode">
            <Link to="/login" className={!isBuddy ? 'is-selected' : ''}>Customer</Link>
            <Link to="/buddy/login" className={isBuddy ? 'is-selected' : ''}>Buddy</Link>
          </div>
          {sessionNotice && <div className="form-error form-error--box session-notice-auth" role="status"><span>{sessionNotice}</span><button type="button" onClick={clearSessionNotice}>Dismiss</button></div>}
          <form className="form-stack" onSubmit={(event) => void submit(event)}>
            <label>
              <span>{isBuddy ? 'Buddy account email' : 'Your phone number'}</span>
              <div className="input-with-icon">{isBuddy ? <Mail size={17} /> : <Phone size={17} />}{isBuddy
                ? <input autoComplete="username" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" value={email} />
                : <input autoComplete="tel" inputMode="tel" onChange={(event) => setPhone(event.target.value)} placeholder="+91 98765 43210" value={phone} />}</div>
            </label>
            {isBuddy && <label>
              <span>Password</span>
              <div className="input-with-icon"><LockKeyhole size={17} /><input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" type={showPassword ? 'text' : 'password'} value={password} /><button className="input-action" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)} type="button">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
            </label>}
            {!isBuddy && <div className="dev-login-note"><ShieldCheck size={17} /><span><strong>Phone sign-in is in development.</strong> The connected backend does not verify this number with an OTP yet.</span></div>}
            {error && <div className="form-error form-error--box" role="alert">{error}</div>}
            <button className="button button--gold button--wide" disabled={busy || loading} type="submit">{busy ? 'Signing you in…' : isBuddy ? 'Sign in to Buddy portal' : 'Continue with phone'} <ArrowRight size={17} /></button>
          </form>
          <div className="auth-divider"><span>—</span></div>
          <p className="auth-account-note">{isBuddy ? 'Buddy accounts are created and approved by Buddyyaa administrators.' : 'Shopping as a local customer, connected to the Buddies around you.'}</p>
          <Link className="auth-admin-link" to="/admin-access">Administrator? Go to the AdminJS panel <ArrowRight size={14} /></Link>
        </motion.div>
        <p className="auth-legal">By continuing, you agree to Buddyyaa’s <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.</p>
      </div>
      <aside className={`auth-aside${isBuddy ? ' auth-aside--buddy' : ''}`}>
        <span className="auth-aside__grain" />
        <span className="auth-aside__top">{isBuddy ? 'A LOCAL BUSINESS, WITH A LITTLE MORE REACH.' : 'FRESH FROM YOUR NEIGHBORHOOD.'}</span>
        <div className="auth-aside__illustration" aria-hidden="true"><div className="auth-aside__circle" /><span>{isBuddy ? '🤝' : '🥭'}</span><i>✳</i><b>LOCAL<br />BY NATURE</b></div>
        <div className="auth-aside__copy"><p>“{isBuddy ? 'You know your neighborhood best. Buddyyaa helps your local supply find its people.' : 'Kya aap aaj bhi mandi jaate ho? Your local Buddy may be closer than you think.'}”</p><span>Buddyyaa · Chhatrapati Sambhajinagar</span></div>
        <div className="auth-aside__dots"><i /><i /><i /></div>
      </aside>
    </main>
  )
}
