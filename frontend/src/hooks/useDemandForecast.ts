import { useEffect, useRef, useState } from 'react'

import {
  predictAllPiles,
  type PilePrediction,
  type PredictedUtilization,
} from '@/api/ai'

interface ForecastState {
  byPileId: Record<string, PilePrediction>
  loading: boolean
  pileCount: number
  averageOccupancy: number
  averageConfidence: number
  error: string | null
  /** Unix ms of when the response was received. */
  generatedAt: number | null
}

const CACHE_KEY = 'hzev:lstm-batch:v2'
const CACHE_TTL_MS = 5 * 60_000

interface CachePayload extends Omit<PredictedUtilization, 'generated_at'> {
  cachedAt: number
}

function readCache(hoursAhead: number): CachePayload | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const c: CachePayload = JSON.parse(raw)
    if (c.hours_ahead !== hoursAhead) return null
    if (Date.now() - c.cachedAt > CACHE_TTL_MS) return null
    return c
  } catch {
    return null
  }
}

function writeCache(payload: CachePayload) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload))
  } catch {
    // ignore quota errors
  }
}

function indexByPile(predictions: PilePrediction[]): Record<string, PilePrediction> {
  const out: Record<string, PilePrediction> = {}
  for (const p of predictions) out[p.pile_id] = p
  return out
}

/**
 * Single-shot LSTM forecast for the whole pile population.
 *
 * Activates only when `enabled` is true (the homepage flips to predict
 * mode). 5-minute localStorage cache keeps mode-toggling cheap.
 */
export function useDemandForecast(hoursAhead: number, enabled: boolean): ForecastState {
  const [state, setState] = useState<ForecastState>({
    byPileId: {},
    loading: false,
    pileCount: 0,
    averageOccupancy: 0,
    averageConfidence: 0,
    error: null,
    generatedAt: null,
  })
  const cancelRef = useRef(false)

  useEffect(() => {
    cancelRef.current = false
    if (!enabled) return

    const cached = readCache(hoursAhead)
    if (cached) {
      setState({
        byPileId: indexByPile(cached.predictions),
        loading: false,
        pileCount: cached.pile_count,
        averageOccupancy: cached.average_predicted_occupancy,
        averageConfidence: cached.average_confidence,
        error: null,
        generatedAt: cached.cachedAt,
      })
      return
    }

    setState((s) => ({ ...s, loading: true, error: null }))

    predictAllPiles(hoursAhead)
      .then((data) => {
        if (cancelRef.current) return
        const cachedAt = Date.now()
        writeCache({
          hours_ahead: data.hours_ahead,
          pile_count: data.pile_count,
          average_predicted_occupancy: data.average_predicted_occupancy,
          average_confidence: data.average_confidence,
          predictions: data.predictions,
          cachedAt,
        })
        setState({
          byPileId: indexByPile(data.predictions),
          loading: false,
          pileCount: data.pile_count,
          averageOccupancy: data.average_predicted_occupancy,
          averageConfidence: data.average_confidence,
          error: null,
          generatedAt: cachedAt,
        })
      })
      .catch((err: unknown) => {
        if (cancelRef.current) return
        setState((s) => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : 'forecast failed',
        }))
      })

    return () => {
      cancelRef.current = true
    }
  }, [enabled, hoursAhead])

  return state
}
