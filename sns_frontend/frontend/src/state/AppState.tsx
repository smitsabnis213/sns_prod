import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, formatApiError, normalizeUser, restoreSession, setAccessToken, ApiError } from '../services/api'
import type { AccountRole, DeliveryLocation, DeliveryMode, Product, User } from '../types'
import {
  addCartLine,
  clearCart,
  initialCart,
  removeCartLine,
  setCartQuantity,
  type CartLine,
  type CartState,
} from './cart'

interface AuthContextValue {
  user: User | null
  role: AccountRole | null
  loading: boolean
  sessionNotice: string | null
  login: (role: AccountRole, credentials: Record<string, string>) => Promise<void>
  logout: () => void
  updateUser: (user: User) => void
  clearSessionNotice: () => void
}

interface CartContextValue {
  state: CartState
  lines: CartLine[]
  count: number
  subtotal: number
  setMode: (mode: DeliveryMode) => void
  add: (product: Product, mode?: DeliveryMode, buddyId?: string) => boolean
  setQuantity: (productId: string, quantity: number) => void
  remove: (productId: string) => void
  clear: (mode?: DeliveryMode) => void
  replaceLines: (lines: CartLine[], mode: DeliveryMode, buddyId?: string) => void
  refreshProducts: (products: Product[], mode?: DeliveryMode) => void
  syncUfdCatalogue: (buddyId: string, buddyName: string, products: Product[]) => void
}

interface DeliveryContextValue {
  location: DeliveryLocation | null
  setLocation: (location: DeliveryLocation) => void
  requestBrowserLocation: () => Promise<DeliveryLocation>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const CartContext = createContext<CartContextValue | null>(null)
const DeliveryContext = createContext<DeliveryContextValue | null>(null)
const CART_STORAGE_KEY = 'buddyyaa-cart-v1'
const LOCATION_STORAGE_KEY = 'buddyyaa-delivery-location-v1'

function readCart(): CartState {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY)
    if (!stored) return initialCart
    const value = JSON.parse(stored) as Partial<CartState>
    return {
      mode: value.mode === 'ufd' ? 'ufd' : 'normal',
      normal: Array.isArray(value.normal) ? value.normal : [],
      ufd: Array.isArray(value.ufd) ? value.ufd : [],
      ufdBuddyId: typeof value.ufdBuddyId === 'string' ? value.ufdBuddyId : undefined,
      ufdBuddyName: typeof value.ufdBuddyName === 'string' ? value.ufdBuddyName : undefined,
    }
  } catch {
    return initialCart
  }
}

function readLocation(): DeliveryLocation | null {
  try {
    const value = JSON.parse(localStorage.getItem(LOCATION_STORAGE_KEY) ?? 'null') as DeliveryLocation | null
    if (
      value && typeof value.address === 'string' &&
      Number.isFinite(value.latitude) && Number.isFinite(value.longitude)
    ) return value
    return null
  } catch {
    return null
  }
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<AccountRole | null>(null)
  const [authLoading, setAuthLoading] = useState(() => {
    const savedRole = sessionStorage.getItem('buddyyaa-role')
    return savedRole === 'customer' || savedRole === 'buddy'
  })
  const [sessionNotice, setSessionNotice] = useState<string | null>(null)
  const [cart, setCart] = useState<CartState>(readCart)
  const [location, setLocationState] = useState<DeliveryLocation | null>(readLocation)

  useEffect(() => {
    const savedRole = sessionStorage.getItem('buddyyaa-role')
    if (savedRole !== 'customer' && savedRole !== 'buddy') {
      sessionStorage.removeItem('buddyyaa-role')
      return
    }
    let active = true
    void (async () => {
      try {
        const refreshed = await restoreSession()
        if (!refreshed) {
          sessionStorage.removeItem('buddyyaa-role')
          return
        }
        const current = await api.me()
        const restoredUser = normalizeUser(current)
        const actualRole = restoredUser.role?.toLocaleLowerCase()
        if ((actualRole === 'customer' || actualRole === 'buddy') && actualRole !== savedRole) {
          sessionStorage.removeItem('buddyyaa-role')
          setSessionNotice('Your saved sign-in no longer matches this account. Please sign in again.')
          return
        }
        if (active && restoredUser.id) {
          setUser(restoredUser)
          setRole(savedRole)
        } else if (active) {
          sessionStorage.removeItem('buddyyaa-role')
        }
      } catch (reason) {
        if (reason instanceof ApiError && [401, 403].includes(reason.status)) {
          sessionStorage.removeItem('buddyyaa-role')
          setSessionNotice('Your session has expired. Please sign in again.')
        } else {
          setSessionNotice(formatApiError(reason))
        }
      } finally {
        if (active) setAuthLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  useEffect(() => {
    const expired = () => {
      setAccessToken(null)
      sessionStorage.removeItem('buddyyaa-role')
      setUser(null)
      setRole(null)
      setSessionNotice('Your session has expired. Please sign in again.')
    }
    window.addEventListener('buddyyaa:session-expired', expired)
    return () => window.removeEventListener('buddyyaa:session-expired', expired)
  }, [])

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
  }, [cart])

  useEffect(() => {
    if (location) localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location))
  }, [location])

  const login = useCallback(async (nextRole: AccountRole, credentials: Record<string, string>) => {
    const result = await api.login(nextRole, credentials)
    if (!result.user.id) throw new Error('The sign-in response did not include a valid account.')
    setUser(result.user)
    setRole(nextRole)
    setSessionNotice(null)
    sessionStorage.setItem('buddyyaa-role', nextRole)
  }, [])

  const logout = useCallback(() => {
    void api.logout()
    sessionStorage.removeItem('buddyyaa-role')
    setUser(null)
    setRole(null)
  }, [])
  const updateUser = useCallback((nextUser: User) => setUser(nextUser), [])
  const clearSessionNotice = useCallback(() => setSessionNotice(null), [])
  const syncUfdCatalogue = useCallback((buddyId: string, buddyName: string, products: Product[]) => {
    const byId = new Map(products.map((product) => [product.id, product]))
    setCart((current) => {
      if (current.ufd.length > 0 && current.ufdBuddyId && current.ufdBuddyId !== buddyId) return current
      const ufd = current.ufd.map((line) => {
        const product = byId.get(line.product.id)
        return product ? { ...line, product } : line
      })
      return { ...current, ufd, ufdBuddyId: buddyId, ufdBuddyName: buddyName }
    })
  }, [])

  const refreshCartProducts = useCallback((products: Product[], mode?: DeliveryMode) => {
    const byId = new Map(products.map((product) => [product.id, product]))
    setCart((current) => {
      const merge = (lines: CartLine[]) => lines.map((line) => {
        const product = byId.get(line.product.id)
        return product ? { ...line, product } : line
      })
      return {
        ...current,
        ...(mode !== 'ufd' ? { normal: merge(current.normal) } : {}),
        ...(mode !== 'normal' ? { ufd: merge(current.ufd) } : {}),
      }
    })
  }, [])

  const cartValue = useMemo<CartContextValue>(() => {
    const lines = cart.mode === 'ufd' ? cart.ufd : cart.normal
    const count = lines.reduce((total, line) => total + line.quantity, 0)
    const subtotal = lines.reduce(
      (total, line) => total + (line.product.salePrice ?? line.product.price) * line.quantity,
      0,
    )
    return {
      state: cart,
      lines,
      count,
      subtotal,
      setMode: (mode) => setCart((current) => ({ ...current, mode })),
      add: (product, mode = cart.mode, buddyId) => {
        const next = addCartLine(cart, product, mode, buddyId)
        if (next === cart) return false
        setCart(next)
        return true
      },
      setQuantity: (productId, quantity) => setCart((current) => setCartQuantity(current, productId, quantity)),
      remove: (productId) => setCart((current) => removeCartLine(current, productId)),
      clear: (mode = cart.mode) => setCart((current) => clearCart(current, mode)),
      replaceLines: (lines, mode, buddyId) => setCart((current) => ({
        ...current,
        [mode === 'ufd' ? 'ufd' : 'normal']: lines,
        ...(mode === 'ufd' ? { ufdBuddyId: buddyId } : {}),
      })),
      syncUfdCatalogue,
      refreshProducts: refreshCartProducts,
    }
  }, [cart, refreshCartProducts, syncUfdCatalogue])

  const requestBrowserLocation = useCallback(() => new Promise<DeliveryLocation>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not available in this browser. Enter your delivery address and coordinates instead.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({
        address: 'My current location',
        latitude: coords.latitude,
        longitude: coords.longitude,
      }),
      (error) => reject(new Error(
        error.code === error.PERMISSION_DENIED
          ? 'Location permission was denied. You can enter your location manually.'
          : 'We could not get your location. Please try again or enter it manually.',
      )),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    )
  }), [])

  const setLocation = useCallback((next: DeliveryLocation) => setLocationState(next), [])

  return (
    <AuthContext.Provider value={{ user, role, loading: authLoading, sessionNotice, login, logout, updateUser, clearSessionNotice }}>
      <CartContext.Provider value={cartValue}>
        <DeliveryContext.Provider value={{ location, setLocation, requestBrowserLocation }}>
          {children}
        </DeliveryContext.Provider>
      </CartContext.Provider>
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AppStateProvider')
  return context
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart must be used within AppStateProvider')
  return context
}

export function useDeliveryLocation() {
  const context = useContext(DeliveryContext)
  if (!context) throw new Error('useDeliveryLocation must be used within AppStateProvider')
  return context
}
