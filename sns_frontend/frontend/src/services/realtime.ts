import { io, type Socket } from 'socket.io-client'
import { getAccessToken } from './api'

const socketUrl = (import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

function connectAuthenticatedSocket(): Socket | undefined {
  const token = getAccessToken()
  if (!socketUrl || !token) return undefined
  return io(socketUrl, {
    autoConnect: true,
    withCredentials: true,
    transports: ['websocket', 'polling'],
    auth: { token },
  })
}

export function createOrderRealtime(
  orderId: string,
  refresh: () => void,
  onConnection: (connected: boolean) => void,
): () => void {
  const socket = connectAuthenticatedSocket()
  if (!socket) {
    onConnection(false)
    return () => undefined
  }

  let firstConnection = true
  const refreshOnReconnect = () => {
    const reconnecting = !firstConnection
    firstConnection = false
    onConnection(false)
    socket.emit('order:join', { orderId }, (response: { joined?: boolean; error?: string }) => {
      onConnection(response?.joined === true)
      if (reconnecting) refresh()
    })
  }
  const disconnected = () => onConnection(false)
  const connectionFailed = () => onConnection(false)
  const refreshPersistedOrder = () => refresh()

  socket.on('connect', refreshOnReconnect)
  socket.on('disconnect', disconnected)
  socket.on('connect_error', connectionFailed)
  socket.on('order:status', refreshPersistedOrder)
  socket.on('order:assignment', refreshPersistedOrder)
  socket.on('delivery:location', refreshPersistedOrder)

  return () => {
    socket.off('connect', refreshOnReconnect)
    socket.off('disconnect', disconnected)
    socket.off('connect_error', connectionFailed)
    socket.off('order:status', refreshPersistedOrder)
    socket.off('order:assignment', refreshPersistedOrder)
    socket.off('delivery:location', refreshPersistedOrder)
    socket.disconnect()
  }
}

export function createBuddyRealtime(refresh: () => void): () => void {
  const socket = connectAuthenticatedSocket()
  if (!socket) return () => undefined
  let firstConnection = true
  const reconnect = () => {
    if (firstConnection) {
      firstConnection = false
      return
    }
    refresh()
  }
  const refreshAssignedOrders = () => refresh()
  socket.on('connect', reconnect)
  socket.on('order:available', refreshAssignedOrders)
  return () => {
    socket.off('connect', reconnect)
    socket.off('order:available', refreshAssignedOrders)
    socket.disconnect()
  }
}
