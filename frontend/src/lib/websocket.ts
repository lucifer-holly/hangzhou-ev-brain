/**
 * Pure WebSocket helper used by the `useWebSocket` hook.
 *
 * Auto-reconnect with exponential backoff capped at 30s, jittered to avoid
 * thundering-herd on a backend restart. Consumers register message
 * subscribers; closing the manager tears the socket down without firing
 * a reconnect.
 */

export type WsListener = (msg: WsMessage) => void

export interface WsMessage<T = unknown> {
  type: 'telemetry' | 'event' | 'tick' | string
  pile_id?: string
  timestamp: string
  data: T
}

export interface WsManagerOptions {
  url: string
  onOpen?: () => void
  onClose?: () => void
  onError?: (err: Event) => void
}

export class WsManager {
  private ws: WebSocket | null = null
  private listeners = new Set<WsListener>()
  private retryAttempt = 0
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private closed = false

  constructor(private readonly opts: WsManagerOptions) {}

  start(): void {
    this.closed = false
    this.connect()
  }

  stop(): void {
    this.closed = true
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
    this.ws?.close()
    this.ws = null
  }

  subscribe(listener: WsListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  get isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  private connect(): void {
    try {
      this.ws = new WebSocket(this.opts.url)
    } catch (err) {
      this.scheduleReconnect()
      this.opts.onError?.(err as Event)
      return
    }

    this.ws.onopen = () => {
      this.retryAttempt = 0
      this.opts.onOpen?.()
    }

    this.ws.onmessage = (e: MessageEvent<string>) => {
      try {
        const msg = JSON.parse(e.data) as WsMessage
        this.listeners.forEach((l) => l(msg))
      } catch {
        // Ignore malformed frames; backend always sends JSON.
      }
    }

    this.ws.onerror = (e) => {
      this.opts.onError?.(e)
    }

    this.ws.onclose = () => {
      this.opts.onClose?.()
      if (!this.closed) this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    if (this.closed) return
    const base = Math.min(30_000, 500 * 2 ** this.retryAttempt)
    const jitter = Math.random() * 0.3 * base
    const delay = base + jitter
    this.retryAttempt += 1
    this.retryTimer = setTimeout(() => this.connect(), delay)
  }
}
