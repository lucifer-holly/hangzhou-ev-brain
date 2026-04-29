import { useEffect, useRef, useState } from 'react'

import { getWsManager } from '@/api/ws'
import type { WsMessage } from '@/lib/websocket'

/**
 * Backend wire shape (see `backend/api/realtime.py::_broadcast_tick`):
 *   - `tick`      : 1× on connect, no payload of interest.
 *   - `telemetry` : 1× per second, `data.piles = [PileTickPoint, ...]` for ALL piles.
 *   - `event`     : 0..N per second, `pile_id` set, `data = GeneratedEvent`.
 */
export interface PileTickPoint {
  pile_id: string
  ts: string
  voltage: number
  current: number
  power: number
  occupancy_rate: number
  energy_delivered_kwh: number
  status: string
}

export interface WsEvent {
  pile_id: string
  type: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  ts: string
}

export interface UseWebSocketState {
  isConnected: boolean
  lastTickAt: string | null
  /** Latest 1-Hz telemetry indexed by pile id. */
  latestTelemetry: Record<string, PileTickPoint>
  /** Newest-first rolling buffer of events. */
  recentEvents: WsEvent[]
}

const EVENT_BUFFER = 50

/**
 * Subscribe to the singleton WebSocket fan-out and project incoming frames
 * into a small in-memory state. `Spawn 5/6/7` build richer state on top.
 *
 * Implementation notes:
 *   - The backend broadcasts an aggregated telemetry frame (all piles) once
 *     per second; this hook flattens it into a per-pile dictionary.
 *   - Events arrive as their own messages and are stored newest-first.
 *   - Connection flips to `true` on the first message, drops to `false` if
 *     the manager reports the socket is no longer open after 1.5s.
 */
export function useWebSocket(): UseWebSocketState {
  const [isConnected, setIsConnected] = useState(false)
  const [lastTickAt, setLastTickAt] = useState<string | null>(null)
  const [latestTelemetry, setLatestTelemetry] = useState<Record<string, PileTickPoint>>({})
  const [recentEvents, setRecentEvents] = useState<WsEvent[]>([])

  const eventsRef = useRef<WsEvent[]>([])

  useEffect(() => {
    const mgr = getWsManager()
    setIsConnected(mgr.isOpen)

    const unsubscribe = mgr.subscribe((msg: WsMessage) => {
      setLastTickAt(msg.timestamp)
      setIsConnected(true)

      if (msg.type === 'telemetry') {
        const payload = msg.data as { piles?: PileTickPoint[] } | PileTickPoint
        const piles = Array.isArray((payload as { piles?: PileTickPoint[] }).piles)
          ? (payload as { piles: PileTickPoint[] }).piles
          : (msg.pile_id
              ? [{ ...(payload as PileTickPoint), pile_id: msg.pile_id }]
              : [])
        if (piles.length === 0) return
        setLatestTelemetry((prev) => {
          const next = { ...prev }
          for (const p of piles) next[p.pile_id] = p
          return next
        })
        return
      }

      if (msg.type === 'event' && msg.pile_id) {
        const evt = { ...(msg.data as WsEvent), pile_id: msg.pile_id }
        eventsRef.current = [evt, ...eventsRef.current].slice(0, EVENT_BUFFER)
        setRecentEvents(eventsRef.current)
      }
    })

    const interval = setInterval(() => setIsConnected(mgr.isOpen), 1500)

    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [])

  return { isConnected, lastTickAt, latestTelemetry, recentEvents }
}
