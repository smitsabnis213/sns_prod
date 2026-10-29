import { describe, expect, it } from 'vitest'
import type { Product } from '../types'
import {
  addCartLine,
  cartCount,
  cartTotal,
  clearCart,
  initialCart,
  setCartQuantity,
} from './cart'

function product(id: string, price: number, availableQuantity?: number): Product {
  return { id, name: `Product ${id}`, price, unit: '1 kg', availableQuantity }
}

describe('shared basket rules', () => {
  it('keeps separate normal and UFD baskets and totals backend product prices', () => {
    let cart = addCartLine(initialCart, product('tomato', 35), 'normal')
    cart = addCartLine(cart, product('mango', 60), 'normal')
    cart = addCartLine(cart, product('okra', 28), 'ufd', 'buddy-a')

    expect(cart.normal).toHaveLength(2)
    expect(cart.ufd).toHaveLength(1)
    expect(cart.ufdBuddyId).toBe('buddy-a')
    expect(cartTotal(cart.normal)).toBe(95)
    expect(cartCount(cart.normal)).toBe(2)
  })
  it('does not mix UFD products from different Buddies', () => {
    const first = addCartLine(initialCart, product('tomato', 35), 'ufd', 'buddy-a')
    const second = addCartLine(first, product('mango', 60), 'ufd', 'buddy-b')

    expect(second).toBe(first)
    expect(second.ufd.map((line) => line.product.id)).toEqual(['tomato'])
    expect(second.ufdBuddyId).toBe('buddy-a')
  })

  it('caps quantities at known available stock and removes zero quantities', () => {
    let cart = addCartLine(initialCart, product('tomato', 35, 1), 'normal')
    expect(addCartLine(cart, product('tomato', 35, 1), 'normal')).toBe(cart)

    cart = setCartQuantity(cart, 'tomato', 0)
    expect(cart.normal).toHaveLength(0)
  })

  it('clears only the requested delivery-mode basket', () => {
    let cart = addCartLine(initialCart, product('tomato', 35), 'normal')
    cart = addCartLine(cart, product('okra', 28), 'ufd', 'buddy-a')
    const next = clearCart(cart, 'ufd')

    expect(next.normal).toHaveLength(1)
    expect(next.ufd).toHaveLength(0)
    expect(next.ufdBuddyId).toBeUndefined()
  })
})
