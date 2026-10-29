import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  ChevronDown,
  CircleUserRound,
  Leaf,
  MapPin,
  Minus,
  Plus,
  Search,
  ShoppingBasket,
  Sprout,
  X,
} from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth, useCart, useDeliveryLocation } from '../state/AppState'
import type { DeliveryLocation, Product } from '../types'
import { formatApiError } from '../services/api'

const currentYear = new Date().getFullYear()

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className={`brand${light ? ' brand--light' : ''}`} aria-label="Buddyyaa home">
      <span className="brand__mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" focusable="false">
          <circle cx="9" cy="8" r="3" />
          <circle cx="23" cy="8" r="3" />
          <path d="M3.5 25c.4-5.7 2.2-9 5.5-9h2.5l4.4 4 4.1-4H23c3.4 0 5.1 3.2 5.5 9" />
          <path d="m11 18 4.5 4 5.5-5" />
        </svg>
      </span>
      <span className="brand__word"><strong>Buddy</strong><b>yaa</b></span>
    </Link>
  )
}

export function SiteHeader() {
  const { location, setLocation } = useDeliveryLocation()
  const { role, user, logout, sessionNotice, clearSessionNotice } = useAuth()
  const cart = useCart()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [locationOpen, setLocationOpen] = useState(false)
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')
  const [searchOpen, setSearchOpen] = useState(false)

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    navigate(`/?q=${encodeURIComponent(query.trim())}`)
    setSearchOpen(false)
  }

  return (
    <>
      <header className="site-header">
        {sessionNotice && <div className="session-notice" role="status"><span>{sessionNotice}</span><button type="button" onClick={clearSessionNotice}>Dismiss</button></div>}
        <div className="site-header__top shell">
          <Brand />
          <button className="location-trigger" onClick={() => setLocationOpen(true)} type="button">
            <span className="location-trigger__icon"><MapPin size={17} /></span>
            <span className="location-trigger__copy">
              <small>Delivering to</small>
              <strong>{location?.address || 'Choose your location'}</strong>
            </span>
            <ChevronDown size={15} />
          </button>
          <form className={`search-box${searchOpen ? ' search-box--focused' : ''}`} onSubmit={submitSearch} role="search">
            <Search size={18} />
            <input
              aria-label="Search fresh produce"
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setSearchOpen(false)}
              placeholder="Search for fresh produce..."
              value={query}
            />
            {query && <button className="icon-button" aria-label="Clear search" onClick={() => setQuery('')} type="button"><X size={15} /></button>}
          </form>
          <nav className="header-actions" aria-label="Main navigation">
            <NavLink to="/orders" className="header-link">My orders</NavLink>
            {role === 'buddy'
              ? <Link className="account-link" to="/buddy"><CircleUserRound size={19} /><span>{user?.name ?? 'Buddy'}</span></Link>
              : <Link className="account-link" to={role === 'customer' ? '/profile' : '/login'}><CircleUserRound size={19} /><span>{user?.name ?? 'Sign in'}</span></Link>}
            <button className="header-cart" type="button" onClick={() => navigate('/checkout')} aria-label={`Open basket, ${cart.count} items`}>
              <ShoppingBasket size={19} /><span className="header-cart__label">Basket</span>{cart.count > 0 && <b>{cart.count}</b>}
            </button>
            {role && <button className="logout-quiet" onClick={logout} type="button">Sign out</button>}
          </nav>
        </div>
        <div className="site-header__bottom">
          <div className="shell site-header__bottom-inner">
            <span className="neighborhood-note"><Sprout size={14} /> Fresh from your neighborhood</span>
            <nav className="secondary-nav" aria-label="Quick links">
              <Link to="/#ufd">UFD delivery</Link>
              <Link to="/buddy/login">Become a Buddy</Link>
              <Link to="/admin-access">Admin access</Link>
            </nav>
          </div>
        </div>
      </header>
      {locationOpen && <LocationDialog onClose={() => setLocationOpen(false)} onSave={setLocation} />}
    </>
  )
}

export function LocationDialog({ onClose, onSave }: {
  onClose: () => void
  onSave: (location: DeliveryLocation) => void
}) {
  const { location, requestBrowserLocation } = useDeliveryLocation()
  const [address, setAddress] = useState(location?.address ?? '')
  const [latitude, setLatitude] = useState(location?.latitude.toString() ?? '')
  const [longitude, setLongitude] = useState(location?.longitude.toString() ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function getCurrentLocation() {
    setBusy(true)
    setError('')
    try {
      const current = await requestBrowserLocation()
      onSave(current)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : formatApiError(reason))
    } finally {
      setBusy(false)
    }
  }

  function saveLocation(event: FormEvent) {
    event.preventDefault()
    const lat = Number(latitude)
    const lng = Number(longitude)
    if (!address.trim() || !Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      setError('Enter an address and valid latitude and longitude so we can check local Buddy availability.')
      return
    }
    onSave({ address: address.trim(), latitude: lat, longitude: lng })
    onClose()
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <motion.section className="location-dialog" role="dialog" aria-modal="true" aria-labelledby="location-title" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <button className="modal-close icon-button" type="button" aria-label="Close location dialog" onClick={onClose}><X size={19} /></button>
        <div className="dialog-symbol"><MapPin size={22} /></div>
        <p className="eyebrow">YOUR NEIGHBORHOOD, YOUR BUDDY</p>
        <h2 id="location-title">Where should we deliver?</h2>
        <p className="muted">Buddyyaa checks real local availability around your delivery location.</p>
        <button className="button button--outline button--wide" disabled={busy} onClick={() => void getCurrentLocation()} type="button">
          <MapPin size={17} /> {busy ? 'Finding your location…' : 'Use my current location'}
        </button>
        <div className="or-divider"><span>or enter it manually</span></div>
        <form className="form-stack" onSubmit={saveLocation}>
          <label>Delivery address<input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="House, street, neighborhood" required /></label>
          <div className="coordinates-row">
            <label>Latitude<input inputMode="decimal" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="19.8762" required /></label>
            <label>Longitude<input inputMode="decimal" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="75.3433" required /></label>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button--dark button--wide" type="submit">Save delivery location <ArrowRight size={17} /></button>
        </form>
      </motion.section>
    </div>
  )
}

export function ProductCard({ product, mode, buddyId, quantity = 0 }: {
  product: Product
  mode: 'normal' | 'ufd'
  buddyId?: string
  quantity?: number
}) {
  const cart = useCart()
  const [notice, setNotice] = useState('')
  const price = product.salePrice ?? product.price
  const addOne = () => {
    const added = cart.add(product, mode, buddyId)
    setNotice(added ? '' : 'This Buddy changed. Clear the UFD basket before adding items from another Buddy.')
  }

  return (
    <motion.article className="product-card" layout initial={{ opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -3 }}>
      <div className="product-card__image">
        {product.imageUrl
          ? <img src={product.imageUrl} alt={product.name} loading="lazy" />
          : <div className="product-image-placeholder"><Leaf size={29} /><span>Fresh pick</span></div>}
        {product.salePrice !== undefined && <span className="sale-tag">SPECIAL PRICE</span>}
      </div>
      <div className="product-card__body">
        {product.categoryName && <span className="product-card__category">{product.categoryName}</span>}
        <h3 title={product.name}>{product.name}</h3>
        <span className="product-card__unit">{product.unit || 'As listed'}</span>
        {mode === 'ufd' && product.availableQuantity !== undefined && <span className="product-card__stock">{product.availableQuantity} available from this Buddy</span>}
        <div className="product-card__buy">
          <div className="product-price">
            <strong>₹{price.toFixed(2)}</strong>
            {product.salePrice !== undefined && <del>₹{product.price.toFixed(2)}</del>}
          </div>
          {quantity > 0
            ? <div className="quantity-control" aria-label={`${quantity} ${product.name} in basket`}>
                <button aria-label={`Remove one ${product.name}`} onClick={() => cart.setQuantity(product.id, quantity - 1)} type="button"><Minus size={14} /></button>
                <span>{quantity}</span>
                <button aria-label={`Add one ${product.name}`} disabled={product.availableQuantity !== undefined && quantity >= product.availableQuantity} onClick={addOne} type="button"><Plus size={14} /></button>
              </div>
            : <button className="add-button" onClick={addOne} type="button" disabled={product.availableQuantity === 0}><Plus size={15} /> Add</button>}
        </div>
        {notice && <span className="product-notice" role="status">{notice}</span>}
      </div>
    </motion.article>
  )
}

export function PageHeading({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return <div className="page-heading">{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{children}</div>
}

export function EmptyState({ icon, title, message, action }: { icon?: ReactNode; title: string; message: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-state__icon">{icon ?? <Sprout size={25} />}</span><h2>{title}</h2><p>{message}</p>{action}</div>
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell site-footer__main">
        <div><Brand light /><p>Fresh local produce, brought closer by the Buddies who know your neighborhood.</p><span className="footer-city"><MapPin size={14} /> Chhatrapati Sambhajinagar, Maharashtra</span></div>
        <div className="footer-links"><strong>Explore</strong><Link to="/">Shop produce</Link><Link to="/orders">Track an order</Link><Link to="/buddy/login">Join as a Buddy</Link><Link to="/admin-access">Admin panel</Link></div>
        <div className="footer-note"><span className="footer-stamp">LOCAL<br />BY NATURE</span><p>Buddyyaa coordinates your order with independent local Buddies. Availability depends on your location and current stock.</p></div>
      </div>
      <div className="site-footer__bottom shell"><span>© {currentYear} Buddyyaa</span><span>Made for neighborhoods, with care.</span></div>
    </footer>
  )
}

export function FloatingCart() {
  const cart = useCart()
  const navigate = useNavigate()
  if (!cart.count) return null
  return (
    <AnimatePresence>
      <motion.button className="floating-cart" initial={{ y: 25, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 25, opacity: 0 }} onClick={() => navigate('/checkout')} type="button">
        <span><ShoppingBasket size={18} /> {cart.count} {cart.count === 1 ? 'item' : 'items'} · ₹{cart.subtotal.toFixed(2)}</span><strong>View basket <ArrowRight size={16} /></strong>
      </motion.button>
    </AnimatePresence>
  )
}
