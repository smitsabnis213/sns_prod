import { lazy, Suspense, useEffect } from 'react'
import { MotionConfig } from 'framer-motion'
import { BrowserRouter, Link, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { FloatingCart, SiteFooter, SiteHeader } from './components/StorefrontParts'
import { AppStateProvider, useAuth } from './state/AppState'

const AdminEntry = lazy(() => import('./pages/AdminEntry').then((module) => ({ default: module.AdminEntry })))
const AuthPage = lazy(() => import('./pages/AuthPage').then((module) => ({ default: module.AuthPage })))
const BuddyDashboard = lazy(() => import('./pages/BuddyPortal').then((module) => ({ default: module.BuddyDashboard })))
const BuddyOrderDetail = lazy(() => import('./pages/BuddyPortal').then((module) => ({ default: module.BuddyOrderDetail })))
const Checkout = lazy(() => import('./pages/Checkout').then((module) => ({ default: module.Checkout })))
const OrderHistory = lazy(() => import('./pages/Orders').then((module) => ({ default: module.OrderHistory })))
const OrderTracking = lazy(() => import('./pages/Orders').then((module) => ({ default: module.OrderTracking })))
const ProfilePage = lazy(() => import('./pages/Orders').then((module) => ({ default: module.ProfilePage })))
const Storefront = lazy(() => import('./pages/Storefront').then((module) => ({ default: module.Storefront })))

function CustomerLayout() {
  return <><SiteHeader /><Outlet /><SiteFooter /><FloatingCart /></>
}

function RouteScrollReset() {
  const location = useLocation()
  useEffect(() => { window.scrollTo({ top: 0, left: 0 }) }, [location.pathname])
  return null
}

function NotFound() {
  const { role } = useAuth()
  return <main className="page-wrap shell not-found"><span className="eyebrow">404 · THIS PAGE ISN’T IN OUR NEIGHBORHOOD</span><h1>We took a wrong turn<span className="title-period">.</span></h1><p>Let’s get you back to the fresh finds.</p><Link className="button button--gold" to={role === 'buddy' ? '/buddy' : '/'}>Back to Buddyyaa</Link></main>
}

export default function App() {
  return <MotionConfig reducedMotion="user"><BrowserRouter><RouteScrollReset /><AppStateProvider><Suspense fallback={<div className="page-loading" role="status">Opening Buddyyaa…</div>}><Routes>
    <Route element={<CustomerLayout />}>
      <Route path="/" element={<Storefront />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/orders" element={<OrderHistory />} />
      <Route path="/orders/:id" element={<OrderTracking />} />
      <Route path="/profile" element={<ProfilePage />} />
    </Route>
    <Route path="/login" element={<AuthPage role="customer" />} />
    <Route path="/buddy/login" element={<AuthPage role="buddy" />} />
    <Route path="/buddy" element={<BuddyDashboard />} />
    <Route path="/buddy/orders/:id" element={<BuddyOrderDetail />} />
    <Route path="/admin-access" element={<AdminEntry />} />
    <Route path="*" element={<NotFound />} />
  </Routes></Suspense></AppStateProvider></BrowserRouter></MotionConfig>
}
