/**
 * Singleton WebSocket manager bound to the configured `VITE_WS_URL`.
 *
 * Lazily started — the first call to `getWsManager()` opens the socket.
 * Hooks (`useWebSocket`) subscribe to it; HMR keeps the same instance
 * across reloads thanks to module caching.
 */
import { env } from '@/lib/env'
import { WsManager } from '@/lib/websocket'

let _manager: WsManager | null = null

export function getWsManager(): WsManager {
  if (!_manager) {
    _manager = new WsManager({ url: env.wsUrl })
    _manager.start()
  }
  return _manager
}
