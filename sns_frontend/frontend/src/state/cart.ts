import type { DeliveryMode, Product } from '../types'

export interface CartLine {
  product: Product
  quantity: number
}

export interface CartState {
  mode: DeliveryMode
  normal: CartLine[]
  ufd: CartLine[]
  ufdBuddyId?: string
  ufdBuddyName?: string
}

export const initialCart: CartState = { mode: 'normal', normal: [], ufd: [] }

export function lineTotal(line: CartLine) {
  return (line.product.salePrice ?? line.product.price) * line.quantity
}

export function cartTotal(lines: CartLine[]) {
  return lines.reduce((total, line) => total + lineTotal(line), 0)
}

export function cartCount(lines: CartLine[]) {
  return lines.reduce((total, line) => total + line.quantity, 0)
}

export function addCartLine(
  state: CartState,
  product: Product,
  mode: DeliveryMode,
  buddyId?: string,
): CartState {
  if (mode === 'ufd' && (!buddyId || (state.ufdBuddyId && state.ufdBuddyId !== buddyId))) return state
  const key = mode === 'ufd' ? 'ufd' : 'normal'
  const lines = [...state[key]]
  const existing = lines.find((line) => line.product.id === product.id)
  const quantity = (existing?.quantity ?? 0) + 1
  if (product.availableQuantity !== undefined && quantity > product.availableQuantity) return state
  if (existing) {
    existing.quantity = quantity
    existing.product = product
  } else {
    lines.push({ product, quantity: 1 })
  }
  return {
    ...state,
    [key]: lines,
    ...(mode === 'ufd' ? { ufdBuddyId: buddyId } : {}),
  }
}

export function setCartQuantity(
  state: CartState,
  productId: string,
  quantity: number,
  mode = state.mode,
): CartState {
  const key = mode === 'ufd' ? 'ufd' : 'normal'
  const lines = state[key]
    .map((line) => line.product.id === productId ? { ...line, quantity } : line)
    .filter((line) => line.quantity > 0)
  return { ...state, [key]: lines, ...(key === 'ufd' && lines.length === 0 ? { ufdBuddyId: undefined, ufdBuddyName: undefined } : {}) }
}

export function removeCartLine(state: CartState, productId: string, mode = state.mode): CartState {
  return setCartQuantity(state, productId, 0, mode)
}

export function clearCart(state: CartState, mode = state.mode): CartState {
  return mode === 'ufd'
    ? { ...state, ufd: [], ufdBuddyId: undefined, ufdBuddyName: undefined }
    : { ...state, normal: [] }
}

export function refreshCartProducts(state: CartState, products: Product[]): CartState {
  const byId = new Map(products.map((product) => [product.id, product]))
  const merge = (lines: CartLine[]) => lines.map((line) => {
    const fresh = byId.get(line.product.id)
    return fresh ? { ...line, product: fresh } : line
  })
  return { ...state, normal: merge(state.normal), ufd: merge(state.ufd) }
}
