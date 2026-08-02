const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')

export type GameSocketStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

export type GameSocketEvent = {
	type: 'game.event'
	event: string
	match_id: number
	match_status: string
	occurred_at: string
}

type Subscriber = {
	onEvent: (event: GameSocketEvent) => void
	onStatus?: (status: GameSocketStatus) => void
}

const subscribers = new Set<Subscriber>()
const reconnectDelays = [1000, 2000, 5000, 10000, 20000, 30000]

let socket: WebSocket | null = null
let status: GameSocketStatus = 'disconnected'
let reconnectAttempt = 0
let reconnectTimer: number | null = null
let heartbeatTimer: number | null = null
let closeTimer: number | null = null
let browserListenersAttached = false

function socketUrl() {
	const explicitUrl = process.env.NEXT_PUBLIC_WS_URL?.trim()
	const baseUrl = explicitUrl || API_URL.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
	return new URL('/ws/games/', `${baseUrl}/`).toString()
}

function updateStatus(nextStatus: GameSocketStatus) {
	status = nextStatus
	subscribers.forEach((subscriber) => subscriber.onStatus?.(nextStatus))
}

function clearHeartbeat() {
	if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer)
	heartbeatTimer = null
}

function clearReconnect() {
	if (reconnectTimer !== null) window.clearTimeout(reconnectTimer)
	reconnectTimer = null
}

function scheduleReconnect() {
	if (subscribers.size === 0 || reconnectTimer !== null) return
	updateStatus('reconnecting')
	const delay = reconnectDelays[Math.min(reconnectAttempt, reconnectDelays.length - 1)]
	reconnectAttempt += 1
	reconnectTimer = window.setTimeout(() => {
		reconnectTimer = null
		connect()
	}, delay)
}

function connect() {
	if (typeof window === 'undefined' || subscribers.size === 0) return
	if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return

	clearReconnect()
	updateStatus(reconnectAttempt === 0 ? 'connecting' : 'reconnecting')
	const nextSocket = new WebSocket(socketUrl())
	socket = nextSocket

	nextSocket.addEventListener('open', () => {
		if (socket !== nextSocket) return
		reconnectAttempt = 0
		updateStatus('connected')
		clearHeartbeat()
		heartbeatTimer = window.setInterval(() => {
			if (nextSocket.readyState === WebSocket.OPEN) nextSocket.send(JSON.stringify({ type: 'ping' }))
		}, 25000)
	})

	nextSocket.addEventListener('message', (message) => {
		try {
			const payload = JSON.parse(message.data) as GameSocketEvent | { type: string }
			if (payload.type === 'game.event') {
				subscribers.forEach((subscriber) => subscriber.onEvent(payload as GameSocketEvent))
			}
		} catch {
			// Ignore malformed server messages and keep the live connection open.
		}
	})

	nextSocket.addEventListener('close', () => {
		if (socket !== nextSocket) return
		socket = null
		clearHeartbeat()
		if (subscribers.size > 0) scheduleReconnect()
		else updateStatus('disconnected')
	})

	nextSocket.addEventListener('error', () => {
		if (nextSocket.readyState !== WebSocket.CLOSED) nextSocket.close()
	})
}

function reconnectNow() {
	if (subscribers.size === 0) return
	clearReconnect()
	if (!socket || socket.readyState === WebSocket.CLOSED) connect()
}

function attachBrowserListeners() {
	if (browserListenersAttached) return
	window.addEventListener('online', reconnectNow)
	document.addEventListener('visibilitychange', reconnectNow)
	browserListenersAttached = true
}

function detachBrowserListeners() {
	if (!browserListenersAttached) return
	window.removeEventListener('online', reconnectNow)
	document.removeEventListener('visibilitychange', reconnectNow)
	browserListenersAttached = false
}

export function subscribeGameSocket(subscriber: Subscriber) {
	if (typeof window === 'undefined') return () => undefined
	if (closeTimer !== null) window.clearTimeout(closeTimer)
	closeTimer = null
	subscribers.add(subscriber)
	subscriber.onStatus?.(status)
	attachBrowserListeners()
	connect()

	return () => {
		subscribers.delete(subscriber)
		if (subscribers.size > 0) return
		closeTimer = window.setTimeout(() => {
			if (subscribers.size > 0) return
			clearReconnect()
			clearHeartbeat()
			detachBrowserListeners()
			socket?.close(1000, 'No game subscribers')
			socket = null
			reconnectAttempt = 0
			updateStatus('disconnected')
		}, 300)
	}
}
