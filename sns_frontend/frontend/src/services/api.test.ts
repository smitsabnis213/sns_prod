import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, normalizeOrder, normalizeProduct, setAccessToken } from './api'

afterEach(() => {
  vi.unstubAllGlobals()
  setAccessToken(null)
  sessionStorage.clear()
})

describe('Buddyyaa API normalization and checkout', () => {
  it('uses the server product price and only accepts a lower valid sale price', () => {
    expect(normalizeProduct({ _id: 'p-1', name: 'Tomatoes', price: 40, salePrice: 32, unit: '500 g' })).toMatchObject({
      id: 'p-1',
      name: 'Tomatoes',
      price: 40,
      salePrice: 32,
      unit: '500 g',
    })
    expect(normalizeProduct({ id: 'p-2', price: 40, salePrice: 48 }).salePrice).toBeUndefined()
  })

  it('maps the backend product and order fields without losing server totals or references', () => {
    expect(normalizeProduct({
      _id: 'p-3',
      name: 'Apples',
      image: 'https://example.test/apples.jpg',
      price: 120,
      discountPrice: 110,
      quantity: '1 kg',
      category: { _id: 'c-1', name: 'Fruits' },
    })).toMatchObject({
      id: 'p-3',
      salePrice: 110,
      unit: '1 kg',
      categoryId: 'c-1',
      categoryName: 'Fruits',
    })
    expect(normalizeOrder({
      _id: 'mongo-order-id',
      orderId: 'ORDR00001',
      totalPrice: 90,
      deliveryType: 'UFD',
      deliveryLocation: { latitude: 19.87, longitude: 75.34, address: 'Home' },
      deliveryPersonLocation: { latitude: 19.88, longitude: 75.35 },
      buddy: { _id: 'buddy-1', name: 'Asha' },
      items: [{ product: { _id: 'p-3', name: 'Apples' }, quantity: 1, price: 90 }],
    })).toMatchObject({
      id: 'mongo-order-id',
      orderNumber: 'ORDR00001',
      total: 90,
      address: 'Home',
      destination: { latitude: 19.87, longitude: 75.34 },
      buddyLocation: { latitude: 19.88, longitude: 75.35 },
      buddyId: 'buddy-1',
    })
  })

  it('preserves the backend order status and selected Buddy in order details', () => {
    const order = normalizeOrder({
      _id: 'order-1',
      orderStatus: 'on_the_way',
      assignedBuddy: { _id: 'buddy-1', name: 'Meena' },
      items: [{ productId: 'p-1', name: 'Tomatoes', quantity: 2, price: 35 }],
    })
    expect(order).toMatchObject({
      id: 'order-1',
      status: 'on_the_way',
      buddyId: 'buddy-1',
      items: [{ productId: 'p-1', quantity: 2, price: 35 }],
    })
    expect(normalizeOrder({ status: 'preparing' }).allowedStatuses).toEqual(['arriving', 'out_for_delivery', 'cancelled'])
  })

  it('submits the backend checkout contract and reuses the same idempotency key on retry', async () => {
    const fetchMock = vi.fn().mockImplementation(() => new Response(JSON.stringify({
      data: { order: { id: 'order-99', status: 'created', totalAmount: 70, items: [] } },
    }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const input = {
      deliveryType: 'UFD' as const,
      items: [{ productId: 'p-1', quantity: 2 }],
      deliveryLocation: { address: 'Test address', latitude: 19.87, longitude: 75.34 },
      selectedBuddyId: 'buddy-1',
      idempotencyKey: 'same-logical-checkout',
    }

    await api.createOrder(input)
    await api.createOrder(input)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const first = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit]
    const second = fetchMock.mock.calls[1] as [RequestInfo | URL, RequestInit]
    expect(first[0]).toBe('/orders/create')
    expect(JSON.parse(String(first[1].body))).toEqual({
      deliveryType: 'UFD',
      items: [{ productId: 'p-1', quantity: 2 }],
      deliveryLocation: { address: 'Test address', latitude: 19.87, longitude: 75.34 },
      selectedBuddyId: 'buddy-1',
      idempotencyKey: 'same-logical-checkout',
    })
    expect(JSON.parse(String(second[1].body))).toEqual(JSON.parse(String(first[1].body)))
  })

  it('does not claim success when the server omits its created order identifier', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { total: 70 } }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.createOrder({
      deliveryType: 'NORMAL',
      items: [{ productId: 'p-1', quantity: 1 }],
      deliveryLocation: { address: 'Test address', latitude: 19.87, longitude: 75.34 },
      idempotencyKey: 'normal-attempt',
    })).rejects.toMatchObject({ code: 'INVALID_ORDER_RESPONSE' })
  })

  it('uses the Buddy email login contract and stores the returned refresh token for this tab', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      accessToken: 'buddy-access',
      refreshToken: 'buddy-refresh',
      user: { _id: 'buddy-1', name: 'Asha', email: 'asha@example.test', role: 'Buddy' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await api.login('buddy', { email: 'asha@example.test', password: 'secret' })
    const request = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit]

    expect(request[0]).toBe('/auth/buddy/login')
    expect(JSON.parse(String(request[1].body))).toEqual({ email: 'asha@example.test', password: 'secret' })
    expect(result.user).toMatchObject({ id: 'buddy-1', role: 'Buddy' })
    expect(sessionStorage.getItem('buddyyaa-refresh-token')).toBe('buddy-refresh')
  })

  it('loads Buddy-owned inventory and updates only available quantities', async () => {
    const inventory = {
      _id: 'inventory-1',
      buddy: 'buddy-1',
      product: { _id: 'product-1', name: 'Apples', quantity: '1 kg' },
      availableQuantity: 4,
      reservedQuantity: 2,
      isActive: true,
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ buddyId: 'buddy-1', inventory: [inventory] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ inventory: { ...inventory, availableQuantity: 3 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.buddyInventory()).resolves.toEqual([{
      id: 'inventory-1',
      productId: 'product-1',
      productName: 'Apples',
      unit: '1 kg',
      availableQuantity: 4,
      reservedQuantity: 2,
      isActive: true,
    }])
    await expect(api.updateBuddyInventory('product-1', 3)).resolves.toMatchObject({
      productId: 'product-1',
      availableQuantity: 3,
      reservedQuantity: 2,
    })

    expect(fetchMock.mock.calls[0][0]).toBe('/buddies/me/inventory')
    expect(fetchMock.mock.calls[1][0]).toBe('/buddies/me/inventory')
    expect(fetchMock.mock.calls[1][1].method).toBe('PATCH')
    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body))).toEqual({
      productId: 'product-1',
      availableQuantity: 3,
    })
  })

  it('refreshes an expired access token before retrying the authenticated profile request', async () => {
    sessionStorage.setItem('buddyyaa-refresh-token', 'old-refresh')
    setAccessToken('expired-access')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'expired access token' }), { status: 401, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: 'new-access', refreshToken: 'new-refresh' }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ user: { _id: 'customer-1', role: 'Customer' } }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await api.me()

    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body))).toEqual({ refreshToken: 'old-refresh' })
    expect(new Headers(fetchMock.mock.calls[2][1].headers).get('Authorization')).toBe('Bearer new-access')
    expect(sessionStorage.getItem('buddyyaa-refresh-token')).toBe('new-refresh')
  })

  it('normalizes the backend order envelope and tracking fields', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        order: { _id: 'mongo-id', orderId: 'ORDR00001', totalPrice: 75, status: 'pending' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        tracking: {
          deliveryLocation: { latitude: 19.87, longitude: 75.34, address: 'Home' },
          deliveryPersonLocation: { latitude: 19.88, longitude: 75.35 },
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const order = await api.order('mongo-id')
    const tracking = await api.tracking('mongo-id')

    expect(order).toMatchObject({ id: 'mongo-id', orderNumber: 'ORDR00001', total: 75 })
    expect(tracking).toMatchObject({
      address: 'Home',
      destination: { latitude: 19.87, longitude: 75.34 },
      buddyLocation: { latitude: 19.88, longitude: 75.35 },
    })
  })

  it('surfaces an expired session after the backend rejects the refresh token', async () => {
    sessionStorage.setItem('buddyyaa-refresh-token', 'expired-refresh-token')
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'expired' }), { status: 401, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response('', { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)
    const expired = vi.fn()
    window.addEventListener('buddyyaa:session-expired', expired)

    await expect(api.products()).rejects.toMatchObject({ status: 401 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(expired).toHaveBeenCalledTimes(1)
    window.removeEventListener('buddyyaa:session-expired', expired)
  })
})
